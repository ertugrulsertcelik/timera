import { useState, useEffect, useRef } from "react";

import { useAuthStore } from "../store/authStore";
import { useEntries } from "../hooks/useEntries";
import { api } from "../api/client";
import { Project, TimeEntry } from "../types";
import { Sidebar } from "../components/Sidebar";
import { UserMenu } from "../components/UserMenu";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getWeekDates(isoWeek: string): string[] {
  const [year, weekNum] = isoWeek.split("-W").map(Number);
  const jan4 = new Date(year, 0, 4);
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function addWeeks(isoWeek: string, delta: number): string {
  const [year, weekNum] = isoWeek.split("-W").map(Number);
  const jan4 = new Date(year, 0, 4);
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1 + delta) * 7);
  return getISOWeek(start);
}

function slotIndex(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}
function slotToTime(index: number): string {
  const h = Math.floor(index / 2);
  const m = index % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const SLOTS = Array.from({ length: 48 }, (_, i) => i);

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg: "#F5F6FA",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  border2: "#F3F4F6",
  text: "#111827",
  text2: "#4B5563",
  muted: "#9CA3AF",
  orange: "#2563EB",
  orangeL: "#EFF6FF",
  red: "#1D4ED8",
  amber: "#0EA5E9",
  green: "#16A34A",
};

