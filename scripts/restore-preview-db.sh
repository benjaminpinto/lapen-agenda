#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

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

if [ -f .env ]; then
    export $(grep -E '^(PGPASSWORD_PREVIEW|PGHOST_PREVIEW|PGPORT_PREVIEW|PGUSER_PREVIEW|PGDATABASE_PREVIEW)=' .env | xargs)
fi

if [ -z "$PGPASSWORD_PREVIEW" ] || [ -z "$PGHOST_PREVIEW" ] || [ -z "$PGUSER_PREVIEW" ] || [ -z "$PGDATABASE_PREVIEW" ]; then
    echo "Error: Required preview database variables not set in .env"
    exit 1
fi

PGPORT_PREVIEW=${PGPORT_PREVIEW:-5432}

echo "Dropping all tables in schema public..."
docker exec -e PGPASSWORD="$PGPASSWORD_PREVIEW" lapen-backend psql -h "$PGHOST_PREVIEW" -p "$PGPORT_PREVIEW" -U "$PGUSER_PREVIEW" -d "$PGDATABASE_PREVIEW" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Restoring database from $BACKUP_FILE..."
docker exec -i -e PGPASSWORD="$PGPASSWORD_PREVIEW" lapen-backend psql -h "$PGHOST_PREVIEW" -p "$PGPORT_PREVIEW" -U "$PGUSER_PREVIEW" -d "$PGDATABASE_PREVIEW" < "$PROJECT_ROOT/$BACKUP_FILE"
echo "Preview database restored successfully!"
