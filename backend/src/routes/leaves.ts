import { Router, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireManager, AuthRequest } from "../middleware/auth";
import { fireWebhookEvent } from "../services/webhookService";
import { prisma } from "../lib/prisma";

const router = Router();

const createLeaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih formatı (YYYY-MM-DD)"),
  type: z.enum(["ANNUAL", "SICK", "UNPAID", "PUBLIC_HOLIDAY"]),
  note: z.string().max(500).optional(),
});

const rejectLeaveSchema = z.object({
  note: z.string().max(500).optional(),
});

function weekToDates(week: string): string[] {
  const [year, weekNum] = week.split("-W").map(Number);
  const jan4 = new Date(year, 0, 4);
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// GET /leaves — employee: kendi, manager: tümü (opsiyonel ?userId= veya ?week= filtresi)
router.get("/", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const { userId, week } = req.query as { userId?: string; week?: string };
    const isManager = req.user!.role === "MANAGER";

    const where: Record<string, unknown> = {};
    if (!isManager) {
      where.userId = req.user!.id;
    } else if (userId) {
      where.userId = userId;
    }
    if (week && /^\d{4}-W\d{1,2}$/.test(week)) {
      where.date = { in: weekToDates(week) };
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        user:    { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });
    res.json(leaves);
  } catch (err) {
    next(err);
  }
});

// GET /leaves/balance/:userId — izin bakiyesi
router.get("/balance/:userId", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const { userId } = req.params;
    if (req.user!.id !== userId && req.user!.role !== "MANAGER") {
      return res.status(403).json({ error: "Yetkiniz yok" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { annualLeaveDays: true },
    });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const year = new Date().getFullYear();
    const gte = `${year}-01-01`;
    const lte = `${year}-12-31`;

    const [annualUsed, sickUsed, unpaidUsed] = await Promise.all([
      prisma.leaveRequest.count({ where: { userId, type: "ANNUAL",  status: "APPROVED", date: { gte, lte } } }),
      prisma.leaveRequest.count({ where: { userId, type: "SICK",    status: "APPROVED", date: { gte, lte } } }),
      prisma.leaveRequest.count({ where: { userId, type: "UNPAID",  status: "APPROVED", date: { gte, lte } } }),
    ]);

    res.json({
      annualRemaining: user.annualLeaveDays,
      annualUsed,
      sickUsed,
      unpaidUsed,
    });
  } catch (err) {
    next(err);
  }
});

// POST /leaves — izin talebi oluştur
router.post("/", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const parsed = createLeaveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { date, type, note } = parsed.data;
    const userId = req.user!.id;

    const existing = await prisma.leaveRequest.findUnique({
      where: { userId_date: { userId, date } },
    });
    if (existing) return res.status(409).json({ error: "Bu tarih için zaten bir izin talebiniz var" });

    const leave = await prisma.leaveRequest.create({
      data: { userId, date, type, note },
      include: { user: { select: { id: true, name: true } } },
    });
    res.status(201).json(leave);
  } catch (err) {
    next(err);
  }
});

// POST /leaves/:id/approve — onayla (manager)
router.post("/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!leave) return res.status(404).json({ error: "İzin talebi bulunamadı" });
    if (leave.status !== "PENDING") return res.status(400).json({ error: "Bu talep zaten işlenmiş" });

    await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({
        where: { id: leave.id },
        data: { status: "APPROVED", managerId: req.user!.id },
      });
      if (leave.type === "ANNUAL") {
        await tx.user.update({
          where: { id: leave.userId },
          data: { annualLeaveDays: { decrement: 1 } },
        });
      }
    });

    // Webhook
    const approvedUser = await prisma.user.findUnique({ where: { id: leave.userId }, select: { name: true } });
    fireWebhookEvent("LEAVE_APPROVED", {
      userName: approvedUser?.name ?? "Bilinmiyor",
      detail: `${leave.date} tarihli ${leave.type} izin talebi onaylandı`,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /leaves/:id/reject — reddet (manager)
router.post("/:id/reject", requireAuth, requireManager, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const parsed = rejectLeaveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!leave) return res.status(404).json({ error: "İzin talebi bulunamadı" });
    if (leave.status !== "PENDING") return res.status(400).json({ error: "Bu talep zaten işlenmiş" });

    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { status: "REJECTED", managerId: req.user!.id, managerNote: parsed.data.note },
    });

    // Webhook
    const rejectedUser = await prisma.user.findUnique({ where: { id: leave.userId }, select: { name: true } });
    fireWebhookEvent("LEAVE_REJECTED", {
      userName: rejectedUser?.name ?? "Bilinmiyor",
      detail: `${leave.date} tarihli ${leave.type} izin talebi reddedildi`,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /leaves/:id — iptal et (sadece PENDING, sadece kendi)
router.delete("/:id", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!leave) return res.status(404).json({ error: "İzin talebi bulunamadı" });
    if (leave.userId !== req.user!.id) return res.status(403).json({ error: "Bu talebi iptal etme yetkiniz yok" });
    if (leave.status !== "PENDING") return res.status(400).json({ error: "Sadece bekleyen talepler iptal edilebilir" });

    await prisma.leaveRequest.delete({ where: { id: leave.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { router as leavesRouter };
