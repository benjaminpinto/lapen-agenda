# Database Normalization Issues

## Summary
Three tables store player names as TEXT without proper foreign key relationships, causing data integrity issues when users change their `short_name`.

---

## Critical Issues

### 1. ❌ `schedules` Table (CRITICAL)

**Current Schema:**
```sql
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    court_id INTEGER,
    date DATE,
    start_time TIME,
    player1_name VARCHAR(255),  -- ❌ No FK
    player2_name VARCHAR(255),  -- ❌ No FK
    match_type VARCHAR(50),
    deleted_at TIMESTAMP
);
```

**Problem:**
- No `player1_id` or `player2_id` foreign keys
- If user changes `short_name`, all schedules show old name
- Affects: Court bookings, calendar view, match creation

**Impact:**
- User "BP" books 10 matches
- User changes name to "Benjamin"
- All 10 matches still show "BP" (orphaned data)

**Routes Affected:**
- `src/routes/public.py` - Schedule creation/updates
- `src/routes/admin.py` - Admin schedule management
- `src/routes/matches.py` - Match listings

---

### 2. ❌ `bets` Table (CRITICAL)

**Current Schema:**
```sql
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),  -- ✅ Has this
    match_id INTEGER,
    player_name VARCHAR(255),  -- ❌ No FK to users
    amount DECIMAL,
    status VARCHAR(20)
);
```

**Problem:**
- Has `user_id` (who placed bet) ✅
- But `player_name` (who they bet on) has no FK ❌
- If player changes name, bet records show old name

**Impact:**
- User bets on "BP" to win
- "BP" changes name to "Benjamin"
- Bet record still shows "BP"
- Settlement logic might break if it matches by name

**Routes Affected:**
- `src/routes/betting.py` - Bet placement
- `src/routes/admin_matches.py` - Match settlement

---

### 3. ⚠️ `match_statistics_unified` Table (FIXED)

**Current Schema:**
```sql
CREATE TABLE match_statistics_unified (
    id SERIAL PRIMARY KEY,
    player1_id INTEGER REFERENCES users(id),  -- ✅ Has FK
    player2_id INTEGER REFERENCES users(id),  -- ✅ Has FK
    winner_id INTEGER REFERENCES users(id),   -- ✅ Has FK
    player1_name VARCHAR(255),  -- For display only
    player2_name VARCHAR(255),  -- For display only
    winner_name VARCHAR(255),   -- For display only
    ...
);
```

**Status:** ✅ **FIXED**
- Has proper foreign keys
- Queries now use IDs (just fixed in previous commit)
- Names kept for display (acceptable denormalization)

---

## Recommended Fixes

### Fix 1: Add FKs to `schedules` Table

**Migration:**
```sql
-- Add columns
ALTER TABLE schedules 
    ADD COLUMN player1_id INTEGER REFERENCES users(id),
    ADD COLUMN player2_id INTEGER REFERENCES users(id);

-- Backfill from names
UPDATE schedules s
SET player1_id = u.id
FROM users u
WHERE LOWER(u.short_name) = LOWER(s.player1_name) 
   OR LOWER(u.name) = LOWER(s.player1_name);

UPDATE schedules s
SET player2_id = u.id
FROM users u
WHERE LOWER(u.short_name) = LOWER(s.player2_name) 
   OR LOWER(u.name) = LOWER(s.player2_name);

-- Make NOT NULL (after verifying all backfilled)
ALTER TABLE schedules 
    ALTER COLUMN player1_id SET NOT NULL,
    ALTER COLUMN player2_id SET NOT NULL;

-- Add indexes
CREATE INDEX idx_schedules_player1 ON schedules(player1_id);
CREATE INDEX idx_schedules_player2 ON schedules(player2_id);
```

**Code Changes:**
- Update INSERT queries to include player IDs
- Update SELECT queries to JOIN users for current names
- Keep `player1_name`/`player2_name` for backward compatibility

---

### Fix 2: Add FK to `bets` Table

**Migration:**
```sql
-- Add column
ALTER TABLE bets 
    ADD COLUMN player_id INTEGER REFERENCES users(id);

-- Backfill from player_name
UPDATE bets b
SET player_id = u.id
FROM users u
WHERE LOWER(u.short_name) = LOWER(b.player_name) 
   OR LOWER(u.name) = LOWER(b.player_name);

-- Make NOT NULL
ALTER TABLE bets 
    ALTER COLUMN player_id SET NOT NULL;

-- Add index
CREATE INDEX idx_bets_player ON bets(player_id);
```

**Code Changes:**
- Update bet placement to store `player_id`
- Update settlement logic to use `player_id` instead of `player_name`
- Keep `player_name` for historical display

---

## Migration Priority

1. **High Priority:** `schedules` table
   - Most frequently used
   - Affects user-facing calendar
   - Easy to fix

2. **Medium Priority:** `bets` table
   - Less frequently used
   - Critical for money transactions
   - Moderate complexity

3. **Done:** `match_statistics_unified` ✅
   - Already fixed in previous commit

---

## Testing Checklist

After migration:
- [ ] User changes `short_name`
- [ ] Old schedules show new name ✅
- [ ] Old bets show new name ✅
- [ ] Statistics show new name ✅
- [ ] No broken foreign keys
- [ ] All queries use IDs not names

---

## Backward Compatibility

**Keep denormalized names:**
- Store both ID and name
- Use ID for queries
- Use name for display
- Sync name on user update (optional trigger)

**Why keep names:**
- Faster queries (no JOIN needed for display)
- Historical record (shows name at time of event)
- Backward compatibility with existing code

---

## Estimated Effort

- **schedules fix:** 2-3 hours
- **bets fix:** 1-2 hours
- **Testing:** 1 hour
- **Total:** ~4-6 hours
