#!/usr/bin/env bash
set -euo pipefail

# ── Timera Production Deploy Script ─────────────────────────────────────────

if [ ! -f ".env.prod" ]; then
  echo "HATA: .env.prod dosyası bulunamadı. .env.prod.example'dan kopyalayın:"
  echo "  cp .env.prod.example .env.prod && vi .env.prod"
  exit 1
fi

# ── Swap kontrolü (1GB RAM için 2GB swap önerilir) ───────────────────────────
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

echo "▶ Mevcut container'lar durduruluyor..."
docker compose -f docker-compose.prod.yml --env-file .env.prod down

echo "▶ Image'lar yeniden derleniyor..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache

echo "▶ Container'lar başlatılıyor..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "▶ Prisma migration çalıştırılıyor..."
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \
  npx prisma db push --schema src/prisma/schema.prisma --accept-data-loss

echo "▶ Kullanılmayan image'lar temizleniyor..."
docker image prune -f

echo ""
echo "✓ Deploy tamamlandı!"
echo "  Frontend: https://$(hostname -I | awk '{print $1}') (self-signed SSL)"
echo "  Backend:  https://$(hostname -I | awk '{print $1}')/api"
echo ""
echo "  NOT: Self-signed sertifika nedeniyle tarayıcıda güvenlik uyarısı çıkacak."
echo "  Domain eklenince: certbot --nginx -d yourdomain.com"
echo ""
echo "  Log takibi: docker compose -f docker-compose.prod.yml logs -f"
