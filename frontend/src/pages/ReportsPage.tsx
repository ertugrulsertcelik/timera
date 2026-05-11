import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";
import { useAuthStore } from "../store/authStore";
import { api } from "../api/client";
import { Sidebar } from "../components/Sidebar";
import { UserMenu } from "../components/UserMenu";

// ── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: "var(--c-bg)",
  surface: "var(--c-surface)",
  border: "var(--c-border)",
  text: "var(--c-text)",
  text2: "var(--c-text2)",
  muted: "var(--c-muted)",
  primary: "#2563EB",
  dark: "#1e2d4a",
  light: "var(--c-orangeL)",
  green: "#16A34A",
  red: "#DC2626",
  amber: "#F59E0B",
};

const CHART_COLORS = ["#2563EB", "#0EA5E9", "#1e2d4a", "#6366F1", "#0284C7", "#1D4ED8", "#38BDF8", "#3B82F6"];

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupedItem {
  key: string;
  label: string;
  color?: string;
  hours: number;
  entryCount: number;
}

interface AdvancedEntry {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
  status: string;
  approval: { action: string; note?: string | null; managerName?: string } | null;
}

interface AdvancedSummary {
  totalHours: number;
  avgDailyHours: number;
  topUser: string | null;
  topProject: string | null;
  entryCount: number;
}

interface ComparisonData {
  period: { start: string; end: string };
  totalHours: number;
  grouped: GroupedItem[];
  diff: number;
  diffPct: number;
}

interface AbsenceRow {
  userId: string;
  name: string;
  businessDays: number;
  daysWorked: number;
  leaveDays: number;
  missedDays: number;
  attendanceRate: number;
  maxStreak: number;
}

interface AdvancedReportData {
  period: { start: string; end: string };
  entries: AdvancedEntry[];
  summary: AdvancedSummary;
  grouped: GroupedItem[];
  comparison: ComparisonData | null;
  absenceData: AbsenceRow[] | null;
}

interface PersonalReportData {
  monthlyHours: number;
  approvedHours: number;
  targetHours: number;
  completionPercent: number;
  projectDistribution: { id: string; name: string; color: string; hours: number; percentage: number }[];
  weeklyTrend: { weekStart: string; hours: number }[];
  gamification: { xpTotal: number; streakDays: number };
  badges: { type: string; earnedAt: string }[];
}

interface Filters {
  reportType: "project" | "user" | "weekly" | "monthly" | "comparison" | "trend" | "absence";
  startDate: string;
  endDate: string;
  selectedUsers: string[];
  selectedProjects: string[];
  selectedStatuses: string[];
  chartType: "bar" | "line" | "pie" | "table";
  groupBy: "project" | "user" | "day" | "week" | "month";
  sortBy: "hours_desc" | "hours_asc" | "alpha" | "date";
  columns: string[];
  autoActive: boolean;
  autoFrequency: "WEEKLY" | "MONTHLY";
  autoDayOfWeek: number;
  autoEmails: string;
}

interface UserItem { id: string; name: string; }
interface ProjectItem { id: string; name: string; color: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtH(h: number): string {
  return `${h}s`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function mondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function getPresetDates(preset: string): { startDate: string; endDate: string } {
  const today = todayStr();
  switch (preset) {
    case "this_week":   return { startDate: mondayOfWeek(), endDate: today };
    case "this_month":  return { startDate: firstOfMonth(), endDate: today };
    case "last_month": {
      const d = new Date();
      const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
      const m = d.getMonth() === 0 ? 12 : d.getMonth();
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
      return { startDate: start, endDate: end };
    }
    case "3months": return { startDate: monthsAgo(3), endDate: today };
    case "this_year": return { startDate: `${new Date().getFullYear()}-01-01`, endDate: today };
    default: return { startDate: firstOfMonth(), endDate: today };
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "APPROVED": return "Onaylı";
    case "PENDING":  return "Bekliyor";
    case "REJECTED": return "Reddedildi";
    case "DRAFT":    return "Taslak";
    default: return s;
  }
}

function statusColor(s: string): string {
  switch (s) {
    case "APPROVED": return T.green;
    case "PENDING":  return T.amber;
    case "REJECTED": return T.red;
    case "DRAFT":    return T.muted;
    default: return T.muted;
  }
}

function badgeLabel(type: string): string {
  switch (type) {
    case "EARLY_BIRD":    return "Erken Kuş";
    case "FULL_WEEK":     return "Tam Hafta";
    case "STREAK_5":      return "5 Gün Serisi";
    case "STREAK_10":     return "10 Gün Serisi";
    case "STREAK_30":     return "30 Gün Serisi";
    case "FIRST_ENTRY":   return "İlk Giriş";
    default: return type;
  }
}

function badgeIcon(type: string): string {
  switch (type) {
    case "EARLY_BIRD":  return "ti-sun";
    case "FULL_WEEK":   return "ti-calendar-check";
    case "STREAK_5":    return "ti-flame";
    case "STREAK_10":   return "ti-flame";
    case "STREAK_30":   return "ti-trophy";
    case "FIRST_ENTRY": return "ti-star";
    default: return "ti-award";
  }
}

function sortGrouped(items: GroupedItem[], sortBy: string): GroupedItem[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case "hours_desc": return b.hours - a.hours;
      case "hours_asc":  return a.hours - b.hours;
      case "alpha":      return a.label.localeCompare(b.label, "tr");
      default: return 0;
    }
  });
}

// ── CustomTooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "10px 14px",
      boxShadow: "0 10px 40px rgba(0,0,0,0.10)",
      fontFamily: "DM Sans, sans-serif", minWidth: 150,
    }}>
      <p style={{ color: T.text2, fontSize: 11, marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {payload.map((item: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.fill || item.stroke, flexShrink: 0 }} />
          <span style={{ color: T.text2, fontSize: 11 }}>{item.name}</span>
          <span style={{ color: T.text, fontSize: 11, fontWeight: 700, marginLeft: "auto", paddingLeft: 12, fontFamily: "DM Mono, monospace" }}>
            {item.value}s
          </span>
        </div>
      ))}
    </div>
  );
}

