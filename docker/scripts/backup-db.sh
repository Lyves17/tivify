#!/bin/bash
# ===========================================
# TIVIFY - Database Backup Script
# ===========================================
# Ejecuta un backup de PostgreSQL via docker exec.
# Uso:
#   ./backup-db.sh                  # backup en ./backups/
#   ./backup-db.sh /ruta/destino    # backup en ruta personalizada
#
# Para programar con cron (diario a las 2AM):
#   0 2 * * * /ruta/a/backup-db.sh >> /var/log/tivify-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../.env"

# Cargar variables de entorno
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
fi

DB_USER="${DB_USER:-tivify}"
DB_NAME="${DB_NAME:-tivify}"
CONTAINER="${POSTGRES_CONTAINER:-tivify-postgres}"
BACKUP_DIR="${1:-${SCRIPT_DIR}/../backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Crear directorio de backups
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting backup of database '${DB_NAME}'..."

# Ejecutar pg_dump dentro del contenedor y comprimir
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: ${BACKUP_FILE} (${SIZE})"

# Limpiar backups antiguos
DELETED=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date)] Deleted ${DELETED} backups older than ${RETENTION_DAYS} days"
fi

echo "[$(date)] Done."
