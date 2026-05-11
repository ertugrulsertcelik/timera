import { useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Sidebar } from "../components/Sidebar";
import { UserMenu } from "../components/UserMenu";
import { api } from "../api/client";

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg: "var(--c-bg)", surface: "var(--c-surface)", border: "var(--c-border)",
  text: "var(--c-text)", text2: "var(--c-text2)", muted: "var(--c-muted)",
  orange: "#2563EB", orangeL: "var(--c-orangeL)",
  red: "#1D4ED8",
  green: "#16A34A", greenL: "#F0FDF4", greenB: "#86EFAC",
  purple: "#7B1FA2", purpleL: "#F3E8FF",
  amber: "#92400E", amberL: "#FEF3C7",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER";
  isActive: boolean;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.25)" }}
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

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium mb-1.5" style={{ color: T.text2 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: `1px solid ${T.border}`, background: T.bg,
  color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box",
};

// ─── UsersPage ────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createModal, setCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EMPLOYEE" as "EMPLOYEE" | "MANAGER" });
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "EMPLOYEE" as "EMPLOYEE" | "MANAGER", isActive: true });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (user?.role !== "MANAGER") { navigate("/"); return; }
    fetchUsers();
  }, [user]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const data = await api.get<UserItem[]>("/users");
      setUsers(data);
    } catch {
      setError("Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setFormError("");
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormError("Tüm alanlar zorunludur"); return;
    }
    setSaving(true);
    try {
      await api.post("/users", form);
      setCreateModal(false);
      setForm({ name: "", email: "", password: "", role: "EMPLOYEE" });
      fetchUsers();
    } catch (e: any) {
      setFormError(e?.message || "Kullanıcı oluşturulamadı");
    } finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editTarget) return;
    setFormError("");
    setSaving(true);
    try {
      await api.put(`/users/${editTarget.id}`, editForm);
      setEditTarget(null);
      fetchUsers();
    } catch (e: any) {
      setFormError(e?.message || "Güncellenemedi");
    } finally { setSaving(false); }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setFormError("");
    if (!newPassword) { setFormError("Yeni şifre boş olamaz"); return; }
    setSaving(true);
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { newPassword });
      setResetTarget(null);
      setNewPassword("");
    } catch (e: any) {
      setFormError(e?.message || "Şifre sıfırlanamadı");
    } finally { setSaving(false); }
  }

  async function handleToggleActive(u: UserItem) {
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      fetchUsers();
    } catch { /* yoksay */ }
  }

  async function handleDelete(u: UserItem) {
    if (!window.confirm(`"${u.name}" adlı kullanıcıyı silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz, tüm girişleri de silinecektir.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      fetchUsers();
    } catch (e: any) {
      alert(e?.message || "Kullanıcı silinemedi");
    }
  }

  function openEdit(u: UserItem) {
    setEditTarget(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, isActive: u.isActive });
    setFormError("");
  }

  function openReset(u: UserItem) {
    setResetTarget(u);
    setNewPassword("");
    setFormError("");
  }

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="flex h-screen" style={{ background: T.bg }}>
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 md:px-8 py-5 flex-shrink-0" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-lg" style={{ color: T.text }}>Kullanıcı Yönetimi</h1>
              <p className="text-xs mt-0.5" style={{ color: T.muted }}>
                {users.length} kullanıcı · {activeCount} aktif
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setCreateModal(true); setForm({ name: "", email: "", password: "", role: "EMPLOYEE" }); setFormError(""); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: T.orange, color: "white", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.red)}
                onMouseLeave={(e) => (e.currentTarget.style.background = T.orange)}
              >
                <i className="ti ti-user-plus" />
                <span className="hidden sm:inline"> Yeni Kullanıcı</span>
              </button>
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 pb-20 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p style={{ color: T.muted, fontSize: 13 }}>Yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-40">
              <p style={{ color: T.red, fontSize: 13 }}>{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${T.border}` }}>
            <div className="rounded-xl overflow-hidden" style={{ background: T.surface, minWidth: 520 }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                    {(["Kullanıcı", "E-posta", "Rol", "Durum", "İşlemler"] as const).map((h, i) => (
                      <th key={h}
                        className={`text-left px-5 py-3 text-xs font-semibold${i === 1 ? " hidden md:table-cell" : ""}`}
                        style={{ color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      {/* Ad */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                            style={{ background: T.orangeL, color: T.orange }}>
                            {u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium" style={{ color: T.text }}>{u.name}</span>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-5 py-3.5 text-sm hidden md:table-cell" style={{ color: T.text2 }}>{u.email}</td>
                      {/* Rol */}
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={u.role === "MANAGER"
                            ? { background: T.purpleL, color: T.purple }
                            : { background: T.bg, color: T.text2, border: `1px solid ${T.border}` }}>
                          {u.role === "MANAGER" ? "Yönetici" : "Çalışan"}
                        </span>
                      </td>
                      {/* Durum */}
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={u.isActive
                            ? { background: T.greenL, color: T.green, border: `1px solid ${T.greenB}` }
                            : { background: "var(--c-input-bg)", color: T.muted, border: `1px solid ${T.border}` }}>
                          {u.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      {/* Islemler */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(u)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                            style={{ background: T.bg, color: T.text2, border: `1px solid ${T.border}`, cursor: "pointer" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = T.orangeL; e.currentTarget.style.color = T.orange; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = T.bg; e.currentTarget.style.color = T.text2; }}
                          >
                            <i className="ti ti-pencil" /><span className="hidden sm:inline"> Düzenle</span>
                          </button>
                          <button onClick={() => openReset(u)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                            style={{ background: T.bg, color: T.text2, border: `1px solid ${T.border}`, cursor: "pointer" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = T.amberL; e.currentTarget.style.color = T.amber; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = T.bg; e.currentTarget.style.color = T.text2; }}
                          >
                            <i className="ti ti-key" /><span className="hidden sm:inline"> Şifre</span>
                          </button>
                          <button onClick={() => handleToggleActive(u)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                            style={{
                              background: u.isActive ? "#FEF2F2" : T.greenL,
                              color: u.isActive ? "#991B1B" : T.green,
                              border: `1px solid ${u.isActive ? "#FECACA" : T.greenB}`,
                              cursor: "pointer",
                            }}>
                            <i className={`ti ${u.isActive ? "ti-user-off" : "ti-user-check"}`} />
                            <span className="hidden sm:inline">{u.isActive ? " Pasife Al" : " Aktive Et"}</span>
                          </button>
                          <button onClick={() => handleDelete(u)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                            style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA", cursor: "pointer" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "#FEF2F2"; }}
                          >
                            <i className="ti ti-trash" /><span className="hidden sm:inline"> Sil</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="py-16 text-center">
                  <i className="ti ti-users" style={{ fontSize: 36, color: T.muted }} />
                  <p className="text-sm mt-2" style={{ color: T.muted }}>Henüz kullanıcı yok</p>
                </div>
              )}
            </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {createModal && (
        <Modal title="Yeni Kullanıcı" onClose={() => setCreateModal(false)}>
          <Field label="Ad Soyad">
            <input style={inputStyle} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 100) })}
              maxLength={100} placeholder="İsim Soyisim" />
          </Field>
          <Field label="E-posta">
            <input style={inputStyle} type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value.slice(0, 254) })}
              maxLength={254} placeholder="kullanici@sirket.com" />
          </Field>
          <Field label="Şifre">
            <input style={inputStyle} type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value.slice(0, 128) })}
              maxLength={128} placeholder="En az 6 karakter" />
          </Field>
          <Field label="Rol">
            <select style={inputStyle} value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "EMPLOYEE" | "MANAGER" })}>
              <option value="EMPLOYEE">Çalışan</option>
              <option value="MANAGER">Yönetici</option>
            </select>
          </Field>
          {formError && <p className="text-xs mb-4" style={{ color: T.red }}>{formError}</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setCreateModal(false)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text2, cursor: "pointer" }}>
              İptal
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: T.orange, color: "white", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Kaydediliyor..." : "Oluştur"}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal title={`Düzenle — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <Field label="Ad Soyad">
            <input style={inputStyle} value={editForm.name}
              maxLength={100}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value.slice(0, 100) })} />
          </Field>
          <Field label="E-posta">
            <input style={inputStyle} type="email" value={editForm.email}
              maxLength={254}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value.slice(0, 254) })} />
          </Field>
          <Field label="Rol">
            <select style={inputStyle} value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "EMPLOYEE" | "MANAGER" })}>
              <option value="EMPLOYEE">Çalışan</option>
              <option value="MANAGER">Yönetici</option>
            </select>
          </Field>
          {formError && <p className="text-xs mb-4" style={{ color: T.red }}>{formError}</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setEditTarget(null)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text2, cursor: "pointer" }}>
              İptal
            </button>
            <button onClick={handleEdit} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: T.orange, color: "white", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <Modal title={`Şifre Sıfırla — ${resetTarget.name}`} onClose={() => setResetTarget(null)}>
          <Field label="Yeni Şifre">
            <input style={inputStyle} type="password" value={newPassword}
              maxLength={128}
              onChange={(e) => setNewPassword(e.target.value.slice(0, 128))}
              placeholder="En az 6 karakter" />
          </Field>
          {formError && <p className="text-xs mb-4" style={{ color: T.red }}>{formError}</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setResetTarget(null)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text2, cursor: "pointer" }}>
              İptal
            </button>
            <button onClick={handleResetPassword} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "#0EA5E9", color: "white", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Sıfırlanıyor..." : "Şifreyi Sıfırla"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
