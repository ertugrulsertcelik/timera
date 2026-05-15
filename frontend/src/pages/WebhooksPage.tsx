import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { UserMenu } from "../components/UserMenu";
import { useAuthStore } from "../store/authStore";
import { api } from "../api/client";

const T = {
  bg: "var(--c-bg)", surface: "var(--c-surface)", border: "var(--c-border)",
  text: "var(--c-text)", text2: "var(--c-text2)", muted: "var(--c-muted)",
  orange: "#2563EB", orangeL: "var(--c-orangeL)",
  red: "#1D4ED8", redL: "var(--c-danger-bg)",
  green: "#16A34A", greenL: "var(--c-success-bg)", greenB: "var(--c-success-border)",
};

type WebhookType = "SLACK" | "TEAMS";
type WebhookEvent = "ENTRY_SUBMITTED" | "ENTRY_APPROVED" | "ENTRY_REJECTED" | "LEAVE_APPROVED" | "LEAVE_REJECTED";

const ALL_EVENTS: { key: WebhookEvent; label: string }[] = [
  { key: "ENTRY_SUBMITTED", label: "Giriş Onaya Gönderildi" },
  { key: "ENTRY_APPROVED",  label: "Giriş Onaylandı" },
  { key: "ENTRY_REJECTED",  label: "Giriş Reddedildi" },
  { key: "LEAVE_APPROVED",  label: "İzin Onaylandı" },
  { key: "LEAVE_REJECTED",  label: "İzin Reddedildi" },
];

interface WebhookConfig {
  id: string;
  name: string;
  type: WebhookType;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  type: "SLACK" as WebhookType,
  url: "",
  events: [] as WebhookEvent[],
  isActive: true,
};

function Badge({ active }: { active: boolean }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: active ? T.greenL : "#F3F4F6",
      color: active ? T.green : T.muted,
      border: `1px solid ${active ? T.greenB : T.border}`,
    }}>
      {active ? "Aktif" : "Pasif"}
    </span>
  );
}

function TypeIcon({ type }: { type: WebhookType }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700,
      background: type === "SLACK" ? "#ECF4FF" : "#F0F0FF",
      color: type === "SLACK" ? "#1264A3" : "#6264A7",
    }}>
      {type === "SLACK" ? "Slack" : "Teams"}
    </span>
  );
}

