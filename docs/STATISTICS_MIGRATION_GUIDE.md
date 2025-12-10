# Statistics System Migration Guide

## Overview
Migrate from dual-table storage (`match_statistics` + `ranking_matches`) to unified `match_results` table.

**Goal:** Eliminate data duplication, simplify queries, reduce code by 50%.

---

## Phase 1: Create New Schema (No Downtime)

### Step 1.1: Create Migration File

**File:** `src/database/migrations/create_match_results_unified.sql`

```sql
-- Unified match results table
CREATE TABLE match_results (
    id SERIAL PRIMARY KEY,
    
    -- Source (one will be NULL)
    schedule_id INTEGER REFERENCES schedules(id),
    ranking_match_id INTEGER REFERENCES ranking_matches(id),
    
    -- Players (denormalized for performance)
    player1_id INTEGER REFERENCES users(id),
    player2_id INTEGER REFERENCES users(id),
    player1_name VARCHAR(255) NOT NULL,
    player2_name VARCHAR(255) NOT NULL,
    
    -- Result
    winner_id INTEGER REFERENCES users(id),
    winner_name VARCHAR(255) NOT NULL,
    score TEXT NOT NULL,  -- "6-4, 3-6, 10-8"
    
    -- Metadata
    match_type VARCHAR(50) NOT NULL,
    match_date DATE NOT NULL,
    season_id INTEGER REFERENCES ranking_seasons(id),
    
    -- Audit
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (schedule_id IS NOT NULL OR ranking_match_id IS NOT NULL),
    CHECK (schedule_id IS NULL OR ranking_match_id IS NULL)
);

-- Indexes
CREATE INDEX idx_match_results_players ON match_results(player1_id, player2_id);
CREATE INDEX idx_match_results_player_names ON match_results(player1_name, player2_name);
CREATE INDEX idx_match_results_date ON match_results(match_date);
CREATE INDEX idx_match_results_type ON match_results(match_type);
CREATE INDEX idx_match_results_season ON match_results(season_id) WHERE season_id IS NOT NULL;
CREATE INDEX idx_match_results_schedule ON match_results(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX idx_match_results_ranking ON match_results(ranking_match_id) WHERE ranking_match_id IS NOT NULL;
```

### Step 1.2: Create Score Parser Utility

**File:** `src/utils/score_parser.py`

```python
def parse_score(score_text):
    """Parse '6-4, 3-6, 10-8' into stats dict"""
    if not score_text:
        return {'p1_sets': 0, 'p2_sets': 0, 'p1_games': 0, 'p2_games': 0}
    
    sets = score_text.split(', ')
    p1_sets = p1_games = p2_sets = p2_games = 0
    
    for set_score in sets:
        try:
            g1, g2 = map(int, set_score.split('-'))
            p1_games += g1
            p2_games += g2
            if g1 > g2:
                p1_sets += 1
            elif g2 > g1:
                p2_sets += 1
        except ValueError:
            continue
    
    return {
        'p1_sets': p1_sets,
        'p2_sets': p2_sets,
        'p1_games': p1_games,
        'p2_games': p2_games
    }

def format_score(p1_sets, p2_sets, p1_games, p2_games):
    """Format stats into score text (best effort)"""
    # Simple format: just show sets and games
    return f"{p1_sets}-{p2_sets} ({p1_games}-{p2_games} games)"
```

### Step 1.3: Run Migration

```bash
# Apply migration
psql $DATABASE_URL -f src/database/migrations/create_match_results_unified.sql

# Verify table created
psql $DATABASE_URL -c "\d match_results"
```

---

## Phase 2: Migrate Existing Data (No Downtime)

### Step 2.1: Create Data Migration Script

**File:** `src/database/migrations/migrate_to_match_results.sql`

