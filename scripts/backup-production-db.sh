#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if [ -f .env ]; then
    export $(grep -E '^(PGPASSWORD|PGHOST|PGPORT|PGUSER|PGDATABASE)=' .env | xargs)
fi

if [ -z "$PGPASSWORD" ] || [ -z "$PGHOST" ] || [ -z "$PGUSER" ] || [ -z "$PGDATABASE" ]; then
    echo "Error: Required database variables not set in .env"
    echo "Required: PGPASSWORD, PGHOST, PGUSER, PGDATABASE"
    exit 1
fi

PGPORT=${PGPORT:-5432}

mkdir -p src/database/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec -e PGPASSWORD="$PGPASSWORD" lapen-postgres pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -n public --no-owner --no-privileges > src/database/backups/production_backup_${TIMESTAMP}.sql
echo "Backup saved to src/database/backups/production_backup_${TIMESTAMP}.sql"
