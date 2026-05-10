import rateLimit from "express-rate-limit";

const turkishMessage = (msg: string) => ({
  handler: (_req: any, res: any) => res.status(429).json({ error: msg }),
});

/** /auth/login → 10 istek / 5 dakika / IP */
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  ...turkishMessage("Çok fazla giriş denemesi, 5 dakika sonra tekrar deneyin"),
});

/** /auth/refresh → 30 istek / 1 dakika / IP */
export const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  ...turkishMessage("Çok fazla token yenileme isteği. 1 dakika sonra tekrar deneyin."),
});

/** Genel API → 120 istek / 1 dakika / IP */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  ...turkishMessage("Çok fazla istek gönderildi. 1 dakika sonra tekrar deneyin."),
  skip: (req) => req.path === "/health",
});
