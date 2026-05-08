const REQUIRED = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "FRONTEND_URL",
] as const;

const MAIL_VARS = ["MAIL_HOST", "MAIL_PORT", "MAIL_USER", "MAIL_PASS", "MAIL_FROM"] as const;

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

  if (!process.env.PORT) {
    console.warn("[Env] PORT tanımlı değil, varsayılan 3001 kullanılacak.");
  }
  if (!process.env.NODE_ENV) {
    console.warn("[Env] NODE_ENV tanımlı değil, geliştirme modu varsayılıyor.");
  }

  const missingMail = MAIL_VARS.filter((k) => !process.env[k]);
  if (missingMail.length > 0) {
    console.warn(`[Env] Mail değişkenleri eksik (${missingMail.join(", ")}) — haftalık mail bildirimleri devre dışı.`);
  }

  console.info("[Env] Tüm ortam değişkenleri doğrulandı.");
}
