import { Router, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireManager } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

const scheduleSchema = z.object({
  frequency: z.enum(["WEEKLY", "MONTHLY"]),
  dayOfWeek: z.number().int().min(0).max(6),
  emails: z.array(z.string().email()).min(1),
  filters: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
});

// GET /reports/schedule — list manager's schedules
router.get("/", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const managerId = (req as any).user.id;
    const schedules = await prisma.reportSchedule.findMany({
      where: { managerId },
      orderBy: { createdAt: "desc" },
    });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
});

// POST /reports/schedule — create schedule
router.post("/", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const managerId = (req as any).user.id;
    const { filters, ...rest } = parsed.data;
    const schedule = await prisma.reportSchedule.create({
      data: { ...rest, filters: filters as any, managerId },
    });
    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
});

// PUT /reports/schedule/:id — update schedule
router.put("/:id", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = scheduleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const managerId = (req as any).user.id;
    const existing = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Zamanlama bulunamadı" });
    if (existing.managerId !== managerId) return res.status(403).json({ error: "Bu zamanlamayı düzenleme yetkiniz yok" });

    const { filters: f2, ...rest2 } = parsed.data;
    const updated = await prisma.reportSchedule.update({
      where: { id: req.params.id },
      data: { ...rest2, ...(f2 !== undefined ? { filters: f2 as any } : {}) },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /reports/schedule/:id — delete schedule
router.delete("/:id", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const managerId = (req as any).user.id;
    const existing = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Zamanlama bulunamadı" });
    if (existing.managerId !== managerId) return res.status(403).json({ error: "Bu zamanlamayı silme yetkiniz yok" });

    await prisma.reportSchedule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as reportScheduleRouter };
