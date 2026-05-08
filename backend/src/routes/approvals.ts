import { Router, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireManager, AuthRequest } from "../middleware/auth";
import { awardXP } from "../services/gamificationService";
import { fireWebhookEvent } from "../services/webhookService";
import { prisma } from "../lib/prisma";

const router = Router();

const rejectSchema = z.object({
  note: z.string().max(500, "Not en fazla 500 karakter olabilir").optional(),
});

router.get("/", requireAuth, requireManager, async (_req, res, next: NextFunction) => {
  try {
    const entries = await prisma.timeEntry.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.status !== "PENDING")
      return res.status(400).json({ error: "Onaylanacak giriş bulunamadı" });

    await prisma.$transaction([
      prisma.timeEntry.update({ where: { id: entry.id }, data: { status: "APPROVED" } }),
      prisma.approval.create({
        data: { entryId: entry.id, managerId: req.user!.id, action: "approved" },
      }),
    ]);

    await awardXP(entry.userId, entry.startTime, entry.endTime, entry.date, prisma);

    // Webhook
    const approvedUser = await prisma.user.findUnique({ where: { id: entry.userId }, select: { name: true } });
    fireWebhookEvent("ENTRY_APPROVED", {
      userName: approvedUser?.name ?? "Bilinmiyor",
      detail: `${entry.date} tarihli ${entry.startTime}–${entry.endTime} girişi onaylandı`,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", requireAuth, requireManager, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.status !== "PENDING")
      return res.status(400).json({ error: "Reddedilecek giriş bulunamadı" });

    await prisma.$transaction([
      prisma.timeEntry.update({ where: { id: entry.id }, data: { status: "REJECTED" } }),
      prisma.approval.create({
        data: { entryId: entry.id, managerId: req.user!.id, action: "rejected", note: parsed.data.note },
      }),
    ]);

    // Webhook
    const rejectedUser = await prisma.user.findUnique({ where: { id: entry.userId }, select: { name: true } });
    fireWebhookEvent("ENTRY_REJECTED", {
      userName: rejectedUser?.name ?? "Bilinmiyor",
      detail: `${entry.date} tarihli ${entry.startTime}–${entry.endTime} girişi reddedildi`,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { router as approvalsRouter };