```sql
-- Migrate from match_statistics
INSERT INTO match_results (
    schedule_id,
    ranking_match_id,
    player1_id,
    player2_id,
    player1_name,
    player2_name,
    winner_id,
    winner_name,
    score,
    match_type,
    match_date,
    season_id,
    added_by,
    created_at
)
SELECT 
    ms.schedule_id,
    NULL as ranking_match_id,
    u1.id as player1_id,
    u2.id as player2_id,
    ms.player1_name,
    ms.player2_name,
    uw.id as winner_id,
    ms.winner_name,
    COALESCE(ms.score, ms.player1_sets || '-' || ms.player2_sets) as score,
    ms.match_type,
    ms.match_date,
    NULL as season_id,
    ms.added_by,
    ms.created_at
FROM match_statistics ms
LEFT JOIN users u1 ON LOWER(u1.short_name) = LOWER(ms.player1_name) OR LOWER(u1.name) = LOWER(ms.player1_name)
LEFT JOIN users u2 ON LOWER(u2.short_name) = LOWER(ms.player2_name) OR LOWER(u2.name) = LOWER(ms.player2_name)
LEFT JOIN users uw ON LOWER(uw.short_name) = LOWER(ms.winner_name) OR LOWER(uw.name) = LOWER(ms.winner_name);

-- Migrate from ranking_matches (completed only)
INSERT INTO match_results (
    schedule_id,
    ranking_match_id,
    player1_id,
    player2_id,
    player1_name,
    player2_name,
    winner_id,
    winner_name,
    score,
    match_type,
    match_date,
    season_id,
    added_by,
    created_at
)
SELECT 
    rm.schedule_id,
    rm.id as ranking_match_id,
    rm.player1_id,
    rm.player2_id,
    u1.short_name as player1_name,
    u2.short_name as player2_name,
    rm.winner_id,
    uw.short_name as winner_name,
    rm.score,
    'Ranking' as match_type,
    COALESCE(rm.played_at::date, s.date) as match_date,
    rr.season_id,
    rm.added_by,
    COALESCE(rm.played_at, rm.created_at) as created_at
FROM ranking_matches rm
JOIN users u1 ON rm.player1_id = u1.id
JOIN users u2 ON rm.player2_id = u2.id
JOIN users uw ON rm.winner_id = uw.id
JOIN ranking_rounds rr ON rm.round_id = rr.id
LEFT JOIN schedules s ON rm.schedule_id = s.id
WHERE rm.status = 'completed';

-- Verify migration
SELECT 
    'match_statistics' as source,
    COUNT(*) as count
FROM match_statistics
UNION ALL
SELECT 
    'ranking_matches' as source,
    COUNT(*) as count
FROM ranking_matches WHERE status = 'completed'
UNION ALL
SELECT 
    'match_results' as source,
    COUNT(*) as count
FROM match_results;
```

### Step 2.2: Run Data Migration

```bash
# Backup first!
pg_dump $DATABASE_URL > backup_before_migration.sql

# Run migration
psql $DATABASE_URL -f src/database/migrations/migrate_to_match_results.sql

# Verify counts match
psql $DATABASE_URL -c "SELECT COUNT(*) FROM match_statistics;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM ranking_matches WHERE status = 'completed';"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM match_results;"
```

---

## Phase 3: Update Backend (Dual Write Period)

### Step 3.1: Create Dual-Write Helper

**File:** `src/utils/match_result_writer.py`

```python
from src.database import get_db
from src.logger import get_logger

logger = get_logger()

def save_match_result(
    schedule_id=None,
    ranking_match_id=None,
    player1_name=None,
    player2_name=None,
    winner_name=None,
    score=None,
    match_type=None,
    match_date=None,
    season_id=None,
    added_by=None
):
    """Save to match_results (new) and legacy tables (old)"""
    db = get_db()
    
    # Get player IDs
    p1 = db.execute('SELECT id FROM users WHERE LOWER(short_name) = LOWER(%s) OR LOWER(name) = LOWER(%s)', 
                    (player1_name, player1_name)).fetchone()
    p2 = db.execute('SELECT id FROM users WHERE LOWER(short_name) = LOWER(%s) OR LOWER(name) = LOWER(%s)', 
                    (player2_name, player2_name)).fetchone()
    winner = db.execute('SELECT id FROM users WHERE LOWER(short_name) = LOWER(%s) OR LOWER(name) = LOWER(%s)', 
                       (winner_name, winner_name)).fetchone()
    
    # Insert into new table
    db.execute('''
        INSERT INTO match_results (
            schedule_id, ranking_match_id, player1_id, player2_id,
            player1_name, player2_name, winner_id, winner_name,
            score, match_type, match_date, season_id, added_by
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        schedule_id, ranking_match_id,
        p1['id'] if p1 else None, p2['id'] if p2 else None,
        player1_name, player2_name,
        winner['id'] if winner else None, winner_name,
        score, match_type, match_date, season_id, added_by
    ))
    
    # Also write to legacy table for safety (during transition)
    if schedule_id and not ranking_match_id:
        from src.utils.score_parser import parse_score
        stats = parse_score(score)
        db.execute('''
            INSERT INTO match_statistics (
                schedule_id, player1_name, player2_name, winner_name,
                player1_sets, player2_sets, player1_games, player2_games,
                match_type, match_date, added_by, score
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            schedule_id, player1_name, player2_name, winner_name,
            stats['p1_sets'], stats['p2_sets'], stats['p1_games'], stats['p2_games'],
            match_type, match_date, added_by, score
        ))
    
    db.commit()
    logger.info(f"Match result saved (dual-write): {player1_name} vs {player2_name}")
```

