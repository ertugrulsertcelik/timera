# Timesheet — Claude Code Rehberi (v1.1.0)

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

---

## Production Checklist (v1.0.0)

### Deploy Öncesi
- [ ] `.env.prod` tüm zorunlu değişkenleri içeriyor (DATABASE_URL, JWT_SECRET ≥32 karakter, JWT_REFRESH_SECRET ≥32 karakter, FRONTEND_URL)
- [ ] JWT secret'lar production-grade rastgele değer (örn: `openssl rand -base64 48`)
- [ ] PostgreSQL production şifresi değiştirildi (varsayılan `timesheet_secret` kullanılmamalı)
- [ ] `NODE_ENV=production` set edildi
- [ ] Mail yapılandırması test edildi (opsiyonel; yoksa haftalık mail devre dışı)
- [ ] FRONTEND_URL production domain'ini gösteriyor (wildcard `*` olmamalı)
- [ ] `npx prisma db push` çalıştırıldı (tüm index'ler uygulandı)
- [ ] Seed **çalıştırılmadı** (NODE_ENV=production ortamında zaten engellenir)

### Deploy Sonrası
- [ ] `/health` endpoint'i 200 döndürüyor
- [ ] Login test edildi (rate limiter devrede mi?)
- [ ] Manager/Employee yetki ayrımı test edildi
- [ ] Excel ve PDF export çalışıyor (puppeteer chromium yüklü mü?)
- [ ] Webhook test butonu başarılı sonuç döndürüyor

---

## Bilinen Kısıtlamalar

- **Tek zaman dilimi:** Tüm zaman işlemleri `Europe/Istanbul` (UTC+3) üzerinden yapılır; farklı zaman diliminde çalışan ekiplerde sorun çıkabilir.
- **PDF için Chromium:** Production'da Alpine Linux imajında `chromium` paketi kurulu olmalı; Dockerfile.prod bunu hallediyor ancak imaj boyutu büyük (~300MB+).
- **Büyük bundle:** Frontend gzip sonrası ~187KB (single chunk). Ölçeklendirme gerekirse dynamic import ile code-splitting yapılmalı.
- **Yıllık izin bakiyesi:** `annualLeaveDays` sayacı DB'de tutulur; yıl başında sıfırlama otomatik yapılmaz — manuel veya cron ile sıfırlanmalı.
- **Audit Log yok:** Kim ne zaman ne değiştirdi bilgisi saklanmıyor (Yapılacaklar listesinde).

---

## Production Ortamı

### Sunucu
- Provider: Oracle Cloud Free Tier
- IP: 92.5.156.75
- OS: Ubuntu 22.04
- Shape: VM.Standard.E2.1.Micro (1 OCPU, 1GB RAM)
- User: ubuntu
- SSH: ssh ubuntu@92.5.156.75

### Kurulu Servisler
- Docker + Docker Compose Plugin
- Git

### Proje Dizini
- /home/ubuntu/timera

### Env Dosyası
- Sunucuda: /home/ubuntu/timera/.env.prod
- Git'e commit edilmez (.gitignore'da)
- Örnek: .env.prod.example

### .env.prod İçeriği (production)
- POSTGRES_USER=timesheet
- POSTGRES_PASSWORD=Timera2026!Secure
- POSTGRES_DB=timesheet
- DATABASE_URL=postgresql://timesheet:Timera2026!Secure@postgres:5432/timesheet?connection_limit=10
- JWT_SECRET=timera_jwt_super_secret_key_2026_production_minimum_32_char
- JWT_REFRESH_SECRET=timera_refresh_super_secret_key_2026_production_minimum_32
- FRONTEND_URL=https://92.5.156.75
- VITE_API_URL=https://92.5.156.75/api
- PORT=3001
- NODE_ENV=production
- MAIL_HOST= (boş, henüz ayarlanmadı)
- MAIL_PORT=587
- MAIL_USER= (boş)
- MAIL_PASS= (boş)
- MAIL_FROM=Timera <noreply@timera.local>

### Docker Compose
- Production: docker-compose.prod.yml
- Development: docker-compose.yml
- Her servisin env_file: .env.prod direktifi var

### Container'lar
- timesheet_db_prod (postgres:16-alpine)
- timesheet_backend_prod (custom build — backend/Dockerfile.prod)
- timesheet_frontend_prod (custom build — frontend/Dockerfile.prod)

### Network
- timera_internal: postgres ↔ backend
- timera_web: backend ↔ frontend ↔ nginx

### Nginx
- Frontend container içinde çalışır
- / → React app (static)
- /api/ → backend:3001 (proxy)
- Port 80'i dinler

### Önemli Düzeltmeler Yapıldı
- backend/Dockerfile.prod'a openssl eklendi (Prisma için şart)
- docker-compose.prod.yml'e her servise env_file direktifi eklendi
- VITE_API_URL .env.prod'a eklendi (frontend build sırasında alıyor)
- DB_PASSWORD değişkeni yerine direkt şifre yazıldı

---

## Deploy Workflow

### Branch Stratejisi
- main → production
- develop → test/staging
- feature/xxx → yeni özellikler

### Yeni Özellik Geliştirme
1. develop branch'ine geç: git checkout develop
2. Feature branch aç: git checkout -b feature/ozellik-adi
3. Geliştir, local'de test et (docker-compose.yml ile)
4. develop'a merge et: git checkout develop && git merge feature/ozellik-adi
5. develop'da tam test et
6. main'e merge et: git checkout main && git merge develop
7. Push: git push origin main
8. Sunucuda deploy: ssh ubuntu@92.5.156.75 → cd timera → ./deploy.sh

