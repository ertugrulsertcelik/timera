import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { validateEnv } from "./lib/env";
import { authRouter } from "./routes/auth";
import { projectsRouter } from "./routes/projects";
import { entriesRouter } from "./routes/entries";
import { approvalsRouter } from "./routes/approvals";
import { reportsRouter } from "./routes/reports";
import { gamificationRouter } from "./routes/gamification";
import { usersRouter } from "./routes/users";
import { leavesRouter } from "./routes/leaves";
import { webhooksRouter } from "./routes/webhooks";
import { startCronJobs } from "./jobs/weeklyMailJob";
import { startCleanupJob } from "./jobs/cleanupJob";
import { errorHandler } from "./middleware/errorHandler";
import { trimmer } from "./middleware/trimmer";
import { loginLimiter, refreshLimiter, apiLimiter } from "./middleware/rateLimiter";

// ── Ortam değişkeni doğrulama (en önce çalışmalı) ─────────────────────────────
validateEnv();

// ── Unhandled hataları yakala ─────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[UnhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[UncaughtException]", err);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === "production";

// ── HTTP Güvenlik Headerları ───────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    xFrameOptions: { action: "deny" },
    xContentTypeOptions: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: '${origin}' izin verilmiyor`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Logging ───────────────────────────────────────────────────────────────────
// Hassas bilgiler (şifre, token) request body'de olur — Morgan body loglamaz,
// sadece method/url/status/response-time loglanır.
app.use(morgan(isProd ? "combined" : "dev"));

// ── Body parsing & sanitization ───────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(trimmer);

// ── Genel API rate limit ──────────────────────────────────────────────────────
app.use(apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/auth/login", loginLimiter);
app.use("/auth/refresh", refreshLimiter);

app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/entries", entriesRouter);
app.use("/approvals", approvalsRouter);
app.use("/reports", reportsRouter);
app.use("/gamification", gamificationRouter);
app.use("/users", usersRouter);
app.use("/leaves", leavesRouter);
app.use("/webhooks", webhooksRouter);
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint bulunamadı" });
});

// ── Global error handler (en sonda olmalı) ────────────────────────────────────
app.use(errorHandler);

// ── Server ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.info(`Backend çalışıyor → http://localhost:${PORT}`);
  startCronJobs();
  startCleanupJob();
});