// ── PieTooltip ────────────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = item.payload?.percentage ?? 0;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "10px 14px",
      boxShadow: "0 10px 40px rgba(0,0,0,0.10)",
      fontFamily: "DM Sans, sans-serif", minWidth: 160,
    }}>
      <p style={{ color: T.text, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{item.name}</p>
      <p style={{ color: T.text2, fontSize: 11 }}>
        <span style={{ fontFamily: "DM Mono, monospace", color: T.primary, fontWeight: 700 }}>{item.value}s</span>
        {" · "}
        <span style={{ color: T.muted }}>{pct}%</span>
      </p>
    </div>
  );
}

// ── ExportDropdown ────────────────────────────────────────────────────────────

function ExportDropdown({ filters, onToast }: { filters: Filters; onToast: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function downloadFile(url: string, filename: string, key: string) {
    setLoading(key);
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) { onToast("İndirme başarısız"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      onToast(`${filename} indirildi`);
    } catch {
      onToast("İndirme sırasında hata oluştu");
    } finally {
      setLoading(null);
      setOpen(false);
    }
  }

  function buildParams() {
    const p = new URLSearchParams();
    p.set("startDate", filters.startDate);
    p.set("endDate",   filters.endDate);
    if (filters.selectedUsers.length)    p.set("userIds",    filters.selectedUsers.join(","));
    if (filters.selectedProjects.length) p.set("projectIds", filters.selectedProjects.join(","));
    if (filters.selectedStatuses.length) p.set("status",     filters.selectedStatuses.join(","));
    return p.toString();
  }

  function currentISOWeek(): string {
    const d = new Date(filters.startDate || new Date());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }

  const items = [
    {
      key: "excel",
      label: "Excel (.xlsx)",
      icon: "ti-file-spreadsheet",
      color: T.green,
      fn: () => {
        const week = currentISOWeek();
        const userParam = filters.selectedUsers.length === 1 ? `&userId=${filters.selectedUsers[0]}` : "";
        downloadFile(`${API_BASE}/reports/export/excel?week=${week}${userParam}`, `timesheet-${week}.xlsx`, "excel");
      },
    },
    {
      key: "csv",
      label: "CSV (.csv)",
      icon: "ti-file-text",
      color: T.amber,
      fn: () => downloadFile(
        `${API_BASE}/reports/export/csv?${buildParams()}`,
        `timesheet-${filters.startDate}-${filters.endDate}.csv`,
        "csv"
      ),
    },
    {
      key: "pdf_weekly",
      label: "PDF Haftalık",
      icon: "ti-file-type-pdf",
      color: T.red,
      fn: () => {
        const week = currentISOWeek();
        const userParam = filters.selectedUsers.length === 1 ? `&userId=${filters.selectedUsers[0]}` : "";
        downloadFile(
          `${API_BASE}/reports/export/pdf/weekly?week=${week}${userParam}`,
          `timesheet-haftalik-${week}.pdf`,
          "pdf_weekly"
        );
      },
    },
    {
      key: "pdf_monthly",
      label: "PDF Aylık",
      icon: "ti-file-type-pdf",
      color: T.primary,
      fn: () => {
        const d = new Date(filters.startDate);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const userParam = filters.selectedUsers.length === 1 ? `&userId=${filters.selectedUsers[0]}` : "";
        downloadFile(
          `${API_BASE}/reports/export/pdf/monthly?year=${year}&month=${month}${userParam}`,
          `timesheet-aylik-${year}-${String(month).padStart(2, "0")}.pdf`,
          "pdf_monthly"
        );
      },
    },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 8, cursor: "pointer",
          background: T.light, border: `1px solid #BFDBFE`,
          color: T.primary, fontSize: 12, fontWeight: 700,
        }}
      >
        <i className="ti ti-download" style={{ fontSize: 14 }} />
        <span>İndir</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 12 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
          minWidth: 180, overflow: "hidden",
        }}>
          {items.map((item) => (
            <button
              key={item.key}
              onClick={item.fn}
              disabled={loading === item.key}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 16px",
                background: "transparent", border: "none", cursor: "pointer",
                color: T.text, fontSize: 12, textAlign: "left",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.light; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <i className={`ti ${loading === item.key ? "ti-loader-2 animate-spin" : item.icon}`}
                style={{ fontSize: 15, color: item.color, flexShrink: 0 }} />
              <span>{loading === item.key ? "İndiriliyor..." : item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SummaryCards ──────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: AdvancedSummary }) {
  const cards = [
    { label: "Toplam Saat", value: `${summary.totalHours}s`, icon: "ti-clock", color: T.primary },
    { label: "Ort. Günlük", value: `${summary.avgDailyHours}s`, icon: "ti-trending-up", color: "#0EA5E9" },
    { label: "En Aktif", value: summary.topUser || "—", icon: "ti-user-star", color: "#6366F1" },
    { label: "En Çok Efor", value: summary.topProject || "—", icon: "ti-folder-star", color: T.amber },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}
      className="grid-cols-2 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: "14px 16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: `${c.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className={`ti ${c.icon}`} style={{ fontSize: 15, color: c.color }} />
            </div>
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{c.label}</span>
          </div>
          <p style={{
            fontSize: 16, fontWeight: 800, color: T.text,
            fontFamily: typeof c.value === "string" && c.value.endsWith("s") ? "DM Mono, monospace" : "DM Sans, sans-serif",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── DetailDrawer ──────────────────────────────────────────────────────────────

function DetailDrawer({
  groupKey, groupLabel, entries, onClose,
}: {
  groupKey: string; groupLabel: string;
  entries: AdvancedEntry[]; onClose: () => void;
}) {
  const filtered = entries.filter(
    (e) => e.projectId === groupKey || e.userId === groupKey || e.projectName === groupKey || e.userName === groupKey
  );
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 300,
        }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(380px, 100vw)", background: T.surface,
        borderLeft: `1px solid ${T.border}`,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        zIndex: 301, display: "flex", flexDirection: "column",
        fontFamily: "DM Sans, sans-serif",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{groupLabel}</p>
            <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{filtered.length} giriş</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 20 }}
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: T.muted, fontSize: 12, marginTop: 40 }}>Giriş bulunamadı</p>
          ) : (
            filtered.map((e) => (
              <div key={e.id} style={{
                padding: "10px 20px", borderBottom: `1px solid ${T.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{e.date}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                    background: `${statusColor(e.status)}18`, color: statusColor(e.status),
                  }}>{statusLabel(e.status)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.projectColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: T.text2 }}>{e.projectName}</span>
                  <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: T.primary, marginLeft: "auto" }}>
                    {e.startTime}–{e.endTime}
                  </span>
                </div>
                {e.note && (
                  <p style={{ fontSize: 11, color: T.muted, fontStyle: "italic", marginTop: 2 }}>{e.note}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── ChartArea ─────────────────────────────────────────────────────────────────

function ChartArea({
  data, filters, onBarClick,
}: {
  data: AdvancedReportData;
  filters: Filters;
  onBarClick: (key: string, label: string) => void;
}) {
  const [tableSortCol, setTableSortCol] = useState<string>("hours");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");

  const sorted = sortGrouped(data.grouped, filters.sortBy);
  const { chartType } = filters;

  const isComparison = filters.reportType === "comparison" && data.comparison;
  const isAbsence    = filters.reportType === "absence" && data.absenceData;

  if (isAbsence && data.absenceData) {
    function sortAbsence(col: string) {
      if (tableSortCol === col) setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setTableSortCol(col); setTableSortDir("desc"); }
    }
    const absRows = [...data.absenceData].sort((a: any, b: any) => {
      const v = (tableSortDir === "desc" ? -1 : 1);
      if (typeof a[tableSortCol] === "number") return v * (a[tableSortCol] - b[tableSortCol]);
      return v * String(a[tableSortCol]).localeCompare(String(b[tableSortCol]), "tr");
    });
    const thStyle: React.CSSProperties = {
      padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
      color: T.text2, background: "var(--c-input-bg)", cursor: "pointer", whiteSpace: "nowrap",
    };
    const tdStyle: React.CSSProperties = {
      padding: "10px 14px", fontSize: 12, color: T.text, borderTop: `1px solid ${T.border}`,
    };
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              {[
                { key: "name", label: "Çalışan" },
                { key: "businessDays", label: "İş Günü" },
                { key: "daysWorked", label: "Çalışılan" },
                { key: "leaveDays", label: "İzin" },
                { key: "missedDays", label: "Eksik" },
                { key: "attendanceRate", label: "Devam %" },
                { key: "maxStreak", label: "En Uzun Seri" },
              ].map((col) => (
                <th key={col.key} style={thStyle} onClick={() => sortAbsence(col.key)}>
                  {col.label} {tableSortCol === col.key ? (tableSortDir === "desc" ? "↓" : "↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {absRows.map((row, i) => (
              <tr key={row.userId}
                style={{ background: i % 2 === 0 ? "var(--c-surface2)" : T.surface }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.light; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? "var(--c-surface2)" : T.surface; }}
              >
                <td style={tdStyle}>{row.name}</td>
                <td style={tdStyle}>{row.businessDays}</td>
                <td style={tdStyle}>{row.daysWorked}</td>
                <td style={tdStyle}>{row.leaveDays}</td>
                <td style={{ ...tdStyle, color: row.missedDays > 0 ? T.red : T.green }}>
                  {row.missedDays}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.border, minWidth: 60 }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: `${Math.min(row.attendanceRate, 100)}%`,
                        background: row.attendanceRate >= 80 ? T.green : row.attendanceRate >= 60 ? T.amber : T.red,
                      }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: T.text2, minWidth: 36 }}>
                      {row.attendanceRate}%
                    </span>
                  </div>
                </td>
                <td style={tdStyle}>{row.maxStreak} gün</td>
              </tr>
            ))}
          </tbody>
        </table>
        {absRows.length === 0 && (
          <p style={{ textAlign: "center", color: T.muted, fontSize: 12, padding: "32px 0" }}>Veri bulunamadı</p>
        )}
      </div>
    );
  }

  if (isComparison && data.comparison) {
    const compKeys = [...new Set([...sorted.map((g) => g.label), ...data.comparison.grouped.map((g) => g.label)])];
    const compData = compKeys.map((label) => {
      const cur  = sorted.find((g) => g.label === label);
      const prev = data.comparison!.grouped.find((g) => g.label === label);
      return { label, current: cur?.hours ?? 0, previous: prev?.hours ?? 0 };
    });
    const diff    = data.comparison.diff;
    const diffPct = data.comparison.diffPct;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: T.primary }} />
            <span style={{ fontSize: 11, color: T.text2 }}>Seçili Dönem</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#93C5FD" }} />
            <span style={{ fontSize: 11, color: T.text2 }}>Önceki Dönem</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <i className={`ti ${diff >= 0 ? "ti-trending-up" : "ti-trending-down"}`}
              style={{ color: diff >= 0 ? T.green : T.red, fontSize: 16 }} />
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: diff >= 0 ? T.green : T.red,
              fontFamily: "DM Mono, monospace",
            }}>
              {diff >= 0 ? "+" : ""}{diff}s ({diffPct >= 0 ? "+" : ""}{diffPct}%)
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={compData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }} barCategoryGap="28%" barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 11 }} tickLine={false} axisLine={{ stroke: T.border }} tickFormatter={(v) => v.length > 12 ? v.slice(0, 11) + "…" : v} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 11, fontFamily: "DM Mono, monospace" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}s`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="current"  name="Seçili Dönem" fill={T.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Bar dataKey="previous" name="Önceki Dönem" fill="#93C5FD"  radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={sorted} margin={{ top: 4, right: 8, left: -16, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 11 }} tickLine={false} axisLine={{ stroke: T.border }} tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + "…" : v} />
          <YAxis tick={{ fill: "#9CA3AF", fontSize: 11, fontFamily: "DM Mono, monospace" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}s`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Bar
            dataKey="hours"
            name="Saat"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            cursor="pointer"
            onClick={(d) => onBarClick(d.key, d.label)}
          >
            {sorted.map((entry, i) => (
              <Cell key={entry.key} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={sorted} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 11 }} tickLine={false} axisLine={{ stroke: T.border }} tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + "…" : v} />
          <YAxis tick={{ fill: "#9CA3AF", fontSize: 11, fontFamily: "DM Mono, monospace" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}s`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: T.text2 }} />
          <Line
            type="monotone"
            dataKey="hours"
            name="Saat"
            stroke={CHART_COLORS[0]}
            strokeWidth={2.5}
            dot={{ r: 4, fill: CHART_COLORS[0], strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "pie") {
    const pieData = sorted.map((g, i) => ({
      name: g.label,
      value: g.hours,
      fill: g.color || CHART_COLORS[i % CHART_COLORS.length],
      percentage: data.summary.totalHours > 0 ? Math.round((g.hours / data.summary.totalHours) * 1000) / 10 : 0,
    }));
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <ResponsiveContainer width={300} height={300}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value" paddingAngle={2}>
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, minWidth: 180 }}>
          {pieData.map((entry) => (
            <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: entry.fill, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: T.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.name}
              </span>
              <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: T.primary, fontWeight: 700, marginLeft: 8 }}>
                {entry.value}s
              </span>
              <span style={{ fontSize: 11, color: T.muted, minWidth: 36, textAlign: "right" }}>
                {entry.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Table
  const allCols = ["user", "date", "project", "startTime", "endTime", "hours", "status", "note", "approver"];
  const colLabels: Record<string, string> = {
    user: "Çalışan", date: "Tarih", project: "Proje",
    startTime: "Başlangıç", endTime: "Bitiş", hours: "Süre",
    status: "Durum", note: "Not", approver: "Onaylayan",
  };
  const activeCols = filters.columns.filter((c) => allCols.includes(c));

  function sortByCol(col: string) {
    if (tableSortCol === col) setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setTableSortCol(col); setTableSortDir("desc"); }
  }

  const tableEntries = [...data.entries].sort((a: any, b: any) => {
    const dir = tableSortDir === "desc" ? -1 : 1;
    const aVal = tableSortCol === "hours"
      ? (parseInt(a.endTime) - parseInt(a.startTime))
      : (a as any)[tableSortCol === "user" ? "userName" : tableSortCol === "project" ? "projectName" : tableSortCol];
    const bVal = tableSortCol === "hours"
      ? (parseInt(b.endTime) - parseInt(b.startTime))
      : (b as any)[tableSortCol === "user" ? "userName" : tableSortCol === "project" ? "projectName" : tableSortCol];
    if (typeof aVal === "number") return dir * (aVal - bVal);
    return dir * String(aVal ?? "").localeCompare(String(bVal ?? ""), "tr");
  });

  const thStyle: React.CSSProperties = {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: T.text2, background: "var(--c-input-bg)", cursor: "pointer", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: 12, color: T.text, borderTop: `1px solid ${T.border}`,
  };

  // Totals
  const totalMinutes = data.entries.reduce((acc, e) => {
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    return acc + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  const totalH = Math.round((totalMinutes / 60) * 10) / 10;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
        <thead>
          <tr>
            {activeCols.map((col) => (
              <th key={col} style={thStyle} onClick={() => sortByCol(col)}>
                {colLabels[col] || col} {tableSortCol === col ? (tableSortDir === "desc" ? "↓" : "↑") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableEntries.map((e, i) => {
            const [sh, sm] = e.startTime.split(":").map(Number);
            const [eh, em] = e.endTime.split(":").map(Number);
            const min = (eh * 60 + em) - (sh * 60 + sm);
            const hrs = Math.round((min / 60) * 10) / 10;
            return (
              <tr key={e.id}
                style={{ background: i % 2 === 0 ? "var(--c-surface2)" : T.surface }}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = T.light; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = i % 2 === 0 ? "var(--c-surface2)" : T.surface; }}
              >
                {activeCols.includes("user")      && <td style={tdStyle}>{e.userName}</td>}
                {activeCols.includes("date")      && <td style={{ ...tdStyle, fontFamily: "DM Mono, monospace", fontSize: 11 }}>{e.date}</td>}
                {activeCols.includes("project")   && (
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.projectColor, flexShrink: 0 }} />
                      {e.projectName}
                    </div>
                  </td>
                )}
                {activeCols.includes("startTime") && <td style={{ ...tdStyle, fontFamily: "DM Mono, monospace", fontSize: 11 }}>{e.startTime}</td>}
                {activeCols.includes("endTime")   && <td style={{ ...tdStyle, fontFamily: "DM Mono, monospace", fontSize: 11 }}>{e.endTime}</td>}
                {activeCols.includes("hours")     && <td style={{ ...tdStyle, fontFamily: "DM Mono, monospace", fontWeight: 700, color: T.primary }}>{hrs}s</td>}
                {activeCols.includes("status")    && (
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                      background: `${statusColor(e.status)}18`, color: statusColor(e.status),
                    }}>{statusLabel(e.status)}</span>
                  </td>
                )}
                {activeCols.includes("note")      && <td style={{ ...tdStyle, color: T.muted, fontStyle: "italic", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note || "—"}</td>}
                {activeCols.includes("approver")  && <td style={tdStyle}>{e.approval?.managerName || "—"}</td>}
              </tr>
            );
          })}
        </tbody>
        {tableEntries.length > 0 && (
          <tfoot>
            <tr style={{ background: T.light }}>
              {activeCols.map((col, i) => (
                <td key={col} style={{ ...tdStyle, fontWeight: 700, color: T.primary }}>
                  {i === 0 ? `TOPLAM (${tableEntries.length})` : col === "hours" ? `${totalH}s` : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {tableEntries.length === 0 && (
        <p style={{ textAlign: "center", color: T.muted, fontSize: 12, padding: "32px 0" }}>Veri bulunamadı</p>
      )}
    </div>
  );
}

// ── FilterPanel ───────────────────────────────────────────────────────────────

function FilterPanel({
  filters, setFilters, users, projects,
  onBuild, building,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  users: UserItem[];
  projects: ProjectItem[];
  onBuild: () => void;
  building: boolean;
}) {
  const [userSearch, setUserSearch]     = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [savingAuto, setSavingAuto]     = useState(false);
  const [autoSaved, setAutoSaved]       = useState(false);

  const set = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const toggleUser = (id: string) =>
    set("selectedUsers", filters.selectedUsers.includes(id)
      ? filters.selectedUsers.filter((u) => u !== id)
      : [...filters.selectedUsers, id]);

  const toggleProject = (id: string) =>
    set("selectedProjects", filters.selectedProjects.includes(id)
      ? filters.selectedProjects.filter((p) => p !== id)
      : [...filters.selectedProjects, id]);

  const toggleStatus = (s: string) =>
    set("selectedStatuses", filters.selectedStatuses.includes(s)
      ? filters.selectedStatuses.filter((x) => x !== s)
      : [...filters.selectedStatuses, s]);

  const toggleColumn = (col: string) =>
    set("columns", filters.columns.includes(col)
      ? filters.columns.filter((c) => c !== col)
      : [...filters.columns, col]);

  function handleReportTypeChange(rt: Filters["reportType"]) {
    const updates: Partial<Filters> = { reportType: rt };
    if (rt === "trend") {
      updates.groupBy = "week"; updates.chartType = "line"; updates.startDate = monthsAgo(3);
    } else if (rt === "absence") {
      updates.groupBy = "user"; updates.chartType = "table"; updates.selectedStatuses = [];
    } else if (rt === "comparison") {
      updates.groupBy = "project"; updates.chartType = "bar";
    } else if (rt === "weekly") {
      updates.groupBy = "day"; updates.chartType = "bar"; updates.startDate = mondayOfWeek();
    } else if (rt === "monthly") {
      updates.groupBy = "day"; updates.chartType = "bar";
    }
    setFilters((f) => ({ ...f, ...updates }));
  }

  async function saveAutoReport() {
    setSavingAuto(true);
    try {
      const emails = filters.autoEmails.split(",").map((e) => e.trim()).filter(Boolean);
      await api.post("/reports/schedule", {
        frequency: filters.autoFrequency,
        dayOfWeek: filters.autoDayOfWeek,
        emails,
        filters: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          userIds: filters.selectedUsers,
          projectIds: filters.selectedProjects,
          statuses: filters.selectedStatuses,
        },
        isActive: filters.autoActive,
      });
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2500);
    } catch (err: any) {
      alert(err.message || "Kayıt başarısız");
    } finally {
      setSavingAuto(false);
    }
  }

  const sectionStyle: React.CSSProperties = {
    borderBottom: `1px solid ${T.border}`, padding: "14px 16px",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: "0.08em",
    marginBottom: 10, textTransform: "uppercase" as const,
  };
  const checkRow: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
    padding: "4px 0", userSelect: "none",
  };

  const REPORT_TYPES: { key: Filters["reportType"]; label: string; icon: string }[] = [
    { key: "project",    label: "Proje Dağılımı",    icon: "ti-folder" },
    { key: "user",       label: "Çalışan Analizi",   icon: "ti-users" },
    { key: "weekly",     label: "Haftalık Görünüm",  icon: "ti-calendar-week" },
    { key: "monthly",    label: "Aylık Görünüm",     icon: "ti-calendar-month" },
    { key: "trend",      label: "Trend (3 Ay)",      icon: "ti-trending-up" },
    { key: "comparison", label: "Dönem Karşılaştırma", icon: "ti-arrows-diff" },
    { key: "absence",    label: "Devamsızlık",       icon: "ti-user-off" },
  ];

  const DOW_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const ALL_COLS = [
    { key: "user",      label: "Çalışan" },
    { key: "date",      label: "Tarih" },
    { key: "project",   label: "Proje" },
    { key: "startTime", label: "Başlangıç" },
    { key: "endTime",   label: "Bitiş" },
    { key: "hours",     label: "Süre" },
    { key: "status",    label: "Durum" },
    { key: "note",      label: "Not" },
    { key: "approver",  label: "Onaylayan" },
  ];

  const filteredUsers    = users.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()));

  return (
    <div style={{
      width: 300, minWidth: 300, background: T.surface,
      borderRight: `1px solid ${T.border}`, overflowY: "auto",
      maxHeight: "calc(100vh - 60px)", paddingBottom: 100,
      display: "flex", flexDirection: "column",
    }}>
      {/* Rapor Tipi */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Rapor Tipi</p>
        {REPORT_TYPES.map((rt) => (
          <div
            key={rt.key}
            onClick={() => handleReportTypeChange(rt.key)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 8, cursor: "pointer",
              marginBottom: 2,
              background: filters.reportType === rt.key ? T.light : "transparent",
              border: filters.reportType === rt.key ? `1px solid #BFDBFE` : "1px solid transparent",
              color: filters.reportType === rt.key ? T.primary : T.text2,
              fontWeight: filters.reportType === rt.key ? 700 : 500,
              fontSize: 12,
            }}
          >
            <i className={`ti ${rt.icon}`} style={{ fontSize: 14, flexShrink: 0 }} />
            {rt.label}
          </div>
        ))}
      </div>

      {/* Tarih Aralığı */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Tarih Aralığı</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          <input
            type="date" value={filters.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, outline: "none", background: "var(--c-input-bg)" }}
            onFocus={(e) => { e.target.style.borderColor = T.primary; }}
            onBlur={(e) => { e.target.style.borderColor = T.border; }}
          />
          <input
            type="date" value={filters.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, outline: "none", background: "var(--c-input-bg)" }}
            onFocus={(e) => { e.target.style.borderColor = T.primary; }}
            onBlur={(e) => { e.target.style.borderColor = T.border; }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[
            { key: "this_week", label: "Bu Hafta" },
            { key: "this_month", label: "Bu Ay" },
            { key: "last_month", label: "Geçen Ay" },
            { key: "3months", label: "Son 3 Ay" },
            { key: "this_year", label: "Bu Yıl" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => {
                const { startDate, endDate } = getPresetDates(p.key);
                setFilters((f) => ({ ...f, startDate, endDate }));
              }}
              style={{
                padding: "4px 9px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                background: "#F3F4F6", border: `1px solid ${T.border}`, color: T.text2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.light; e.currentTarget.style.color = T.primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = T.text2; }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Çalışanlar */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Çalışanlar</p>
        <input
          placeholder="Ara..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          style={{ width: "100%", marginBottom: 8, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, outline: "none", background: "var(--c-input-bg)", boxSizing: "border-box" as const }}
          onFocus={(e) => { e.target.style.borderColor = T.primary; }}
          onBlur={(e) => { e.target.style.borderColor = T.border; }}
        />
        <label style={{ ...checkRow, marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={filters.selectedUsers.length === 0}
            onChange={() => set("selectedUsers", [])}
            style={{ accentColor: T.primary }}
          />
          <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>Tüm Çalışanlar</span>
        </label>
        <div style={{ maxHeight: 160, overflowY: "auto" }}>
          {filteredUsers.map((u) => (
            <label key={u.id} style={checkRow}>
              <input
                type="checkbox"
                checked={filters.selectedUsers.includes(u.id)}
                onChange={() => toggleUser(u.id)}
                style={{ accentColor: T.primary }}
              />
              <span style={{ fontSize: 12, color: T.text2 }}>{u.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Projeler */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Projeler</p>
        <input
          placeholder="Ara..."
          value={projectSearch}
          onChange={(e) => setProjectSearch(e.target.value)}
          style={{ width: "100%", marginBottom: 8, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, outline: "none", background: "var(--c-input-bg)", boxSizing: "border-box" as const }}
          onFocus={(e) => { e.target.style.borderColor = T.primary; }}
          onBlur={(e) => { e.target.style.borderColor = T.border; }}
        />
        <label style={{ ...checkRow, marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={filters.selectedProjects.length === 0}
            onChange={() => set("selectedProjects", [])}
            style={{ accentColor: T.primary }}
          />
          <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>Tüm Projeler</span>
        </label>
        <div style={{ maxHeight: 160, overflowY: "auto" }}>
          {filteredProjects.map((p) => (
            <label key={p.id} style={checkRow}>
              <input
                type="checkbox"
                checked={filters.selectedProjects.includes(p.id)}
                onChange={() => toggleProject(p.id)}
                style={{ accentColor: T.primary }}
              />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.text2 }}>{p.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Durum */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Durum</p>
        {[
          { key: "APPROVED", label: "Onaylanan", color: T.green },
          { key: "PENDING",  label: "Bekleyen",  color: T.amber },
          { key: "REJECTED", label: "Reddedilen", color: T.red },
          { key: "DRAFT",    label: "Taslak",    color: T.muted },
        ].map((s) => (
          <label key={s.key} style={checkRow}>
            <input
              type="checkbox"
              checked={filters.selectedStatuses.includes(s.key)}
              onChange={() => toggleStatus(s.key)}
              style={{ accentColor: s.color }}
            />
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: T.text2 }}>{s.label}</span>
          </label>
        ))}
      </div>

      {/* Görünüm */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Görünüm</p>
        {/* Chart Type */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {[
            { key: "bar",   icon: "ti-chart-bar",   label: "Bar"   },
            { key: "line",  icon: "ti-chart-line",  label: "Line"  },
            { key: "pie",   icon: "ti-chart-pie-2", label: "Pie"   },
            { key: "table", icon: "ti-table",       label: "Tablo" },
          ].map((ct) => (
            <button
              key={ct.key}
              title={ct.label}
              onClick={() => set("chartType", ct.key as Filters["chartType"])}
              style={{
                flex: 1, padding: "6px 4px", borderRadius: 8, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                background: filters.chartType === ct.key ? T.light : "var(--c-surface2)",
                border: filters.chartType === ct.key ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                color: filters.chartType === ct.key ? T.primary : T.muted,
              }}
            >
              <i className={`ti ${ct.icon}`} style={{ fontSize: 15 }} />
              <span style={{ fontSize: 9, fontWeight: 700 }}>{ct.label}</span>
            </button>
          ))}
        </div>
        {/* GroupBy */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: T.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>Gruplama</label>
          <select
            value={filters.groupBy}
            onChange={(e) => set("groupBy", e.target.value as Filters["groupBy"])}
            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, outline: "none", background: "var(--c-input-bg)" }}
          >
            <option value="project">Projeye Göre</option>
            <option value="user">Çalışana Göre</option>
            <option value="day">Güne Göre</option>
            <option value="week">Haftaya Göre</option>
            <option value="month">Aya Göre</option>
          </select>
        </div>
        {/* SortBy */}
        <div>
          <label style={{ fontSize: 11, color: T.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>Sıralama</label>
          <select
            value={filters.sortBy}
            onChange={(e) => set("sortBy", e.target.value as Filters["sortBy"])}
            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, outline: "none", background: "var(--c-input-bg)" }}
          >
            <option value="hours_desc">Saat (Yüksek→Düşük)</option>
            <option value="hours_asc">Saat (Düşük→Yüksek)</option>
            <option value="alpha">Alfabetik</option>
          </select>
        </div>
      </div>

      {/* Sütunlar (sadece table modda) */}
      {filters.chartType === "table" && (
        <div style={sectionStyle}>
          <p style={sectionTitle}>Sütunlar</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
            {[
              { key: "user", label: "Çalışan" }, { key: "date", label: "Tarih" },
              { key: "project", label: "Proje" }, { key: "startTime", label: "Başlangıç" },
              { key: "endTime", label: "Bitiş" }, { key: "hours", label: "Süre" },
              { key: "status", label: "Durum" }, { key: "note", label: "Not" },
              { key: "approver", label: "Onaylayan" },
            ].map((col) => (
              <label key={col.key} style={checkRow}>
                <input
                  type="checkbox"
                  checked={filters.columns.includes(col.key)}
                  onChange={() => toggleColumn(col.key)}
                  style={{ accentColor: T.primary }}
                />
                <span style={{ fontSize: 11, color: T.text2 }}>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Otomatik Rapor */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ ...sectionTitle, marginBottom: 0 }}>Otomatik Rapor</p>
          <div
            onClick={() => set("autoActive", !filters.autoActive)}
            style={{
              width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "background 0.2s",
              background: filters.autoActive ? T.primary : T.border, position: "relative",
            }}
          >
            <div style={{
              position: "absolute", top: 3, left: filters.autoActive ? 18 : 3,
              width: 14, height: 14, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
        </div>
        {filters.autoActive && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: T.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>Sıklık</label>
              <select
                value={filters.autoFrequency}
                onChange={(e) => set("autoFrequency", e.target.value as "WEEKLY" | "MONTHLY")}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, outline: "none", background: "var(--c-input-bg)" }}
              >
                <option value="WEEKLY">Haftalık</option>
                <option value="MONTHLY">Aylık</option>
              </select>
            </div>
            {filters.autoFrequency === "WEEKLY" && (
              <div>
                <label style={{ fontSize: 11, color: T.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>Gün</label>
                <select
                  value={filters.autoDayOfWeek}
                  onChange={(e) => set("autoDayOfWeek", Number(e.target.value))}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, outline: "none", background: "var(--c-input-bg)" }}
                >
                  {DOW_LABELS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, color: T.text2, fontWeight: 600, display: "block", marginBottom: 4 }}>E-posta Adresleri (virgülle ayır)</label>
              <input
                type="text"
                value={filters.autoEmails}
                onChange={(e) => set("autoEmails", e.target.value)}
                placeholder="ali@firma.com, veli@firma.com"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, outline: "none", background: "var(--c-input-bg)", boxSizing: "border-box" as const }}
                onFocus={(e) => { e.target.style.borderColor = T.primary; }}
                onBlur={(e) => { e.target.style.borderColor = T.border; }}
              />
            </div>
            <button
              onClick={saveAutoReport}
              disabled={savingAuto || !filters.autoEmails.trim()}
              style={{
                padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: savingAuto || !filters.autoEmails.trim() ? "not-allowed" : "pointer",
                background: autoSaved ? "#DCFCE7" : T.light,
                border: `1px solid ${autoSaved ? "#86EFAC" : "#BFDBFE"}`,
                color: autoSaved ? T.green : T.primary,
              }}
            >
              {savingAuto ? "Kaydediliyor..." : autoSaved ? "✓ Kaydedildi" : "Kaydet"}
            </button>
          </div>
        )}
      </div>

      {/* Build button (sticky bottom) */}
      <div style={{
        position: "sticky" as const,
        bottom: 0,
        background: "var(--c-surface)",
        padding: "12px 16px",
        borderTop: `1px solid ${T.border}`,
      }}>
        <button
          onClick={onBuild}
          disabled={building}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 10,
            background: building ? "#93C5FD" : T.primary,
            color: "#fff", fontSize: 13, fontWeight: 700,
            border: "none", cursor: building ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {building && <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 15 }} />}
          {building ? "Oluşturuluyor..." : "Raporu Oluştur"}
        </button>
      </div>
    </div>
  );
}

// ── EmployeePersonalDashboard ─────────────────────────────────────────────────

function EmployeePersonalDashboard() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData]   = useState<PersonalReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<PersonalReportData>(`/reports/personal?year=${year}&month=${month}`);
      setData(d);
    } catch {}
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const completionColor = data
    ? data.completionPercent >= 80 ? T.green : data.completionPercent >= 60 ? T.amber : T.red
    : T.muted;

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 pb-20 md:pb-5">
      {/* Month selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={prevMonth}
          style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", color: T.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="ti ti-chevron-left" style={{ fontSize: 14 }} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, minWidth: 130, textAlign: "center" }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={nextMonth}
          style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", color: T.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
        </button>
        {loading && <i className="ti ti-loader-2 animate-spin" style={{ color: T.muted, fontSize: 15 }} />}
      </div>

      {!data && !loading && (
        <p style={{ textAlign: "center", color: T.muted, marginTop: 60 }}>Veri yüklenemedi.</p>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}
            className="md:grid-cols-4">
            {[
              { label: "Bu Ay Toplam", value: `${data.monthlyHours}s`, icon: "ti-clock", color: T.primary },
              { label: "Onaylanan",    value: `${data.approvedHours}s`, icon: "ti-circle-check", color: T.green },
              { label: "Hedef",        value: `${data.targetHours}s`, icon: "ti-target", color: T.amber },
              { label: "Tamamlanma",   value: `${data.completionPercent}%`, icon: "ti-chart-pie", color: completionColor },
            ].map((c) => (
              <div key={c.label} style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${c.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`ti ${c.icon}`} style={{ fontSize: 16, color: c.color }} />
                  </div>
                  <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{c.label}</span>
                </div>
                <p style={{ fontSize: 20, fontWeight: 800, color: T.text, fontFamily: "DM Mono, monospace" }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Completion bar */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Hedef Tamamlanma</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: completionColor, fontFamily: "DM Mono, monospace" }}>
                {data.completionPercent}%
              </span>
            </div>
            <div style={{ height: 10, background: T.border, borderRadius: 5 }}>
              <div style={{
                height: "100%", borderRadius: 5,
                width: `${Math.min(data.completionPercent, 100)}%`,
                background: completionColor, transition: "width 0.6s ease",
              }} />
            </div>
            <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
              {data.approvedHours}s onaylandı / {data.targetHours}s hedef
            </p>
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}
            className="md:grid-cols-2 grid-cols-1">
            {/* Project Distribution */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 14 }}>Proje Dağılımı</h3>
              {data.projectDistribution.length === 0 ? (
                <p style={{ textAlign: "center", color: T.muted, fontSize: 12, paddingTop: 40 }}>Onaylanan giriş yok</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.projectDistribution.map((p) => ({ ...p, value: p.hours }))}
                      cx="50%" cy="50%" outerRadius={75} dataKey="value" paddingAngle={2}>
                      {data.projectDistribution.map((p, i) => (
                        <Cell key={p.id} fill={p.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div style={{ marginTop: 8 }}>
                {data.projectDistribution.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 11, color: T.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: T.primary, fontWeight: 700 }}>{p.hours}s</span>
                    <span style={{ fontSize: 10, color: T.muted, minWidth: 30, textAlign: "right" }}>{p.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Trend */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 14 }}>Haftalık Trend (Son 4 Hafta)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.weeklyTrend} margin={{ top: 4, right: 8, left: -24, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="weekStart" tick={{ fill: "#9CA3AF", fontSize: 10 }} tickLine={false} axisLine={{ stroke: T.border }}
                    tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 10, fontFamily: "DM Mono, monospace" }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `${v}s`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="hours" name="Saat" stroke={T.primary} strokeWidth={2.5}
                    dot={{ r: 4, fill: T.primary, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gamification */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 14 }}>Gamification</h3>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1, background: T.light, borderRadius: 10, padding: 14, textAlign: "center" }}>
                <p style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Toplam XP</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: T.primary, fontFamily: "DM Mono, monospace" }}>{data.gamification.xpTotal}</p>
                <p style={{ fontSize: 10, color: T.text2, marginTop: 2 }}>Seviye {Math.floor(data.gamification.xpTotal / 1000) + 1}</p>
              </div>
              <div style={{ flex: 1, background: "var(--c-orangeL)", borderRadius: 10, padding: 14, textAlign: "center" }}>
                <p style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Gün Serisi</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: T.amber, fontFamily: "DM Mono, monospace" }}>{data.gamification.streakDays}</p>
                <p style={{ fontSize: 10, color: T.text2, marginTop: 2 }}>ardışık gün</p>
              </div>
            </div>
            {data.badges.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 10 }}>ROZETLER</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {data.badges.map((b) => (
                    <div key={b.type} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 20,
                      background: T.light, border: `1px solid #BFDBFE`,
                    }}>
                      <i className={`ti ${badgeIcon(b.type)}`} style={{ fontSize: 14, color: T.primary }} />
                      <span style={{ fontSize: 11, color: T.primary, fontWeight: 700 }}>{badgeLabel(b.type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.badges.length === 0 && (
              <p style={{ fontSize: 12, color: T.muted, textAlign: "center" }}>Henüz rozet kazanılmadı</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── ReportsPage (Main) ────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === "MANAGER";

  const today = todayStr();

  const [filters, setFilters] = useState<Filters>({
    reportType: "project",
    startDate: firstOfMonth(),
    endDate: today,
    selectedUsers: [],
    selectedProjects: [],
    selectedStatuses: ["APPROVED"],
    chartType: "bar",
    groupBy: "project",
    sortBy: "hours_desc",
    columns: ["user", "date", "project", "hours", "status"],
    autoActive: false,
    autoFrequency: "WEEKLY",
    autoDayOfWeek: 4,
    autoEmails: "",
  });

  const [reportData, setReportData]   = useState<AdvancedReportData | null>(null);
  const [building, setBuilding]       = useState(false);
  const [users, setUsers]             = useState<UserItem[]>([]);
  const [projects, setProjects]       = useState<ProjectItem[]>([]);
  const [toast, setToast]             = useState("");
  const [filterOpen, setFilterOpen]   = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [drawer, setDrawer]           = useState<{ key: string; label: string } | null>(null);

  useEffect(() => {
    if (isManager) {
      api.get<UserItem[]>("/users").then(setUsers).catch(() => {});
      api.get<ProjectItem[]>("/projects/all").then(setProjects).catch(() => {});
    }
  }, [isManager]);

  const buildReport = useCallback(async () => {
    if (!isManager) return;
    setBuilding(true);
    try {
      const params = new URLSearchParams();
      params.set("startDate", filters.startDate);
      params.set("endDate",   filters.endDate);
      params.set("groupBy",   filters.groupBy);
      if (filters.selectedUsers.length)    params.set("userIds",    filters.selectedUsers.join(","));
      if (filters.selectedProjects.length) params.set("projectIds", filters.selectedProjects.join(","));
      if (filters.selectedStatuses.length) params.set("status",     filters.selectedStatuses.join(","));

      if (filters.reportType === "comparison") params.set("type", "comparison");
      else if (filters.reportType === "absence") params.set("type", "absence");
      else params.set("type", "summary");

      const data = await api.get<AdvancedReportData>(`/reports/advanced?${params.toString()}`);
      setReportData(data);
    } catch (err: any) {
      showToast(err.message || "Rapor oluşturulamadı");
    } finally {
      setBuilding(false);
    }
  }, [filters, isManager]);

  // Auto-build on mount
  useEffect(() => {
    if (isManager) buildReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  const periodLabel = reportData
    ? `${reportData.period.start} — ${reportData.period.end}`
    : `${filters.startDate} — ${filters.endDate}`;

  if (!isManager) {
    return (
      <div className="flex min-h-screen" style={{ background: T.bg }}>
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header style={{
            padding: "14px 24px", background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Kişisel Raporlar</span>
            <UserMenu />
          </header>
          <EmployeePersonalDashboard />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: T.bg, fontFamily: "DM Sans, sans-serif" }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)", flexShrink: 0, gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mobile filter toggle */}
            <button
              className="md:hidden"
              onClick={() => setFilterOpen((o) => !o)}
              style={{
                width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                background: filterOpen ? T.light : "var(--c-surface2)", border: `1px solid ${filterOpen ? "#BFDBFE" : T.border}`,
                color: filterOpen ? T.primary : T.muted,
              }}
            >
              <i className="ti ti-adjustments-horizontal" style={{ fontSize: 16 }} />
            </button>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Rapor Oluşturucu</span>
              {reportData && (
                <p style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{periodLabel}</p>
              )}
            </div>
            {building && <i className="ti ti-loader-2 animate-spin" style={{ color: T.muted, fontSize: 16 }} />}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {reportData && (
              <span style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 20,
                background: T.light, color: T.primary, fontWeight: 700, border: `1px solid #BFDBFE`,
              }}>
                {reportData.summary.entryCount} giriş
              </span>
            )}
            <ExportDropdown filters={filters} onToast={showToast} />
            <UserMenu />
          </div>
        </header>

        {/* Body: filter panel + right panel */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Filter Panel */}
          <div
            className={`${filterOpen ? "flex" : "hidden"} md:flex`}
            style={{ flexShrink: 0, overflowY: "auto", height: "100%" }}
          >
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              users={users}
              projects={projects}
              onBuild={buildReport}
              building={building}
            />
          </div>

          {/* Right Panel */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", minWidth: 0 }}
            className="pb-20 md:pb-5">
            {!reportData && !building && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: 12 }}>
                <i className="ti ti-chart-bar" style={{ fontSize: 48, color: T.border }} />
                <p style={{ color: T.muted, fontSize: 14 }}>Filtreleri seçip "Raporu Oluştur"a tıklayın</p>
              </div>
            )}

            {building && !reportData && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60%", gap: 12 }}>
                <i className="ti ti-loader-2 animate-spin" style={{ color: T.primary, fontSize: 24 }} />
                <span style={{ color: T.text2, fontSize: 14 }}>Rapor oluşturuluyor...</span>
              </div>
            )}

            {reportData && (
              <>
                {/* Summary Cards */}
                <SummaryCards summary={reportData.summary} />

                {/* Chart Card */}
                <div style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 14, padding: "20px", marginBottom: 16,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                        {filters.reportType === "comparison" ? "Dönem Karşılaştırması" :
                         filters.reportType === "absence"    ? "Devamsızlık Analizi" :
                         filters.reportType === "trend"      ? "Trend Analizi" :
                         "Analiz Grafiği"}
                      </h2>
                      <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{periodLabel}</p>
                    </div>
                  </div>

                  {reportData.grouped.length === 0 && !reportData.absenceData ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 10 }}>
                      <i className="ti ti-chart-bar-off" style={{ fontSize: 40, color: T.border }} />
                      <p style={{ color: T.muted, fontSize: 12 }}>Seçili filtrelere uygun veri bulunamadı</p>
                    </div>
                  ) : (
                    <ChartArea data={reportData} filters={filters} onBarClick={(key, label) => setDrawer({ key, label })} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {drawer && reportData && (
        <DetailDrawer
          groupKey={drawer.key}
          groupLabel={drawer.label}
          entries={reportData.entries}
          onClose={() => setDrawer(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          padding: "10px 20px", borderRadius: 12, fontSize: 12, fontWeight: 600, zIndex: 400,
          background: T.surface, border: `1px solid ${T.border}`, color: T.text,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
          className="bottom-20 md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
