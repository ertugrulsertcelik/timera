import { Router, NextFunction, Request } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().email("Geçersiz e-posta adresi"),
  password: z.string().min(1, "Şifre gerekli"),
});

function getIP(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "bilinmiyor"
  );
}

// POST /auth/login
// Rate limit: loginLimiter (index.ts'de uygulanır)
router.post("/login", async (req, res, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Geçersiz istek" });

    const { email, password } = parsed.data;
    const ip = getIP(req);

    const user = await prisma.user.findUnique({ where: { email } });

    // Kullanıcı yoksa genel hata (timing attack'ı önlemek için dummy bcrypt)
    if (!user || !user.isActive) {
      await bcrypt.compare(password, "$2a$10$dummyhashfordummycomparison00000000000000000");
      console.warn(`[Auth] Başarısız giriş — kullanıcı bulunamadı: ${email} IP: ${ip}`);
      return res.status(401).json({ error: "E-posta veya şifre hatalı" });
    }

    // Hesap kilitli mi?
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      console.warn(`[Auth] Kilitli hesaba giriş denemesi: ${email} IP: ${ip}`);
      return res.status(423).json({
        error: `Hesap kilitlendi. ${remaining} dakika sonra tekrar deneyin.`,
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      const attempts = user.loginAttempts + 1;
      const shouldLock = attempts >= MAX_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
            : user.lockedUntil,
        },
      });
      console.warn(
        `[Auth] Başarısız giriş (${attempts}/${MAX_ATTEMPTS}): ${email} IP: ${ip}${shouldLock ? " — HESAP KİLİTLENDİ" : ""}`
      );
      if (shouldLock) {
        return res.status(423).json({
          error: `Çok fazla hatalı deneme. Hesap ${LOCK_MINUTES} dakika kilitlendi.`,
        });
      }
      return res.status(401).json({
        error: `E-posta veya şifre hatalı. ${MAX_ATTEMPTS - attempts} deneme hakkı kaldı.`,
      });
    }

    // Başarılı giriş — kilidi sıfırla
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });

    console.info(`[Auth] Başarılı giriş: ${email} IP: ${ip}`);
    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword },
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh — refresh token rotation
// Rate limit: refreshLimiter (index.ts'de uygulanır)
router.post("/refresh", async (req, res, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Token gerekli" });

    let payload: { id: string };
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string };
    } catch {
      return res.status(401).json({ error: "Geçersiz token" });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
      return res.status(401).json({ error: "Token süresi dolmuş, tekrar giriş yapın" });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive)
      return res.status(401).json({ error: "Kullanıcı bulunamadı veya hesap devre dışı" });

    // Token rotation: eskiyi sil, yenisini yaz
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const newRefreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { userId: user.id, token: newRefreshToken, expiresAt },
    });

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" }
    );

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post("/logout", async (req, res, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
