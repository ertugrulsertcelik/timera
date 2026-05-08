import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const surface = "#FFFFFF";
const border  = "#E5E7EB";
const text2   = "#4B5563";
const muted   = "#9CA3AF";
const orange  = "#F4631E";
const orangeL = "#FFF0EB";
const red     = "#E8302A";
const amber   = "#F9A825";

const NAV_ITEMS = [
  { icon: "ti-calendar-week", label: "Bu Hafta",     path: "/" },
  { icon: "ti-beach",         label: "İzin Takibi",  path: "/leaves" },
  { icon: "ti-chart-bar",     label: "Raporlar",     path: "/reports" },
  { icon: "ti-trophy",        label: "Sıralama",     path: "/leaderboard" },
];

const ADMIN_ITEMS = [
  { icon: "ti-checks",   label: "Onaylar",      path: "/approvals" },
  { icon: "ti-folder",   label: "Projeler",     path: "/projects" },
  { icon: "ti-users",    label: "Kullanıcılar", path: "/users" },
  { icon: "ti-webhook",  label: "Webhooks",     path: "/webhooks" },
];

interface SidebarProps {
  pendingCount?: number;
  gamification?: { xpTotal: number; streakDays: number } | null;
}

export function Sidebar({ pendingCount = 0, gamification }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate         = useNavigate();
  const { pathname }     = useLocation();

  function NavButton({ icon, label, path, badge }: {
    icon: string; label: string; path: string; badge?: number;
  }) {
    const active = pathname === path;
    return (
      <button
        onClick={() => navigate(path)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 text-left transition-all"
        style={{
          background:  active ? orange : "transparent",
          color:       active ? "white" : text2,
          fontWeight:  active ? 600 : 400,
          border:      "none",
          cursor:      "pointer",
          fontFamily:  "inherit",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = orangeL;
            e.currentTarget.style.color      = orange;
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color      = text2;
          }
        }}
      >
        <i className={`ti ${icon} text-sm`} />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span style={{
            background: "#FEF3C7", color: "#92400E",
            fontSize: 10, fontWeight: 700,
            padding: "1px 6px", borderRadius: 99,
          }}>
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0"
      style={{
        width: 220,
        height: "100vh",
        background: surface,
        borderRight: `1px solid ${border}`,
        boxShadow: "1px 0 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Logo / Kullanıcı */}
      <div style={{
        background: "linear-gradient(135deg, #F4631E 0%, #E8302A 100%)",
        padding: "18px 20px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.28)",
          }}>
            <i className="ti ti-clock" style={{ fontSize: 16, color: "white" }} />
          </div>
          <div>
            <p style={{ margin: 0, color: "white", fontWeight: 900, fontSize: 11, letterSpacing: "0.12em" }}>
              TIMERA
            </p>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: 10 }}>Timesheet</p>
          </div>
        </div>
        <p style={{
          margin: 0, fontSize: 12, fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {user?.name}
        </p>
      </div>

      {/* Navigasyon */}
      <nav className="px-3 py-3 flex-1 overflow-y-auto">
        <p style={{
          margin: "0 0 6px 8px", fontSize: 10, fontWeight: 600,
          color: muted, textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          Menü
        </p>
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.path} {...item} />
        ))}

        {user?.role === "MANAGER" && (
          <>
            <p style={{
              margin: "16px 0 6px 8px", fontSize: 10, fontWeight: 600,
              color: muted, textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              Yönetim
            </p>
            {ADMIN_ITEMS.map((item) => (
              <NavButton
                key={item.path}
                {...item}
                badge={item.path === "/approvals" ? pendingCount : undefined}
              />
            ))}
          </>
        )}
      </nav>

      {/* XP / Streak (opsiyonel) */}
      {gamification && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: text2, fontWeight: 500 }}>
              Seviye {Math.floor(gamification.xpTotal / 1000) + 1}
            </span>
            <span style={{ color: orange, fontFamily: "DM Mono, monospace" }}>
              {gamification.xpTotal} XP
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 99, background: border, marginBottom: 8 }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: `linear-gradient(90deg, ${orange}, ${red})`,
              width: `${(gamification.xpTotal % 1000) / 10}%`,
              transition: "width 0.4s ease",
            }} />
          </div>
          {gamification.streakDays > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: amber }}>
              <i className="ti ti-flame text-sm" />
              {gamification.streakDays} günlük seri
            </div>
          )}
        </div>
      )}

      {/* Çıkış */}
      <button
        onClick={logout}
        className="flex items-center gap-2 text-sm transition-all flex-shrink-0"
        style={{
          padding: "14px 20px",
          background: "none", border: "none",
          borderTop: `1px solid ${border}`,
          color: muted, cursor: "pointer", textAlign: "left",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = red)}
        onMouseLeave={(e) => (e.currentTarget.style.color = muted)}
      >
        <i className="ti ti-logout text-sm" />
        Çıkış Yap
      </button>
    </aside>
  );
}
