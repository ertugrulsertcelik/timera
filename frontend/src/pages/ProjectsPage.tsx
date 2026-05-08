import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Sidebar } from "../components/Sidebar";
import { api } from "../api/client";
import { Project } from "../types";

// ─── Tasarım sabitleri ────────────────────────────────────────────────────────

const T = {
  bg: "#F5F6FA", surface: "#FFFFFF", border: "#E5E7EB",
  text: "#111827", text2: "#4B5563", muted: "#9CA3AF",
  orange: "#F4631E", orangeL: "#FFF0EB",
  green: "#16A34A", greenL: "#F0FDF4", greenB: "#86EFAC",
  red: "#991B1B", redL: "#FEF2F2", redB: "#FECACA",
};

// ─── Renk paleti ──────────────────────────────────────────────────────────────

const PALETTE = [
  "#F4631E", "#E8302A", "#F9A825", "#C2185B",
  "#7B1FA2", "#1565C0", "#00695C", "#E65100",
  "#5DCAA5", "#60A5FA", "#F472B6", "#FBBF24",
];

function isValidHex(val: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(val);
}

// ─── ColorPicker ──────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [raw, setRaw] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setRaw(value); }, [value]);

  function handleRawChange(v: string) {
    setRaw(v);
    if (isValidHex(v)) onChange(v);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {PALETTE.map((c) => (
          <button
            key={c} type="button"
            onClick={() => { onChange(c); setRaw(c); }}
            className="w-7 h-7 rounded-lg flex-shrink-0 transition-all"
            style={{
              background: c,
              border: value === c ? "2px solid #fff" : "2px solid transparent",
              outline: value === c ? `2px solid ${T.orange}` : "none",
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg flex-shrink-0"
          style={{ background: isValidHex(raw) ? raw : "#E5E7EB", border: `1px solid ${T.border}` }} />
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs select-none"
            style={{ color: T.muted, fontFamily: "DM Mono, monospace" }}>#</span>
          <input
            ref={inputRef}
            type="text"
            value={raw.replace(/^#/, "")}
            onChange={(e) => handleRawChange("#" + e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="F4631E"
            className="w-full rounded-xl pl-7 pr-3 py-2.5 text-xs outline-none"
            style={{
              background: "#F9FAFB",
              border: `1.5px solid ${isValidHex(raw) ? T.border : T.redB}`,
              color: T.text, fontFamily: "DM Mono, monospace", letterSpacing: "0.05em",
            }}
            onFocus={(e) => { e.target.style.borderColor = isValidHex(raw) ? T.orange : T.redB; e.target.style.background = "#FFFFFF"; }}
            onBlur={(e)  => { e.target.style.borderColor = isValidHex(raw) ? T.border : T.redB; e.target.style.background = "#F9FAFB"; }}
          />
        </div>
        <label className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
          style={{ background: "#F9FAFB", border: `1px solid ${T.border}` }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.orange; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}
          title="Renk seçici">
          <i className="ti ti-color-swatch text-sm" style={{ color: T.muted }} />
          <input
            type="color"
            value={isValidHex(raw) ? raw : "#F4631E"}
            onChange={(e) => { onChange(e.target.value.toUpperCase()); setRaw(e.target.value.toUpperCase()); }}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}

// ─── ProjectModal ─────────────────────────────────────────────────────────────

interface ProjectModalProps {
  initial?: Project | null;
  onSave: (data: { name: string; color: string; description: string }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string;
}

function ProjectModal({ initial, onSave, onClose, saving, error }: ProjectModalProps) {
  const [name, setName]   = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#F4631E");
  const [desc, setDesc]   = useState(initial?.description ?? "");

  const isEdit  = !!initial;
  const canSave = name.trim().length > 0 && isValidHex(color);

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
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base" style={{ color: T.text }}>
            {isEdit ? "Projeyi Düzenle" : "Yeni Proje"}
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ background: "#F9FAFB", border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.border; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
          >
            <i className="ti ti-x text-sm" />
          </button>
        </div>

        <label className="block text-xs font-medium mb-1.5" style={{ color: T.text2 }}>Proje adı</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Örn. Backend Geliştirme"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-4"
          style={{
            background: "#F9FAFB", border: `1.5px solid ${T.border}`,
            color: T.text, fontFamily: "DM Sans, sans-serif",
          }}
          onFocus={(e) => { e.target.style.borderColor = T.orange; e.target.style.background = "#FFFFFF"; }}
          onBlur={(e)  => { e.target.style.borderColor = T.border;  e.target.style.background = "#F9FAFB"; }}
          autoFocus
        />

        <label className="block text-xs font-medium mb-1.5" style={{ color: T.text2 }}>
          Açıklama <span style={{ color: T.muted }}>(opsiyonel)</span>
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, 500))}
          rows={2}
          maxLength={500}
          placeholder="Kısa bir açıklama..."
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none mb-4"
          style={{
            background: "#F9FAFB", border: `1.5px solid ${T.border}`,
            color: T.text, fontFamily: "DM Sans, sans-serif",
          }}
          onFocus={(e) => { e.target.style.borderColor = T.orange; e.target.style.background = "#FFFFFF"; }}
          onBlur={(e)  => { e.target.style.borderColor = T.border;  e.target.style.background = "#F9FAFB"; }}
        />

        <label className="block text-xs font-medium mb-2" style={{ color: T.text2 }}>Proje rengi</label>
        <ColorPicker value={color} onChange={setColor} />

        {error && (
          <p className="text-xs mt-3 px-3 py-2 rounded-lg"
            style={{ background: T.redL, color: T.red, border: `1px solid ${T.redB}` }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: "#F9FAFB", border: `1.5px solid ${T.border}`, color: T.text2, cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.border; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
          >
            Vazgeç
          </button>
          <button
            onClick={() => onSave({ name: name.trim(), color, description: desc.trim() })}
            disabled={!canSave || saving}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold"
            style={{
              background: (!canSave || saving) ? "#F3F4F6" : "linear-gradient(135deg, #F4631E, #E8302A)",
              border: "none",
              color: (!canSave || saving) ? T.muted : "white",
              cursor: (!canSave || saving) ? "not-allowed" : "pointer",
              boxShadow: (!canSave || saving) ? "none" : "0 4px 12px rgba(244,99,30,0.3)",
            }}>
            {saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DeactivateConfirm ────────────────────────────────────────────────────────

interface DeactivateConfirmProps {
  project: Project;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

function DeactivateConfirm({ project, onConfirm, onClose, loading }: DeactivateConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl p-6" style={{
        background: T.surface, border: `1px solid ${T.border}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
      }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: T.redL, border: `1px solid ${T.redB}` }}>
          <i className="ti ti-power-off" style={{ fontSize: 22, color: "#E8302A" }} />
        </div>
        <h3 className="font-bold text-sm mb-1.5" style={{ color: T.text }}>Projeyi Pasife Al</h3>
        <p className="text-xs mb-5" style={{ color: T.text2, lineHeight: 1.6 }}>
          <span style={{ color: T.orange, fontWeight: 600 }}>{project.name}</span> projesi yeni girişlerde
          görünmez. Mevcut girişler korunur.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: "#F9FAFB", border: `1.5px solid ${T.border}`, color: T.text2, cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.border; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
          >
            Vazgeç
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
            style={{
              background: loading ? "#F3F4F6" : T.redL,
              border: `1.5px solid ${loading ? T.border : T.redB}`,
              color: loading ? T.muted : T.red,
              cursor: loading ? "not-allowed" : "pointer",
            }}>
            {loading ? "Yapılıyor..." : "Pasife Al"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProjectsPage ─────────────────────────────────────────────────────────────

export function ProjectsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [projects, setProjects]                   = useState<Project[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [showModal, setShowModal]                 = useState(false);
  const [editTarget, setEditTarget]               = useState<Project | null>(null);
  const [deactivateTarget, setDeactivateTarget]   = useState<Project | null>(null);
  const [saving, setSaving]                       = useState(false);
  const [actionId, setActionId]                   = useState<string | null>(null);
  const [modalError, setModalError]               = useState("");
  const [toast, setToast]                         = useState("");
  const [filter, setFilter]                       = useState<"active" | "all">("active");

  useEffect(() => {
    if (user && user.role !== "MANAGER") navigate("/", { replace: true });
  }, [user, navigate]);

  const fetchProjects = () => {
    setLoading(true);
    api.get<Project[]>("/projects/all")
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function openCreate() {
    setEditTarget(null);
    setModalError("");
    setShowModal(true);
  }

  function openEdit(p: Project) {
    setEditTarget(p);
    setModalError("");
    setShowModal(true);
  }

  async function handleSave(data: { name: string; color: string; description: string }) {
    setSaving(true);
    setModalError("");
    try {
      if (editTarget) {
        const updated = await api.put<Project>(`/projects/${editTarget.id}`, data);
        setProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p));
        showToast("Proje güncellendi");
      } else {
        const created = await api.post<Project>("/projects", data);
        setProjects((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "tr")));
        showToast("Proje oluşturuldu");
      }
      setShowModal(false);
    } catch (err: any) {
      setModalError(err.message || "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setActionId(deactivateTarget.id);
    try {
      await api.patch(`/projects/${deactivateTarget.id}/deactivate`);
      setProjects((prev) => prev.map((p) =>
        p.id === deactivateTarget.id ? { ...p, isActive: false } : p
      ));
      showToast(`"${deactivateTarget.name}" pasife alındı`);
      setDeactivateTarget(null);
    } catch (err: any) {
      showToast(err.message || "Bir hata oluştu");
    } finally {
      setActionId(null);
    }
  }

  async function handleDeleteProject(project: Project) {
    if (!window.confirm(`"${project.name}" projesini silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz.`)) return;
    setActionId(project.id);
    try {
      await api.delete(`/projects/${project.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      showToast(`"${project.name}" silindi`);
    } catch (err: any) {
      showToast(err.message || "Proje silinemedi");
    } finally {
      setActionId(null);
    }
  }

  const displayed    = projects.filter((p) => filter === "all" || p.isActive);
  const activeCount  = projects.filter((p) => p.isActive).length;
  const inactiveCount = projects.filter((p) => !p.isActive).length;

  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>

      <Sidebar />

      {/* ── Ana içerik ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 flex-shrink-0"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: T.text }}>Projeler</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: T.orangeL, color: T.orange }}>
              {activeCount} aktif{inactiveCount > 0 ? ` · ${inactiveCount} pasif` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Filtre */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              {(["active", "all"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: filter === f ? T.orange : "transparent",
                    color: filter === f ? "white" : T.text2,
                    border: "none", cursor: "pointer",
                  }}>
                  {f === "active" ? "Aktif" : "Tümü"}
                </button>
              ))}
            </div>
            {/* Yeni proje */}
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: "linear-gradient(135deg, #F4631E, #E8302A)",
                border: "none", color: "white", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(244,99,30,0.35)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(244,99,30,0.45)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(244,99,30,0.35)"; }}
            >
              <i className="ti ti-plus text-sm" />
              Yeni Proje
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
                <i className="ti ti-loader-2 animate-spin" /> Yükleniyor...
              </div>
            </div>
          )}

          {!loading && displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: T.orangeL, border: `1px solid rgba(244,99,30,0.2)` }}>
                <i className="ti ti-folder-off" style={{ fontSize: 28, color: T.orange }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: T.text }}>
                {filter === "active" ? "Aktif proje yok" : "Hiç proje yok"}
              </p>
              {filter === "active" && inactiveCount > 0 && (
                <button onClick={() => setFilter("all")} className="text-xs mt-1 transition-all"
                  style={{ color: T.orange, background: "none", border: "none", cursor: "pointer" }}>
                  Pasif projeleri göster →
                </button>
              )}
            </div>
          )}

          {/* Proje tablosu */}
          {!loading && displayed.length > 0 && (
            <div className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              {/* Başlık */}
              <div className="grid px-4 py-3" style={{
                gridTemplateColumns: "2fr 3fr 90px 110px",
                background: "#F9FAFB", borderBottom: `1px solid ${T.border}`,
              }}>
                {["Proje", "Açıklama", "Durum", ""].map((h) => (
                  <span key={h} className="text-xs font-semibold"
                    style={{ color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Satırlar */}
              {displayed.map((project, idx) => {
                const busy = actionId === project.id;
                return (
                  <div key={project.id}
                    className="grid items-center px-4 py-3.5 transition-all"
                    style={{
                      gridTemplateColumns: "2fr 3fr 90px 110px",
                      background: busy ? "#FFF7F5" : T.surface,
                      borderBottom: idx < displayed.length - 1 ? `1px solid ${T.border}` : "none",
                      opacity: busy ? 0.7 : 1,
                    }}>

                    {/* Proje adı */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ background: project.color, boxShadow: `0 0 0 3px ${project.color}20` }} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: T.text }}>
                          {project.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: T.muted, fontFamily: "DM Mono, monospace" }}>
                          {project.color.toLowerCase()}
                        </p>
                      </div>
                    </div>

                    {/* Açıklama */}
                    <p className="text-xs truncate pr-4" style={{ color: T.text2 }}>
                      {project.description || <span style={{ color: T.border }}>—</span>}
                    </p>

                    {/* Durum */}
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={project.isActive
                          ? { background: T.greenL, color: T.green, border: `1px solid ${T.greenB}` }
                          : { background: "#F9FAFB", color: T.muted, border: `1px solid ${T.border}` }
                        }>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: project.isActive ? T.green : T.muted }} />
                        {project.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    {/* Aksiyonlar */}
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(project)}
                        disabled={busy}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                        style={{
                          background: "transparent", border: `1px solid ${T.border}`,
                          color: busy ? T.border : T.muted, cursor: busy ? "not-allowed" : "pointer",
                        }}
                        onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; e.currentTarget.style.background = T.orangeL; } }}
                        onMouseLeave={(e) => { if (!busy) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; e.currentTarget.style.background = "transparent"; } }}
                        title="Düzenle"
                      >
                        <i className="ti ti-pencil" style={{ fontSize: 13 }} />
                      </button>

                      {project.isActive && (
                        <button
                          onClick={() => setDeactivateTarget(project)}
                          disabled={busy}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                          style={{
                            background: "transparent", border: `1px solid ${T.border}`,
                            color: busy ? T.border : T.muted, cursor: busy ? "not-allowed" : "pointer",
                          }}
                          onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.borderColor = T.redB; e.currentTarget.style.color = "#E8302A"; e.currentTarget.style.background = T.redL; } }}
                          onMouseLeave={(e) => { if (!busy) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; e.currentTarget.style.background = "transparent"; } }}
                          title="Pasife al"
                        >
                          <i className="ti ti-power-off" style={{ fontSize: 13 }} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteProject(project)}
                        disabled={busy}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                        style={{
                          background: "transparent", border: `1px solid ${T.border}`,
                          color: busy ? T.border : T.muted, cursor: busy ? "not-allowed" : "pointer",
                        }}
                        onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.borderColor = "#FECACA"; e.currentTarget.style.color = "#B91C1C"; e.currentTarget.style.background = "#FEF2F2"; } }}
                        onMouseLeave={(e) => { if (!busy) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; e.currentTarget.style.background = "transparent"; } }}
                        title="Sil"
                      >
                        <i className="ti ti-trash" style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modaller */}
      {showModal && (
        <ProjectModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          error={modalError}
        />
      )}

      {deactivateTarget && (
        <DeactivateConfirm
          project={deactivateTarget}
          onConfirm={handleDeactivate}
          onClose={() => setDeactivateTarget(null)}
          loading={actionId === deactivateTarget.id}
        />
      )}

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
