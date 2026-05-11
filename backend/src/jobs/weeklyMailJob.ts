import cron from "node-cron";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma";

async function sendWeeklySummary() {
  if (!process.env.MAIL_HOST) {
    console.info("Haftalik mail: MAIL_HOST tanimli degil, atlanıyor.");
    return;
  }

  const pendingCount = await prisma.timeEntry.count({ where: { status: "PENDING" } });
  if (pendingCount === 0) {
    console.info("Haftalik mail: bekleyen giris yok, mail gonderilmedi");
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

  console.info(`Haftalik mail gonderildi — ${pendingCount} bekleyen giris, ${managers.length} yonetici`);
}

async function sendScheduledReports() {
  if (!process.env.MAIL_HOST) return;

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const todayDow = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const isFirstOfMonth = now.getDate() === 1;

  const schedules = await prisma.reportSchedule.findMany({
    where: { isActive: true },
    include: { manager: { select: { name: true } } },
  });

  if (schedules.length === 0) return;

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });

  for (const sched of schedules) {
    const shouldSend =
      (sched.frequency === "WEEKLY"  && sched.dayOfWeek === todayDow) ||
      (sched.frequency === "MONTHLY" && isFirstOfMonth);

    if (!shouldSend) continue;

    // Build a quick summary for the email
    const period = sched.frequency === "MONTHLY"
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      : `Bu Hafta`;

    const approvedCount = await prisma.timeEntry.count({ where: { status: "APPROVED" } });
    const pendingCount  = await prisma.timeEntry.count({ where: { status: "PENDING"  } });

    const html = `
      <p>Merhaba,</p>
      <p><strong>${sched.manager.name}</strong> tarafindan ayarlanan otomatik Timera raporu (${period}):</p>
      <ul>
        <li>Onaylanan giris sayisi: <strong>${approvedCount}</strong></li>
        <li>Onay bekleyen giris: <strong>${pendingCount}</strong></li>
      </ul>
      <p>
        <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/reports"
           style="background:#2563EB;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;">
          Raporlara git
        </a>
      </p>
      <hr/>
      <p style="font-size:12px;color:#888;">Timera — otomatik zamanlama bildirimi</p>
    `;

    for (const email of sched.emails) {
      try {
        await transporter.sendMail({
          from: process.env.MAIL_FROM,
          to: email,
          subject: `Timera Otomatik Rapor — ${period}`,
          html,
        });
      } catch (err) {
        console.error(`[ScheduledReport] Mail gönderilemedi: ${email}`, err);
      }
    }

    console.info(`[ScheduledReport] Gönderildi — ${sched.id}, ${sched.emails.length} alıcı`);
  }
}

export function startCronJobs() {
  // Her Cuma 17:00 — Istanbul saati
  cron.schedule("0 17 * * 5", sendWeeklySummary, { timezone: "Europe/Istanbul" });
  console.info("Cron job kuruldu — Her Cuma 17:00 Istanbul");

  // Her gün 08:00 — zamanlanmış rapor kontrolü
  cron.schedule("0 8 * * *", sendScheduledReports, { timezone: "Europe/Istanbul" });
  console.info("Cron job kuruldu — Her gün 08:00 Istanbul (zamanlanmış raporlar)");
}
