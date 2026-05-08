import puppeteer from "puppeteer";
import { PrismaClient } from "@prisma/client";
import { buildPdfHtml } from "./pdfTemplate";

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function minsOfEntry(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function weekToRange(week: string): { start: string; end: string; label: string } {
  const [yearStr, wStr] = week.split("-W");
  const year = parseInt(yearStr);
  const w = parseInt(wStr);
  // ISO week: find Jan 4 (always in week 1), then compute Monday of week w
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    label: `${fmt(monday)} – ${fmt(sunday)}`,
  };
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export async function generateWeeklyPdf(
  week: string,
  prisma: PrismaClient,
  userId?: string | null
): Promise<Buffer> {
  const { start, end, label } = weekToRange(week);

  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(userId ? { userId } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { name: true, color: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const isAllUsers = !userId;
  let subtitle = `Haftalık Rapor — ${label}`;
  if (!isAllUsers && entries[0]) {
    subtitle = `${entries[0].user.name} — ${label}`;
  }

  const totalMinutes = entries.reduce((s, e) => s + minsOfEntry(e.startTime, e.endTime), 0);
  const approvedMinutes = entries
    .filter((e) => e.status === "APPROVED")
    .reduce((s, e) => s + minsOfEntry(e.startTime, e.endTime), 0);

  const now = new Date();
  const generatedAt = `${now.toLocaleDateString("tr-TR")} ${now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;

  const data = {
    title: `Haftalık Rapor`,
    subtitle,
    generatedAt,
    totalMinutes,
    approvedMinutes,
    isAllUsers,
    entries: entries.map((e) => ({
      date: formatDate(e.date),
      dayName: DAY_NAMES[new Date(e.date + "T00:00:00").getDay()],
      startTime: e.startTime,
      endTime: e.endTime,
      durationMin: minsOfEntry(e.startTime, e.endTime),
      projectName: e.project.name,
      projectColor: e.project.color,
      note: e.note,
      status: e.status,
      userName: e.user.name,
    })),
  };

  return renderHtmlToPdf(buildPdfHtml(data));
}

export async function generateMonthlyPdf(
  year: number,
  month: number,
  prisma: PrismaClient,
  userId?: string | null
): Promise<Buffer> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;
  const monthNames = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(userId ? { userId } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { name: true, color: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const isAllUsers = !userId;
  let subtitle = `Aylık Rapor — ${monthNames[month - 1]} ${year}`;
  if (!isAllUsers && entries[0]) {
    subtitle = `${entries[0].user.name} — ${monthNames[month - 1]} ${year}`;
  }

  const totalMinutes = entries.reduce((s, e) => s + minsOfEntry(e.startTime, e.endTime), 0);
  const approvedMinutes = entries
    .filter((e) => e.status === "APPROVED")
    .reduce((s, e) => s + minsOfEntry(e.startTime, e.endTime), 0);

  const now = new Date();
  const generatedAt = `${now.toLocaleDateString("tr-TR")} ${now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;

  const data = {
    title: `Aylık Rapor`,
    subtitle,
    generatedAt,
    totalMinutes,
    approvedMinutes,
    isAllUsers,
    entries: entries.map((e) => ({
      date: formatDate(e.date),
      dayName: DAY_NAMES[new Date(e.date + "T00:00:00").getDay()],
      startTime: e.startTime,
      endTime: e.endTime,
      durationMin: minsOfEntry(e.startTime, e.endTime),
      projectName: e.project.name,
      projectColor: e.project.color,
      note: e.note,
      status: e.status,
      userName: e.user.name,
    })),
  };

  return renderHtmlToPdf(buildPdfHtml(data));
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
