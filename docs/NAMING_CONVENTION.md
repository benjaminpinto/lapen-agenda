# Player Name Handling — Convention

## Background

Each user has two name fields:
- `users.name` — full legal name (e.g. "Alexandre Souza Barroso")
- `users.short_name` — display nickname (e.g. "Alexandre Barroso")

Frontend pickers send raw strings (typed by user or selected from autocomplete). Backend must resolve those strings to a user row and store IDs whenever possible.

## Rules

### 1. Storage: IDs are authoritative, names are derived

Tables that already follow the rule:
- `ranking_matches` — only stores `player1_id`, `player2_id`. Names rendered via JOIN at read time.
- `ranking_participants` — joined with `users` for display.

Tables that store name strings (legacy / for non-registered guests):
- `schedules.player1_name` / `player2_name` — kept; populate `player1_id` / `player2_id` whenever string resolves to a user.
- `bets.player_name`, `match_results.winner_name`, `match_statistics_unified.player1_name`/`player2_name`/`winner_name` — kept for now (#7 TODO).

### 2. Lookups: use `find_user_by_display_name`

```python
from src.utils.user_lookup import find_user_by_display_name

user = find_user_by_display_name(db, player1_name)
# returns row with id/name/short_name, or None
```

- Matches `short_name` first, then `name`.
- Both sides normalized via `LOWER(TRIM(...))`.
- Filters by `deleted_at IS NULL` and `lapen_approved = TRUE` by default.
- Pass `require_approved=False` when historical (non-active) players need to be found (e.g. statistics queries).

**Never** copy the inline `LOWER(TRIM(short_name)) = LOWER(TRIM(%s)) OR LOWER(TRIM(name)) = LOWER(TRIM(%s))` query into new code. Always use the helper.

### 3. Comparisons: use `names_match`

```python
from src.utils.user_lookup import names_match

if names_match(player_name, match_info['player1_name']):
    ...
```

- Case-insensitive + trim, on both sides.
- Handles `None` safely.

**Never** use plain `==` on user-typed strings or DB-stored display names. Trailing whitespace bug (`"Alexandre Barroso "` vs `"Alexandre Barroso"`) silently breaks bet matching, winner detection and ranking statistics.

### 4. SQL comparisons in queries

When comparing a user-supplied name string to a stored name column inside SQL (e.g. `bets.player_name`), normalize both sides:

```sql
WHERE LOWER(TRIM(player_name)) = LOWER(TRIM(%s))
```

Done in `admin_matches.py` (winning/losing bet lookup).

### 5. Storage: trim on write

`users.name` and `users.short_name` are constrained by `users_name_trimmed` / `users_short_name_trimmed` (see migration 013). Inserts that don't trim will fail loudly. Use `TRIM(%s)` in SQL or `.strip()` in Python before insert.

`schedules` already inserts trimmed (`TRIM(%s)`). Maintain this pattern in any new tables that store display names.

## What was fixed (audit batch)

| # | Change | File |
|---|---|---|
| 1 | Migration: TRIM existing user names + add CHECK constraints | `src/database/migrations/013_normalize_user_names.sql` |
| 2 | Helper `find_user_by_display_name` + `names_match` | `src/utils/user_lookup.py` |
| 3 | Replace inline lookup in `create_schedule`, `update_schedule` | `src/routes/public.py` |
| 4 | Replace inline lookup in `add_match_result`, `get_player_statistics` | `src/routes/statistics.py` |
| 5 | Replace `winner_name == schedule['player1_name']` with `names_match()` | `src/routes/statistics.py` |
| 6 | Normalize `player_name` comparisons in finish_match SQL | `src/routes/admin_matches.py` |
| 7 | Normalize `valid_players` check in place_bet | `src/routes/betting.py` |
| 8 | Master schema in sync | `src/database/postgres_schema.sql` |
| 9 | Tests (13 cases) | `tests/backend/test_user_lookup.py` |

## TODO (deferred)

### #6 — Frontend: send `user_id` from picker

Today the picker autocomplete returns the typed string back to the backend. Backend then re-resolves to ID. If the user types a name that matches no user, ID is NULL — match is created with one or both `player_id` columns empty, statistics under-count.

Right approach: when a user is selected from the autocomplete dropdown, frontend sends `player1_id` (and `player1_name` as label fallback). Backend trusts ID over string.

Affected:
- `src/components/ScheduleForm.jsx` (and any other picker)
- `src/routes/public.py` `create_schedule` / `update_schedule` to accept and validate `player1_id`/`player2_id`
- `src/routes/admin_matches.py` `finish_match` to accept `winner_user_id`

### #7 — Drop denormalized name columns

Move from string-based to FK-based:
- `bets.player_name` → keep `'player1' | 'player2'` enum referencing the schedule (or directly `bet_on_user_id`)
- `match_results.winner_name` → `winner_user_id INTEGER REFERENCES users(id)`
- `match_statistics_unified.*_name` columns → derive via JOIN

Migration plan:
1. Add new FK columns alongside existing.
2. Backfill from current strings (best-effort `find_user_by_display_name`).
3. Switch reads to JOIN; render names from `users.short_name`.
4. Drop string columns once all readers migrated.

Touches every betting/stats/ranking display query. Plan as a dedicated branch with feature flag for read path.

### #8 — Resolve duplicate "Amanda" short_name

Two users share `short_name = 'Amanda'` (ids 43, 45). Blocks the unique index `LOWER(short_name)` planned for #6. Admin needs to disambiguate (e.g. "Amanda P." / "Amanda Lerner") before adding the constraint.

After resolution, add to migration 014:

```sql
CREATE UNIQUE INDEX users_short_name_unique
  ON users (LOWER(short_name))
  WHERE deleted_at IS NULL AND lapen_approved = TRUE;
```
