import { useState, useEffect, ReactNode } from "react";
import { useAuthStore } from "../store/authStore";
import { Sidebar } from "../components/Sidebar";
import { UserMenu } from "../components/UserMenu";
import { api } from "../api/client";
import { LeaveRequest, LeaveBalance } from "../types";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#F5F6FA", surface: "#FFFFFF", border: "#E5E7EB",
  text: "#111827", text2: "#4B5563", muted: "#9CA3AF",
  orange: "#2563EB", orangeL: "#EFF6FF",
  green: "#16A34A", greenL: "#F0FDF4", greenB: "#86EFAC",
  blue: "#1565C0", blueL: "#EFF6FF", blueB: "#BFDBFE",
  red: "#991B1B", redL: "#FEF2F2", redB: "#FECACA",
  amber: "#92400E", amberL: "#FEF3C7", amberB: "#FDE68A",
  gray: "#6B7280", grayL: "#F9FAFB",
};

const TYPE_LABEL: Record<string, string> = {
  ANNUAL: "Yıllık İzin", SICK: "Hastalık İzni",
  UNPAID: "Ücretsiz İzin", PUBLIC_HOLIDAY: "Resmi Tatil",
};
const TYPE_COLOR: Record<string, string> = {
  ANNUAL: T.green, SICK: T.blue, UNPAID: T.gray, PUBLIC_HOLIDAY: T.orange,
};
const TYPE_BG: Record<string, string> = {
  ANNUAL: T.greenL, SICK: T.blueL, UNPAID: "#F3F4F6", PUBLIC_HOLIDAY: T.orangeL,
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor", APPROVED: "Onaylandı", REJECTED: "Reddedildi",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: T.amber, APPROVED: T.green, REJECTED: T.red,
};
const STATUS_BG: Record<string, string> = {
  PENDING: T.amberL, APPROVED: T.greenL, REJECTED: T.redL,
};

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_DAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl shadow-xl" style={{ background: T.surface, border: `1px solid ${T.border}`, width: "min(440px, 95vw)", maxHeight: "90vh", overflow: "auto" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <h2 className="font-semibold text-sm" style={{ color: T.text }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 18 }}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── RejectModal ──────────────────────────────────────────────────────────────
function RejectModal({ leave, onConfirm, onClose, saving }: {
  leave: LeaveRequest; onConfirm: (note: string) => void; onClose: () => void; saving: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-6" style={{ background: T.surface, border: `1px solid ${T.border}`, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <h3 className="font-semibold text-sm mb-1" style={{ color: T.text }}>Talebi Reddet</h3>
        <p className="text-xs mb-4" style={{ color: T.muted }}>{leave.user.name} · {leave.date} · {TYPE_LABEL[leave.type]}</p>
        <label className="block text-xs font-medium mb-1.5" style={{ color: T.text2 }}>Red nedeni <span style={{ color: T.muted }}>(opsiyonel)</span></label>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} maxLength={500}
          placeholder="Açıklama..."
          className="w-full rounded-xl px-3 py-2.5 text-xs resize-none outline-none"
          style={{ background: "#F9FAFB", border: `1.5px solid ${T.border}`, color: T.text }}
          onFocus={(e) => { e.target.style.borderColor = T.red; e.target.style.background = "#fff"; }}
          onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.background = "#F9FAFB"; }} />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-medium"
            style={{ background: T.grayL, border: `1px solid ${T.border}`, color: T.text2, cursor: "pointer" }}>
            Vazgeç
          </button>
          <button onClick={() => onConfirm(note)} disabled={saving} className="flex-1 py-2 rounded-xl text-xs font-medium"
            style={{ background: saving ? "#F3F4F6" : T.redL, border: `1px solid ${saving ? T.border : T.redB}`, color: saving ? T.muted : T.red, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Reddediliyor..." : "Reddet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function Calendar({ leaves, year, month, onDayClick }: {
  leaves: LeaveRequest[]; year: number; month: number; onDayClick: (date: string) => void;
}) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7; // 0 = Monday

  const leaveByDate: Record<string, LeaveRequest[]> = {};
  leaves.forEach((l) => {
    if (!leaveByDate[l.date]) leaveByDate[l.date] = [];
    leaveByDate[l.date].push(l);
  });

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {TR_DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: T.muted }}>
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ minHeight: 64 }} />;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayLeaves = leaveByDate[dateStr] || [];
          const isToday = dateStr === today;
          const approvedLeave = dayLeaves.find((l) => l.status === "APPROVED");

          return (
            <div key={dateStr}
              onClick={() => onDayClick(dateStr)}
              className="rounded-lg p-1.5 cursor-pointer transition-all"
              style={{
                minHeight: 64,
                background: approvedLeave ? TYPE_BG[approvedLeave.type] : T.surface,
                border: `1.5px solid ${isToday ? T.orange : approvedLeave ? TYPE_COLOR[approvedLeave.type] + "40" : T.border}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.orange; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = isToday ? T.orange : approvedLeave ? TYPE_COLOR[approvedLeave.type] + "40" : T.border; }}>
              <div className="text-xs font-bold mb-1" style={{ color: isToday ? T.orange : T.text }}>
                {day}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayLeaves.slice(0, 2).map((l) => (
                  <div key={l.id} className="text-xs px-1 rounded truncate"
                    style={{
                      background: TYPE_COLOR[l.type] + "20",
                      color: TYPE_COLOR[l.type],
                      fontSize: 9,
                      fontWeight: 600,
                    }}>
                    {l.status === "PENDING" ? "⏳ " : l.status === "REJECTED" ? "✗ " : ""}
                    {TYPE_LABEL[l.type].split(" ")[0]}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LeavePage ────────────────────────────────────────────────────────────────
export function LeavePage() {
  const { user } = useAuthStore();
  const isManager = user?.role === "MANAGER";

  const today = new Date().toISOString().slice(0, 10);
  const [calYear, setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);

  const [leaves, setLeaves]    = useState<LeaveRequest[]>([]);
  const [balance, setBalance]  = useState<LeaveBalance | null>(null);
  const [users, setUsers]      = useState<{ id: string; name: string }[]>([]);
  const [filterUserId, setFilterUserId] = useState("");
  const [loading, setLoading]  = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [form, setForm] = useState({ date: today, type: "ANNUAL", note: "" });
  const [saving, setSaving]    = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [toast, setToast]      = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function fetchLeaves() {
    try {
      const params = isManager && filterUserId ? `?userId=${filterUserId}` : "";
      const data = await api.get<LeaveRequest[]>(`/leaves${params}`);
      setLeaves(data);
    } catch { /* ignore */ }
  }

  async function fetchBalance() {
    if (!user) return;
    const uid = isManager && filterUserId ? filterUserId : user.id;
    try {
      const data = await api.get<LeaveBalance>(`/leaves/balance/${uid}`);
      setBalance(data);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLeaves(), fetchBalance()]).finally(() => setLoading(false));
  }, [filterUserId]);

  useEffect(() => {
    if (isManager) {
      api.get<{ id: string; name: string }[]>("/users")
        .then(setUsers)
        .catch(() => {});
    }
  }, [isManager]);

  async function handleCreate() {
    setFormError("");
    if (!form.date) { setFormError("Tarih seçiniz"); return; }
    setSaving(true);
    try {
      await api.post("/leaves", { date: form.date, type: form.type, note: form.note || undefined });
      setShowCreate(false);
      setForm({ date: today, type: "ANNUAL", note: "" });
      fetchLeaves();
      fetchBalance();
      showToast("İzin talebi oluşturuldu");
    } catch (e: any) {
      setFormError(e?.message || "Talep oluşturulamadı");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    setActionId(id);
    try {
      await api.post(`/leaves/${id}/approve`);
      showToast("İzin onaylandı");
      fetchLeaves();
      fetchBalance();
    } catch (e: any) {
      showToast(e?.message || "Hata oluştu");
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(note: string) {
    if (!rejectTarget) return;
    setActionId(rejectTarget.id);
    try {
      await api.post(`/leaves/${rejectTarget.id}/reject`, { note });
      showToast("İzin talebi reddedildi");
      setRejectTarget(null);
      fetchLeaves();
    } catch (e: any) {
      showToast(e?.message || "Hata oluştu");
    } finally {
      setActionId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm("Bu izin talebini iptal etmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/leaves/${id}`);
      showToast("İzin talebi iptal edildi");
      fetchLeaves();
      fetchBalance();
    } catch (e: any) {
      showToast(e?.message || "Hata oluştu");
    }
  }

  function prevMonth() {
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  }

  // Calendar day click — pre-fill date in modal
  function handleDayClick(date: string) {
    const hasLeave = leaves.some((l) => l.date === date && (isManager ? l.userId === (filterUserId || user?.id) : true));
    if (!hasLeave) {
      setForm((f) => ({ ...f, date }));
      setShowCreate(true);
    }
  }

  // Filter calendar leaves for the displayed month
  const monthStr = `${calYear}-${String(calMonth).padStart(2, "0")}`;
  const calLeaves = leaves.filter((l) => l.date.startsWith(monthStr));

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${T.border}`, background: "#F9FAFB",
    color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  const ANNUAL_TOTAL = 14;

  return (
    <div className="flex h-screen" style={{ background: T.bg }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3.5 flex-shrink-0"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: T.text }}>İzin Takibi</span>
            {isManager && (
              <select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}
                className="rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: "#F9FAFB", border: `1px solid ${T.border}`, color: T.text }}>
                <option value="">Tüm Çalışanlar</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setForm({ date: today, type: "ANNUAL", note: "" }); setShowCreate(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: T.orange, color: "white", border: "none", cursor: "pointer" }}>
              <i className="ti ti-plus text-sm" />
              Yeni İzin Talebi
            </button>
            <UserMenu />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 md:pt-5 pb-20 md:pb-5">

          {/* Balance Cards */}
          {balance && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Yıllık */}
              <div className="rounded-xl px-4 py-4" style={{ background: T.surface, borderTop: `3px solid ${T.green}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: T.muted }}>Yıllık İzin</p>
                  <i className="ti ti-beach text-sm" style={{ color: T.green }} />
                </div>
                <p className="text-2xl font-black" style={{ color: T.text }}>{balance.annualRemaining} gün</p>
                <div className="mt-2 mb-1 rounded-full overflow-hidden" style={{ height: 4, background: T.border }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    width: `${Math.max(0, (balance.annualUsed / ANNUAL_TOTAL) * 100)}%`,
                    background: balance.annualRemaining <= 3 ? T.red : T.green,
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <p className="text-xs" style={{ color: T.muted }}>{balance.annualUsed} kullanıldı / {ANNUAL_TOTAL} gün</p>
              </div>
              {/* Hastalık */}
              <div className="rounded-xl px-4 py-4" style={{ background: T.surface, borderTop: `3px solid ${T.blue}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: T.muted }}>Hastalık İzni</p>
                  <i className="ti ti-heart-rate-monitor text-sm" style={{ color: T.blue }} />
                </div>
                <p className="text-2xl font-black" style={{ color: T.text }}>{balance.sickUsed} gün</p>
                <p className="text-xs mt-2" style={{ color: T.muted }}>kullanıldı · limitsiz</p>
              </div>
              {/* Ücretsiz */}
              <div className="rounded-xl px-4 py-4" style={{ background: T.surface, borderTop: `3px solid ${T.gray}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: T.muted }}>Ücretsiz İzin</p>
                  <i className="ti ti-calendar-off text-sm" style={{ color: T.gray }} />
                </div>
                <p className="text-2xl font-black" style={{ color: T.text }}>{balance.unpaidUsed} gün</p>
                <p className="text-xs mt-2" style={{ color: T.muted }}>kullanıldı · limitsiz</p>
              </div>
            </div>
          )}

          {/* Calendar */}
          <div className="rounded-xl p-5 mb-6" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ background: T.bg, border: `1px solid ${T.border}`, cursor: "pointer", color: T.text2 }}>
                  <i className="ti ti-chevron-left" style={{ fontSize: 13 }} />
                </button>
                <span className="text-sm font-semibold" style={{ color: T.text, minWidth: 130, textAlign: "center" }}>
                  {TR_MONTHS[calMonth - 1]} {calYear}
                </span>
                <button onClick={nextMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ background: T.bg, border: `1px solid ${T.border}`, cursor: "pointer", color: T.text2 }}>
                  <i className="ti ti-chevron-right" style={{ fontSize: 13 }} />
                </button>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4">
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLOR[k] }} />
                    <span className="text-xs" style={{ color: T.muted }}>{v.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
            <Calendar leaves={calLeaves} year={calYear} month={calMonth} onDayClick={handleDayClick} />
          </div>

          {/* Leave Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-sm font-semibold" style={{ color: T.text }}>İzin Talepleri</h2>
            </div>
            {loading ? (
              <div className="py-16 text-center">
                <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 28, color: T.muted }} />
                <p className="text-sm mt-2" style={{ color: T.muted }}>Yükleniyor...</p>
              </div>
            ) : leaves.length === 0 ? (
              <div className="py-16 text-center">
                <i className="ti ti-beach" style={{ fontSize: 36, color: T.muted }} />
                <p className="text-sm mt-2" style={{ color: T.muted }}>Henüz izin talebi yok</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    {isManager && <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: T.muted }}>Çalışan</th>}
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: T.muted }}>Tarih</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: T.muted }}>Tür</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: T.muted }}>Not</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: T.muted }}>Durum</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: T.muted }}>Yönetici Notu</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => {
                    const busy = actionId === l.id;
                    return (
                      <tr key={l.id} style={{ borderTop: `1px solid ${T.border}`, opacity: busy ? 0.6 : 1 }}>
                        {isManager && (
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: T.text }}>
                            {l.user.name}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm" style={{ color: T.text, fontFamily: "DM Mono, monospace" }}>
                          {l.date}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: TYPE_BG[l.type], color: TYPE_COLOR[l.type] }}>
                            {TYPE_LABEL[l.type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: T.muted, maxWidth: 180 }}>
                          <span className="truncate block">{l.note || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: STATUS_BG[l.status], color: STATUS_COLOR[l.status] }}>
                            {STATUS_LABEL[l.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: T.muted, maxWidth: 160 }}>
                          <span className="truncate block">{l.managerNote || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {isManager && l.status === "PENDING" && (
                              <>
                                <button onClick={() => handleApprove(l.id)} disabled={busy}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                                  style={{ background: T.greenL, border: `1px solid ${T.greenB}`, color: T.green, cursor: busy ? "not-allowed" : "pointer" }}>
                                  <i className="ti ti-check" /> Onayla
                                </button>
                                <button onClick={() => setRejectTarget(l)} disabled={busy}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                                  style={{ background: T.redL, border: `1px solid ${T.redB}`, color: T.red, cursor: busy ? "not-allowed" : "pointer" }}>
                                  <i className="ti ti-x" /> Reddet
                                </button>
                              </>
                            )}
                            {!isManager && l.status === "PENDING" && (
                              <button onClick={() => handleCancel(l.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: T.redL, border: `1px solid ${T.redB}`, color: T.red, cursor: "pointer" }}>
                                <i className="ti ti-trash" /> İptal
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Yeni İzin Talebi" onClose={() => setShowCreate(false)}>
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: T.text2 }}>Tarih</label>
            <input type="date" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={inputStyle} />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: T.text2 }}>İzin Türü</label>
            <select value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={inputStyle}>
              <option value="ANNUAL">Yıllık İzin</option>
              <option value="SICK">Hastalık İzni</option>
              <option value="UNPAID">Ücretsiz İzin</option>
              <option value="PUBLIC_HOLIDAY">Resmi Tatil</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: T.text2 }}>Not <span style={{ color: T.muted }}>(opsiyonel)</span></label>
            <textarea value={form.note} rows={3} maxLength={500}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Açıklama..."
              className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
              style={{ ...inputStyle, height: "auto" }} />
          </div>
          {formError && <p className="text-xs mb-3" style={{ color: T.red }}>{formError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text2, cursor: "pointer" }}>
              İptal
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: T.orange, color: "white", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Gönderiliyor..." : "Talep Oluştur"}
            </button>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          leave={rejectTarget}
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
          saving={actionId === rejectTarget.id}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs font-semibold z-50"
          style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
