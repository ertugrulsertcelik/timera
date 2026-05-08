# Timesheet

7/24 çalışan ekipler için yarım saatlik blok tabanlı zaman takip uygulaması.

## Hızlı başlangıç

```bash
cp .env.example .env
# .env dosyasını düzenle

docker compose up -d
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed
```

## Local geliştirme

```bash
# Sadece postgres
docker compose up -d postgres

# Backend
cd backend && npm install && npm run db:generate && npm run dev

# Frontend (yeni terminal)
cd frontend && npm install && npm run dev
```

## Test kullanıcıları

| Email | Şifre | Rol |
|---|---|---|
| manager@timesheet.local | manager123 | Manager |
| erto@timesheet.local | employee123 | Employee |
