import { Router, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireManager } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { fireWebhookEvent } from "../services/webhookService";

const router = Router();

const ALL_EVENTS = ["ENTRY_SUBMITTED", "ENTRY_APPROVED", "ENTRY_REJECTED", "LEAVE_APPROVED", "LEAVE_REJECTED"] as const;

const webhookSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["SLACK", "TEAMS"]),
  url: z.string().url("Geçerli bir URL girin"),
  events: z.array(z.enum(ALL_EVENTS)).min(1, "En az bir olay seçin"),
  isActive: z.boolean().optional().default(true),
});

// GET /webhooks — tüm webhook konfigürasyonları
router.get("/", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const hooks = await prisma.webhookConfig.findMany({ orderBy: { createdAt: "desc" } });
    res.json(hooks);
  } catch (err) { next(err); }
});

// POST /webhooks — yeni webhook ekle
router.post("/", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const hook = await prisma.webhookConfig.create({ data: parsed.data });
    res.status(201).json(hook);
  } catch (err) { next(err); }
});

// PUT /webhooks/:id — güncelle
router.put("/:id", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = webhookSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const hook = await prisma.webhookConfig.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(hook);
  } catch (err) { next(err); }
});

// DELETE /webhooks/:id — sil
router.delete("/:id", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    await prisma.webhookConfig.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /webhooks/:id/test — test mesajı gönder
router.post("/:id/test", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const hook = await prisma.webhookConfig.findUnique({ where: { id: req.params.id } });
    if (!hook) return res.status(404).json({ error: "Webhook bulunamadı" });

    const { fireWebhookEvent: fire } = await import("../services/webhookService");
    await fire("ENTRY_SUBMITTED", {
      userName: "Test Kullanıcı",
      detail: "Bu bir test mesajıdır — Timera webhook testi",
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export { router as webhooksRouter };
