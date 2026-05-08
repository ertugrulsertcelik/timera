import rateLimit from "express-rate-limit";

const turkishMessage = (msg: string) => ({
  handler: (_req: any, res: any) => res.status(429).json({ error: msg }),
});

/** /auth/login → 5 istek / 3 dakika / IP */
export const loginLimiter = rateLimit({
  windowMs: 3 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  ...turkishMessage("Çok fazla giriş denemesi. 3 dakika sonra tekrar deneyin."),
});

/** /auth/refresh → 20 istek / 15 dakika / IP */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  ...turkishMessage("Çok fazla token yenileme isteği. 15 dakika sonra tekrar deneyin."),
});

/** Genel API → 100 istek / 15 dakika / IP */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  ...turkishMessage("Çok fazla istek gönderildi. 15 dakika sonra tekrar deneyin."),
  skip: (req) => req.path === "/health",
});
