#!/bin/bash
set -euo pipefail

BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="/home/ubuntu/timera/docker-compose.prod.yml"
ENV_FILE="/home/ubuntu/timera/.env.prod"

mkdir -p "$BACKUP_DIR"

docker compose -f "$COMPOSE_FILE" \
  --env-file "$ENV_FILE" \
  exec -T postgres pg_dump -U timesheet timesheet \
  > "$BACKUP_DIR/timera_$DATE.sql"

# 7 günden eski backup'ları sil
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete

echo "Backup tamamlandi: $BACKUP_DIR/timera_$DATE.sql"
