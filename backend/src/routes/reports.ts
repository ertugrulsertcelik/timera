import { Router, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireManager } from "../middleware/auth";
import { generateExcel } from "../services/exportService";
import { generateWeeklyPdf, generateMonthlyPdf } from "../services/pdfService";
import { prisma } from "../lib/prisma";

const router = Router();

const monthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const weekQuerySchema = z.object({
  week: z.string().regex(/^\d{4}-W\d{1,2}$/, "Geçersiz hafta formatı (örn: 2025-W18)"),
  userId: z.string().optional(),
});

// Proje x kullanıcı bazlı efor raporu — ?year=2025&month=5
router.get("/effort", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = monthQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const year = parsed.data.year ?? new Date().getFullYear();
    const month = parsed.data.month ?? new Date().getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-31`;

    const entries = await prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, status: "APPROVED" },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });

    const effortMap: Record<string, Record<string, number>> = {};
    for (const e of entries) {
      const [sh, sm] = e.startTime.split(":").map(Number);
      const [eh, em] = e.endTime.split(":").map(Number);
      const minutes = (eh * 60 + em) - (sh * 60 + sm);
      const projKey = `${e.project.id}|${e.project.name}|${e.project.color}`;
      const userKey = `${e.user.id}|${e.user.name}`;
      if (!effortMap[projKey]) effortMap[projKey] = {};
      effortMap[projKey][userKey] = (effortMap[projKey][userKey] || 0) + minutes;
    }

    const result = Object.entries(effortMap).map(([proj, users]) => {
      const [id, name, color] = proj.split("|");
      return {
        project: { id, name, color },
        users: Object.entries(users).map(([u, minutes]) => {
          const [uid, uname] = u.split("|");
          return { id: uid, name: uname, hours: Math.round((minutes / 60) * 10) / 10 };
        }),
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Çalışan özet — aylık toplam saat
router.get("/summary", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = monthQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const year = parsed.data.year ?? new Date().getFullYear();
    const month = parsed.data.month ?? new Date().getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-31`;

    const users = await prisma.user.findMany({
      where: { isActive: true, role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        entries: {
          where: { date: { gte: start, lte: end }, status: "APPROVED" },
          select: { startTime: true, endTime: true },
        },
      },
    });

    const summary = users.map((u) => {
      const totalMin = u.entries.reduce((acc, e) => {
        const [sh, sm] = e.startTime.split(":").map(Number);
        const [eh, em] = e.endTime.split(":").map(Number);
        return acc + (eh * 60 + em) - (sh * 60 + sm);
      }, 0);
      return { id: u.id, name: u.name, hours: Math.round((totalMin / 60) * 10) / 10 };
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Excel export — ?week=2025-W18
router.get("/export/excel", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = weekQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { week, userId } = parsed.data;
    const buffer = await generateExcel(week, prisma, userId || null);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="timesheet-${week}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// PDF haftalık export — ?week=2025-W18&userId=...
router.get("/export/pdf/weekly", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = weekQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { week, userId } = parsed.data;
    const buffer = await generateWeeklyPdf(week, prisma, userId || null);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="timesheet-haftalik-${week}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// PDF aylık export — ?year=2025&month=5&userId=...
router.get("/export/pdf/monthly", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const schema = monthQuerySchema.extend({ userId: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const year = parsed.data.year ?? new Date().getFullYear();
    const month = parsed.data.month ?? new Date().getMonth() + 1;
    const buffer = await generateMonthlyPdf(year, month, prisma, parsed.data.userId || null);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="timesheet-aylik-${year}-${String(month).padStart(2, "0")}.pdf"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export { router as reportsRouter };