const STATUS = {
  DRAFT:    { label: "Taslak",     color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
  PENDING:  { label: "Bekliyor",   color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  APPROVED: { label: "Onaylı",     color: "#166534", bg: "#F0FDF4", border: "#86EFAC" },
  REJECTED: { label: "Reddedildi", color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
};

// ─── BlockModal ───────────────────────────────────────────────────────────────

interface BlockModalProps {
  startSlot: number;
  endSlot: number;
  projects: Project[];
  onSave: (projectId: string, note: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string;
  isMobile: boolean;
}

function BlockModal({ startSlot, endSlot, projects, onSave, onClose, saving, error, isMobile }: BlockModalProps) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [note, setNote] = useState("");

  const startTime = slotToTime(startSlot);
  const endTime = slotToTime(endSlot + 1);
  const hours = (endSlot - startSlot + 1) / 2;
  const crossMidnight = endSlot >= 47;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{
        alignItems: isMobile ? "flex-end" : "center",
        padding: isMobile ? 0 : "0 16px",
        background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full overflow-y-auto"
        style={{
          maxWidth: isMobile ? "100%" : 384,
          maxHeight: isMobile ? "85vh" : undefined,
          padding: 24,
          background: T.surface,
          borderRadius: isMobile ? "20px 20px 0 0" : 16,
          boxShadow: isMobile ? "0 -4px 30px rgba(0,0,0,0.15)" : "0 20px 60px rgba(0,0,0,0.15)",
          border: `1px solid ${T.border}`,
          animation: isMobile ? "slideUp 0.25s ease" : undefined,
        }}>

        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border, margin: "0 auto 16px" }} />
        )}

        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base" style={{ color: T.text }}>Zaman Girişi</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: T.orangeL, color: T.orange }}>
            <i className="ti ti-clock text-sm" />
            {startTime} – {crossMidnight ? "23:30" : endTime}
            {crossMidnight && <span style={{ color: T.red }}> +ertesi</span>}
          </span>
          <span className="text-sm" style={{ color: T.muted }}>{hours} saat</span>
        </div>

        <label className="block text-sm font-semibold mb-2" style={{ color: T.text }}>Proje</label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto mb-4">
          {projects.map((p) => (
            <button key={p.id} type="button" onClick={() => setProjectId(p.id)}
              className="w-full flex items-center gap-2.5 px-3 rounded-xl text-sm text-left transition-all"
              style={{
                minHeight: 44,
                background: projectId === p.id ? p.color + "15" : T.bg,
                border: `1.5px solid ${projectId === p.id ? p.color : T.border}`,
                color: projectId === p.id ? T.text : T.text2,
                cursor: "pointer", fontWeight: projectId === p.id ? 600 : 400,
              }}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>

        <label className="block text-sm font-semibold mb-2" style={{ color: T.text }}>Ne yaptın?</label>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))}
          placeholder="Kısa bir açıklama..." rows={3} maxLength={500}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
          style={{ background: T.bg, border: `1.5px solid ${T.border}`, color: T.text }}
          onFocus={(e) => (e.target.style.borderColor = T.orange)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
        <div className="flex justify-end mb-4">
          <span style={{ fontSize: 11, color: note.length >= 450 ? "#EF4444" : T.muted }}>
            {note.length}/500
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm mb-4"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
            <i className="ti ti-alert-circle flex-shrink-0" />{error}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl text-sm font-medium"
            style={{ minHeight: 44, background: T.bg, border: `1.5px solid ${T.border}`, color: T.text2, cursor: "pointer" }}>
            Vazgeç
          </button>
          <button onClick={() => onSave(projectId, note)} disabled={saving || !projectId}
            className="flex-1 rounded-xl text-sm font-bold"
            style={{
              minHeight: 44,
              background: saving || !projectId ? T.border : `linear-gradient(135deg, ${T.orange}, ${T.red})`,
              color: saving || !projectId ? T.muted : "white",
              border: "none", cursor: saving || !projectId ? "not-allowed" : "pointer",
              boxShadow: saving || !projectId ? "none" : "0 4px 12px rgba(37,99,235,0.3)",
            }}>
            {saving ? <span className="flex items-center justify-center gap-1.5"><i className="ti ti-loader-2 animate-spin" /> Kaydediliyor...</span> : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditEntryModal ───────────────────────────────────────────────────────────

interface EditModalProps {
  entry: TimeEntry;
  projects: Project[];
  onSave: (projectId: string, note: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string;
  isMobile: boolean;
}

function EditEntryModal({ entry, projects, onSave, onClose, saving, error, isMobile }: EditModalProps) {
  const [projectId, setProjectId] = useState(entry.projectId);
  const [note, setNote] = useState(entry.note ?? "");
  const sm = STATUS[entry.status as keyof typeof STATUS];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{
        alignItems: isMobile ? "flex-end" : "center",
        padding: isMobile ? 0 : "0 16px",
        background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full overflow-y-auto"
        style={{
          maxWidth: isMobile ? "100%" : 384,
          maxHeight: isMobile ? "85vh" : undefined,
          padding: 24,
          background: T.surface,
          borderRadius: isMobile ? "20px 20px 0 0" : 16,
          boxShadow: isMobile ? "0 -4px 30px rgba(0,0,0,0.15)" : "0 20px 60px rgba(0,0,0,0.15)",
          border: `1px solid ${T.border}`,
          animation: isMobile ? "slideUp 0.25s ease" : undefined,
        }}>

        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border, margin: "0 auto 16px" }} />
        )}

        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base" style={{ color: T.text }}>Girişi Düzenle</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: T.orangeL, color: T.orange }}>
            <i className="ti ti-clock text-sm" />
            {entry.startTime} – {entry.endTime}
          </span>
          <span className="px-2 py-1 rounded-lg text-xs font-semibold"
            style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
            {sm.label}
          </span>
        </div>

        {entry.status === "PENDING" && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <i className="ti ti-info-circle flex-shrink-0 mt-0.5" style={{ color: "#92400E" }} />
            <p className="text-xs" style={{ color: "#92400E", lineHeight: 1.5 }}>
              Düzenleme yapılırsa giriş <strong>taslağa</strong> döner, tekrar onaya gönderilmesi gerekir.
            </p>
          </div>
        )}

        <label className="block text-sm font-semibold mb-2" style={{ color: T.text }}>Proje</label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto mb-4">
          {projects.map((p) => (
            <button key={p.id} type="button" onClick={() => setProjectId(p.id)}
              className="w-full flex items-center gap-2.5 px-3 rounded-xl text-sm text-left"
              style={{
                minHeight: 44,
                background: projectId === p.id ? p.color + "15" : T.bg,
                border: `1.5px solid ${projectId === p.id ? p.color : T.border}`,
                color: projectId === p.id ? T.text : T.text2,
                cursor: "pointer", fontWeight: projectId === p.id ? 600 : 400,
              }}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>

        <label className="block text-sm font-semibold mb-2" style={{ color: T.text }}>Not</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))}
          placeholder="Kısa bir açıklama..." rows={3} maxLength={500}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
          style={{ background: T.bg, border: `1.5px solid ${T.border}`, color: T.text }}
          onFocus={(e) => (e.target.style.borderColor = T.orange)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
        <div className="flex justify-end mb-4">
          <span style={{ fontSize: 11, color: note.length >= 450 ? "#EF4444" : T.muted }}>
            {note.length}/500
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm mb-4"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
            <i className="ti ti-alert-circle flex-shrink-0" />{error}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl text-sm font-medium"
            style={{ minHeight: 44, background: T.bg, border: `1.5px solid ${T.border}`, color: T.text2, cursor: "pointer" }}>
            Vazgeç
          </button>
          <button onClick={() => onSave(projectId, note)} disabled={saving || !projectId}
            className="flex-1 rounded-xl text-sm font-bold"
            style={{
              minHeight: 44,
              background: saving || !projectId ? T.border : `linear-gradient(135deg, ${T.orange}, ${T.red})`,
              color: saving || !projectId ? T.muted : "white",
              border: "none", cursor: saving || !projectId ? "not-allowed" : "pointer",
              boxShadow: saving || !projectId ? "none" : "0 4px 12px rgba(37,99,235,0.3)",
            }}>
            {saving ? <span className="flex items-center justify-center gap-1.5"><i className="ti ti-loader-2 animate-spin" /> Kaydediliyor...</span> : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TimeGrid ─────────────────────────────────────────────────────────────────

interface TimeGridProps {
  date: string;
  entries: TimeEntry[];
  projects: Project[];
  onAddEntry: (projectId: string, note: string, startTime: string, endTime: string) => Promise<void>;
  onDeleteEntry: (id: string) => void;
  onUpdateEntry: (id: string, projectId: string, note: string) => Promise<void>;
  isMobile: boolean;
  slotH: number;
}

function TimeGrid({ date, entries, projects, onAddEntry, onDeleteEntry, onUpdateEntry, isMobile, slotH }: TimeGridProps) {
  const [selecting, setSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState<number | null>(null);
  const [selectEnd, setSelectEnd] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  // Mobil: iki-dokunuş seçim
  const [mobileSelectStart, setMobileSelectStart] = useState<number | null>(null);

  const [popoverEntry, setPopoverEntry] = useState<{ entry: TimeEntry; x: number; y: number } | null>(null);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const isToday = date === new Date().toISOString().slice(0, 10);
  const [nowPx, setNowPx] = useState(() => {
    const d = new Date();
    return ((d.getHours() * 60 + d.getMinutes()) / 30) * slotH;
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowPx(((d.getHours() * 60 + d.getMinutes()) / 30) * slotH);
    }, 30_000);
    return () => clearInterval(id);
  }, [slotH]);

  // ESC → mobil seçimi iptal et
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileSelectStart(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dayEntries = entries.filter((e) => e.date === date);

  const occupiedSlots = new Set<number>();
  for (const e of dayEntries) {
    const s = slotIndex(e.startTime);
    const end = slotIndex(e.endTime);
    for (let i = s; i < end; i++) occupiedSlots.add(i);
  }

  // ── Masaüstü sürükleme ──────────────────────────────────────────────────────
  function handleSlotMouseDown(slot: number) {
    if (occupiedSlots.has(slot)) return;
    setSelecting(true); setSelectStart(slot); setSelectEnd(slot);
  }
  function handleSlotMouseEnter(slot: number) {
    if (!selecting || selectStart === null) return;
    const min = Math.min(selectStart, slot), max = Math.max(selectStart, slot);
    let blocked = false;
    for (let i = min; i <= max; i++) { if (occupiedSlots.has(i)) { blocked = true; break; } }
    if (!blocked) setSelectEnd(slot);
  }
  function handleMouseUp() {
    if (selecting && selectStart !== null && selectEnd !== null) setShowModal(true);
    setSelecting(false);
  }
  useEffect(() => {
    if (isMobile) return;
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isMobile, selecting, selectStart, selectEnd]);

  // ── Mobil tap-to-select ────────────────────────────────────────────────────
  function handleSlotClick(slot: number) {
    if (occupiedSlots.has(slot)) return;
    if (mobileSelectStart === null) {
      setMobileSelectStart(slot);
    } else {
      const min = Math.min(mobileSelectStart, slot);
      const max = Math.max(mobileSelectStart, slot);
      let blocked = false;
      for (let i = min; i <= max; i++) {
        if (occupiedSlots.has(i)) { blocked = true; break; }
      }
      if (blocked) { setMobileSelectStart(null); return; }
      setSelectStart(min); setSelectEnd(max);
      setShowModal(true); setMobileSelectStart(null);
    }
  }

  async function handleSave(projectId: string, note: string) {
    if (selectStart === null || selectEnd === null) return;
    setSaving(true); setSaveError("");
    const minSlot = Math.min(selectStart, selectEnd);
    const maxSlot = Math.max(selectStart, selectEnd);
    try {
      await onAddEntry(projectId, note, slotToTime(minSlot), slotToTime(maxSlot + 1));
      setShowModal(false); setSelectStart(null); setSelectEnd(null);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setSaving(false);
    }
  }
  function handleCloseModal() {
    setShowModal(false); setSelectStart(null); setSelectEnd(null); setSaveError("");
  }

  function openPopover(e: TimeEntry, ev: React.MouseEvent) {
    ev.stopPropagation();
    if (selecting) return;
    setPopoverEntry({ entry: e, x: ev.clientX, y: ev.clientY });
  }
  function closePopover() { setPopoverEntry(null); }
  function openEdit() {
    if (!popoverEntry) return;
    setEditEntry(popoverEntry.entry); setEditError(""); setPopoverEntry(null);
  }
  async function handleDelete() {
    if (!popoverEntry) return;
    closePopover(); onDeleteEntry(popoverEntry.entry.id);
  }
  async function handleEditSave(projectId: string, note: string) {
    if (!editEntry) return;
    setEditSaving(true); setEditError("");
    try {
      await onUpdateEntry(editEntry.id, projectId, note);
      setEditEntry(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setEditSaving(false);
    }
  }

  const selMin = selectStart !== null && selectEnd !== null ? Math.min(selectStart, selectEnd) : -1;
  const selMax = selectStart !== null && selectEnd !== null ? Math.max(selectStart, selectEnd) : -1;

  return (
    <div className="relative select-none" ref={gridRef}>

      {/* Mobil seçim banner — sticky (ilk slot seçildikten sonra görünür) */}
      {isMobile && mobileSelectStart !== null && (
        <div style={{
          position: "sticky", top: 0, zIndex: 15,
          background: "#FFF7ED", borderBottom: "1px solid #FED7AA",
          padding: "10px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="ti ti-hand-click" style={{ fontSize: 15, color: T.orange }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#9A3412" }}>Bitiş saatini seç</span>
            <span style={{ fontSize: 12, fontFamily: "DM Mono, monospace", fontWeight: 700, color: T.orange }}>
              {slotToTime(mobileSelectStart)}
            </span>
          </div>
          <button
            onClick={() => setMobileSelectStart(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9A3412", fontSize: 18, lineHeight: 1, padding: "4px 8px", minHeight: 44, display: "flex", alignItems: "center" }}>
            <i className="ti ti-x" />
          </button>
        </div>
      )}

      <div className="flex">

        {/* Saat etiketleri */}
        <div className="flex-shrink-0" style={{ width: isMobile ? 48 : 56, background: "#FAFAFA" }}>
          {SLOTS.map((slot) => (
            <div key={slot} style={{
              height: slotH,
              display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
              paddingRight: isMobile ? 6 : 10, paddingTop: 4,
              borderBottom: `1px solid ${slot % 2 === 0 ? T.border : T.border2}`,
            }}>
              <span style={{
                fontSize: slot % 2 === 0 ? (isMobile ? 9 : 10) : (isMobile ? 8 : 9),
                color: slot % 2 === 0 ? "#6B7280" : "#D1D5DB",
                fontWeight: slot % 2 === 0 ? 500 : 400,
                fontFamily: "DM Mono, monospace",
                lineHeight: 1,
              }}>
                {slotToTime(slot)}
              </span>
            </div>
          ))}
        </div>

        {/* Grid alanı */}
        <div className="flex-1 relative" style={{ borderLeft: `1px solid ${T.border}` }}>

          {/* Slot arka planları */}
          {SLOTS.map((slot) => {
            const isSelected = slot >= selMin && slot <= selMax;
            const isOccupied = occupiedSlots.has(slot);
            const isHour = slot % 2 === 0;
            const isMobileStart = isMobile && mobileSelectStart === slot;
            return (
              <div
                key={slot}
                className={`time-slot${isOccupied ? " occupied" : ""}${isSelected ? " selected" : ""}`}
                style={{
                  height: slotH,
                  borderBottom: `1px solid ${isHour ? T.border : T.border2}`,
                  cursor: isOccupied ? "default" : (isMobile ? "pointer" : "crosshair"),
                  background: isMobileStart ? `${T.orange}18` : undefined,
                  outline: isMobileStart ? `2px solid ${T.orange}` : undefined,
                  outlineOffset: -2,
                }}
                onMouseDown={isMobile ? undefined : () => handleSlotMouseDown(slot)}
                onMouseEnter={isMobile ? undefined : () => handleSlotMouseEnter(slot)}
                onClick={isMobile ? () => handleSlotClick(slot) : undefined}
              />
            );
          })}

          {/* Entry blokları */}
          {dayEntries.map((e) => {
            const s = slotIndex(e.startTime);
            const end = slotIndex(e.endTime);
            const top = s * slotH + 2;
            const height = (end - s) * slotH - 4;
            const color = projects.find((p) => p.id === e.projectId)?.color ?? T.orange;
            const proj = projects.find((p) => p.id === e.projectId);
            const active = popoverEntry?.entry.id === e.id;
            const rejNote = e.status === "REJECTED" ? (e.approval?.note ?? null) : null;
            return (
              <div
                key={e.id}
                className="absolute group"
                style={{
                  position: "absolute",
                  top, height, left: 8, right: 8,
                  borderRadius: 6,
                  borderLeft: `3px solid ${color}`,
                  background: active ? color + "26" : color + "18",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 10px 0 8px",
                  overflow: "hidden",
                  cursor: "pointer",
                  zIndex: active ? 10 : 2,
                  boxShadow: active ? `0 0 0 2px ${color}60` : undefined,
                  transition: "background 0.1s, box-shadow 0.15s",
                }}
                onClick={(ev) => openPopover(e, ev)}
                title={e.status === "REJECTED" && rejNote && height < 56 ? `Red sebebi: ${rejNote}` : undefined}
              >
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {proj?.name}
                  </span>
                  {height > 32 && e.note && (
                    <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                      {e.note}
                    </span>
                  )}
                  {height >= 56 && rejNote && (
                    <span style={{ fontSize: 10, color: "#b91c1c", display: "flex", alignItems: "center", gap: 3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <i className="ti ti-alert-circle" style={{ flexShrink: 0, fontSize: 11 }} />
                      {rejNote}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", flexShrink: 0, marginLeft: 8, gap: 2 }}>
                  <span style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: "#999", whiteSpace: "nowrap" }}>
                    {e.startTime} – {e.endTime}
                  </span>
                  <span style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 10, fontWeight: 500,
                    background: e.status === "APPROVED" ? "#dcfce7" : e.status === "PENDING" ? "#fef9c3" : e.status === "REJECTED" ? "#fee2e2" : "#f3f4f6",
                    color: e.status === "APPROVED" ? "#15803d" : e.status === "PENDING" ? "#a16207" : e.status === "REJECTED" ? "#b91c1c" : "#6b7280",
                  }}>
                    {e.status === "APPROVED" ? "Onaylı" : e.status === "PENDING" ? "Bekliyor" : e.status === "REJECTED" ? "Reddedildi" : "Taslak"}
                  </span>
                </div>

                {e.status === "DRAFT" && (
                  <button
                    onClick={(ev) => { ev.stopPropagation(); onDeleteEntry(e.id); }}
                    style={{ position: "absolute", top: 4, right: 4, background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, lineHeight: 1, opacity: 0, transition: "opacity 0.15s" }}
                    className="delete-btn"
                  >
                    <i className="ti ti-x" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Şimdiki zaman çizgisi */}
          {isToday && (
            <div className="pointer-events-none absolute" style={{ top: nowPx, left: 0, right: 0, zIndex: 6 }}>
              <div style={{
                position: "absolute", left: -5, top: -4,
                width: 9, height: 9, borderRadius: "50%", background: T.orange,
              }} />
              <div style={{ height: 1.5, background: T.orange, opacity: 0.6 }} />
            </div>
          )}

          {/* Masaüstü seçim overlay */}
          {!isMobile && selecting && selectStart !== null && selMin >= 0 && (
            <div className="pointer-events-none absolute" style={{
              top: selMin * slotH, height: (selMax - selMin + 1) * slotH,
              left: 4, right: 4,
              border: `2px dashed ${T.orange}60`,
              borderRadius: 8, zIndex: 4,
              background: `${T.orange}08`,
            }}>
              <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: T.orange,
                  background: "rgba(255,255,255,0.95)",
                  padding: "2px 10px", borderRadius: 6,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  fontFamily: "DM Mono, monospace",
                }}>
                  {slotToTime(selMin)} – {slotToTime(selMax + 1)}
                  <span style={{ color: T.text2, marginLeft: 6 }}>
                    {(selMax - selMin + 1) / 2}sa
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Yeni giriş modalı */}
      {showModal && selectStart !== null && selectEnd !== null && (
        <BlockModal
          startSlot={Math.min(selectStart, selectEnd)}
          endSlot={Math.max(selectStart, selectEnd)}
          projects={projects} onSave={handleSave} onClose={handleCloseModal}
          saving={saving} error={saveError} isMobile={isMobile}
        />
      )}

      {/* Entry popover */}
      {popoverEntry && (() => {
        const { entry, x, y } = popoverEntry;
        const proj = projects.find((p) => p.id === entry.projectId);
        const canEdit = entry.status === "DRAFT" || entry.status === "PENDING" || entry.status === "REJECTED";
        const canDel = entry.status === "DRAFT";
        const sm = STATUS[entry.status as keyof typeof STATUS];
        const cardW = 228;
        const cardH = canEdit && canDel ? 168 : canEdit ? 136 : 110;
        const left = Math.min(x + 10, window.innerWidth - cardW - 8);
        const top = y + cardH > window.innerHeight - 8 ? y - cardH - 10 : y + 10;

        return (
          <>
            <div className="fixed inset-0 z-40" onClick={closePopover} />
            <div className="fixed z-50 rounded-xl py-2"
              style={{ left, top, width: cardW, background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 10px 40px rgba(0,0,0,0.12)" }}
              onClick={(ev) => ev.stopPropagation()}>

              <div className="px-3 pb-2 mb-1" style={{ borderBottom: `1px solid ${T.border2}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: proj?.color ?? T.orange }} />
                  <span className="text-sm font-semibold truncate" style={{ color: T.text }}>{proj?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: T.muted, fontFamily: "DM Mono, monospace" }}>
                    {entry.startTime} – {entry.endTime}
                  </span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                </div>
                {entry.note && (
                  <p className="text-xs mt-1 truncate" style={{ color: T.text2 }}>{entry.note}</p>
                )}
              </div>

              {!canEdit && !canDel && (
                <p className="px-3 py-2 text-xs" style={{ color: T.muted }}>Aksiyon yapılamaz</p>
              )}
              {canEdit && (
                <button onClick={openEdit}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                  style={{ background: "none", border: "none", color: T.text2, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                  <i className="ti ti-pencil text-sm" style={{ color: T.orange }} />
                  Düzenle
                </button>
              )}
              {canDel && (
                <button onClick={handleDelete}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                  style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                  <i className="ti ti-trash text-sm" />
                  Sil
                </button>
              )}
            </div>
          </>
        );
      })()}

      {/* Düzenleme modalı */}
      {editEntry && (
        <EditEntryModal entry={editEntry} projects={projects}
          onSave={handleEditSave} onClose={() => setEditEntry(null)}
          saving={editSaving} error={editError} isMobile={isMobile}
        />
      )}
    </div>
  );
}

// ─── WeekPage ─────────────────────────────────────────────────────────────────

export function WeekPage() {
  const { user } = useAuthStore();

  const [isMobile] = useState(() => typeof window !== "undefined" && (window.innerWidth < 768 || "ontouchstart" in window));
  const slotH = isMobile ? 36 : 28;

  const [week, setWeek] = useState(() => getISOWeek(new Date()));
  const [activeDate, setActiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [projects, setProjects] = useState<Project[]>([]);
  const [gamification, setGamification] = useState<{ xpTotal: number; streakDays: number } | null>(null);
  const [submitMsg, setSubmitMsg] = useState("");
  const [bannerDismissedDate, setBannerDismissedDate] = useState<string | null>(null);
  const [approvedLeaves, setApprovedLeaves] = useState<{ date: string; type: string }[]>([]);

  const { entries, loading, addEntry, updateEntry, deleteEntry, submitDay, refetch } = useEntries(week);

  const today = new Date().toISOString().slice(0, 10);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const dayTabsRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);
  const initialLoaded = useRef(false);

  useEffect(() => { if (!loading) initialLoaded.current = true; }, [loading]);

  useEffect(() => {
    if (!loading && savedScrollRef.current > 0 && gridScrollRef.current) {
      gridScrollRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = 0;
    }
  }, [loading, entries]);

  useEffect(() => {
    if (activeDate === today && gridScrollRef.current) {
      const d = new Date();
      const px = ((d.getHours() * 60 + d.getMinutes()) / 30) * slotH;
      gridScrollRef.current.scrollTop = Math.max(0, px - 120);
    }
  }, [activeDate, slotH]);

  // Aktif gün sekmesini görünüme kaydır
  useEffect(() => {
    if (!dayTabsRef.current) return;
    const el = dayTabsRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeDate, week]);

  const weekDates = getWeekDates(week);

  useEffect(() => {
    api.get<Project[]>("/projects").then(setProjects).catch(() => {});
    api.get<{ xpTotal: number; streakDays: number }>("/gamification/me")
      .then(setGamification).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ date: string; type: string; status: string }[]>(`/leaves?week=${week}`)
      .then((leaves) => setApprovedLeaves(leaves.filter((l) => l.status === "APPROVED")))
      .catch(() => {});
  }, [week]);

  useEffect(() => {
    if (!weekDates.includes(activeDate)) setActiveDate(weekDates[0]);
  }, [week]);

  function calcMin(list: TimeEntry[]) {
    return list.reduce((acc, e) => {
      const [sh, sm] = e.startTime.split(":").map(Number);
      const [eh, em] = e.endTime.split(":").map(Number);
      return acc + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);
  }
  const approvedEntries = entries.filter((e) => e.status === "APPROVED");
  const pendingEntries  = entries.filter((e) => e.status === "PENDING");
  const rejectedEntries = entries.filter((e) => e.status === "REJECTED");
  const draftEntries    = entries.filter((e) => e.status === "DRAFT");
  const totalMin    = calcMin(entries);
  const approvedMin = calcMin(approvedEntries);
  const pendingMin  = calcMin(pendingEntries);
  const rejectedMin = calcMin(rejectedEntries);
  const draftMin    = calcMin(draftEntries);
  const dayEntries = entries.filter((e) => e.date === activeDate);
  const dayTotal = calcMin(dayEntries);
  const hasDraft = dayEntries.some((e) => e.status === "DRAFT");

  function fmt(min: number) {
    const h = Math.floor(min / 60), m = min % 60;
    return m === 0 ? `${h}` : `${h}.5`;
  }

  const showBanner = !loading
    && activeDate === today
    && entries.filter((e) => e.date === today).length === 0
    && bannerDismissedDate !== today;

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

  const weekLabel = () => `${formatDate(weekDates[0])} – ${formatDate(weekDates[6])}`;

  async function handleAddEntry(projectId: string, note: string, startTime: string, endTime: string) {
    savedScrollRef.current = gridScrollRef.current?.scrollTop ?? 0;
    const endSlotIdx = slotIndex(endTime);
    if (endSlotIdx <= 48 && endTime !== "00:00") {
      await addEntry({ projectId, date: activeDate, startTime, endTime, note });
    } else {
      const dateIndex = weekDates.indexOf(activeDate);
      await addEntry({ projectId, date: activeDate, startTime, endTime: "23:30", note });
      if (dateIndex < 6)
        await addEntry({ projectId, date: weekDates[dateIndex + 1], startTime: "00:00", endTime, note });
    }
    refetch();
  }

  async function handleUpdateEntry(id: string, projectId: string, note: string) {
    await updateEntry(id, { projectId, note });
  }

  async function handleSubmit() {
    const draft = dayEntries.filter((e) => e.status === "DRAFT");
    if (draft.length === 0) { setSubmitMsg("Gönderilecek giriş yok"); return; }
    await submitDay(activeDate);
    setSubmitMsg(`${draft.length} giriş onaya gönderildi ✓`);
    setTimeout(() => setSubmitMsg(""), 3000);
  }

  const statCards = [
    { label: "Onaylanan", value: `${fmt(approvedMin)} sa`, sub: `${approvedEntries.length} giriş onaylandı`, accent: T.green, icon: "ti-circle-check" },
    { label: "Bekleyen",  value: `${fmt(pendingMin)} sa`,  sub: `${pendingEntries.length} giriş bekliyor`,   accent: T.amber, icon: "ti-clock-pause" },
    { label: "Reddedilen", value: `${fmt(rejectedMin)} sa`, sub: `${rejectedEntries.length} giriş reddedildi`, accent: T.red, icon: "ti-circle-x" },
  ];

  // Mobil submit bar içeriği (hem sabit mobil hem masaüstü kullanır)
  const submitBarContent = (
    <>
      <span className="text-sm" style={{ color: submitMsg ? T.green : T.muted }}>
        {submitMsg || (hasDraft
          ? `${dayEntries.filter((e) => e.status === "DRAFT").length} taslak giriş var`
          : "Tüm girişler gönderildi")}
      </span>
      <button onClick={handleSubmit} disabled={!hasDraft}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
        style={{
          background: hasDraft ? `linear-gradient(135deg, ${T.orange}, ${T.red})` : T.border,
          color: hasDraft ? "white" : T.muted,
          border: "none", cursor: hasDraft ? "pointer" : "not-allowed",
          boxShadow: hasDraft ? `0 4px 12px ${T.orange}30` : "none",
          minHeight: 44,
        }}>
        <i className="ti ti-send text-sm" />
        Onaya Gönder
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>

      {/* Sidebar — masaüstünde görünür (Sidebar kendi CSS'iyle mobilde gizlenir) */}
      <Sidebar gamification={gamification} />

      {/* Ana içerik */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Topbar */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 flex-shrink-0"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-sm md:text-base font-bold" style={{ color: T.text }}>Zaman Girişi</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setWeek(addWeeks(week, -1))}
                className="flex items-center justify-center rounded-lg transition-all"
                style={{ width: 32, height: 32, flexShrink: 0, background: "#FFFFFF", border: "1.5px solid #E5E7EB", borderRadius: 8, color: "#4B5563", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ti ti-chevron-left" style={{ fontSize: 14, color: "#4B5563" }} />
              </button>
              <span className="text-xs md:text-sm font-medium px-2 md:px-3 text-center"
                style={{ color: T.text2, minWidth: isMobile ? 100 : 140 }}>
                {weekLabel()}
              </span>
              <button onClick={() => setWeek(addWeeks(week, 1))}
                className="flex items-center justify-center rounded-lg transition-all"
                style={{ width: 32, height: 32, flexShrink: 0, background: "#FFFFFF", border: "1.5px solid #E5E7EB", borderRadius: 8, color: "#4B5563", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "#4B5563" }} />
              </button>
              <button onClick={() => { setWeek(getISOWeek(new Date())); setActiveDate(today); }}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all ml-1"
                style={{ background: T.orangeL, border: `1px solid ${T.orange}30`, color: T.orange, cursor: "pointer", minHeight: 36 }}>
                Bugün
              </button>
            </div>
          </div>
          <UserMenu />
        </header>

        {/* İzin banner */}
        {approvedLeaves.some((l) => l.date === activeDate) && (
          <div className="flex items-center gap-3 px-4 md:px-6 py-3 flex-shrink-0"
            style={{ background: "#F0FDF4", borderBottom: "1px solid #86EFAC" }}>
            <i className="ti ti-beach flex-shrink-0" style={{ color: "#16A34A" }} />
            <span className="text-sm flex-1" style={{ color: "#14532D" }}>
              Bu gün için onaylanmış bir izniniz var.
            </span>
          </div>
        )}

        {/* Hatırlatma banner */}
        {showBanner && (
          <div className="flex items-center gap-3 px-4 md:px-6 py-3 flex-shrink-0"
            style={{ background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
            <i className="ti ti-alert-triangle flex-shrink-0" style={{ color: "#F59E0B" }} />
            <span className="text-sm flex-1" style={{ color: "#92400E" }}>
              Bugün henüz giriş yapmadın — hadi bir blok seç!
            </span>
            <button onClick={() => setBannerDismissedDate(today)}
              style={{ background: "none", border: "none", color: "#B45309", cursor: "pointer", minHeight: 44, minWidth: 44 }}>
              <i className="ti ti-x text-sm" />
            </button>
          </div>
        )}

        {/* Kaydırılabilir içerik */}
        <div
          className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5"
          style={{ paddingBottom: isMobile ? 160 : 20 }}>

          {/* Stat kartları — mobilde 2 sütun, masaüstünde 4 sütun */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-5">
            {/* Bu Hafta */}
            <div className="rounded-xl px-3 md:px-4 py-3 md:py-4"
              style={{ background: T.surface, borderTop: `3px solid ${T.orange}`, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: T.muted }}>Bu Hafta</p>
                <span className="w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center" style={{ background: T.orange + "15" }}>
                  <i className="ti ti-clock text-sm" style={{ color: T.orange }} />
                </span>
              </div>
              <p className="text-xl md:text-2xl font-black" style={{ color: T.text }}>{fmt(totalMin)} sa</p>
              {totalMin > 0 ? (
                <div style={{ display: "flex", height: 4, borderRadius: 99, overflow: "hidden", marginTop: 8, marginBottom: 4, gap: 1 }}>
                  {draftMin    > 0 && <div style={{ flex: draftMin,    background: "#9CA3AF", borderRadius: 2 }} />}
                  {pendingMin  > 0 && <div style={{ flex: pendingMin,  background: T.amber,  borderRadius: 2 }} />}
                  {approvedMin > 0 && <div style={{ flex: approvedMin, background: T.green,  borderRadius: 2 }} />}
                  {rejectedMin > 0 && <div style={{ flex: rejectedMin, background: T.red,    borderRadius: 2 }} />}
                </div>
              ) : (
                <div style={{ height: 4, marginTop: 8, marginBottom: 4 }} />
              )}
              <p className="text-xs" style={{ color: T.muted }}>{entries.length} giriş · bu hafta</p>
            </div>

            {statCards.map((s) => (
              <div key={s.label} className="rounded-xl px-3 md:px-4 py-3 md:py-4"
                style={{ background: T.surface, borderTop: `3px solid ${s.accent}`, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: T.muted }}>{s.label}</p>
                  <span className="w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center" style={{ background: s.accent + "15" }}>
                    <i className={`ti ${s.icon} text-sm`} style={{ color: s.accent }} />
                  </span>
                </div>
                <p className="text-xl md:text-2xl font-black" style={{ color: T.text }}>{s.value}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: T.muted }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Gün sekmeleri — yatay kaydırılabilir */}
          <div ref={dayTabsRef} className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
            {weekDates.map((date, i) => {
              const cnt = entries.filter((e) => e.date === date).length;
              const hasPend = entries.some((e) => e.date === date && e.status === "PENDING");
              const hasAppr = entries.some((e) => e.date === date && e.status === "APPROVED");
              const isActive = date === activeDate;
              const isTday = date === today;
              const leave = approvedLeaves.find((l) => l.date === date);

              return (
                <button key={date}
                  data-active={String(isActive)}
                  onClick={() => setActiveDate(date)}
                  className="flex flex-col items-center px-3 py-2 rounded-xl transition-all flex-shrink-0"
                  style={{
                    background: isActive ? T.orange : leave ? "#F0FDF4" : T.surface,
                    border: `1.5px solid ${isActive ? T.orange : leave ? "#86EFAC" : isTday ? T.orange + "50" : T.border}`,
                    cursor: "pointer", minWidth: 52,
                    boxShadow: isActive ? `0 2px 8px ${T.orange}30` : "0 1px 2px rgba(0,0,0,0.04)",
                    minHeight: 44,
                  }}>
                  <span className="text-xs font-bold" style={{ color: isActive ? "white" : T.text2 }}>
                    {DAY_LABELS[i]}
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: isActive ? "rgba(255,255,255,0.8)" : T.muted }}>
                    {formatDate(date).split(" ")[0]}
                  </span>
                  {leave && !isActive && (
                    <span className="text-xs mt-0.5" style={{ color: T.green, fontSize: 8, fontWeight: 700 }}>İZİN</span>
                  )}
                  {cnt > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full mt-1" style={{
                      background: isActive ? "rgba(255,255,255,0.8)" : hasAppr ? T.green : hasPend ? T.amber : T.orange,
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Grid kapsayıcı */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>

            {/* Grid başlık */}
            <div className="flex items-center justify-between px-4 md:px-5 py-3"
              style={{ borderBottom: `1px solid ${T.border}`, background: "#FAFAFA" }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: T.text }}>
                  {formatDate(activeDate)} — {DAY_LABELS[weekDates.indexOf(activeDate)]}
                </span>
                {dayTotal > 0 && (
                  <span className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                    style={{ background: T.orangeL, color: T.orange }}>
                    {fmt(dayTotal)} saat
                  </span>
                )}
              </div>
              <span className="text-xs hidden sm:block" style={{ color: T.muted }}>
                <i className="ti ti-hand-click text-xs mr-1" />
                {isMobile ? "Tıklayarak seç" : "Sürükle veya tıkla"}
              </span>
            </div>

            {/* Scrollable grid */}
            <div ref={gridScrollRef} className="time-grid-scroll"
              style={{ height: isMobile ? 420 : 480, overflowY: "auto" }}>
              {loading && !initialLoaded.current ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2" style={{ color: T.muted }}>
                    <i className="ti ti-loader-2 animate-spin text-xl" />
                  </div>
                </div>
              ) : (
                <TimeGrid
                  date={activeDate} entries={entries} projects={projects}
                  onAddEntry={handleAddEntry} onDeleteEntry={deleteEntry}
                  onUpdateEntry={handleUpdateEntry}
                  isMobile={isMobile} slotH={slotH}
                />
              )}
            </div>

            {/* Masaüstü submit bar */}
            <div className="hidden md:flex items-center justify-between px-5 py-3"
              style={{ borderTop: `1px solid ${T.border}`, background: "#FAFAFA" }}>
              {submitBarContent}
            </div>
          </div>
        </div>

        {/* Mobil submit bar — sabit, tab bar'ın üzerinde */}
        {isMobile && (
          <div className="fixed left-0 right-0 z-30 flex items-center justify-between px-4 py-3 md:hidden"
            style={{ bottom: 64, background: T.surface, borderTop: `1px solid ${T.border}`, boxShadow: "0 -2px 8px rgba(0,0,0,0.06)" }}>
            {submitBarContent}
          </div>
        )}
      </div>
    </div>
  );
}
