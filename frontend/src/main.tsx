import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import "./index.css";
import { LoginPage } from "./pages/LoginPage";
import { WeekPage } from "./pages/WeekPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { UsersPage } from "./pages/UsersPage";
import { LeavePage } from "./pages/LeavePage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { useAuthStore } from "./store/authStore";
import { api } from "./api/client";

const IDLE_MS = 15 * 60 * 1000;

const T = {
  border: "var(--c-border)", bg: "var(--c-bg)", text: "var(--c-text)", text2: "var(--c-text2)",
  muted: "var(--c-muted)", orange: "#2563EB", red: "#1D4ED8",
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: "#1F2937", color: "white",
      padding: "12px 18px", borderRadius: 10, fontSize: 13,
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)", maxWidth: 320,
      display: "flex", alignItems: "center", gap: 10,
      animation: "toastIn 0.2s ease",
    }}>
      <i className="ti ti-alert-circle" style={{ color: "#F59E0B", fontSize: 16, flexShrink: 0 }} />
      {message}
    </div>
  );
}

// ── İlk giriş şifre belirleme modalı ─────────────────────────────────────────
function SetInitialPasswordModal({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setErr("");
    if (pw.length < 6) { setErr("Şifre en az 6 karakter olmalı"); return; }
    if (pw !== pw2) { setErr("Şifreler eşleşmiyor"); return; }
    setSaving(true);
    try {
      await api.put("/users/me/set-initial-password", { newPassword: pw });
      onDone();
    } catch (e: any) {
      setErr(e?.message || "Şifre belirlenemedi");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1.5px solid ${T.border}`, background: T.bg,
    color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box",
    marginBottom: 12,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--c-surface)", borderRadius: 16, width: 420, padding: "32px 32px 28px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: "#EFF6FF",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}>
            <i className="ti ti-lock" style={{ fontSize: 22, color: T.orange }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>
            Şifrenizi Belirleyin
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
            Yöneticiniz hesabınızı oluşturdu. Devam etmek için kendinize ait bir şifre belirleyin.
          </p>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: "block", marginBottom: 6 }}>
          Yeni Şifre
        </label>
        <input
          type="password" value={pw} maxLength={128}
          onChange={(e) => setPw(e.target.value)}
          placeholder="En az 6 karakter"
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = T.orange)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />

        <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: "block", marginBottom: 6 }}>
          Şifre Tekrar
        </label>
        <input
          type="password" value={pw2} maxLength={128}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Şifrenizi tekrar girin"
          style={{ ...inputStyle, marginBottom: 0 }}
          onFocus={(e) => (e.target.style.borderColor = T.orange)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {err && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: T.red }}>{err}</p>
        )}

        <button
          onClick={handleSubmit} disabled={saving}
          style={{
            marginTop: 20, width: "100%", padding: "11px",
            background: saving ? T.muted : T.orange, color: "white",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Kaydediliyor..." : "Şifremi Belirle"}
        </button>
      </div>
    </div>
  );
}

// ── Boşta kalma zamanlayıcısı ─────────────────────────────────────────────────
function IdleMonitor({ onIdle }: { onIdle: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onIdle, IDLE_MS);
  }, [onIdle]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [reset]);

  return null;
}

// ── Mobil alt tab bar ─────────────────────────────────────────────────────────
function MobileTabBar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role !== "MANAGER") return;
    api.get<{ id: string }[]>("/approvals")
      .then((d) => setPendingCount(d.length))
      .catch(() => {});
  }, [user?.role, pathname]);

  const tabs: { icon: string; label: string; path: string | null; badge?: number }[] = [
    { icon: "ti-calendar-week", label: "Ana Sayfa", path: "/" },
    ...(user?.role === "MANAGER"
      ? [{ icon: "ti-checks", label: "Onaylar", path: "/approvals", badge: pendingCount }]
      : []),
    { icon: "ti-beach", label: "İzin", path: "/leaves" },
    { icon: "ti-user", label: "Çıkış", path: null },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ background: "var(--c-surface)", borderTop: "1px solid var(--c-border)", boxShadow: "0 -2px 8px rgba(0,0,0,0.06)" }}>
      <div className="flex" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {tabs.map((tab) => {
          const active = tab.path !== null && pathname === tab.path;
          return (
            <button key={tab.label}
              onClick={() => tab.path ? navigate(tab.path) : logout()}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 2,
                background: "none", border: "none", cursor: "pointer",
                padding: "8px 0", minHeight: 56,
              }}>
              <div style={{ position: "relative" }}>
                <i className={`ti ${tab.icon}`} style={{ fontSize: 22, color: active ? "#2563EB" : "#9CA3AF" }} />
                {tab.badge != null && tab.badge > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -7,
                    background: "#2563EB", color: "white",
                    fontSize: 9, fontWeight: 700, lineHeight: 1,
                    padding: "2px 4px", borderRadius: 99, minWidth: 14, textAlign: "center",
                  }}>
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, color: active ? "#2563EB" : "#9CA3AF", fontWeight: active ? 600 : 400 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Route koruma ──────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ManagerRoute({
  children,
  onUnauthorized,
}: {
  children: React.ReactNode;
  onUnauthorized: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const unauthorized = !!user && user.role !== "MANAGER";

  useEffect(() => {
    if (unauthorized) onUnauthorized();
  }, [unauthorized, onUnauthorized]);

  if (!user) return <Navigate to="/login" replace />;
  if (unauthorized) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const { user, logout, setUser } = useAuthStore();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => setToast(msg), []);
  const clearToast = useCallback(() => setToast(null), []);

  function handlePasswordSet() {
    if (!user) return;
    const updated = { ...user, mustChangePassword: false };
    setUser(updated);
  }

  return (
    <BrowserRouter>
      {user && <IdleMonitor onIdle={logout} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
      {user?.mustChangePassword && <SetInitialPasswordModal onDone={handlePasswordSet} />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* MobileTabBar tüm korumalı rotalarda görünür */}
        <Route path="/" element={<ProtectedRoute><WeekPage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/leaves" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
        <Route
          path="/approvals"
          element={
            <ManagerRoute onUnauthorized={() => showToast("Bu sayfaya erişim yetkiniz yok")}>
              <ApprovalsPage />
            </ManagerRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ManagerRoute onUnauthorized={() => showToast("Bu sayfaya erişim yetkiniz yok")}>
              <ProjectsPage />
            </ManagerRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ManagerRoute onUnauthorized={() => showToast("Bu sayfaya erişim yetkiniz yok")}>
              <ReportsPage />
            </ManagerRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ManagerRoute onUnauthorized={() => showToast("Bu sayfaya erişim yetkiniz yok")}>
              <UsersPage />
            </ManagerRoute>
          }
        />
        <Route
          path="/webhooks"
          element={
            <ManagerRoute onUnauthorized={() => showToast("Bu sayfaya erişim yetkiniz yok")}>
              <WebhooksPage />
            </ManagerRoute>
          }
        />
        <Route path="/*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && <MobileTabBar />}
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
