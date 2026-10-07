# Database Migrations (Historical Reference)

This folder contains historical migration files that were applied to evolve the database schema over time.

## ⚠️ Important Note

**These migrations have already been applied to production.**

For new database setups, use the consolidated schema file:
- **`../postgres_schema.sql`** - Complete, up-to-date PostgreSQL schema

## Migration History

Pre-numbered migrations (`ranking_schema_postgres.sql`, `add_admin_field_postgres.sql`, etc.) were consolidated into `postgres_schema.sql` and removed from this folder — see commit `0f6ff23`. Numbered migrations below are kept and applied in order:

1. **001_add_unaccent_extension.sql** - PostgreSQL unaccent extension
2. **002_backfill_player_ids.sql** - Backfilled player IDs in ranking matches
3. **003_add_refresh_tokens.sql** - Added refresh_tokens table for HTTP-only cookie auth
4. **004_add_users_soft_delete.sql** - Added soft delete (`deleted_at`) to users
5. **005_challenges_schema.sql** - Created challenges table (player-to-player challenges)
6. **006_update_wo_type_constraint.sql** - Added 'user' to wo_type constraint
7. **007_add_nextgen_group.sql** - Added 'nextgen' group type to ranking system
8. **012_add_not_played_status.sql** - Added 'not_played' status to ranking_matches
9. **013_normalize_user_names.sql** - Trimmed whitespace in user names, enforced going forward
10. **014_add_tournaments.sql** - Tournament module: `tournaments`, `tournament_categories`, `tournament_registrations`, `tournament_groups`, `tournament_group_entries`, `tournament_matches`, `tournament_sessions`, `tournament_session_courts`, `tournament_slot_blocks`, `tournament_unavailability`, `tournament_audit_log`; adds `match_statistics_unified.tournament_match_id` and replaces its two unnamed CHECKs with `chk_match_stats_single_source` (exactly one origin)

**Note:** 008-011 were never assigned — no gap to fill, just unused numbers between 007 and 012.

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
