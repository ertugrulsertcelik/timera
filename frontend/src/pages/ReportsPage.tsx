import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useAuthStore } from "../store/authStore";
import { api } from "../api/client";

// ─── Tasarım sabitleri ────────────────────────────────────────────────────────

const T = {
  bg: "#F5F6FA", surface: "#FFFFFF", border: "#E5E7EB",
  text: "#111827", text2: "#4B5563", muted: "#9CA3AF",
  orange: "#F4631E", orangeL: "#FFF0EB",
  green: "#16A34A", greenL: "#F0FDF4", greenB: "#86EFAC",
};

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface EffortRow {
  project: { id: string; name: string; color: string };
  users: { id: string; name: string; hours: number }[];
}

interface SummaryRow {
  id: string;
  name: string;
  hours: number;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const USER_COLORS = [
  "#F4631E", "#7B1FA2", "#1565C0", "#16A34A",
  "#C2185B", "#E65100", "#0277BD", "#558B2F",
];

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function currentISOWeek(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
  );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ─── CustomTooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "10px 14px",
      boxShadow: "0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
      minWidth: 150,
    }}>
      <p style={{ color: T.text2, fontSize: 11, marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {payload.map((item: any) => (
        <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.fill, flexShrink: 0 }} />
          <span style={{ color: T.text2, fontSize: 11 }}>{item.name}</span>
          <span style={{ color: T.text, fontSize: 11, fontWeight: 700, marginLeft: "auto", paddingLeft: 12, fontFamily: "DM Mono, monospace" }}>
            {item.value}s
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── CustomLegend ─────────────────────────────────────────────────────────────

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", justifyContent: "center", marginTop: 8 }}>
      {payload.map((item: any) => (
        <div key={item.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
          <span style={{ color: T.text2, fontSize: 11 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── ReportsPage ──────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [effortData, setEffortData] = useState<EffortRow[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [effortLoading, setEffortLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [exportWeek, setExportWeek] = useState(currentISOWeek);
  const [exportUserId, setExportUserId] = useState("");
  const [exportUsers, setExportUsers] = useState<{ id: string; name: string }[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportingPdfWeekly, setExportingPdfWeekly] = useState(false);
  const [exportingPdfMonthly, setExportingPdfMonthly] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (user && user.role !== "MANAGER") navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>("/users")
      .then((list) => setExportUsers(list.filter((u) => u.name)))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(() => {
    const params = `?year=${year}&month=${month}`;
    setEffortLoading(true);
    setSummaryLoading(true);

    api.get<EffortRow[]>(`/reports/effort${params}`)
      .then(setEffortData)
      .catch(console.error)
      .finally(() => setEffortLoading(false));

    api.get<SummaryRow[]>(`/reports/summary${params}`)
      .then((rows) => setSummaryData([...rows].sort((a, b) => b.hours - a.hours)))
      .catch(console.error)
      .finally(() => setSummaryLoading(false));
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  async function downloadFile(url: string, filename: string, setLoading: (v: boolean) => void) {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) { showToast("İndirme başarısız"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      showToast(`${filename} indirildi`);
    } catch {
      showToast("İndirme sırasında hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const userParam = exportUserId ? `&userId=${exportUserId}` : "";
    await downloadFile(
      `${BASE}/reports/export/excel?week=${exportWeek}${userParam}`,
      `timesheet-${exportWeek}.xlsx`,
      setExporting
    );
  }

  async function handlePdfWeekly() {
    const userParam = exportUserId ? `&userId=${exportUserId}` : "";
    await downloadFile(
      `${BASE}/reports/export/pdf/weekly?week=${exportWeek}${userParam}`,
      `timesheet-haftalik-${exportWeek}.pdf`,
      setExportingPdfWeekly
    );
  }

  async function handlePdfMonthly() {
    const userParam = exportUserId ? `&userId=${exportUserId}` : "";
    await downloadFile(
      `${BASE}/reports/export/pdf/monthly?year=${year}&month=${month}${userParam}`,
      `timesheet-aylik-${year}-${String(month).padStart(2, "0")}.pdf`,
      setExportingPdfMonthly
    );
  }

  const allUsers = [...new Set(effortData.flatMap((p) => p.users.map((u) => u.name)))].sort();
  const chartData = effortData.map((row) => {
    const obj: Record<string, any> = { project: row.project.name, _color: row.project.color };
    row.users.forEach((u) => { obj[u.name] = u.hours; });
    return obj;
  });
  const maxHours = summaryData.length > 0 ? Math.max(...summaryData.map((r) => r.hours)) : 0;
  const isLoading = effortLoading || summaryLoading;

  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>

      <Sidebar />

      {/* ── Ana içerik ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 flex-shrink-0 gap-4"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

          {/* Sol: başlık + ay seçici */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold" style={{ color: T.text }}>Raporlar</span>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
              >
                <i className="ti ti-chevron-left" style={{ fontSize: 13 }} />
              </button>
              <span className="text-xs font-semibold px-2"
                style={{ color: T.text, minWidth: 110, textAlign: "center" }}>
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button onClick={nextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
              >
                <i className="ti ti-chevron-right" style={{ fontSize: 13 }} />
              </button>
            </div>
            {isLoading && (
              <i className="ti ti-loader-2 animate-spin text-sm" style={{ color: T.muted }} />
            )}
          </div>

          {/* Sağ: Excel export */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: T.text2 }}>Hafta:</span>
            <input
              type="week"
              value={exportWeek}
              onChange={(e) => setExportWeek(e.target.value)}
              className="rounded-lg px-2 py-1.5 text-xs outline-none transition-all"
              style={{
                background: "#F9FAFB", border: `1.5px solid ${T.border}`,
                color: T.text, fontFamily: "DM Mono, monospace",
              }}
              onFocus={(e) => { e.target.style.borderColor = T.orange; }}
              onBlur={(e) => { e.target.style.borderColor = T.border; }}
            />
            <select
              value={exportUserId}
              onChange={(e) => setExportUserId(e.target.value)}
              className="rounded-lg px-2 py-1.5 text-xs outline-none transition-all"
              style={{
                background: "#F9FAFB", border: `1.5px solid ${T.border}`,
                color: T.text, maxWidth: 140,
              }}
              onFocus={(e) => { e.target.style.borderColor = T.orange; }}
              onBlur={(e) => { e.target.style.borderColor = T.border; }}
            >
              <option value="">Tüm Çalışanlar</option>
              {exportUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              onClick={handleExport}
              disabled={exporting || !exportWeek}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: (exporting || !exportWeek) ? "#F3F4F6" : T.greenL,
                border: `1px solid ${(exporting || !exportWeek) ? T.border : T.greenB}`,
                color: (exporting || !exportWeek) ? T.muted : T.green,
                cursor: (exporting || !exportWeek) ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => { if (!exporting && exportWeek) e.currentTarget.style.background = "#DCFCE7"; }}
              onMouseLeave={(e) => { if (!exporting && exportWeek) e.currentTarget.style.background = T.greenL; }}
            >
              <i className={`ti ${exporting ? "ti-loader-2 animate-spin" : "ti-file-spreadsheet"} text-sm`} />
              {exporting ? "İndiriliyor..." : "Excel İndir"}
            </button>

            <button
              onClick={handlePdfWeekly}
              disabled={exportingPdfWeekly || !exportWeek}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: (exportingPdfWeekly || !exportWeek) ? "#F3F4F6" : "#FFF0EB",
                border: `1px solid ${(exportingPdfWeekly || !exportWeek) ? T.border : "#FDBA74"}`,
                color: (exportingPdfWeekly || !exportWeek) ? T.muted : T.orange,
                cursor: (exportingPdfWeekly || !exportWeek) ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => { if (!exportingPdfWeekly && exportWeek) e.currentTarget.style.background = "#FFE4CE"; }}
              onMouseLeave={(e) => { if (!exportingPdfWeekly && exportWeek) e.currentTarget.style.background = "#FFF0EB"; }}
            >
              <i className={`ti ${exportingPdfWeekly ? "ti-loader-2 animate-spin" : "ti-file-type-pdf"} text-sm`} />
              {exportingPdfWeekly ? "İndiriliyor..." : "Haftalık PDF"}
            </button>

            <button
              onClick={handlePdfMonthly}
              disabled={exportingPdfMonthly}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: exportingPdfMonthly ? "#F3F4F6" : "#EFF6FF",
                border: `1px solid ${exportingPdfMonthly ? T.border : "#93C5FD"}`,
                color: exportingPdfMonthly ? T.muted : "#2563EB",
                cursor: exportingPdfMonthly ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => { if (!exportingPdfMonthly) e.currentTarget.style.background = "#DBEAFE"; }}
              onMouseLeave={(e) => { if (!exportingPdfMonthly) e.currentTarget.style.background = "#EFF6FF"; }}
            >
              <i className={`ti ${exportingPdfMonthly ? "ti-loader-2 animate-spin" : "ti-file-type-pdf"} text-sm`} />
              {exportingPdfMonthly ? "İndiriliyor..." : "Aylık PDF"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Efor Grafiği ─────────────────────────────────────────────── */}
          <div className="rounded-xl p-5 mb-5"
            style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-bold" style={{ color: T.text }}>Proje Eforu</h2>
                <p className="text-xs mt-0.5" style={{ color: T.muted }}>
                  {MONTH_NAMES[month - 1]} {year} · onaylanan saatler
                </p>
              </div>
              {!effortLoading && effortData.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: T.orangeL, color: T.orange }}>
                  {effortData.length} proje
                </span>
              )}
            </div>

            {effortLoading ? (
              <div className="flex items-center justify-center" style={{ height: 260 }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
                  <i className="ti ti-loader-2 animate-spin" /> Yükleniyor...
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center" style={{ height: 260 }}>
                <i className="ti ti-chart-bar-off" style={{ fontSize: 36, color: T.border, marginBottom: 10 }} />
                <p className="text-xs" style={{ color: T.muted }}>Bu ay için onaylanan giriş bulunamadı</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
                  barCategoryGap="28%"
                  barGap={3}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis
                    dataKey="project"
                    tick={{ fill: T.text2, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}
                    axisLine={{ stroke: T.border }}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(v) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                  />
                  <YAxis
                    tick={{ fill: T.muted, fontSize: 10, fontFamily: "DM Mono, monospace" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}s`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  <Legend content={<CustomLegend />} />
                  {allUsers.map((userName, i) => (
                    <Bar
                      key={userName}
                      dataKey={userName}
                      fill={USER_COLORS[i % USER_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Çalışan Özeti ────────────────────────────────────────────── */}
          <div className="rounded-xl p-5"
            style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-bold" style={{ color: T.text }}>Çalışan Özeti</h2>
                <p className="text-xs mt-0.5" style={{ color: T.muted }}>
                  {MONTH_NAMES[month - 1]} {year} · toplam onaylanan saat
                </p>
              </div>
              {!summaryLoading && summaryData.length > 0 && (
                <span className="text-xs" style={{ color: T.text2 }}>
                  Toplam:{" "}
                  <span style={{ color: T.orange, fontFamily: "DM Mono, monospace", fontWeight: 700 }}>
                    {summaryData.reduce((a, r) => a + r.hours, 0).toFixed(1)}s
                  </span>
                </span>
              )}
            </div>

            {summaryLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
                  <i className="ti ti-loader-2 animate-spin" /> Yükleniyor...
                </div>
              </div>
            ) : summaryData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <i className="ti ti-users-group" style={{ fontSize: 32, color: T.border, marginBottom: 8 }} />
                <p className="text-xs" style={{ color: T.muted }}>Bu ay için onaylanan giriş bulunamadı</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {summaryData.map((row, idx) => {
                  const pct = maxHours > 0 ? (row.hours / maxHours) * 100 : 0;
                  const color = USER_COLORS[idx % USER_COLORS.length];
                  return (
                    <div key={row.id}
                      className="flex items-center gap-4 px-3 py-3 rounded-xl"
                      style={{ background: idx % 2 === 0 ? "#F9FAFB" : "transparent" }}>

                      <span className="text-xs w-5 text-right flex-shrink-0"
                        style={{ color: T.muted, fontFamily: "DM Mono, monospace" }}>
                        {idx + 1}
                      </span>

                      <span className="text-sm font-medium flex-shrink-0" style={{ color: T.text, minWidth: 160 }}>
                        {row.name}
                      </span>

                      <div className="flex-1 h-2 rounded-full" style={{ background: T.border }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: color }} />
                      </div>

                      <span className="text-sm font-bold flex-shrink-0"
                        style={{ color: T.text, fontFamily: "DM Mono, monospace", minWidth: 50, textAlign: "right" }}>
                        {row.hours}s
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs font-semibold z-50"
          style={{
            background: T.surface, border: `1px solid ${T.border}`,
            color: T.text, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
          {toast}
        </div>
      )}
    </div>
  );
}
