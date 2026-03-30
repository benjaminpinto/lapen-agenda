#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 src/database/backups/production_backup_20251231_142710.sql"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$PROJECT_ROOT/$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $PROJECT_ROOT/$BACKUP_FILE"
    exit 1
fi

echo "Dropping and recreating database..."
docker exec -i lapen-postgres psql -U lapen_user -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'lapen_agenda' AND pid <> pg_backend_pid();"
docker exec -i lapen-postgres psql -U lapen_user -d postgres -c "DROP DATABASE IF EXISTS lapen_agenda;"
docker exec -i lapen-postgres psql -U lapen_user -d postgres -c "CREATE DATABASE lapen_agenda;"

echo "Restoring database from $BACKUP_FILE..."
docker exec -i lapen-postgres psql -U lapen_user -d lapen_agenda < "$PROJECT_ROOT/$BACKUP_FILE"
echo "Database restored successfully!"
