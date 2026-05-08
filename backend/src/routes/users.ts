import { Router, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth, requireManager, AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(1, "Ad boş olamaz").max(100, "Ad en fazla 100 karakter olabilir"),
  email: z.string().email("Geçersiz e-posta adresi"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  role: z.enum(["EMPLOYEE", "MANAGER"]),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(["EMPLOYEE", "MANAGER"]).optional(),
  isActive: z.boolean().optional(),
  weeklyTargetHours: z.number().min(1).max(80).optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre gerekli"),
  newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalı"),
});

const initialPasswordSchema = z.object({
  newPassword: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

// GET /users — tüm kullanıcılar (manager)
router.get("/", requireAuth, requireManager, async (_req, res, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, weeklyTargetHours: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /users — yeni kullanıcı (manager)
router.post("/", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { name, email, password, role } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Bu e-posta zaten kullanılıyor" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name, email, passwordHash, role,
        mustChangePassword: true, // ilk girişte şifre değiştirmesi zorunlu
        gamification: { create: { xpTotal: 0, streakDays: 0 } },
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /users/me/set-initial-password — ilk giriş şifre belirleme (mevcut şifre gerekmez)
router.put("/me/set-initial-password", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    if (!user.mustChangePassword) return res.status(403).json({ error: "Bu işlem yetkiniz yok" });

    const parsed = initialPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PUT /users/me/password — kendi şifresini değiştir
// NOT: Bu route /:id'den önce tanımlanmalı
router.put("/me/password", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { currentPassword, newPassword } = parsed.data;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: "Mevcut şifre hatalı" });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PUT /users/:id — kullanıcı güncelle (manager)
router.put("/:id", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (parsed.data.email) {
      const existing = await prisma.user.findFirst({
        where: { email: parsed.data.email, NOT: { id: req.params.id } },
      });
      if (existing) return res.status(409).json({ error: "Bu e-posta zaten kullanılıyor" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /users/:id/reset-password — şifre sıfırla (manager)
router.post("/:id/reset-password", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash, mustChangePassword: true }, // sıfırlanan şifreyle giriş yapınca tekrar değiştirmesi gerekir
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id — kullanıcı sil (manager) — tüm ilişkili veriler cascade silinir
router.delete("/:id", requireAuth, requireManager, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user!.id) {
      return res.status(400).json({ error: "Kendi hesabınızı silemezsiniz" });
    }

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId: targetId } });
      await tx.badge.deleteMany({ where: { userId: targetId } });
      await tx.gamification.deleteMany({ where: { userId: targetId } });
      // Kullanıcının entry'lerinin onaylarını sil
      const entryIds = (await tx.timeEntry.findMany({ where: { userId: targetId }, select: { id: true } })).map((e) => e.id);
      if (entryIds.length > 0) {
        await tx.approval.deleteMany({ where: { entryId: { in: entryIds } } });
      }
      await tx.timeEntry.deleteMany({ where: { userId: targetId } });
      // Manager olarak yaptığı onayları sil
      await tx.approval.deleteMany({ where: { managerId: targetId } });
      await tx.user.delete({ where: { id: targetId } });
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { router as usersRouter };
