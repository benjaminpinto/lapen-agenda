#!/bin/bash

mkdir -p src/database/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec -e PGPASSWORD="$PGPASSWORD" -it lapen-postgres pg_dump -h $PGHOST -p 5432 -U $PGUSER -d postgres -n public --no-owner --no-privileges > src/database/backups/production_backup_${TIMESTAMP}.sql
echo "Backup saved to src/database/backups/production_backup_${TIMESTAMP}.sql"