export function WebhooksPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [hooks, setHooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "MANAGER") navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => { fetchHooks(); }, []);

  function fetchHooks() {
    setLoading(true);
    api.get<WebhookConfig[]>("/webhooks")
      .then(setHooks)
      .catch(() => showToast("Webhook'lar yüklenemedi"))
      .finally(() => setLoading(false));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(h: WebhookConfig) {
    setEditId(h.id);
    setForm({ name: h.name, type: h.type, url: h.url, events: h.events, isActive: h.isActive });
    setShowModal(true);
  }

  function toggleEvent(ev: WebhookEvent) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast("İsim zorunlu"); return; }
    if (!form.url.trim()) { showToast("URL zorunlu"); return; }
    if (form.events.length === 0) { showToast("En az bir olay seçin"); return; }
    setSaving(true);
    try {
      if (editId) {
        const updated = await api.put<WebhookConfig>(`/webhooks/${editId}`, form);
        setHooks((hs) => hs.map((h) => h.id === editId ? updated : h));
        showToast("Webhook güncellendi");
      } else {
        const created = await api.post<WebhookConfig>("/webhooks", form);
        setHooks((hs) => [created, ...hs]);
        showToast("Webhook eklendi");
      }
      setShowModal(false);
    } catch {
      showToast("Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await api.post(`/webhooks/${id}/test`, {});
      showToast("Test mesajı gönderildi");
    } catch {
      showToast("Test mesajı gönderilemedi");
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/webhooks/${id}`);
      setHooks((hs) => hs.filter((h) => h.id !== id));
      showToast("Webhook silindi");
    } catch {
      showToast("Silme başarısız");
    } finally {
      setDeletingId(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 10,
    border: `1.5px solid ${T.border}`, background: "var(--c-input-bg)",
    color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "DM Sans, sans-serif",
  };

  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 flex-shrink-0"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span className="text-sm font-semibold" style={{ color: T.text }}>Webhook Bildirimleri</span>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: T.orange, color: "white", border: "none", cursor: "pointer" }}
            >
              <i className="ti ti-plus text-sm" />
              Webhook Ekle
            </button>
            <UserMenu />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl mb-5"
            style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            <i className="ti ti-info-circle text-sm flex-shrink-0 mt-0.5" style={{ color: "#2563EB" }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: "#1E40AF", marginBottom: 2 }}>
                Slack & Microsoft Teams Desteği
              </p>
              <p className="text-xs" style={{ color: "#3B82F6", lineHeight: 1.5 }}>
                Incoming Webhook URL'sini yapıştırın. Belirttiğiniz olaylar gerçekleştiğinde bildirim gönderilir.
                Slack için <strong>App &gt; Incoming Webhooks</strong>, Teams için <strong>Bağlayıcılar &gt; Incoming Webhook</strong> kullanın.
              </p>
            </div>
          </div>

          {/* Webhook listesi */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <i className="ti ti-loader-2 animate-spin text-xl" style={{ color: T.muted }} />
              </div>
            ) : hooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <i className="ti ti-webhook" style={{ fontSize: 40, color: T.border, marginBottom: 12 }} />
                <p className="text-sm font-medium" style={{ color: T.muted }}>Henüz webhook yok</p>
                <p className="text-xs mt-1" style={{ color: T.muted }}>Slack veya Teams'e bildirim göndermek için ekleyin</p>
              </div>
            ) : (
              <div>
                {hooks.map((h, i) => (
                  <div key={h.id}
                    className="flex items-start gap-4 px-5 py-4"
                    style={{ borderBottom: i < hooks.length - 1 ? `1px solid ${T.border}` : "none" }}>

                    {/* Sol icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: h.type === "SLACK" ? "#ECF4FF" : "#F0F0FF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <i className="ti ti-brand-slack" style={{
                        fontSize: 18,
                        color: h.type === "SLACK" ? "#1264A3" : "#6264A7",
                      }} />
                    </div>

                    {/* Bilgiler */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold" style={{ color: T.text }}>{h.name}</span>
                        <TypeIcon type={h.type} />
                        <Badge active={h.isActive} />
                      </div>
                      <p className="text-xs mb-2 truncate" style={{ color: T.muted, fontFamily: "DM Mono, monospace" }}>
                        {h.url}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {h.events.map((ev) => (
                          <span key={ev} style={{
                            padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                            background: T.orangeL, color: T.orange,
                          }}>
                            {ALL_EVENTS.find((e) => e.key === ev)?.label ?? ev}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Aksiyonlar */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleTest(h.id)}
                        disabled={testingId === h.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          background: "var(--c-input-bg)", border: `1px solid ${T.border}`,
                          color: T.text2, cursor: "pointer",
                        }}
                      >
                        <i className={`ti ${testingId === h.id ? "ti-loader-2 animate-spin" : "ti-send"} text-xs`} />
                        {testingId === h.id ? "Gönderiliyor..." : "Test"}
                      </button>
                      <button
                        onClick={() => openEdit(h)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          background: "var(--c-input-bg)", border: `1px solid ${T.border}`,
                          color: T.text2, cursor: "pointer",
                        }}
                      >
                        <i className="ti ti-pencil text-xs" />
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(h.id)}
                        disabled={deletingId === h.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          background: T.redL, border: `1px solid var(--c-danger-border)`,
                          color: T.red, cursor: "pointer",
                        }}
                      >
                        <i className={`ti ${deletingId === h.id ? "ti-loader-2 animate-spin" : "ti-trash"} text-xs`} />
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{
            background: T.surface, borderRadius: 16, width: 480, maxHeight: "90vh",
            overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ padding: "24px 28px 0" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 20 }}>
                {editId ? "Webhook Düzenle" : "Yeni Webhook"}
              </h2>
            </div>

            <div style={{ padding: "0 28px 24px" }}>
              {/* İsim */}
              <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: "block", marginBottom: 5 }}>
                İsim
              </label>
              <input
                value={form.name} maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Örn: Slack Bildirim Kanalı"
                style={{ ...inputStyle, marginBottom: 14 }}
                onFocus={(e) => (e.target.style.borderColor = T.orange)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />

              {/* Tür */}
              <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: "block", marginBottom: 5 }}>
                Platform
              </label>
              <div className="flex gap-2 mb-4">
                {(["SLACK", "TEAMS"] as WebhookType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    style={{
                      flex: 1, padding: "9px", borderRadius: 10, border: `2px solid`,
                      borderColor: form.type === t ? T.orange : T.border,
                      background: form.type === t ? T.orangeL : "var(--c-input-bg)",
                      color: form.type === t ? T.orange : T.text2,
                      cursor: "pointer", fontWeight: 600, fontSize: 13,
                      fontFamily: "DM Sans, sans-serif",
                    }}
                  >
                    {t === "SLACK" ? "Slack" : "Microsoft Teams"}
                  </button>
                ))}
              </div>

              {/* URL */}
              <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: "block", marginBottom: 5 }}>
                Webhook URL
              </label>
              <input
                value={form.url} type="url"
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder={form.type === "SLACK" ? "https://hooks.slack.com/..." : "https://outlook.office.com/webhook/..."}
                style={{ ...inputStyle, marginBottom: 14 }}
                onFocus={(e) => (e.target.style.borderColor = T.orange)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />

              {/* Olaylar */}
              <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: "block", marginBottom: 8 }}>
                Olaylar
              </label>
              <div className="flex flex-col gap-2 mb-4">
                {ALL_EVENTS.map(({ key, label }) => {
                  const checked = form.events.includes(key);
                  return (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <div
                        onClick={() => toggleEvent(key)}
                        style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                          border: `2px solid ${checked ? T.orange : T.border}`,
                          background: checked ? T.orange : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        {checked && <i className="ti ti-check" style={{ fontSize: 11, color: "white" }} />}
                      </div>
                      <span className="text-sm" style={{ color: T.text }}>{label}</span>
                    </label>
                  );
                })}
              </div>

              {/* Aktif toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 20 }}>
                <div
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  style={{
                    width: 36, height: 20, borderRadius: 99, cursor: "pointer", flexShrink: 0,
                    background: form.isActive ? T.orange : T.border,
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", background: "white",
                    position: "absolute", top: 3, transition: "left 0.2s",
                    left: form.isActive ? 19 : 3,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
                <span className="text-sm" style={{ color: T.text }}>Aktif</span>
              </label>

              {/* Butonlar */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 10,
                    background: "var(--c-input-bg)", border: `1px solid ${T.border}`,
                    color: T.text2, cursor: "pointer", fontSize: 13, fontWeight: 600,
                    fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 10,
                    background: saving ? T.muted : T.orange, border: "none",
                    color: "white", cursor: saving ? "not-allowed" : "pointer",
                    fontSize: 13, fontWeight: 600, fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  {saving ? "Kaydediliyor..." : editId ? "Güncelle" : "Ekle"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
