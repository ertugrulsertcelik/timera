#!/usr/bin/env bash
set -euo pipefail

# ── Timera Production Deploy Script ─────────────────────────────────────────

if [ ! -f ".env.prod" ]; then
  echo "HATA: .env.prod dosyası bulunamadı. .env.prod.example'dan kopyalayın:"
  echo "  cp .env.prod.example .env.prod && vi .env.prod"
  exit 1
fi

echo "▶ Mevcut container'lar durduruluyor..."
docker compose -f docker-compose.prod.yml --env-file .env.prod down

echo "▶ Image'lar yeniden derleniyor..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache

echo "▶ Container'lar başlatılıyor..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "▶ Prisma migration çalıştırılıyor..."
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \
  npx prisma db push --schema src/prisma/schema.prisma --accept-data-loss

echo ""
echo "✓ Deploy tamamlandı!"
echo "  Frontend: http://localhost (veya yapılandırdığınız alan adı)"
echo "  Backend:  http://localhost/api"
echo ""
echo "  Log takibi: docker compose -f docker-compose.prod.yml logs -f"
