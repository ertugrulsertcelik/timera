import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

// ─── Yüzen blob şekilleri ─────────────────────────────────────────────────────

interface BlobShape {
  w: number; h: number;
  top?: string; left?: string; right?: string; bottom?: string;
  color: string; opacity: number; blur: number;
  anim: string; dur: string; delay: string;
}

const BLOBS: BlobShape[] = [
  { w: 200, h: 200, top: "-60px", left: "-60px", color: "#2563EB", opacity: 0.10, blur: 60, anim: "float1", dur: "8s", delay: "0s" },
  { w: 150, h: 150, bottom: "-40px", right: "-40px", color: "#0EA5E9", opacity: 0.12, blur: 40, anim: "float2", dur: "6s", delay: "1s" },
  { w: 80, h: 80, top: "45%", left: "10%", color: "#1D4ED8", opacity: 0.08, blur: 20, anim: "float3", dur: "10s", delay: "2s" },
  { w: 120, h: 80, top: "15%", right: "8%", color: "#BFDBFE", opacity: 0.30, blur: 30, anim: "float1", dur: "7s", delay: "0.5s" },
  { w: 180, h: 120, bottom: "20%", left: "5%", color: "#93C5FD", opacity: 0.15, blur: 50, anim: "float2", dur: "9s", delay: "1.5s" },
];

const FEATURES = [
  { icon: "ti-clock", title: "7/24 Zaman Takibi", desc: "Yarım saatlik bloklar" },
  { icon: "ti-trophy", title: "Gamification", desc: "XP, rozet ve sıralama" },
  { icon: "ti-file-spreadsheet", title: "Raporlar", desc: "Excel ve PDF export" },
];

// ─── LoginPage ────────────────────────────────────────────────────────────────

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");

  const { login, isLoading, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password, remember);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--c-bg)" }}>

      {/* ── Sol panel: form ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col"
        style={{ background: "var(--c-surface)", animation: "slideInLeft 0.5s ease both" }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-8 md:px-14 py-10">
          <div className="w-full max-w-sm">

            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
              <img src="/logo.png" alt="Timera"
                style={{ width: 56, height: 56, objectFit: "contain" }} />
              <div>
                <p className="font-bold leading-none"
                  style={{ fontSize: 20, color: "#1e2d4a", letterSpacing: "0.01em" }}>
                  timera
                </p>
                <p style={{ fontSize: 10, letterSpacing: "0.12em", color: "#9CA3AF", marginTop: 1, textTransform: "uppercase" }}>
                  Timesheet Made Simple
                </p>
              </div>
            </div>

            {/* Başlık */}
            <h2 className="text-2xl font-bold mb-1" style={{ color: "#111827" }}>Hoş geldiniz</h2>
            <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
              Hesabınıza giriş yapın
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* E-posta */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5"
                  style={{ color: "#374151" }}>
                  E-posta
                </label>
                <div className="relative">
                  <i className="ti ti-mail absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: "#9CA3AF" }} />
                  <input
                    id="email" type="email" required autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@sirket.com"
                    className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none"
                    style={{
                      background: "#F9FAFB",
                      border: "1.5px solid #E5E7EB",
                      color: "#111827",
                      transition: "border-color 0.2s, background 0.2s",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#FFFFFF"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
                  />
                </div>
              </div>

              {/* Şifre */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5"
                  style={{ color: "#374151" }}>
                  Şifre
                </label>
                <div className="relative">
                  <i className="ti ti-lock absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: "#9CA3AF" }} />
                  <input
                    id="password" type="password" required autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none"
                    style={{
                      background: "#F9FAFB",
                      border: "1.5px solid #E5E7EB",
                      color: "#111827",
                      transition: "border-color 0.2s, background 0.2s",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#FFFFFF"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
                  />
                </div>
              </div>

              {/* Beni hatırla */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "#2563EB", cursor: "pointer" }}
                />
                <label htmlFor="remember" style={{ fontSize: 13, color: "#4B5563", cursor: "pointer" }}>
                  Beni hatırla
                </label>
              </div>

              {/* Hata */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
                  <i className="ti ti-alert-circle flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Giriş Yap butonu */}
              <button
                type="submit" disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-bold mt-2"
                style={{
                  background: isLoading ? "#E5E7EB" : "#2563EB",
                  color: isLoading ? "#9CA3AF" : "white",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  boxShadow: isLoading ? "none" : "0 4px 16px rgba(37,99,235,0.30)",
                  border: "none",
                  transition: "background 0.2s, transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.background = "#1D4ED8"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={(e) => { if (!isLoading) { e.currentTarget.style.background = "#2563EB"; e.currentTarget.style.transform = "translateY(0)"; } }}
              >
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
          </div>
        </div>

        {/* Footer */}
        <p className="text-center pb-6" style={{ fontSize: 10, color: "#D1D5DB" }}>
          © 2026 Timera · Designed & developed by Ertuğrul Sertçelik
        </p>
      </div>

      {/* ── Sağ panel: özellikler + bloblar ────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-center relative overflow-hidden px-12"
        style={{
          width: "55%",
          flexShrink: 0,
          background: "linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 50%, #BFDBFE 100%)",
          animation: "slideInRight 0.5s ease both",
        }}
      >
        {/* Yüzen bloblar */}
        {BLOBS.map((b, i) => (
          <div key={i} style={{
            position: "absolute",
            width: b.w, height: b.h,
            top: b.top, left: b.left,
            bottom: b.bottom, right: b.right,
            borderRadius: "50%",
            background: b.color,
            opacity: b.opacity,
            filter: `blur(${b.blur}px)`,
            animation: `${b.anim} ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay,
            pointerEvents: "none",
          }} />
        ))}

        {/* İçerik */}
        <div className="relative z-10">

          {/* Başlık */}
          <h1 style={{
            fontSize: 36, fontWeight: 800, lineHeight: 1.25,
            color: "#1e2d4a", marginBottom: 12,
          }}>
            Zamanını takip et,<br />puan kazan.
          </h1>
          <p style={{ fontSize: 15, color: "#4B5563", lineHeight: 1.75, marginBottom: 40 }}>
            Yarım saatlik bloklar halinde çalışma sürenizi<br />
            kaydedin, manager onayına gönderin.
          </p>

          {/* Özellik kartları */}
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.75)",
                  border: "1px solid #DBEAFE",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 2px 12px rgba(37,99,235,0.07)",
                }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  <i className={`ti ${f.icon}`} style={{ fontSize: 18, color: "#2563EB" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#1e2d4a", marginBottom: 2 }}>
                    {f.title}
                  </p>
                  <p className="text-xs" style={{ color: "#6B7280" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Alt istatistik */}
          <p style={{ marginTop: 32, fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-users" style={{ color: "#93C5FD" }} />
            10-15 kişilik ekipler için tasarlandı
          </p>
        </div>
      </div>
    </div>
  );
}
