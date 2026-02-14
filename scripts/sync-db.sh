#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting database backup..."
"$SCRIPT_DIR/backup-production-db.sh"

BACKUP_FILE=$(ls -t "$SCRIPT_DIR/../src/database/backups/production_backup_"*.sql | head -1)

echo ""
echo "Backup completed: $BACKUP_FILE"
echo ""
echo "Where do you want to restore?"
echo "1) Local"
echo "2) Preview"
echo "3) Both"
read -p "Enter choice (1, 2, or 3): " choice

case $choice in
    1)
        echo "Restoring to local database..."
        "$SCRIPT_DIR/restore-local-db.sh" "${BACKUP_FILE#$SCRIPT_DIR/../}"
        ;;
    2)
        echo "Restoring to preview database..."
        "$SCRIPT_DIR/restore-preview-db.sh" "${BACKUP_FILE#$SCRIPT_DIR/../}"
        ;;
    3)
        echo "Restoring to local database..."
        "$SCRIPT_DIR/restore-local-db.sh" "${BACKUP_FILE#$SCRIPT_DIR/../}"
        echo ""
        echo "Restoring to preview database..."
        "$SCRIPT_DIR/restore-preview-db.sh" "${BACKUP_FILE#$SCRIPT_DIR/../}"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac
