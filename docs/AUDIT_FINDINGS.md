# API Audit — Findings (2026-04-30)

Deep review of all Flask routes, services and webhooks. Verified against source.

Two earlier TOCTOU bugs already fixed (ranking match-result double-count, draw double-generation). The pattern repeats across the codebase — most "high" entries below are the same shape.

## Conventions

- **TOCTOU**: `SELECT status → check → UPDATE` without a conditional `WHERE status = '<expected>'`. Concurrent requests both pass the check and double-write. Fix is always: drop the check, change UPDATE to `WHERE id = %s AND status = '<expected>'`, verify `cursor.rowcount`.
- **PII**: payment IDs, emails, phone numbers, PIX keys.

---

## CRITICAL

### 1. `src/routes/matches.py:179-180` — `create_match` always 500s (NameError)

```python
current_date = CURRENT_DATE
current_time = CURRENT_TIME
```

`CURRENT_DATE`/`CURRENT_TIME` are not imported. Python `NameError` at runtime. Even if defined, they would be string-interpolated into SQL (line 183 `f'''...'''`) → SQL injection.

**Fix:** delete the two lines, parameterize with `%s` and `datetime.now()` (mirroring `get_available_matches` at lines 22-23).

### 2. `src/routes/payments.py:129` — `get_payment_history` exposes any user's payment history

```python
@payments_bp.route('/history/<int:user_id>', methods=['GET'])
def get_payment_history(user_id):
```

No `@require_auth`, no ownership check. `GET /api/payments/history/42` → user 42's payments + match info. PII leak.

**Fix:** add `@require_auth`, drop `<int:user_id>` from URL, use `request.user_id`.

### 3. `src/routes/admin_matches.py:234, 310, 332` — admin reports public

