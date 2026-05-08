import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[Hata]", err.message, err.stack);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Bu kayıt zaten mevcut" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Kayıt bulunamadı" });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "İlişkili kayıt bulunamadı" });
    }
    return res.status(400).json({ error: `Veritabanı hatası (${err.code})` });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: "Geçersiz veri formatı" });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json({ error: "Veritabanına bağlanılamadı" });
  }

  const status = (err as any).status ?? 500;
  const message = status < 500 ? err.message : "Sunucu hatası oluştu";
  res.status(status).json({ error: message });
}
