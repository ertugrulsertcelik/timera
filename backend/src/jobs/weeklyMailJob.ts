import cron from "node-cron";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma";

async function sendWeeklySummary() {
  const pendingCount = await prisma.timeEntry.count({ where: { status: "PENDING" } });
  if (pendingCount === 0) {
    console.log("Haftalik mail: bekleyen giris yok, mail gonderilmedi");
    return;
  }

  const managers = await prisma.user.findMany({ where: { role: "MANAGER", isActive: true } });

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });

  for (const manager of managers) {
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: manager.email,
      subject: `Timesheet — ${pendingCount} onay bekliyor`,
      html: `
        <p>Merhaba ${manager.name},</p>
        <p>Bu hafta <strong>${pendingCount}</strong> zaman girisi onayinizi bekliyor.</p>
        <p>
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/approvals"
             style="background:#3C3489;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;">
            Onay ekranina git
          </a>
        </p>
        <hr/>
        <p style="font-size:12px;color:#888;">Timesheet — otomatik bildirim</p>
      `,
    });
  }

  console.log(`Haftalik mail gonderildi — ${pendingCount} bekleyen giris, ${managers.length} yonetici`);
}

export function startCronJobs() {
  // Her Cuma 17:00 — Istanbul saati
  cron.schedule("0 17 * * 5", sendWeeklySummary, { timezone: "Europe/Istanbul" });
  console.log("Cron job kuruldu — Her Cuma 17:00 Istanbul");
}
