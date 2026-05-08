# Timesheet — Claude Code Rehberi

## Proje Özeti
7/24 çalışan ekipler için yarım saatlik blok tabanlı zaman takip uygulaması.
Oyunlaştırma (XP, seri, rozetler), proje bazlı renklendirme, manager onay akışı,
haftalık Excel + PDF export, izin takibi, Slack/Teams webhook bildirimleri
ve otomatik Cuma mail bildirimi içerir.

---

## Klasör Yapısı

```
timesheet/
├── backend/                        # Node.js + Express + TypeScript + Prisma
│   └── src/
│       ├── index.ts                # Express app, route kayıtları, cron başlatma, global hata yönetimi
│       ├── lib/
│       │   ├── prisma.ts           # Singleton PrismaClient (connection_limit=10)
│       │   └── env.ts              # Ortam değişkeni doğrulama (process.exit if missing)
│       ├── prisma/
│       │   ├── schema.prisma       # DB şeması (7 model)
│       │   └── seed.ts             # Test kullanıcıları ve örnek projeler
│       ├── middleware/
│       │   ├── auth.ts             # JWT doğrulama, rol kontrolü (requireAuth, requireManager)
│       │   ├── errorHandler.ts     # Global error handler — Prisma P2002/P2025/P2003 Türkçe mesaj
│       │   ├── rateLimiter.ts      # loginLimiter (5/3dk), refreshLimiter (20/15dk), apiLimiter (100/15dk)
│       │   └── trimmer.ts          # req.body tüm string değerlerinde trim()
│       ├── routes/
│       │   ├── auth.ts             # POST /auth/login, /refresh, /logout
│       │   ├── entries.ts          # GET/POST/PUT/DELETE /entries, POST /entries/submit
│       │   ├── projects.ts         # GET/POST/PUT/DELETE /projects, PATCH /projects/:id/deactivate
│       │   ├── approvals.ts        # GET /approvals, POST /approvals/:id/approve|reject
│       │   ├── reports.ts          # GET /reports/effort|summary|export/excel|pdf/weekly|pdf/monthly
│       │   ├── gamification.ts     # GET /gamification/me|leaderboard
│       │   ├── users.ts            # GET/POST/PUT/DELETE /users, PUT /users/me/password|set-initial-password, POST /users/:id/reset-password
│       │   ├── leaves.ts           # GET/POST /leaves, GET /leaves/balance/:userId, POST /leaves/:id/approve|reject, DELETE /leaves/:id
│       │   └── webhooks.ts         # GET/POST/PUT/DELETE /webhooks, POST /webhooks/:id/test
│       ├── services/
│       │   ├── overlapService.ts   # Çakışma kontrolü (aynı kullanıcı + tarih + saat)
│       │   ├── gamificationService.ts  # XP hesaplama, streak, rozet — upsert ile otomatik kayıt oluşturur
│       │   ├── exportService.ts    # Excel (ExcelJS) export — kullanıcı filtreli, Türkçe format
│       │   ├── pdfTemplate.ts      # Haftalık/aylık PDF HTML şablonu
│       │   ├── pdfService.ts       # Puppeteer ile HTML→PDF render
│       │   └── webhookService.ts   # fireWebhookEvent — Slack/Teams format + fetch
│       └── jobs/
│           ├── weeklyMailJob.ts    # Her Cuma 17:00 cron — bekleyen girişler için manager maili
│           └── cleanupJob.ts       # Her gece 03:00 cron — süresi dolmuş refresh token temizliği
└── frontend/                       # React + Vite + TypeScript + Tailwind
    └── src/
        ├── main.tsx                # Router, ProtectedRoute, ManagerRoute, IdleMonitor, SetInitialPasswordModal
        ├── index.css               # Tailwind base + custom animations
        ├── types/index.ts          # User, Project, TimeEntry, Gamification, Leave tipleri
        ├── api/client.ts           # Fetch wrapper — accessToken sessionStorage, refresh token rotation
        ├── store/
        │   └── authStore.ts        # Zustand — login/logout/setUser, sessionStorage+localStorage
        ├── hooks/
        │   └── useEntries.ts       # TimeEntry CRUD hook
        ├── components/
        │   └── Sidebar.tsx         # Paylaşılan sidebar — useLocation ile aktif path
        └── pages/
            ├── LoginPage.tsx
            ├── WeekPage.tsx        # 7 günlük grid, SLOT_H=28, entry blokları, izin entegrasyonu
            ├── ApprovalsPage.tsx
            ├── ProjectsPage.tsx
            ├── ReportsPage.tsx     # Excel + PDF haftalık/aylık indirme
            ├── LeaderboardPage.tsx
            ├── UsersPage.tsx
            ├── LeavePage.tsx       # İzin/tatil takibi — bakiye, takvim, liste, manager onay
            └── WebhooksPage.tsx    # Slack/Teams webhook yönetimi
```

