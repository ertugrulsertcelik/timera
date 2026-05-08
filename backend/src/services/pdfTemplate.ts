interface PdfEntry {
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  projectName: string;
  projectColor: string;
  note: string;
  status: string;
  userName?: string;
}

interface PdfData {
  title: string;
  subtitle: string;
  generatedAt: string;
  totalMinutes: number;
  approvedMinutes: number;
  entries: PdfEntry[];
  isAllUsers: boolean;
}

function minsToHM(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min === 0 ? `${h}s` : `${h}s ${min}dk`;
}

function statusLabel(s: string): string {
  return s === "APPROVED" ? "Onaylı" : s === "PENDING" ? "Bekliyor" : s === "REJECTED" ? "Reddedildi" : "Taslak";
}

function statusColor(s: string): string {
  return s === "APPROVED" ? "#16A34A" : s === "PENDING" ? "#D97706" : s === "REJECTED" ? "#DC2626" : "#6B7280";
}

function statusBg(s: string): string {
  return s === "APPROVED" ? "#F0FDF4" : s === "PENDING" ? "#FFFBEB" : s === "REJECTED" ? "#FEF2F2" : "#F9FAFB";
}

export function buildPdfHtml(data: PdfData): string {
  const rows = data.entries.map((e, i) => `
    <tr style="background:${i % 2 === 0 ? "#FFFFFF" : "#F9FAFB"}">
      ${data.isAllUsers ? `<td>${e.userName ?? ""}</td>` : ""}
      <td>${e.date}</td>
      <td>${e.dayName}</td>
      <td style="font-family:'DM Mono',monospace">${e.startTime}</td>
      <td style="font-family:'DM Mono',monospace">${e.endTime}</td>
      <td style="font-family:'DM Mono',monospace">${minsToHM(e.durationMin)}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px">
          <span style="width:9px;height:9px;border-radius:50%;background:${e.projectColor};flex-shrink:0;display:inline-block"></span>
          ${e.projectName}
        </span>
      </td>
      <td style="color:#6B7280;font-size:11px">${e.note || "—"}</td>
      <td>
        <span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;color:${statusColor(e.status)};background:${statusBg(e.status)}">
          ${statusLabel(e.status)}
        </span>
      </td>
    </tr>
  `).join("");

  const userColHeader = data.isAllUsers ? `<th>Çalışan</th>` : "";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;900&family=DM+Mono&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 12px;
    color: #111827;
    background: #FFFFFF;
    padding: 32px 36px;
  }
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 2px solid #F3F4F6;
  }
  .logo-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo-icon {
    width: 38px; height: 38px;
    border-radius: 10px;
    background: linear-gradient(135deg, #F4631E 0%, #E8302A 100%);
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 18px; font-weight: 900;
    flex-shrink: 0;
  }
  .logo-text { font-size: 16px; font-weight: 900; color: #F4631E; letter-spacing: 0.08em; }
  .logo-sub { font-size: 10px; color: #9CA3AF; }
  .header-right { text-align: right; }
  .report-title { font-size: 18px; font-weight: 700; color: #111827; }
  .report-sub { font-size: 12px; color: #6B7280; margin-top: 3px; }
  .generated { font-size: 10px; color: #9CA3AF; margin-top: 6px; }

  .stats {
    display: flex; gap: 12px; margin-bottom: 22px;
  }
  .stat-card {
    flex: 1;
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 12px 16px;
  }
  .stat-label { font-size: 10px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .stat-value { font-size: 20px; font-weight: 700; color: #111827; font-family: 'DM Mono', monospace; }
  .stat-accent { color: #F4631E; }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }
  thead tr {
    background: #F4631E;
    color: white;
  }
  th {
    padding: 9px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.03em;
  }
  td {
    padding: 8px 10px;
    border-bottom: 1px solid #F3F4F6;
    vertical-align: middle;
  }
  tr:last-child td { border-bottom: none; }
  .total-row td {
    background: #FFF0EB !important;
    font-weight: 700;
    border-top: 2px solid #F4631E;
    color: #F4631E;
  }
  .footer {
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid #F3F4F6;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #9CA3AF;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-wrap">
      <div class="logo-icon">T</div>
      <div>
        <div class="logo-text">TIMERA</div>
        <div class="logo-sub">Timesheet</div>
      </div>
    </div>
    <div class="header-right">
      <div class="report-title">${data.title}</div>
      <div class="report-sub">${data.subtitle}</div>
      <div class="generated">Oluşturulma: ${data.generatedAt}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Toplam Giriş</div>
      <div class="stat-value">${data.entries.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Toplam Süre</div>
      <div class="stat-value stat-accent">${minsToHM(data.totalMinutes)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Onaylanan</div>
      <div class="stat-value" style="color:#16A34A">${minsToHM(data.approvedMinutes)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Onay Oranı</div>
      <div class="stat-value">${data.totalMinutes > 0 ? Math.round((data.approvedMinutes / data.totalMinutes) * 100) : 0}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${userColHeader}
        <th>Tarih</th>
        <th>Gün</th>
        <th>Başlangıç</th>
        <th>Bitiş</th>
        <th>Süre</th>
        <th>Proje</th>
        <th>Not</th>
        <th>Durum</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        ${data.isAllUsers ? `<td colspan="5">TOPLAM</td>` : `<td colspan="4">TOPLAM</td>`}
        <td style="font-family:'DM Mono',monospace">${minsToHM(data.totalMinutes)}</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <span>Timera Timesheet Sistemi</span>
    <span>${data.generatedAt}</span>
  </div>
</body>
</html>`;
}
