#!/bin/bash

mkdir -p src/database/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec -e PGPASSWORD="$PGPASSWORD" -it lapen-postgres pg_dump -h db.prisma.io -p 5432 -U d7c4a7bb2668a28667c3e9cf8ca33ae91c66fb2822c5a44b8978bd187cd49f46 -d postgres -n public --no-owner --no-privileges > src/database/backups/production_backup_${TIMESTAMP}.sql
echo "Backup saved to src/database/backups/production_backup_${TIMESTAMP}.sql"
