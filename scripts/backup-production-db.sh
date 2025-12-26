#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if [ -f .env ]; then
    export $(grep -E '^PGPASSWORD=' .env | xargs)
fi

if [ -z "$PGPASSWORD" ]; then
    echo "Error: PGPASSWORD not set in .env"
    exit 1
fi

mkdir -p src/database/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec -e PGPASSWORD="$PGPASSWORD" lapen-postgres pg_dump -h $PGHOST -p 5432 -U $PGUSER -d postgres -n public --no-owner --no-privileges > src/database/backups/production_backup_${TIMESTAMP}.sql
echo "Backup saved to src/database/backups/production_backup_${TIMESTAMP}.sql"