---

## Tech Stack

| Katman        | Teknoloji                                  |
|---------------|--------------------------------------------|
| Backend       | Node.js, Express, TypeScript               |
| ORM           | Prisma                                     |
| Veritabanı    | PostgreSQL (Docker)                        |
| Auth          | JWT (15dk) + Refresh Token (7 gün)         |
| Frontend      | React 18, Vite, TypeScript                 |
| Stil          | Tailwind CSS + inline style (açık tema)    |
| State         | Zustand                                    |
| Grafik        | Recharts                                   |
| Mail          | Nodemailer + node-cron                     |
| Export        | ExcelJS (Excel), Puppeteer (PDF)           |
| Webhook       | Slack Incoming Webhook, Teams MessageCard  |

---

## Veritabanı Modelleri

```
User          → id, name, email, passwordHash, role (EMPLOYEE|MANAGER), isActive,
                mustChangePassword, annualLeaveDays (default 14),
                loginAttempts, lockedUntil, createdAt
Project       → id, name, color (#hex), description, isActive, createdAt
TimeEntry     → id, userId, projectId, date (YYYY-MM-DD), startTime (HH:MM),
                endTime (HH:MM), note, status (DRAFT→PENDING→APPROVED|REJECTED)
                @@unique([userId, date, startTime])   ← aynı kullanıcı+gün+saat tekrar giremez
Approval      → id, entryId, managerId, action, note
Gamification  → id, userId, xpTotal, streakDays, lastEntryDate
Badge         → id, userId, type (EARLY_BIRD|STREAK_5|STREAK_10|STREAK_30|FULL_WEEK|FIRST_ENTRY)
RefreshToken  → id, userId, token, expiresAt
LeaveRequest  → id, userId, date (YYYY-MM-DD), type (ANNUAL|SICK|UNPAID|PUBLIC_HOLIDAY),
                note?, status (PENDING|APPROVED|REJECTED), managerId?, managerNote?
                @@unique([userId, date])   ← aynı güne birden fazla talep olamaz
WebhookConfig → id, name, type (SLACK|TEAMS), url, events (WebhookEvent[]), isActive
                WebhookEvent: ENTRY_SUBMITTED|ENTRY_APPROVED|ENTRY_REJECTED|LEAVE_APPROVED|LEAVE_REJECTED
```

---

## Önemli İş Kuralları

### Zaman Girişi
- Yarım saatlik bloklar: 00:00–23:30 arası (48 slot/gün), SLOT_H = 28px
- Haftanın 7 günü giriş yapılabilir (haftasonu dahil)
- Gece yarısı geçen girişler (örn. 22:00–04:00) backend'e iki ayrı entry olarak gönderilir:
  - Birinci gün: 22:00–23:30
  - İkinci gün: 00:00–04:00
