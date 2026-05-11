import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { Sidebar } from "../components/Sidebar";
import { UserMenu } from "../components/UserMenu";
import { api } from "../api/client";

// ─── Tasarım sabitleri ────────────────────────────────────────────────────────

const T = {
  bg: "#F5F6FA", surface: "#FFFFFF", border: "#E5E7EB",
  text: "#111827", text2: "#4B5563", muted: "#9CA3AF",
  orange: "#2563EB", orangeL: "#EFF6FF",
};

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  streak: number;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

// altın, gümüş, bronz
const RANK_COLORS = ["#0EA5E9", "#9E9E9E", "#8D6E63"];
const RANK_BG = ["#FFFDE7", "#F5F5F5", "#EFEBE9"];
const RANK_BORDER = ["#FDE68A", "#E0E0E0", "#D7CCC8"];
const RANK_ICONS = ["ti-crown", "ti-medal", "ti-award"];

function level(xp: number) { return Math.floor(xp / 1000) + 1; }
function levelPct(xp: number) { return (xp % 1000) / 10; }

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "#2563EB", "#7B1FA2", "#1565C0", "#00695C",
  "#0284C7", "#E65100", "#4A148C", "#1A237E",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── PodiumCard ───────────────────────────────────────────────────────────────

function PodiumCard({ entry, height }: { entry: LeaderboardEntry; height: number }) {
  const color = RANK_COLORS[entry.rank - 1];
  const bg = RANK_BG[entry.rank - 1];
  const border = RANK_BORDER[entry.rank - 1];
  const icon = RANK_ICONS[entry.rank - 1];

  return (
    <div className="flex flex-col items-center" style={{ width: 140 }}>
      {/* İkon rozet */}
      <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
        style={{ background: bg, border: `1.5px solid ${border}` }}>
        <i className={`ti ${icon} text-sm`} style={{ color }} />
      </div>

      {/* Avatar */}
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 text-base font-bold relative"
        style={{
          background: avatarColor(entry.name),
          border: `2.5px solid ${color}`,
          color: "#fff",
          boxShadow: `0 4px 16px ${color}30`,
        }}>
        {initials(entry.name)}
        <div className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: color, color: "#fff", boxShadow: `0 2px 6px ${color}50` }}>
          {entry.rank}
        </div>
      </div>

      {/* İsim */}
      <p className="text-xs font-bold text-center mb-1 leading-tight" style={{ color: T.text, maxWidth: 110 }}>
        {entry.name}
      </p>
      <p className="text-xs mb-3 font-bold" style={{ color, fontFamily: "DM Mono, monospace" }}>
        {entry.xp.toLocaleString("tr-TR")} XP
      </p>

      {/* Podyum sütunu */}
      <div className="w-full rounded-t-xl flex items-end justify-center pb-2"
        style={{
          height,
          background: `linear-gradient(180deg, ${color}18 0%, ${color}05 100%)`,
          border: `1.5px solid ${border}`,
          borderBottom: "none",
        }}>
        <span className="text-xs font-semibold" style={{ color: `${color}AA`, fontFamily: "DM Mono, monospace" }}>
          Lv.{level(entry.xp)}
        </span>
      </div>
    </div>
  );
}

// ─── LeaderboardPage ──────────────────────────────────────────────────────────