### Step 3.2: Update Statistics Route (Read from New Table)

**File:** `src/routes/statistics_v2.py` (new file, side-by-side)

```python
from flask import Blueprint, request, jsonify
from src.auth import require_auth
from src.database import get_db
from src.utils.score_parser import parse_score
from src.logger import get_logger

logger = get_logger()
statistics_v2_bp = Blueprint('statistics_v2', __name__, url_prefix='/api/v2/statistics')

@statistics_v2_bp.route('/player', methods=['GET'])
def get_player_statistics():
    """Get statistics - simplified with unified table"""
    player1 = request.args.get('player1')
    player2 = request.args.get('player2')
    match_type = request.args.get('match_type')
    
    if not player1:
        return jsonify({'error': 'Jogador obrigatório'}), 400
    
    db = get_db()
    conditions = ['(player1_name = %s OR player2_name = %s)']
    params = [player1, player1]
    
    if player2:
        conditions.append('((player1_name = %s AND player2_name = %s) OR (player1_name = %s AND player2_name = %s))')
        params.extend([player1, player2, player2, player1])
    
    if match_type:
        conditions.append('match_type = %s')
        params.append(match_type)
    
    # SINGLE QUERY - no UNION!
    matches = db.execute(f'''
        SELECT * FROM match_results 
        WHERE {" AND ".join(conditions)} 
        ORDER BY match_date DESC
    ''', params).fetchall()
    
    # Calculate stats
    stats = {
        'total_matches': len(matches),
        'wins': sum(1 for m in matches if m['winner_name'] == player1),
        'losses': len(matches) - sum(1 for m in matches if m['winner_name'] == player1),
        'matches': []
    }
    
    # Parse scores for detailed stats
    sets_won = sets_lost = games_won = games_lost = 0
    for match in matches:
        parsed = parse_score(match['score'])
        is_p1 = match['player1_name'] == player1
        
        sets_won += parsed['p1_sets'] if is_p1 else parsed['p2_sets']
        sets_lost += parsed['p2_sets'] if is_p1 else parsed['p1_sets']
        games_won += parsed['p1_games'] if is_p1 else parsed['p2_games']
        games_lost += parsed['p2_games'] if is_p1 else parsed['p1_games']
        
        stats['matches'].append({
            'player1_name': match['player1_name'],
            'player2_name': match['player2_name'],
            'winner_name': match['winner_name'],
            'score': match['score'],
            'match_type': match['match_type'],
            'match_date': match['match_date'],
            **parsed
        })
    
    stats.update({
        'sets_won': sets_won,
        'sets_lost': sets_lost,
        'games_won': games_won,
        'games_lost': games_lost
    })
    
    if player2:
        stats['head_to_head'] = {
            'player1': player1,
            'player2': player2,
            'player1_wins': sum(1 for m in matches if m['winner_name'] == player1),
            'player2_wins': sum(1 for m in matches if m['winner_name'] == player2)
        }
    
    db.close()
    return jsonify(stats)

@statistics_v2_bp.route('/general', methods=['GET'])
def get_general_statistics():
    """Get general statistics - simplified"""
    season_filter = request.args.get('season')
    db = get_db()
    
    conditions = []
    params = []
    
    if season_filter == 'amistosos':
        conditions.append("match_type != 'Ranking'")
    elif season_filter:
        conditions.append('season_id = %s')
        params.append(season_filter)
    
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    matches = db.execute(f'''
        SELECT * FROM match_results {where_clause}
        ORDER BY match_date DESC
    ''', params).fetchall()
    
    if not matches:
        return jsonify({
            'total_matches': 0,
            'total_players': 0,
            'total_sets': 0,
            'total_games': 0,
            'super_tiebreaks': 0,
            'match_types': {},
            'top_players': [],
            'top_streaks': []
        })
    
    # Calculate aggregates
    players_stats = {}
    match_types = {}
    total_sets = total_games = super_tiebreaks = 0
    
    for match in matches:
        parsed = parse_score(match['score'])
        total_sets += parsed['p1_sets'] + parsed['p2_sets']
        total_games += parsed['p1_games'] + parsed['p2_games']
        
        if parsed['p1_sets'] == parsed['p2_sets'] == 1:
            super_tiebreaks += 1
        
        match_types[match['match_type']] = match_types.get(match['match_type'], 0) + 1
        
        for player in [match['player1_name'], match['player2_name']]:
            if player not in players_stats:
                players_stats[player] = {'wins': 0, 'matches': 0}
            players_stats[player]['matches'] += 1
            if match['winner_name'] == player:
                players_stats[player]['wins'] += 1
    
    top_players = sorted(
        [{'name': p, 'wins': s['wins'], 'matches': s['matches'],
          'win_rate': (s['wins'] / s['matches'] * 100) if s['matches'] > 0 else 0}
         for p, s in players_stats.items()],
        key=lambda x: (x['wins'], x['win_rate']),
        reverse=True
    )[:5]
    
    db.close()
    return jsonify({
        'total_matches': len(matches),
        'total_players': len(players_stats),
        'total_sets': total_sets,
        'total_games': total_games,
        'super_tiebreaks': super_tiebreaks,
        'match_types': match_types,
        'top_players': top_players,
        'top_streaks': []  # Calculate if needed
    })

@statistics_v2_bp.route('/players', methods=['GET'])
def get_all_players():
    """Get all players - simplified"""
    db = get_db()
    players = db.execute('''
        SELECT DISTINCT player1_name as name FROM match_results
        UNION
        SELECT DISTINCT player2_name as name FROM match_results
        ORDER BY name
    ''').fetchall()
    db.close()
    return jsonify({'players': [p['name'] for p in players]})

@statistics_v2_bp.route('/opponents/<player_name>', methods=['GET'])
def get_player_opponents(player_name):
    """Get opponents - simplified"""
    db = get_db()
    opponents = db.execute('''
        SELECT DISTINCT 
            CASE 
                WHEN player1_name = %s THEN player2_name
                ELSE player1_name
            END as opponent
        FROM match_results
        WHERE player1_name = %s OR player2_name = %s
        ORDER BY opponent
    ''', (player_name, player_name, player_name)).fetchall()
    db.close()
    return jsonify({'opponents': [o['opponent'] for o in opponents]})
```

