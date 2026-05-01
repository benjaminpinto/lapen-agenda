# API Audit — Fix Checklist

Track via this doc. Tick as fixes land. Reference: `AUDIT_FINDINGS.md`.

## CRITICAL

- [x] **#1** `matches.py:179` — fix `create_match` `NameError` (`CURRENT_DATE`/`CURRENT_TIME` undefined)
- [x] **#2** `payments.py:129` — add auth on `get_payment_history`, drop `<user_id>` from URL
- [x] **#3** `admin_matches.py:234,310,332` — add `@require_admin_auth` to report routes
- [x] **#4** `admin_matches.py:12` — `finish_match` atomic claim + rowcount guard
- [x] **#5** `admin_matches.py:141` — `cancel_match` atomic claim + Stripe `idempotency_key`
- [x] **#6** `betting.py:122` — refund payment when `place_bet` fails eligibility post-confirm
- [x] **#7** `webhooks.py:8` — verify MP `x-signature` header + add `WHERE status='pending'` guard

## HIGH

- [x] **#8** `matches.py:220` — `toggle_betting` atomic toggle + admin gate
- [x] **#9** `matches.py:249` — `update_match_status` admin gate + transition validation (or remove)
- [x] **#10** `challenges.py:157,180,206` — three TOCTOU fixes (accept/reject/delete)
- [x] **#11** `auth.py:308` — `reset_password` atomic claim with token in WHERE + rowcount
- [x] **#12** `auth.py:208` — `verify_email` atomic claim
- [x] **#13** `auth.py:187` — `update_profile` validation + email normalization
- [x] **#14** `betting.py:368` — `cancel_bet` real refund + pool race fix
- [x] **#15** `public.py:198` — schedule-link race: `WHERE schedule_id IS NULL`

## MEDIUM

- [x] **#16** `ranking.py:763` — `update_participant_temp_points` season-active guard
- [x] **#17** `matches.py:166` — `create_match` admin gate
- [ ] **#18** `payments.py:54,81` — `payment_logs` idempotency (unique index + `ON CONFLICT DO NOTHING`) — **deferred** (needs schema migration; current cancel_match already idempotent via Stripe key)
- [x] **#19** `auth.py:14` — `bcrypt.gensalt(rounds=12)` explicit
- [x] **#20** `ranking_config.py` — drop process-local cache (or version it)
- [x] **#21** `challenges.py:75` — drop JWT-prefix log line
- [x] **#22** `statistics.py:47` — change `in [...]` to `==`

## LOW

- [ ] **#23** `public.py:225` — atomic `update_schedule` (optional)
- [ ] **#24** `betting.py:177` — defer potential_return recalc (optional perf)
- [ ] **#25** `admin_matches.py:107` — defer settlement emails until after commit

## Name Normalization (separate workstream — see `docs/NAMING_CONVENTION.md`)

- [x] Migration `013_normalize_user_names.sql`: TRIM existing data + CHECK constraints
- [x] `src/utils/user_lookup.py`: `find_user_by_display_name`, `names_match`
- [x] Apply helper in `public.py`, `statistics.py`
- [x] Apply `names_match` in `betting.py`, `statistics.py`
- [x] Normalize `player_name` SQL comparisons in `admin_matches.py`
- [x] Update `postgres_schema.sql`
- [x] Tests: `tests/backend/test_user_lookup.py` (13 cases)
- [ ] **TODO #6** Frontend: send `user_id` from picker (not raw string)
- [ ] **TODO #7** Drop denormalized name columns (`bets.player_name`, `match_results.winner_name`, `match_statistics_unified.*_name`) → FK only
- [ ] **TODO #8** Resolve duplicate "Amanda" short_name (ids 43, 45) then add unique index

## Tests

- [x] `tests/backend/test_audit_fixes.py` — 5 regression tests covering #4, #10, #11, #12, #15
- [x] Full backend suite green: 157 passed
- [ ] Future: tests for #5 Stripe `idempotency_key` (needs Stripe mock), #6 refund-on-eligibility (needs payment mock), #14 cancel_bet refund (needs gateway mock)
