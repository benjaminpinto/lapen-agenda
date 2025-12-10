# Database Migrations (Historical Reference)

This folder contains historical migration files that were applied to evolve the database schema over time.

## ⚠️ Important Note

**These migrations have already been applied to production.**

For new database setups, use the consolidated schema file:
- **`../postgres_schema.sql`** - Complete, up-to-date PostgreSQL schema

## Migration History

Applied in chronological order:

1. **ranking_schema_postgres.sql** - Initial ranking system tables
2. **add_admin_field_postgres.sql** - Added is_admin to users
3. **add_match_statistics_postgres.sql** - Created match_statistics table
4. **add_short_name_postgres.sql** - Added short_name to users
5. **add_player_ids_to_schedules.sql** - Linked schedules to users
6. **add_round_description_postgres.sql** - Added description to ranking_rounds
7. **add_score_to_match_statistics.sql** - Added score column
8. **update_round_status_postgres.sql** - Updated status constraint
9. **create_match_results_unified.sql** - Created unified statistics table
10. **migrate_to_match_results.sql** - Migrated data to unified table
11. **cleanup_old_statistics.sql** - Removed old match_statistics table

## Current Schema

All changes from these migrations are consolidated in:
- `src/database/postgres_schema.sql`

This file includes:
- All table definitions
- All indexes (including performance indexes)
- All constraints and foreign keys
- Triggers and functions

## Usage

**For new environments:**
```bash
psql $DATABASE_URL -f src/database/postgres_schema.sql
```

**These migration files are kept for:**
- Historical reference
- Understanding schema evolution
- Documentation purposes