- Çakışma kontrolü hem frontend hem backend'de yapılır
- `DRAFT` → kullanıcı "Onaya Gönder" diyince `PENDING` olur
- `PENDING` → manager onaylarsa `APPROVED`, reddederse `REJECTED`
- `APPROVED` entry düzenlenemez; `REJECTED` entry tekrar düzenlenip gönderilebilir

### Validasyon Kuralları (backend)
- `date`: YYYY-MM-DD regex + gerçek tarih geçerliliği kontrolü
- `startTime` her zaman `endTime`'dan küçük olmalı
- `note` max 500 karakter
- `name` max 100 karakter (proje ve kullanıcı)
- `description` max 500 karakter

### Kullanıcı Yönetimi
- Admin kullanıcı oluştururken `mustChangePassword: true` set edilir
- Admin şifre sıfırlarken de `mustChangePassword: true` set edilir
- Kullanıcı ilk girişinde `SetInitialPasswordModal` gösterilir (mevcut şifre gerekmez)
- Kullanıcı silme: cascade transaction (RefreshToken → Badge → Gamification → Entry Approvals → TimeEntries → Manager Approvals → User)
- Kendi hesabını silme engellenir

### Proje Yönetimi
- Sadece MANAGER proje ekler/düzenler/pasife alır/siler
- Pasife alınan proje yeni girişlerde görünmez, geçmiş girişlerde kalır
- Entry'si olan proje silinemez (pasife alma önerilir)
- Her proje bir hex renk koduna sahiptir (grid'de renklendirme için)

### Gamification
- Her onaylanan 30 dakika = 10 XP
- Streak bonusu: 5 gün → +50 XP, 10 gün → +100 XP, 30 gün → +300 XP
- Erken kuş rozeti: 09:00'dan önce giriş yapılan blok onaylanırsa
- Seviye = xpTotal / 1000 (Seviye 1'den başlar)
- Yeni kullanıcı oluşturulurken Gamification kaydı otomatik oluşturulur
- `gamificationService`: `upsert` kullanır — kayıt yoksa oluşturur

---

## Güvenlik Katmanı

### Backend
- **Rate limiting:** `/auth/login` 5 istek/3dk, `/auth/refresh` 20/15dk, genel API 100/15dk
- **Helmet:** CSP, X-Frame-Options: DENY, xContentTypeOptions
- **CORS:** sadece `FRONTEND_URL` origin'ine izin ver, credentials: true
- **Brute-force:** `loginAttempts` + `lockedUntil` (5 hatalı denemede 15dk kilit)
- **Timing attack koruması:** kullanıcı bulunamazsa dummy `bcrypt.compare`
- **Input sanitization:** `trimmer` middleware tüm string input'larda trim()
- **Refresh token rotation:** `/auth/refresh` eskiyi siler, yenisini döner

### Frontend
- **accessToken:** `sessionStorage` (sekme kapanınca silinir)
- **refreshToken:** `localStorage` (oturumlar arası kalıcı)
- **Idle timeout:** 15 dakika hareketsizlik → otomatik logout (`IdleMonitor`)
- **ManagerRoute:** EMPLOYEE rolü manager sayfasına erişirse `/` ye yönlendirir + toast
- **Input maxLength:** not 500, proje adı 100, açıklama 500, e-posta 254, şifre 128
- **XSS:** `dangerouslySetInnerHTML` kullanılmıyor

---

## Backend Mimarisi (Production)

### Prisma Singleton (`src/lib/prisma.ts`)
Tüm route'lar `new PrismaClient()` yerine bu singleton'ı kullanır.
`DATABASE_URL`'e otomatik `?connection_limit=10&pool_timeout=10` eklenir.

### Global Error Handler (`src/middleware/errorHandler.ts`)
- `P2002` → 409 "Bu kayıt zaten mevcut"
- `P2025` → 404 "Kayıt bulunamadı"
- `P2003` → 400 "İlişkili kayıt bulunamadı"
- `PrismaClientValidationError` → 400 "Geçersiz veri formatı"
- 5xx hatalar kullanıcıya "Sunucu hatası oluştu" döner (detay loglanır)

### Cron Jobs
| Job | Zamanlama | Görev |
|-----|-----------|-------|
| `weeklyMailJob` | Her Cuma 17:00 (İstanbul) | Bekleyen girişler için manager maili |
| `cleanupJob` | Her gece 03:00 (İstanbul) | Süresi dolmuş RefreshToken'ları siler |

### Unhandled Hata Yakalama
`process.on("unhandledRejection")` ve `process.on("uncaughtException")` index.ts'de tanımlı.

---

## API Endpoint Listesi

```
POST   /auth/login                       # { mustChangePassword } döner
POST   /auth/refresh
POST   /auth/logout

GET    /projects                         # Aktif projeler (tüm kullanıcılar)
GET    /projects/all                     # Tüm projeler (manager)
POST   /projects                         # Proje ekle (manager)
PUT    /projects/:id                     # Güncelle (manager)
PATCH  /projects/:id/deactivate          # Pasife al (manager)
DELETE /projects/:id                     # Sil (manager) — entry varsa 400

GET    /entries?week=2025-W19            # Haftanın girişleri
GET    /entries?week=...&userId=...      # Başkasının girişleri (manager)
POST   /entries                          # Yeni giriş
PUT    /entries/:id                      # Güncelle (DRAFT/REJECTED)
POST   /entries/submit                   # Günü onaya gönder { date }
DELETE /entries/:id                      # Sil (sadece DRAFT)

GET    /approvals                        # Bekleyen onaylar (manager)
POST   /approvals/:id/approve            # Onayla (manager)
POST   /approvals/:id/reject             # Reddet (manager) { note? }

GET    /reports/effort?year=&month=      # Proje x kullanıcı efor raporu (manager)
GET    /reports/summary?year=&month=     # Çalışan özet (manager)
GET    /reports/export/excel?week=&userId=    # Excel export (manager) — userId opsiyonel
GET    /reports/export/pdf/weekly?week=&userId=   # Haftalık PDF export (manager)
GET    /reports/export/pdf/monthly?year=&month=&userId= # Aylık PDF export (manager)

GET    /leaves                            # kendi izinleri (employee) / tümü (manager), ?userId= ?week=
GET    /leaves/balance/:userId            # izin bakiyesi { annualRemaining, annualUsed, sickUsed, unpaidUsed }
POST   /leaves                            # izin talebi { date, type, note? }
POST   /leaves/:id/approve                # onayla (manager) — ANNUAL ise annualLeaveDays-1
POST   /leaves/:id/reject                 # reddet (manager) { note? }
DELETE /leaves/:id                        # iptal (sadece PENDING, sadece kendi)

GET    /gamification/me                  # Kendi XP/streak/rozetleri
GET    /gamification/leaderboard         # Ekip sıralaması

GET    /users                            # Tüm kullanıcılar (manager)
POST   /users                            # Yeni kullanıcı (manager) — mustChangePassword: true
PUT    /users/:id                        # Kullanıcı güncelle (manager)
DELETE /users/:id                        # Kullanıcı sil (manager) — cascade
PUT    /users/me/password                # Kendi şifresini değiştir (currentPassword gerekli)
PUT    /users/me/set-initial-password    # İlk giriş şifre belirleme (mustChangePassword=true ise)
POST   /users/:id/reset-password         # Şifre sıfırla (manager) — mustChangePassword: true set eder

GET    /webhooks                         # Tüm webhook konfigürasyonları (manager)
POST   /webhooks                         # Yeni webhook { name, type, url, events[], isActive }
PUT    /webhooks/:id                     # Güncelle (manager)
DELETE /webhooks/:id                     # Sil (manager)
POST   /webhooks/:id/test               # Test mesajı gönder (manager)

GET    /health                           # { status: "ok", ts: ... }
```

---

## Ortam Değişkenleri

```bash
# backend/.env
DATABASE_URL=postgresql://timesheet:timesheet_secret@localhost:5432/timesheet
JWT_SECRET=...
JWT_REFRESH_SECRET=...
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=noreply@example.com
MAIL_PASS=...
MAIL_FROM=Timesheet <noreply@example.com>
FRONTEND_URL=http://localhost:5173
PORT=3001
NODE_ENV=production

# frontend/.env (opsiyonel, default zaten 3001)
VITE_API_URL=http://localhost:3001
```

---

## Geliştirme Komutları

```bash
# Postgres başlat
docker compose up -d postgres

# Backend
cd backend
npm run dev          # ts-node-dev ile hot reload

# Frontend
cd frontend
npm run dev          # Vite HMR

# DB schema güncelle (migration yerine push — geliştirme için)
cd backend
npx prisma db push --schema src/prisma/schema.prisma

# Prisma client yenile (schema değişince)
npx prisma generate --schema src/prisma/schema.prisma

# Seed (test kullanıcıları + projeler)
npx ts-node src/prisma/seed.ts
```

---

## Test Kullanıcıları (seed sonrası)

| E-posta                    | Şifre        | Rol      |
|----------------------------|--------------|----------|
| erto@timesheet.local       | employee123  | EMPLOYEE |
| manager@timesheet.local    | manager123   | MANAGER  |

---

## Tasarım Sistemi

- **Tema:** Açık (light)
- **Ana arka plan:** `#F5F6FA`
- **Panel/kart:** `#FFFFFF`
- **Border:** `#E5E7EB` (ince), `#F3F4F6` (çok ince)
- **Ana renk:** `#F4631E` (turuncu/aktif), `#E8302A` (kırmızı/hover)
- **Durum renkleri:** Onaylı `#16A34A`, Bekliyor `#92400E`, Reddedildi `#991B1B`, Taslak `#6B7280`
- **Font:** DM Sans (UI), DM Mono (saat etiketleri)
- **İkon seti:** Tabler Icons (webfont, `ti-` prefix)

---

## Tamamlanan Sayfalar & Özellikler

- [x] `LoginPage` — form, hata yönetimi, test hesabı butonları, yanlış şifrede hata mesajı
- [x] `WeekPage` — 7 günlük grid (SLOT_H=28), sürükle-seç blok girişi, modal, gece yarısı bölme, stat kartları (Bu Hafta mini durum çubuğu + Onaylanan + Bekleyen + Reddedilen), onaya gönder, entry blok görünümü (sol: ad+not, sağ: saat+badge, hover sil butonu), REJECTED bloklarda red sebebi (72px+ direkt, küçükte title tooltip)
- [x] `ApprovalsPage` — manager onay ekranı (bekleyen girişleri listele, onayla/reddet, **Tümünü Onayla** — Promise.allSettled)
- [x] `ProjectsPage` — proje ekle/düzenle/pasife al/sil, renk seçici
- [x] `ReportsPage` — proje x kullanıcı bar chart (Recharts), aylık özet, Excel export, Haftalık PDF + Aylık PDF indirme (puppeteer)
- [x] `LeaderboardPage` — XP sıralaması, rozetler
- [x] `UsersPage` — kullanıcı listesi, ekle/düzenle/sil/şifre sıfırla/aktif-pasif toggle
- [x] `Sidebar` — paylaşılan bileşen, useLocation ile aktif path, MANAGER'a yönetim menüsü, `height:100vh` logout her zaman görünür
- [x] Güvenlik (backend) — rate limiting, helmet, CORS, brute-force, refresh token rotation, trimmer
- [x] Güvenlik (frontend) — sessionStorage token, idle timeout, ManagerRoute, input maxLength, `/auth/login` 401 refresh bypass
- [x] İlk giriş şifre belirleme — `mustChangePassword` flag + `SetInitialPasswordModal`
- [x] Gamification fix — yeni kullanıcı leaderboard'a eklenir (upsert)
- [x] Backend production — connection pooling, global error handler, Zod validasyon, cleanup cron
- [x] Excel yeniden tasarım — Türkçe başlıklar, gün kolonu, H:MM süre formatı, turuncu header, freeze, auto-filter, TOPLAM satırı, kullanıcı bazlı filtre
- [x] `LeavePage` — izin/tatil takibi: bakiye kartları (yıllık progress bar, hastalık, ücretsiz), aylık takvim, izin listesi tablosu, yeni talep modal, manager onayla/reddet, çalışan filtresi
- [x] WeekPage izin entegrasyonu — izinli günler yeşil sekme + "İZİN" etiketi, izin banner'ı
- [x] `WebhooksPage` — Slack/Teams webhook CRUD, test butonu, olay seçimi (ENTRY_SUBMITTED|APPROVED|REJECTED, LEAVE_APPROVED|REJECTED)
- [x] Webhook bildirimleri (backend) — approvals.ts, entries.ts (submit), leaves.ts (approve/reject) tetikleyicileri
- [x] PDF export (backend) — puppeteer + HTML şablon, haftalık + aylık, kullanıcı filtreli
- [x] Production Docker Compose — `docker-compose.prod.yml`, multi-stage Dockerfile, nginx SPA conf, `.env.prod.example`, `deploy.sh`

## Excel Formatı (exportService.ts)
- Satır 1: Hafta no + tarih aralığı (birleştirilmiş)
- Satır 2: Kapsam (Tüm Çalışanlar / kişi adı)
- Satır 3: Header (turuncu, freeze)
- Sütunlar: Çalışan (all-user modda), Tarih, Gün, Başlangıç, Bitiş, Süre (H:MM), Proje, Not
- Tek kişi modda Çalışan kolonu gösterilmez, sheet adı kişi adı olur
- Son satır: TOPLAM (turuncu arka plan)

### İzin Takibi İş Kuralları
- ANNUAL izin onaylanınca `annualLeaveDays` 1 azalır
- Aynı güne birden fazla talep olamaz (`@@unique([userId, date])`)
- Sadece PENDING talep iptal edilebilir
- PUBLIC_HOLIDAY bakiyeyi etkilemez
- Employee: kendi taleplerini görür; Manager: tümünü (opsiyonel userId filtresiyle)

## Yapılacaklar

- [ ] Manager Dashboard
- [ ] Toplu Onay (ApprovalsPage'de filtre + toplu seçim)
- [ ] Tekrarlayan Görev Şablonları
- [ ] Audit Log
- [ ] PWA Desteği

---

## Production Dağıtım

### Dosyalar
| Dosya | Açıklama |
|-------|----------|
| `docker-compose.prod.yml` | Production compose — postgres + backend + frontend |
| `backend/Dockerfile.prod` | Multi-stage: build → alpine runner (chromium için) |
| `frontend/Dockerfile.prod` | Multi-stage: vite build → nginx |
| `frontend/nginx.prod.conf` | SPA yönlendirme + `/api/` proxy + cache headers |
| `.env.prod.example` | Ortam değişkeni şablonu |
| `deploy.sh` | Tek komutla deploy scripti |

### Hızlı Deploy
```bash
cp .env.prod.example .env.prod
# .env.prod içindeki değerleri doldurun
chmod +x deploy.sh
./deploy.sh
```

### Webhook Kurulumu
- **Slack:** App → Incoming Webhooks → URL kopyala
- **Teams:** Kanal → Bağlayıcılar → Incoming Webhook → URL kopyala
- Timera'da Webhooks sayfasına gidip URL + platform + olayları seçin
- Test butonuyla doğrulayın

### PDF Notları
- Puppeteer, alpine'de `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` kullanır
- `Dockerfile.prod`'da `chromium` + bağımlılıkları apk ile yükleniyor
- Lokal geliştirmede puppeteer kendi chromium'unu indirir (otomatik)
