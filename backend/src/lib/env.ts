const REQUIRED = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "FRONTEND_URL",
] as const;

export function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[Env] Eksik zorunlu değişkenler: ${missing.join(", ")}`);
    console.error("[Env] Uygulama başlatılamadı.");
    process.exit(1);
  }

  if (process.env.JWT_SECRET!.length < 32) {
    console.warn(
      `[Env] UYARI: JWT_SECRET ${process.env.JWT_SECRET!.length} karakter — minimum 32 karakter olmalı!`
    );
  }
  if (process.env.JWT_REFRESH_SECRET!.length < 32) {
    console.warn(
      `[Env] UYARI: JWT_REFRESH_SECRET ${process.env.JWT_REFRESH_SECRET!.length} karakter — minimum 32 karakter olmalı!`
    );
  }

  console.log("[Env] Tüm ortam değişkenleri doğrulandı.");
}
