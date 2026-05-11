#!/usr/bin/env bash
set -euo pipefail

# ── Timera Production Deploy Script (v2 — selective rebuild) ─────────────────

# 1. .env.prod kontrolü
if [ ! -f ".env.prod" ]; then
  echo "HATA: .env.prod dosyası bulunamadı. .env.prod.example'dan kopyalayın:"
  echo "  cp .env.prod.example .env.prod && vi .env.prod"
  exit 1
fi

# 2. Swap kontrolü (1GB RAM için 2GB swap önerilir)
if [ "$(swapon -s | wc -l)" -lt 2 ]; then
  echo "▶ Swap bulunamadı, 2GB swap ekleniyor..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "✓ Swap eklendi: 2GB"
else
  echo "✓ Swap zaten aktif, atlanıyor."
fi

# 3. Ne değişti kontrol et (pull öncesi)
echo "▶ Değişiklikler kontrol ediliyor..."
git fetch origin main
CHANGED=$(git diff HEAD origin/main --name-only)

if [ -z "$CHANGED" ]; then
  echo "ℹ  Uzak repoda yeni değişiklik yok."
  echo "   Zorla yeniden başlatmak için: docker compose -f docker-compose.prod.yml --env-file .env.prod restart"
  exit 0
fi

echo "Değişen dosyalar:"
echo "$CHANGED"
echo ""

# 4. Kodu çek
git pull origin main

# 5. Hangi servisler etkilendi?
BACKEND_CHANGED=$(echo "$CHANGED" | grep -c "^backend/" || true)
FRONTEND_CHANGED=$(echo "$CHANGED" | grep -c "^frontend/" || true)
COMPOSE_CHANGED=$(echo "$CHANGED" | grep -c "docker-compose" || true)

echo "Backend değişiklik: $BACKEND_CHANGED dosya"
echo "Frontend değişiklik: $FRONTEND_CHANGED dosya"
echo "Compose değişiklik: $COMPOSE_CHANGED dosya"
echo ""

DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

# 6. Yeniden derleme ve başlatma
if [ "$COMPOSE_CHANGED" -gt 0 ]; then
  # ─ docker-compose dosyası değiştiyse tam restart gerekli ─
  echo "▶ docker-compose değişti — tam yeniden başlatma (~8-10 dk)..."
  $DC down
  $DC build
  $DC up -d

elif [ "$BACKEND_CHANGED" -gt 0 ] && [ "$FRONTEND_CHANGED" -gt 0 ]; then
  # ─ İkisi de değişti: paralel rebuild, sırayla up ─
  echo "▶ Backend + Frontend rebuild (~4-5 dk)..."
  $DC build backend frontend
  $DC up -d --no-deps backend
  $DC up -d --no-deps frontend

elif [ "$BACKEND_CHANGED" -gt 0 ]; then
  # ─ Sadece backend — frontend çalışmaya devam eder ─
  echo "▶ Sadece backend rebuild (~1-2 dk)..."
  $DC build backend
  $DC up -d --no-deps backend

elif [ "$FRONTEND_CHANGED" -gt 0 ]; then
  # ─ Sadece frontend — backend çalışmaya devam eder ─
  echo "▶ Sadece frontend rebuild (~2-3 dk)..."
  $DC build frontend
  $DC up -d --no-deps frontend

else
  # ─ Sadece kök dosyalar (scripts, docs vb.) ─
  echo "▶ Servis kodu değişmedi — restart atlanıyor."
fi

# 7. Prisma migration — sadece backend veya compose değiştiyse
if [ "$BACKEND_CHANGED" -gt 0 ] || [ "$COMPOSE_CHANGED" -gt 0 ]; then
  echo "▶ Backend hazır olana kadar bekleniyor..."
  sleep 5
  echo "▶ Prisma migration çalıştırılıyor..."
  $DC exec backend \
    npx prisma db push --schema src/prisma/schema.prisma --accept-data-loss
  echo "✓ Migration tamamlandı."
fi

# 8. Kullanılmayan image'ları temizle
docker image prune -f

echo ""
echo "✓ Deploy tamamlandı!"
echo ""
echo "  Süre referansı:"
echo "  - Sadece frontend : ~2-3 dk"
echo "  - Sadece backend  : ~1-2 dk"
echo "  - İkisi birden    : ~4-5 dk"
echo "  - Full restart    : ~8-10 dk"
echo ""
echo "  Frontend : https://$(hostname -I | awk '{print $1}') (self-signed SSL)"
echo "  Backend  : https://$(hostname -I | awk '{print $1}')/api"
echo ""
echo "  Log takibi: docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f"