### Step 3.3: Register V2 Routes

**File:** `main.py` (add this line)

```python
from src.routes.statistics_v2 import statistics_v2_bp
app.register_blueprint(statistics_v2_bp)
```

---

## Phase 4: Testing Period (1-2 Weeks)

### Step 4.1: A/B Testing Script

**File:** `tests/test_statistics_migration.py`

```python
import requests

BASE_URL = "http://localhost:5001"

def compare_endpoints():
    """Compare old vs new endpoints"""
    players = ["Player1", "Player2"]
    
    for player in players:
        # Old endpoint
        old = requests.get(f"{BASE_URL}/api/statistics/player?player1={player}")
        # New endpoint
        new = requests.get(f"{BASE_URL}/api/v2/statistics/player?player1={player}")
        
        old_data = old.json()
        new_data = new.json()
        
        # Compare key metrics
        assert old_data['total_matches'] == new_data['total_matches'], f"Mismatch for {player}"
        assert old_data['wins'] == new_data['wins'], f"Wins mismatch for {player}"
        
        print(f"✅ {player}: Old={old_data['total_matches']} matches, New={new_data['total_matches']} matches")

if __name__ == "__main__":
    compare_endpoints()
    print("✅ All comparisons passed!")
```

### Step 4.2: Monitor Logs

```bash
# Watch for any errors
tail -f logs/app.log | grep -i "statistics"

# Check query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM match_results WHERE player1_name = 'Test' OR player2_name = 'Test';"
```

---

## Phase 5: Switch Frontend to V2 (After Validation)

### Step 5.1: Update API Calls

**File:** `src/components/statistics/Statistics.jsx`

```javascript
// Change all API calls from /api/statistics to /api/v2/statistics

// Before:
const response = await fetch('/api/statistics/player?...')

// After:
const response = await fetch('/api/v2/statistics/player?...')
```

**Changes needed:**
- Line ~70: `fetchPlayers()` → `/api/v2/statistics/players`
- Line ~90: `fetchGeneralStats()` → `/api/v2/statistics/general`
- Line ~100: `fetchOpponents()` → `/api/v2/statistics/opponents/${player}`
- Line ~120: `fetchStatistics()` → `/api/v2/statistics/player`