### deploy.sh Ne Yapar?
1. main branch kontrolü yapar (başka branch'te çalışmaz)
2. git pull (son kodu çeker)
3. docker compose build (image'ları yeniden build eder)
4. docker compose up -d (container'ları yeniden başlatır)
5. prisma migrate deploy (yeni migration varsa çalıştırır)
6. eski image'ları temizler

### Sık Kullanılan Komutlar

```bash
# Logları izle
docker compose -f docker-compose.prod.yml --env-file .env.prod logs backend --tail=50 -f

# Container durumu
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Backend restart
docker compose -f docker-compose.prod.yml --env-file .env.prod restart backend

# DB'ye gir
docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres psql -U timesheet -d timesheet

# Manuel migration
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend npx prisma db push --schema src/prisma/schema.prisma

# Tüm sistemi durdur
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Tüm sistemi başlat
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Rate Limit Sıfırlama
Backend restart edince rate limit sıfırlanır:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod restart backend
```

### Seed (yeni kullanıcı/proje eklemek için)
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
// seed kodunu buraya yaz
main().finally(() => prisma.\$disconnect());
"
```

---

## Bilinen Sorunlar ve Çözümleri

### Prisma OpenSSL Hatası
Sorun: "Prisma failed to detect the libssl/openssl version"
Çözüm: backend/Dockerfile.prod'da her iki stage'e openssl eklendi

### VITE_API_URL Boş
Sorun: Frontend backend'e bağlanamıyor, "Failed to fetch"
Çözüm: .env.prod'a VITE_API_URL=http://92.5.156.75/api ekle, frontend rebuild et

### Rate Limit Kilidi
Sorun: Çok fazla login denemesi, hesap kilitlendi
Çözüm: Backend restart et, rate limit sıfırlanır

### DB_PASSWORD Değişkeni
Sorun: docker-compose.prod.yml ${DB_PASSWORD} okumuyor
Çözüm: Direkt şifreyi yaz veya .env.prod'da DB_PASSWORD=... ekle

### ts-node Seed Hatası
Sorun: Production image'da dev dependencies yok, ts-node çalışmıyor
Çözüm: node -e ile direkt JavaScript olarak çalıştır

---

## Yapılacaklar (Production)

- [ ] Domain al ve SSL sertifikası ekle (Let's Encrypt + Certbot)
- [ ] Mail (SMTP) ayarla
- [ ] Sunucu monitoring ekle (UptimeRobot veya benzeri)
- [ ] Firewall sıkılaştırma (sadece 22, 80, 443 açık olsun)

---

## Güvenlik Durumu

| Güvenlik Kontrolü | Durum |
|---|---|
| Port 3001 kapalı (backend internal only) | ✅ |
| HTTPS zorunlu (HTTP → 443 redirect) | ✅ |
| Self-signed SSL (TLS 1.2 + 1.3) | ✅ |
| Nginx güvenlik header'ları | ✅ |
| Nginx rate limiting (login 5/dk, api 30/sn) | ✅ |
| Swap bellek (deploy.sh otomatik ekler) | ✅ |
| PostgreSQL internal only | ✅ |
| Non-root Docker user (backend + nginx worker) | ✅ |
| Otomatik backup (scripts/backup.sh) | ✅ |
| SSL sertifikası (Let's Encrypt) | ⏳ Domain gerekli |
| Mail bildirimleri | ⏳ SMTP gerekli |

### Backup Crontab Kurulumu
Sunucuda bir kez çalıştır:
```bash
chmod +x /home/ubuntu/timera/scripts/backup.sh
crontab -e
# Şu satırı ekle:
0 3 * * * /home/ubuntu/timera/scripts/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```

---

## Versiyon Geçmişi

### v1.1.0
- Mobil uyumluluk: WeekPage tap-to-select (iki adımlı seçim, sticky banner, ESC iptal), responsive layout
- Alt tab bar: Mobilde sabit bottom nav (Ana Sayfa, Onaylar, İzin, Çıkış), pending badge
- LoginPage mobile: yüzen kartlar mobilde gizlendi, responsive padding
- Touch: min-height 44px butonlar, input font-size 16px (iOS zoom engeli)
- Güvenlik: nginx header'ları (HSTS, X-Frame, CSP vb.), rate limiting (login 5/dk, api 30/sn)
- Port 3001 kapalı (backend internal), swap bellek, otomatik backup scripti
- Self-signed SSL / HTTPS zorunlu yönlendirme
- Non-root Docker user (backend + nginx worker: `timera`)
- PWA: manifest.json, icon.svg, 192/512px PNG üretimi (librsvg), theme-color, apple-touch-icon

### v1.0.0
- İlk production release
- Tüm sayfalar: LoginPage, WeekPage, ApprovalsPage, ProjectsPage, ReportsPage, LeaderboardPage, UsersPage, LeavePage, WebhooksPage
- Gamification (XP, streak, rozetler), haftalık Excel/PDF export, Slack/Teams webhook bildirimleri
- İzin takibi (bakiye, takvim, manager onay akışı)
- JWT + Refresh Token auth, brute-force koruması, idle timeout
- Docker Compose production (multi-stage Dockerfile, nginx SPA, deploy.sh)
