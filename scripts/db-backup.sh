#!/bin/bash
# ==============================================================================
# Smart Kirana - Daily PostgreSQL Database Backup Script
# Usage: ./scripts/db-backup.sh
# Can be scheduled via crontab: 0 2 * * * /path/to/scripts/db-backup.sh
# ==============================================================================

set -e

# Load environment variables if .env exists
if [ -f "backend/.env" ]; then
  export $(grep -v '^#' backend/.env | xargs)
elif [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set in environment or .env file."
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/kirana_backup_$TIMESTAMP.sql.gz"

echo "=========================================================="
echo "Starting Smart Kirana PostgreSQL Backup: $TIMESTAMP"
echo "Target File: $BACKUP_FILE"
echo "=========================================================="

# Run pg_dump with custom compressed format
pg_dump "$DATABASE_URL" --no-owner --clean --if-exists | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup completed successfully! Size: $FILESIZE"

# Retain last 30 days of backups, delete older ones
echo "Cleaning up backups older than 30 days..."
find "$BACKUP_DIR" -type f -name "kirana_backup_*.sql.gz" -mtime +30 -exec rm {} \;

echo "Backup and retention rotation complete."
