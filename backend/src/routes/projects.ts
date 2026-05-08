import { Router, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireManager } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

const projectSchema = z.object({
  name: z.string().min(1, "Proje adı boş olamaz").max(100, "Proje adı en fazla 100 karakter olabilir"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Geçersiz renk kodu (örn: #3C3489)"),
  description: z.string().max(500, "Açıklama en fazla 500 karakter olabilir").optional(),
});

// Aktif projeler — tüm kullanıcılar
router.get("/", requireAuth, async (_req, res, next: NextFunction) => {
  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// Tüm projeler (pasifler dahil) — sadece manager
router.get("/all", requireAuth, requireManager, async (_req, res, next: NextFunction) => {
  try {
    const projects = await prisma.project.findMany({ orderBy: { name: "asc" } });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const project = await prisma.project.create({ data: parsed.data });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = projectSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/deactivate", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// DELETE /projects/:id — proje sil (manager) — entry varsa engelle
router.delete("/:id", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const entryCount = await prisma.timeEntry.count({ where: { projectId: req.params.id } });
    if (entryCount > 0) {
      return res.status(400).json({
        error: `Bu projeye ait ${entryCount} giriş var. Silmek yerine pasife alabilirsiniz.`,
      });
    }
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { router as projectsRouter };
