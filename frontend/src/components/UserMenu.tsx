import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";

export function UserMenu() {
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Avatar butonu */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "#2563EB", color: "white",
          border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 700,
          fontFamily: "DM Mono, monospace",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
        title={user.name}
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          background: "#FFFFFF", border: "1px solid #E5E7EB",
          borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          minWidth: 200, zIndex: 1000, overflow: "hidden",
        }}>
          {/* Kullanıcı bilgisi */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
              {user.name}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9CA3AF" }}>
              {user.role === "MANAGER" ? "Yönetici" : "Çalışan"}
            </p>
          </div>

          {/* Menü öğeleri */}
          <div style={{ padding: "6px 0" }}>
            <button
              onClick={() => { toggle(); }}
              style={{
                width: "100%", padding: "9px 16px",
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 13, color: "#4B5563", textAlign: "left",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <i className={`ti ${isDark ? "ti-sun" : "ti-moon"}`} style={{ fontSize: 14, color: "#9CA3AF" }} />
              {isDark ? "Açık Tema" : "Karanlık Tema"}
            </button>
            <div style={{ height: 1, background: "#F3F4F6", margin: "4px 0" }} />

            <button
              onClick={() => { setOpen(false); navigate("/profile"); }}
              style={{
                width: "100%", padding: "9px 16px",
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 13, color: "#4B5563", textAlign: "left",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <i className="ti ti-lock" style={{ fontSize: 14, color: "#9CA3AF" }} />
              Şifre Değiştir
            </button>

            <div style={{ height: 1, background: "#F3F4F6", margin: "4px 0" }} />

            <button
              onClick={() => { setOpen(false); logout(); }}
              style={{
                width: "100%", padding: "9px 16px",
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 13, color: "#991B1B", textAlign: "left",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF2F2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <i className="ti ti-logout" style={{ fontSize: 14, color: "#991B1B" }} />
              Çıkış Yap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
