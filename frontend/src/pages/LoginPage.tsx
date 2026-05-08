import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const BLOCKS = [
  { w: 148, top: "14%", left: "6%", delay: "0s", label: "Sprint planning", color: "rgba(255,255,255,0.90)" },
  { w: 124, top: "28%", left: "62%", delay: "0.5s", label: "K8s upgrade", color: "rgba(255,255,255,0.80)" },
  { w: 156, top: "44%", left: "4%", delay: "0.9s", label: "Nessus bulguları", color: "rgba(255,255,255,0.90)" },
  { w: 118, top: "60%", left: "58%", delay: "0.3s", label: "CI/CD pipeline", color: "rgba(255,255,255,0.80)" },
  { w: 140, top: "74%", left: "10%", delay: "1.1s", label: "Vault entegrasyon", color: "rgba(255,255,255,0.90)" },
  { w: 108, top: "10%", left: "52%", delay: "0.7s", label: "Code review", color: "rgba(255,255,255,0.75)" },
  { w: 130, top: "82%", left: "55%", delay: "1.3s", label: "Monitoring setup", color: "rgba(255,255,255,0.85)" },
];

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const { login, isLoading, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#F5F6FA" }}>

      {/* ── Sol panel: marka ──────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-shrink-0 relative overflow-hidden"
        style={{
          width: "44%",
          background: "linear-gradient(145deg, #F4631E 0%, #E8302A 55%, #C2185B 100%)",
        }}>

        {/* Izgara desen */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }} />

        {/* Parıltı */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 70% 60% at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 70%)",
        }} />

        {/* Yüzen aktivite kartları */}
        {BLOCKS.map((b, i) => (
          <div key={i}
            className="absolute flex items-center gap-2 px-3 rounded-xl text-xs font-medium select-none"
            style={{
              width: b.w, height: 34, top: b.top, left: b.left,
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: b.color,
              backdropFilter: "blur(8px)",
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(12px)",
              transition: `opacity 0.7s ${b.delay}, transform 0.7s ${b.delay}`,
              animation: `float${i % 3} ${7 + i}s ease-in-out infinite`,
              animationDelay: b.delay,
            }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white opacity-80" />
            {b.label}
          </div>
        ))}

        {/* Marka içeriği */}
        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          {/* Üst: logo */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                <i className="ti ti-clock" style={{ fontSize: 20, color: "white" }} />
              </div>
              <div>
                <p className="font-black text-base tracking-widest" style={{ color: "white", letterSpacing: "0.12em" }}>
                  TIMERA
                </p>
                <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Timesheet Platform
                </p>
              </div>
            </div>
          </div>

          {/* Orta: tagline */}
          <div>
            <h1 className="font-black text-4xl leading-tight mb-4" style={{ color: "white" }}>
              Zamanını<br />takip et,<br />puan kazan.
            </h1>
            <p className="text-base" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
              Yarım saatlik bloklar halinde çalışma sürenizi kaydedin,
              manager onayına gönderin ve ekibinizle yarışın.
            </p>

            {/* Özellik listesi */}
            <div className="mt-8 space-y-3">
              {[
                { icon: "ti-calendar-week", text: "7/24 zaman takibi" },
                { icon: "ti-trophy", text: "XP, rozet ve sıralama" },
                { icon: "ti-file-spreadsheet", text: "Haftalık Excel export" },
              ].map((f) => (
                <div key={f.text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.15)" }}>
                    <i className={`ti ${f.icon} text-sm`} style={{ color: "white" }} />
                  </div>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alt */}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            © 2026 ANKASOFT · Tüm hakları saklıdır
          </p>
        </div>
      </div>

      {/* ── Sağ panel: giriş formu ────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12"
        style={{ background: "#FFFFFF" }}>
        <div className="w-full max-w-sm"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s 0.1s, transform 0.5s 0.1s",
          }}>

          {/* Mobil logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #F4631E, #E8302A)" }}>
              <i className="ti ti-clock text-white" style={{ fontSize: 18 }} />
            </div>
            <div>
              <p className="font-black text-sm tracking-widest" style={{ color: "#F4631E", letterSpacing: "0.1em" }}>ANKASOFT</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>Timesheet</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: "#111827" }}>Hoş geldiniz</h2>
          <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
            Hesabınıza giriş yapın
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                E-posta
              </label>
              <div className="relative">
                <i className="ti ti-mail absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#9CA3AF" }} />
                <input
                  id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@ankasoft.com"
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "#F9FAFB",
                    border: "1.5px solid #E5E7EB",
                    color: "#111827",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#F4631E"; e.target.style.background = "#FFFFFF"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                Şifre
              </label>
              <div className="relative">
                <i className="ti ti-lock absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#9CA3AF" }} />
                <input
                  id="password" type="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "#F9FAFB",
                    border: "1.5px solid #E5E7EB",
                    color: "#111827",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#F4631E"; e.target.style.background = "#FFFFFF"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
                <i className="ti ti-alert-circle flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit" disabled={isLoading}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all mt-2"
              style={{
                background: isLoading ? "#E5E7EB" : "linear-gradient(135deg, #F4631E, #E8302A)",
                color: isLoading ? "#9CA3AF" : "white",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: isLoading ? "none" : "0 4px 16px rgba(244,99,30,0.35)",
                border: "none",
              }}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ti ti-loader-2 animate-spin" />
                  Giriş yapılıyor...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Giriş Yap
                  <i className="ti ti-arrow-right" />
                </span>
              )}
            </button>
          </form>

          {/* Test hesapları */}
          <div className="mt-7 pt-6" style={{ borderTop: "1px solid #F3F4F6" }}>
            <p className="text-xs text-center mb-3 font-medium" style={{ color: "#9CA3AF" }}>
              — Test hesapları —
            </p>
            <div className="space-y-2">
              {[
                { label: "Çalışan", email: "erto@timesheet.local", pass: "employee123", icon: "ti-user", color: "#7B1FA2" },
                { label: "Yönetici", email: "manager@timesheet.local", pass: "manager123", icon: "ti-crown", color: "#F4631E" },
              ].map((u) => (
                <button key={u.email} type="button"
                  onClick={() => { setEmail(u.email); setPassword(u.pass); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all text-left"
                  style={{
                    background: "#F9FAFB",
                    border: "1.5px solid #E5E7EB",
                    color: "#4B5563",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = u.color; e.currentTarget.style.background = "#FFFFFF"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; }}
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: u.color + "15" }}>
                    <i className={`ti ${u.icon} text-sm`} style={{ color: u.color }} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs" style={{ color: "#374151" }}>{u.label}</p>
                    <p className="text-xs truncate" style={{ color: "#9CA3AF", fontFamily: "DM Mono, monospace" }}>{u.email}</p>
                  </div>
                  <i className="ti ti-corner-down-left ml-auto text-sm" style={{ color: "#D1D5DB" }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