### Step 5.2: Deploy Frontend

```bash
# Test locally first
npm run dev

# Build and deploy
npm run build
git add .
git commit -m "feat: migrate statistics to unified API"
git push
```

---

## Phase 6: Cleanup (After 2 Weeks of Stable V2)

### Step 6.1: Remove Old Routes

**File:** `main.py`

```python
# Remove this line:
# from src.routes.statistics import statistics_bp
# app.register_blueprint(statistics_bp)

# Keep only:
from src.routes.statistics_v2 import statistics_v2_bp
app.register_blueprint(statistics_v2_bp)
```

### Step 6.2: Rename V2 to Main

```bash
# Rename files
mv src/routes/statistics.py src/routes/statistics_old_backup.py
mv src/routes/statistics_v2.py src/routes/statistics.py

# Update blueprint name in statistics.py
# Change: statistics_v2_bp → statistics_bp
# Change: /api/v2/statistics → /api/statistics
```

### Step 6.3: Drop Old Tables

**File:** `src/database/migrations/cleanup_old_statistics.sql`

```sql
-- Backup first!
CREATE TABLE match_statistics_backup AS SELECT * FROM match_statistics;

-- Drop old table
DROP TABLE IF EXISTS match_statistics CASCADE;

-- Remove redundant columns from ranking_matches
ALTER TABLE ranking_matches 
    DROP COLUMN IF EXISTS sets_p1,
    DROP COLUMN IF EXISTS sets_p2,
    DROP COLUMN IF EXISTS games_p1,
    DROP COLUMN IF EXISTS games_p2,
    DROP COLUMN IF EXISTS points_p1,
    DROP COLUMN IF EXISTS points_p2;

-- Verify
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%match%';
```

### Step 6.4: Update Frontend URLs Back

**File:** `src/components/statistics/Statistics.jsx`

```javascript
// Change back from /api/v2/statistics to /api/statistics
// (since we renamed the blueprint)
```

---

## Rollback Plan

If issues occur, rollback immediately:

### Rollback Step 1: Switch Frontend Back

```javascript
// Change all /api/v2/statistics back to /api/statistics
```

### Rollback Step 2: Disable V2 Routes

```python
# In main.py, comment out:
# app.register_blueprint(statistics_v2_bp)
```

### Rollback Step 3: Restore from Backup

```bash
psql $DATABASE_URL < backup_before_migration.sql
```

---

## Success Metrics

Track these during migration:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| API response time | <200ms | Monitor logs |
| Query count per request | 1 (down from 2) | PostgreSQL logs |
| Code lines (backend) | ~150 (down from 300) | `wc -l statistics.py` |
| Zero data loss | 100% | Compare row counts |
| Zero downtime | 100% | Uptime monitoring |

---

## Timeline

| Phase | Duration | Risk |
|-------|----------|------|
| Phase 1: Create schema | 1 hour | Low |
| Phase 2: Migrate data | 2 hours | Medium |
| Phase 3: Update backend | 4 hours | Medium |
| Phase 4: Testing | 1-2 weeks | Low |
| Phase 5: Switch frontend | 1 hour | Low |
| Phase 6: Cleanup | 2 hours | Low |

**Total active development:** ~1 day
**Total migration period:** 2-3 weeks (with safety buffer)

---

## Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Review all statistics endpoints
- [ ] Test score_parser utility
- [ ] Set up monitoring

### During Migration
- [ ] Create match_results table
- [ ] Migrate existing data
- [ ] Verify row counts match
- [ ] Deploy V2 routes
- [ ] A/B test old vs new
- [ ] Monitor for 1-2 weeks

### Post-Migration
- [ ] Switch frontend to V2
- [ ] Monitor for 1 week
- [ ] Remove old routes
- [ ] Drop old tables
- [ ] Update documentation
- [ ] Celebrate! 🎉

---

## Support

If issues arise:
1. Check logs: `tail -f logs/app.log`
2. Compare queries: Run A/B test script
3. Rollback if needed: Follow rollback plan
4. Report issues with specific player names and expected vs actual results

---

## Benefits Recap

✅ **50% code reduction** (300 → 150 lines)
✅ **50% faster queries** (1 query vs 2 + UNION)
✅ **Single source of truth** (no sync issues)
✅ **Easier to maintain** (one table to modify)
✅ **Better performance** (simpler execution plans)
✅ **Zero downtime** (gradual migration)

**Estimated effort:** 1 day development + 2-3 weeks gradual rollout