- `/api/admin/matches/<id>/report` — exposes user emails, PIX keys, bet amounts → **admin-only**
- `/api/admin/matches/<id>/result` — winner + score only → **kept public** (used by `FinishedMatchCard` on the public /betting page; result of a finished match isn't sensitive)
- `/api/admin/matches/reports` — aggregate betting analytics → **admin-only**

**Fix:** add `@require_admin_auth` to `/report` and `/reports`. `/result` left open.

### 4. `src/routes/admin_matches.py:12-139` — `finish_match` TOCTOU + double payout

SELECT match status (line 26-32) → UPDATE without guard (line 59) → INSERT `match_results` (line 62) → UPDATE bets to `won`/`lost` and email each user (line 99-119). Two concurrent calls both run the full settlement → duplicate `match_results` row, bets potentially double-paid in the email pipeline.

**Fix:** atomic `UPDATE matches SET status='finished' WHERE id=%s AND status != 'finished'` first; check `rowcount==1` before any settlement work.

### 5. `src/routes/admin_matches.py:141-232` — `cancel_match` double-refund (real money)

SELECT then UPDATE (line 151, 210) without status guard. Two concurrent `/cancel` calls both pass the check and both call `stripe.Refund.create(payment_intent=...)` (line 186) for every active bet. Stripe accepts both refunds — **money out twice**. No `idempotency_key` passed to Stripe.

**Fix:**
1. Atomic claim on `matches.status` (same pattern as #4).
2. Pass `idempotency_key=f'refund_{bet_id}'` to `stripe.Refund.create` so any future retry is idempotent.

### 6. `src/routes/betting.py:122-134` — payment taken without bet, no refund

`place_bet` confirms payment at line 109. If `is_match_eligible_for_betting()` returns False at line 122 (e.g. <1h to match start), the route disables betting and returns 400 — but **does not refund the user**. User pays, no bet placed, money stuck.

**Fix:** trigger Stripe/MP refund before returning the 400.

### 7. `src/routes/webhooks.py:8-58` — Mercado Pago webhook missing signature verification

`payments.py:22` correctly verifies Stripe via `stripe.Webhook.construct_event`. MP handler trusts incoming POST entirely. Mitigated partly by fetching real status from MP API, but vulnerable to: replay (old approved payment IDs), bet status overwrite (no `WHERE status='pending'` guard at line 48), and DoS via fake IDs hammering MP API.

**Fix:**
1. Verify MP `x-signature` header (HMAC-SHA256 of `id:<id>;request-id:<rid>;ts:<ts>;` with `MERCADOPAGO_WEBHOOK_SECRET`).
2. Add `WHERE status='pending'` guard on bet UPDATE.

---

## HIGH

### 8. `src/routes/matches.py:220-246` — `toggle_betting` race + auth gap

```python
new_status = not match['betting_enabled']
db.execute('UPDATE matches SET betting_enabled = %s WHERE id = %s', ...)
```

Two concurrent toggles read same value, both flip → final state is undefined. Plus `@require_auth` (any logged-in user can disable betting on any match).

**Fix:** atomic `UPDATE matches SET betting_enabled = NOT betting_enabled WHERE id=%s` and `@require_admin_auth`.

### 9. `src/routes/matches.py:249-279` — `update_match_status` no admin gate, no transition validation

`@require_auth` instead of `@require_admin_auth`. Any user can flip any match to/from any state, including resurrecting `finished` → `upcoming` (bypasses settlement).

**Fix:** require admin; whitelist transitions (e.g. only `upcoming → live`, `live → finished`, etc.). Or remove the route — `finish_match` and `cancel_match` already cover legitimate transitions.

### 10. `src/routes/challenges.py:157, 180, 206` — three TOCTOU races

- `accept_challenge` (line 157)
- `reject_challenge` (line 180)
- `delete_challenge` (line 206)

All follow `SELECT → check → UPDATE` without a status guard.

**Fix:** atomic `UPDATE challenges SET status='active' WHERE id=%s AND status='pending' AND challenged_id=%s` + rowcount check. Repeat for reject (`status='rejected'`) and delete (`status='cancelled'`).

### 11. `src/routes/auth.py:308-348` — `reset_password` token not single-use

SELECT user by token (line 324), check expiry, UPDATE by `id` (line 338). Two concurrent requests with same valid token both pass SELECT, both UPDATE → last password wins, both NULL the token. Token was effectively reusable until both requests complete.

**Fix:** `UPDATE users SET password_hash=%s, reset_token=NULL, reset_token_expires=NULL WHERE id=%s AND reset_token=%s` + `rowcount==1`.

### 12. `src/routes/auth.py:208-235` — `verify_email` same race

Functionally idempotent (verifying twice = harmless), but pattern is fragile.

**Fix:** `UPDATE users SET is_verified=true, verification_token=NULL WHERE verification_token=%s` + rowcount check.

### 13. `src/routes/auth.py:187-206` — `update_profile` validation gaps

- KeyError on missing `data['name']`, `data['short_name']`, `data['email']` (uses `[]` not `.get()` for first three)
- `data['email']` not normalized (no lower/strip)
- No format validation
- No uniqueness check (relies on DB constraint failure surfacing as 400)

**Fix:** validate all fields, normalize email, surface DB unique-constraint as a clear error.

### 14. `src/routes/betting.py:368-403` — `cancel_bet` no refund + pool race

`UPDATE bets SET status='refunded'` flips local status but **never calls Stripe/MP refund**. User is told "cancelled" but money never returns. Plus race: two concurrent cancels both pass `status='active'` SELECT, both call `update_match_pool(match_id, -amount)` → pool double-decremented.

**Fix:**
1. Atomic `UPDATE bets SET status='refunded' WHERE id=%s AND status='active'` + rowcount==1 guard before any pool/refund work.
2. Issue actual external refund (Stripe with `idempotency_key=f'cancel_{bet_id}'`, or MP equivalent).

### 15. `src/routes/public.py:198-200` — schedule→ranking_match link race

```python
if ranking_match:
    db.execute('UPDATE ranking_matches SET schedule_id = %s WHERE id = %s', ...)
```

Two simultaneous schedule creations matching same Liga players both find the same `ranking_match` row, both overwrite each other's `schedule_id`. Last one wins, the other schedule is orphaned from the ranking match.

**Fix:** `WHERE id=%s AND schedule_id IS NULL` + rowcount.

---

## MEDIUM

### 16. `src/routes/ranking.py:763-785` — `update_participant_temp_points` unguarded

Direct `UPDATE temp_points = %s` with no season-state check. Admin can mutate temp points on a `finished` season, retro-changing historical positions.

**Fix:** add a `JOIN ranking_seasons WHERE status='active'` guard, or fail loudly when season isn't active.

### 17. `src/routes/matches.py:166-217` — `create_match` no admin gate

`@require_auth`. Any user can create matches. Currently mostly moot because the route is broken (#1), but will become live once fixed.

**Fix:** `@require_admin_auth`.

### 18. `src/routes/payments.py:54-57, 81-84` — `payment_logs` not idempotent

`INSERT INTO payment_logs` runs unconditionally on every webhook delivery. Stripe retries → duplicate log rows. Not a money bug, but inflates the table and confuses audit traces.

**Fix:** unique index on `(payment_id, event_type)` + `ON CONFLICT DO NOTHING`.

### 19. `src/auth.py:14` — `bcrypt.gensalt()` no explicit rounds

Defaults to 12 in current bcrypt → meets project's 12-round minimum **today**. Fragile if library default changes.

**Fix:** `bcrypt.gensalt(rounds=12)`.

### 20. `src/services/ranking_config.py:6-54` — `_cache` is process-local

On Vercel serverless or multi-worker Gunicorn, `set_config()` invalidates only the current worker's cache. Other workers serve stale config until their own write. Manifests as "I changed scoring rules but ranking still uses old ones."

**Fix:** drop the cache (PostgreSQL is fast enough), or add a config-version row and check on read.

### 21. `src/routes/challenges.py:75` — JWT prefix logged

```python
logger.info(f"Cookie token: {token[:50] if token else 'None'}...")
```

50 chars of a JWT in logs. Helps an attacker who steals logs forge or replay tokens.

**Fix:** delete the line.

### 22. `src/routes/statistics.py:47` — list-membership idiom for single comparison

```python
winner_id = ... if winner_name in [schedule['player1_name']] else ...
```

Works but `==` is the intent. Cosmetic.

---

## LOW

### 23. `src/routes/public.py:225-264` — `update_schedule` no atomic reservation

Read-then-write on schedules with no row lock; two admins editing same schedule could clobber. Low real-world risk.

### 24. `src/routes/betting.py:177-192` — `place_bet` recomputes potential_return for all active bets

Every new bet UPDATEs all active bets in the match. Functionally correct, but on a hot match this is O(N) writes per new bet — under load you'll see lock contention.

### 25. `src/routes/admin_matches.py:107-119` — losing-bet emails sent before commit

Email send (line 123) is inside the transaction before `db.commit()` (line 125). Commit failure → users get "you lost" emails for bets that weren't actually settled.

**Fix:** queue emails for after-commit, or accept the gap.

---

## Hotspots

- **Money flow** (#5, #6, #14): real-cash double-pay or stuck funds
- **Admin auth** (#2, #3, #9, #17): PII leaks, privilege escalation
- **Concurrency** (#4, #5, #8, #10, #11, #14, #15): TOCTOU race pattern repeated
