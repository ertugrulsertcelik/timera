import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Sidebar } from "../components/Sidebar";
import { api } from "../api/client";
import { Project } from "../types";

// ─── Tasarım sabitleri ────────────────────────────────────────────────────────

const T = {
  bg: "#F5F6FA", surface: "#FFFFFF", border: "#E5E7EB",
  text: "#111827", text2: "#4B5563", muted: "#9CA3AF",
  orange: "#2563EB", orangeL: "#EFF6FF",
  green: "#16A34A", greenL: "#F0FDF4", greenB: "#86EFAC",
  red: "#991B1B", redL: "#FEF2F2", redB: "#FECACA",
};

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface PendingEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
  user: { id: string; name: string; email: string };
  project: Project;
}

// ─── Yardımcı ────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function duration(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const min = (eh * 60 + em) - (sh * 60 + sm);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} sa` : `${h}.5 sa`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "#2563EB", "#7B1FA2", "#1565C0", "#00695C",
  "#0284C7", "#E65100", "#4A148C", "#1A237E",
];
function avatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── RejectModal ─────────────────────────────────────────────────────────────

interface RejectModalProps {
  entry: PendingEntry;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

function RejectModal({ entry, onConfirm, onClose, loading }: RejectModalProps) {
  const [note, setNote] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl p-6" style={{
        background: T.surface, border: `1px solid ${T.border}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
      }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: T.redL, border: `1px solid ${T.redB}` }}>
            <i className="ti ti-x" style={{ fontSize: 16, color: "#1D4ED8" }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: T.text }}>Girişi Reddet</h3>
            <p className="text-xs mt-0.5" style={{ color: T.muted }}>
              {entry.user.name} · {entry.project.name} · {entry.startTime}–{entry.endTime}
            </p>
          </div>
        </div>

        <label className="block text-xs font-medium mb-1.5" style={{ color: T.text2 }}>
          Red nedeni <span style={{ color: T.muted }}>(opsiyonel)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          placeholder="Açıklama ekle..."
          className="w-full rounded-xl px-3 py-2.5 text-xs resize-none outline-none"
          style={{
            background: "#F9FAFB", border: `1.5px solid ${T.border}`,
            color: T.text, fontFamily: "DM Sans, sans-serif",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#1D4ED8"; e.target.style.background = "#FFFFFF"; }}
          onBlur={(e)  => { e.target.style.borderColor = T.border;   e.target.style.background = "#F9FAFB"; }}
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: "#F9FAFB", border: `1.5px solid ${T.border}`, color: T.text2, cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.border; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
          >
            Vazgeç
          </button>
          <button
            onClick={() => onConfirm(note)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium"
            style={{
              background: loading ? "#F3F4F6" : "#FEF2F2",
              border: `1.5px solid ${loading ? T.border : T.redB}`,
              color: loading ? T.muted : T.red,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Reddediliyor..." : "Reddet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ApprovalsPage ────────────────────────────────────────────────────────────

export function ApprovalsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [entries, setEntries]           = useState<PendingEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [actionId, setActionId]         = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PendingEntry | null>(null);
  const [toast, setToast]               = useState("");

  useEffect(() => {
    if (user && user.role !== "MANAGER") navigate("/", { replace: true });
  }, [user, navigate]);

  const fetchEntries = () => {
    setLoading(true);
    api.get<PendingEntry[]>("/approvals")
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEntries(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleApprove(id: string) {
    setActionId(id);
    try {
      await api.post(`/approvals/${id}/approve`);
      showToast("Giriş onaylandı");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      showToast(err.message || "Hata oluştu");
    } finally {
      setActionId(null);
    }
  }

  async function handleApproveAll() {
    if (!entries.length) return;
    setBulkApproving(true);
    try {
      const results = await Promise.allSettled(
        entries.map((e) => api.post(`/approvals/${e.id}/approve`))
      );
      const ok  = results.filter((r) => r.status === "fulfilled").length;
      const err = results.filter((r) => r.status === "rejected").length;
      showToast(err === 0 ? `${ok} giriş onaylandı` : `${ok} onaylandı, ${err} başarısız`);
      fetchEntries();
    } finally {
      setBulkApproving(false);
    }
  }

  async function handleReject(note: string) {
    if (!rejectTarget) return;
    setActionId(rejectTarget.id);
    try {
      await api.post(`/approvals/${rejectTarget.id}/reject`, { note });
      showToast("Giriş reddedildi");
      setEntries((prev) => prev.filter((e) => e.id !== rejectTarget.id));
      setRejectTarget(null);
    } catch (err: any) {
      showToast(err.message || "Hata oluştu");
    } finally {
      setActionId(null);
    }
  }

  const grouped = entries.reduce<Record<string, PendingEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>

      <Sidebar pendingCount={entries.length} />

      {/* ── Ana içerik ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Topbar */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3.5 flex-shrink-0"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: T.text }}>Bekleyen Onaylar</span>
            {!loading && entries.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: "#FEF3C7", color: "#92400E" }}>
                {entries.length} giriş
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!loading && entries.length > 0 && (
              <button
                onClick={handleApproveAll}
                disabled={bulkApproving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: bulkApproving ? "#F3F4F6" : T.greenL,
                  border: `1px solid ${bulkApproving ? T.border : T.greenB}`,
                  color: bulkApproving ? T.muted : T.green,
                  cursor: bulkApproving ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => { if (!bulkApproving) e.currentTarget.style.background = "#DCFCE7"; }}
                onMouseLeave={(e) => { if (!bulkApproving) e.currentTarget.style.background = T.greenL; }}
              >
                <i className={`ti ${bulkApproving ? "ti-loader-2 animate-spin" : "ti-checks"} text-sm`} />
                <span className="hidden sm:inline">{bulkApproving ? "Onaylanıyor..." : "Tümünü Onayla"}</span>
              </button>
            )}
            <button
              onClick={fetchEntries}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
              title="Yenile"
            >
              <i className="ti ti-refresh" style={{ fontSize: 13 }} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 md:pt-5 pb-20 md:pb-5">

          {/* Yükleniyor */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
                <i className="ti ti-loader-2 animate-spin" /> Yükleniyor...
              </div>
            </div>
          )}

          {/* Boş durum */}
          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: T.greenL, border: `1px solid ${T.greenB}` }}>
                <i className="ti ti-checks" style={{ fontSize: 28, color: T.green }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: T.text }}>Bekleyen onay yok</p>
              <p className="text-xs" style={{ color: T.muted }}>Tüm girişler işlendi.</p>
            </div>
          )}

          {/* Tarih grupları */}
          {!loading && sortedDates.map((date) => (
            <div key={date} className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold" style={{ color: T.text2 }}>
                  {formatDate(date)}
                </span>
                <div className="flex-1 h-px" style={{ background: T.border }} />
                <span className="text-xs" style={{ color: T.muted }}>
                  {grouped[date].length} giriş
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {grouped[date].map((entry) => {
                  const busy = actionId === entry.id;
                  return (
                    <div key={entry.id}
                      className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all"
                      style={{
                        background: T.surface,
                        border: `1px solid ${T.border}`,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        opacity: busy ? 0.6 : 1,
                      }}>

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{
                          background: avatarColor(entry.user.id),
                          color: "#fff",
                          fontFamily: "DM Mono, monospace",
                        }}>
                        {initials(entry.user.name)}
                      </div>

                      {/* Kullanıcı + proje */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold" style={{ color: T.text }}>
                            {entry.user.name}
                          </span>
                          <span style={{ color: T.border }}>·</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: entry.project.color }} />
                            <span className="text-xs" style={{ color: T.text2 }}>
                              {entry.project.name}
                            </span>
                          </div>
                        </div>
                        {entry.note && (
                          <p className="text-xs truncate" style={{ color: T.muted, maxWidth: 320 }}>
                            {entry.note}
                          </p>
                        )}
                      </div>

                      {/* Saat + süre */}
                      <div className="text-right flex-shrink-0 mr-4 hidden sm:block">
                        <p className="text-sm font-semibold" style={{ color: T.text, fontFamily: "DM Mono, monospace" }}>
                          {entry.startTime} – {entry.endTime}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: T.muted }}>
                          {duration(entry.startTime, entry.endTime)}
                        </p>
                      </div>

                      {/* Butonlar */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(entry.id)}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: T.greenL,
                            border: `1px solid ${T.greenB}`,
                            color: busy ? T.muted : T.green,
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                          onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#DCFCE7"; }}
                          onMouseLeave={(e) => { if (!busy) e.currentTarget.style.background = T.greenL; }}
                        >
                          <i className="ti ti-check text-sm" />
                          <span className="hidden sm:inline">Onayla</span>
                        </button>
                        <button
                          onClick={() => setRejectTarget(entry)}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: T.redL,
                            border: `1px solid ${T.redB}`,
                            color: busy ? T.muted : T.red,
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                          onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#FEE2E2"; }}
                          onMouseLeave={(e) => { if (!busy) e.currentTarget.style.background = T.redL; }}
                        >
                          <i className="ti ti-x text-sm" />
                          <span className="hidden sm:inline">Reddet</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          entry={rejectTarget}
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
          loading={actionId === rejectTarget.id}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs font-semibold z-50"
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            color: T.text,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
          {toast}
        </div>
      )}
    </div>
  );
}
