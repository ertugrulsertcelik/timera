import { Router, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { checkOverlap } from "../services/overlapService";
import { awardXP } from "../services/gamificationService";
import { fireWebhookEvent } from "../services/webhookService";
import { prisma } from "../lib/prisma";

const router = Router();

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(d: string) {
  const parsed = new Date(d);
  return !isNaN(parsed.getTime()) && d === parsed.toISOString().slice(0, 10);
}

const entryBaseSchema = z.object({
  projectId: z.string().min(1, "Proje seçilmeli"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD formatında olmalı")
    .refine(isValidDate, "Geçersiz tarih"),
  startTime: z.string().regex(timeRegex, "Geçersiz başlangıç saati"),
  endTime: z.string().regex(timeRegex, "Geçersiz bitiş saati"),
  note: z.string().max(500, "Not en fazla 500 karakter olabilir").default(""),
});

const entrySchema = entryBaseSchema.refine((d) => d.startTime < d.endTime, {
  message: "Başlangıç saati bitiş saatinden küçük olmalı",
  path: ["startTime"],
});

const submitSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD formatında olmalı")
    .refine(isValidDate, "Geçersiz tarih"),
});

// Haftanın girişleri — ?week=2025-W18
// Manager, ?userId=xxx ile başkasının girişlere bakabilir
router.get("/", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const { week, userId } = req.query;
    const targetUserId = req.user!.role === "MANAGER" && userId ? String(userId) : req.user!.id;

    let dateFilter = {};
    if (week) {
      const [year, weekNum] = String(week).split("-W").map(Number);
      if (!year || !weekNum || weekNum < 1 || weekNum > 53) {
        return res.status(400).json({ error: "Geçersiz hafta formatı (örn: 2025-W18)" });
      }
      const jan4 = new Date(year, 0, 4);
      const startOfWeek = new Date(jan4);
      startOfWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7);
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        dates.push(d.toISOString().slice(0, 10));
      }
      dateFilter = { date: { in: dates } };
    }

    const entries = await prisma.timeEntry.findMany({
      where: { userId: targetUserId, ...dateFilter },
      include: { project: true, approval: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { projectId, date, startTime, endTime, note } = parsed.data;
    const userId = req.user!.id;

    const overlap = await checkOverlap(userId, date, startTime, endTime, prisma);
    if (overlap) return res.status(409).json({ error: "Bu saatte başka bir giriş var" });

    const entry = await prisma.timeEntry.create({
      data: { userId, projectId, date, startTime, endTime, note },
      include: { project: true },
    });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// Güncelle — sadece DRAFT veya REJECTED
router.put("/:id", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.userId !== req.user!.id)
      return res.status(404).json({ error: "Giriş bulunamadı" });
    if (!["DRAFT", "PENDING", "REJECTED"].includes(entry.status))
      return res.status(400).json({ error: "Onaylanan giriş düzenlenemez" });

    const parsed = entryBaseSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { startTime, endTime, date } = parsed.data;

    // startTime < endTime kontrolü (ikisi de verilmişse)
    const effectiveStart = startTime ?? entry.startTime;
    const effectiveEnd = endTime ?? entry.endTime;
    if (effectiveStart >= effectiveEnd) {
      return res.status(400).json({ error: "Başlangıç saati bitiş saatinden küçük olmalı" });
    }

    if (startTime || endTime) {
      const overlap = await checkOverlap(
        req.user!.id,
        date ?? entry.date,
        effectiveStart,
        effectiveEnd,
        prisma,
        entry.id
      );
      if (overlap) return res.status(409).json({ error: "Bu saatte başka bir giriş var" });
    }

    const updated = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: { ...parsed.data, status: "DRAFT" },
      include: { project: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Günü onaya gönder
router.post("/submit", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { date } = parsed.data;
    const updated = await prisma.timeEntry.updateMany({
      where: { userId: req.user!.id, date, status: "DRAFT" },
      data: { status: "PENDING" },
    });

    if (updated.count === 0)
      return res.status(400).json({ error: "Gönderilecek taslak giriş yok" });

    // Webhook
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } }).then((u) => {
      fireWebhookEvent("ENTRY_SUBMITTED", {
        userName: u?.name ?? "Bilinmiyor",
        detail: `${date} tarihli ${updated.count} giriş onaya gönderildi`,
      });
    }).catch(() => {});

    res.json({ submitted: updated.count });
  } catch (err) {
    next(err);
  }
});

// Sil — sadece DRAFT
router.delete("/:id", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.userId !== req.user!.id)
      return res.status(404).json({ error: "Giriş bulunamadı" });
    if (entry.status !== "DRAFT")
      return res.status(400).json({ error: "Sadece taslak girişler silinebilir" });

    await prisma.timeEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { router as entriesRouter };
