import cron from "node-cron";
import { prisma } from "../lib/prisma";

async function cleanupExpiredTokens() {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      console.info(`[Cleanup] ${result.count} süresi dolmuş token silindi`);
    }
  } catch (err) {
    console.error("[Cleanup] Token temizleme hatası:", err);
  }
}

export function startCleanupJob() {
  // Her gece 03:00 — Istanbul saati
  cron.schedule("0 3 * * *", cleanupExpiredTokens, { timezone: "Europe/Istanbul" });
  console.info("Cleanup job kuruldu — Her gece 03:00 Istanbul");
}
