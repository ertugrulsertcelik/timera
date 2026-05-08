import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const ORANGE  = "FFF4631E";
const ORANGE_L = "FFFFF0EB";
const GRAY_L  = "FFF9FAFB";
const BORDER_C = "FFE5E7EB";

function minsToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function cellBorder(): Partial<ExcelJS.Borders> {
  const s: ExcelJS.BorderStyle = "hair";
  const color = { argb: BORDER_C };
  return { top: { style: s, color }, bottom: { style: s, color }, left: { style: s, color }, right: { style: s, color } };
}

export async function generateExcel(
  week: string,
  prisma: PrismaClient,
  userId?: string | null,
): Promise<Buffer> {
  const [year, weekNum] = week.split("-W").map(Number);
  const jan4 = new Date(year, 0, 4);
  const startOfWeek = new Date(jan4);
  startOfWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const weekLabel = `${formatDate(dates[0])} – ${formatDate(dates[6])}`;

  // Fetch user name if filtering
  let filterUserName: string | null = null;
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    filterUserName = u?.name ?? null;
  }

  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { in: dates },
      status: "APPROVED",
      ...(userId ? { userId } : {}),
    },
    include: {
      user: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { date: "asc" }, { startTime: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "TIMERA";
  wb.created = new Date();

  const sheetName = filterUserName ? filterUserName.slice(0, 31) : "Haftalık Rapor";
  const ws = wb.addWorksheet(sheetName);

  // ── Columns ────────────────────────────────────────────────────────────────
  const showUser = !userId;
  const columns: Partial<ExcelJS.Column>[] = [
    ...(showUser ? [{ header: "Çalışan", key: "user", width: 22 }] : []),
    { header: "Tarih",     key: "date",    width: 14 },
    { header: "Gün",       key: "day",     width: 13 },
    { header: "Başlangıç", key: "start",   width: 11 },
    { header: "Bitiş",     key: "end",     width: 11 },
    { header: "Süre",      key: "hours",   width: 10 },
    { header: "Proje",     key: "project", width: 24 },
    { header: "Not",       key: "note",    width: 42 },
  ];
  ws.columns = columns;
  const lastColLetter = String.fromCharCode(64 + columns.length);

  // ── Info rows ──────────────────────────────────────────────────────────────
  ws.insertRow(1, []);
  ws.insertRow(1, []);

  // Row 1: week info
  ws.getCell("A1").value = `Hafta ${weekNum} — ${weekLabel}`;
  ws.getCell("A1").font = { bold: true, size: 13, color: { argb: "FF111827" } };
  ws.mergeCells(`A1:${lastColLetter}1`);

  // Row 2: user / scope info
  ws.getCell("A2").value = filterUserName
    ? `Çalışan: ${filterUserName}`
    : "Kapsam: Tüm Çalışanlar";
  ws.getCell("A2").font = { size: 10, color: { argb: "FF6B7280" } };
  ws.mergeCells(`A2:${lastColLetter}2`);

  // Row 3 = header (already set by ws.columns)
  // ── Header row styling ────────────────────────────────────────────────────
  const headerRow = ws.getRow(3);
  headerRow.height = 26;
  headerRow.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: "medium", color: { argb: "FFE8302A" } } };
  });

  // Freeze header + info rows
  ws.views = [{ state: "frozen", ySplit: 3 }];

  // Auto-filter on header row
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columns.length } };

  // ── Data rows ─────────────────────────────────────────────────────────────
  let totalMinutes = 0;
  entries.forEach((e, idx) => {
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    const minutes  = (eh * 60 + em) - (sh * 60 + sm);
    totalMinutes  += minutes;

    const dateObj = new Date(e.date + "T00:00:00");
    const rowData: Record<string, string> = {
      ...(showUser ? { user: e.user.name } : {}),
      date:    formatDate(e.date),
      day:     TR_DAYS[dateObj.getDay()],
      start:   e.startTime,
      end:     e.endTime,
      hours:   minsToHM(minutes),
      project: e.project.name,
      note:    e.note,
    };

    const row = ws.addRow(rowData);
    row.height = 22;
    row.alignment = { vertical: "middle" };
    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_L } };
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = cellBorder();
    });
  });

  // ── Total row ──────────────────────────────────────────────────────────────
  if (entries.length > 0) {
    const totalRow = ws.addRow({
      ...(showUser ? { user: "TOPLAM" } : { date: "TOPLAM" }),
      hours: minsToHM(totalMinutes),
    });
    totalRow.height = 24;
    totalRow.font   = { bold: true, size: 11 };
    totalRow.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_L } };
    totalRow.alignment = { vertical: "middle" };
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: { style: "medium", color: { argb: "FFE8302A" } } };
    });
  }

  // Empty entries notice
  if (entries.length === 0) {
    const emptyRow = ws.addRow({ ...(showUser ? { user: "Bu hafta onaylanan giriş bulunamadı." } : { date: "Bu hafta onaylanan giriş bulunamadı." }) });
    emptyRow.font = { italic: true, color: { argb: "FF9CA3AF" } };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