export function LeaderboardPage() {
  const { user } = useAuthStore();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    api.get<LeaderboardEntry[]>("/gamification/leaderboard")
      .then((data) => {
        setEntries(data);
        const me = data.find((e) => e.name === user?.name) ?? null;
        setMyEntry(me);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.name]);

  const podium = entries.slice(0, 3);
  const podiumOrder = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : podium;
  const podiumHeights = [90, 120, 70];

  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>

      <Sidebar />

      {/* ── Ana içerik ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Topbar */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3.5 flex-shrink-0"
          style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: T.text }}>Ekip Sıralaması</span>
            {!loading && entries.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: T.orangeL, color: T.orange }}>
                {entries.length} kişi
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {myEntry && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: T.orangeL, border: `1px solid rgba(37,99,235,0.2)` }}>
                <i className="ti ti-user text-xs" style={{ color: T.orange }} />
                <span className="text-xs font-medium" style={{ color: T.text2 }}>Sıran:</span>
                <span className="text-xs font-bold" style={{ color: T.orange, fontFamily: "DM Mono, monospace" }}>
                  #{myEntry.rank}
                </span>
                <span style={{ color: T.border }}>·</span>
                <span className="text-xs font-semibold" style={{ color: T.text, fontFamily: "DM Mono, monospace" }}>
                  {myEntry.xp.toLocaleString("tr-TR")} XP
                </span>
              </div>
            )}
            <UserMenu />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 md:pt-5 pb-20 md:pb-5">

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
                <i className="ti ti-loader-2 animate-spin" /> Yükleniyor...
              </div>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: T.orangeL, border: `1px solid rgba(37,99,235,0.2)` }}>
                <i className="ti ti-trophy-off" style={{ fontSize: 28, color: T.orange }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: T.text }}>Henüz sıralama yok</p>
              <p className="text-xs" style={{ color: T.muted }}>Giriş onaylandıkça XP kazanılır.</p>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <>
              {/* ── Podyum ──────────────────────────────────────────────── */}
              {podium.length >= 2 && (
                <div className="flex items-end justify-center gap-3 mb-8 pt-4">
                  {podiumOrder.map((entry, i) => (
                    <PodiumCard key={entry.rank} entry={entry} height={podiumHeights[i]} />
                  ))}
                </div>
              )}

              {/* ── Sıralama tablosu ────────────────────────────────────── */}
              <div className="overflow-x-auto">
              <div className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", minWidth: 520 }}>

                {/* Başlık */}
                <div className="grid px-4 py-3 text-xs font-semibold"
                  style={{
                    gridTemplateColumns: "40px 1fr 80px 110px 130px 80px",
                    background: "#F9FAFB", borderBottom: `1px solid ${T.border}`,
                    color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
                  <span>#</span>
                  <span>Kullanıcı</span>
                  <span>Seviye</span>
                  <span>XP</span>
                  <span>XP İlerlemesi</span>
                  <span style={{ textAlign: "right" }}>Seri</span>
                </div>

                {/* Satırlar */}
                {entries.map((entry, idx) => {
                  const isMe = entry.name === user?.name;
                  const isTop = entry.rank <= 3;
                  const rankColor = isTop ? RANK_COLORS[entry.rank - 1] : null;
                  const pct = levelPct(entry.xp);

                  return (
                    <div key={entry.rank}
                      className="grid items-center px-4 py-3"
                      style={{
                        gridTemplateColumns: "40px 1fr 80px 110px 130px 80px",
                        background: isMe
                          ? "#FFF7F5"
                          : idx % 2 === 0 ? T.surface : "#F9FAFB",
                        borderBottom: idx < entries.length - 1 ? `1px solid ${T.border}` : "none",
                        borderLeft: isMe ? `3px solid ${T.orange}` : "3px solid transparent",
                      }}>

                      {/* Sıra */}
                      <div className="flex items-center">
                        {isTop ? (
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: RANK_BG[entry.rank - 1], border: `1px solid ${RANK_BORDER[entry.rank - 1]}` }}>
                            <i className={`ti ${RANK_ICONS[entry.rank - 1]} text-xs`}
                              style={{ color: rankColor! }} />
                          </div>
                        ) : (
                          <span className="text-xs w-7 text-center font-semibold"
                            style={{ color: T.muted, fontFamily: "DM Mono, monospace" }}>
                            {entry.rank}
                          </span>
                        )}
                      </div>

                      {/* Kullanıcı */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                          style={{ background: avatarColor(entry.name), color: "#fff" }}>
                          {initials(entry.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold truncate block"
                            style={{ color: isMe ? T.orange : T.text }}>
                            {entry.name}
                          </span>
                          {isMe && (
                            <span className="text-xs font-medium" style={{ color: T.orange }}>Sen</span>
                          )}
                        </div>
                      </div>

                      {/* Seviye */}
                      <span className="text-xs font-bold"
                        style={{
                          color: isTop ? rankColor! : T.text2,
                          fontFamily: "DM Mono, monospace",
                        }}>
                        Lv.{level(entry.xp)}
                      </span>

                      {/* XP */}
                      <span className="text-sm font-bold"
                        style={{ color: T.text, fontFamily: "DM Mono, monospace" }}>
                        {entry.xp.toLocaleString("tr-TR")}
                      </span>

                      {/* XP Progress */}
                      <div>
                        <div className="h-2 rounded-full mb-1" style={{ background: T.border }}>
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: isTop ? rankColor! : T.orange,
                            }} />
                        </div>
                        <span className="text-xs" style={{ color: T.muted, fontFamily: "DM Mono, monospace" }}>
                          {entry.xp % 1000} / 1000
                        </span>
                      </div>

                      {/* Seri */}
                      <div className="flex items-center justify-end gap-1">
                        {entry.streak > 0 ? (
                          <>
                            <i className="ti ti-flame text-xs" style={{ color: "#0EA5E9" }} />
                            <span className="text-xs font-bold"
                              style={{ color: "#0EA5E9", fontFamily: "DM Mono, monospace" }}>
                              {entry.streak}g
                            </span>
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: T.border }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              {entries.length < 20 && (
                <p className="text-center text-xs mt-4" style={{ color: T.muted }}>
                  En fazla 20 kişi gösterilir · XP kazanmak için giriş yaptır ve onaylat
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
