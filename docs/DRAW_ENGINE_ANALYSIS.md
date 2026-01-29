# Draw Engine Analysis & Three-Tier Group Implementation Plan

## Current System Overview

### Draw Engine Architecture

The `draw_engine.py` module is responsible for generating match pairings for ranking rounds. It implements a sophisticated algorithm that ensures fair matchups while avoiding recent opponents.

#### Core Components

**1. DrawEngine Class**
- Location: `src/services/draw_engine.py`
- Main method: `generate_draw(round_id)`
- Helper method: `_generate_group_matches(players, group_type, round_id)`

**2. Current Group Structure**
- **Elite Group**: Top 50% of participants (configurable via `elite_cutoff`)
- **Challenger Group**: Bottom 50% of participants

**3. Configuration**
- Managed by `RankingConfigService` in `src/services/ranking_config.py`
- Default `elite_cutoff`: 8 players
- Stored in `ranking_season_config` table

### How the Current Draw Engine Works

#### Step 1: Initialization
```python
def generate_draw(round_id):
    # Get round and season information
    round_info = db.execute('''
        SELECT r.*, s.id as season_id FROM ranking_rounds r
        JOIN ranking_seasons s ON r.season_id = s.id
        WHERE r.id = %s
    ''', (round_id,)).fetchone()
    
    # Load season configuration
    config = RankingConfigService.get_config(round_info['season_id'])
    elite_cutoff = config['elite_cutoff']  # Default: 8
```

#### Step 2: Participant Retrieval
```python
# Get active participants ordered by position (ranking)
participants = db.execute('''
    SELECT rp.*, u.name FROM ranking_participants rp
    JOIN users u ON rp.user_id = u.id
    WHERE rp.season_id = %s AND rp.is_active = true
    ORDER BY rp.position ASC
''', (round_info['season_id'],)).fetchall()
```

#### Step 3: Group Split (Current Two-Tier System)
```python
# Split into Elite and Challenger groups
elite_players = participants[:elite_cutoff]        # Positions 1-8
challenger_players = participants[elite_cutoff:]   # Positions 9+
```

#### Step 4: Match Generation
```python
# Generate matches for each group
elite_matches = DrawEngine._generate_group_matches(elite_players, 'elite', round_id)
challenger_matches = DrawEngine._generate_group_matches(challenger_players, 'challenger', round_id)
```

#### Step 5: Match Pairing Algorithm

The `_generate_group_matches()` method implements a sophisticated pairing algorithm:

**Key Features:**
1. **2 Matches Per Player**: Each player gets exactly 2 matches per round
2. **Recent Opponent Avoidance**: Checks last 2 rounds to avoid repeat pairings
3. **Even Distribution**: Ensures all players get equal number of matches
4. **Fairness**: Prioritizes players with fewer matches first

**Algorithm Flow:**
```python
def _generate_group_matches(players, group_type, round_id):
    # 1. Get recent pairings from last 2 rounds
    recent_pairings = db.execute('''
        SELECT player1_id, player2_id FROM ranking_draws
        WHERE round_id IN (
            SELECT id FROM ranking_rounds 
            WHERE season_id = (SELECT season_id FROM ranking_rounds WHERE id = %s)
            AND round_number >= (SELECT round_number - 2 FROM ranking_rounds WHERE id = %s)
        )
    ''', (round_id, round_id)).fetchall()
    
    # 2. Track matches per player
    player_matches = {pid: 0 for pid in player_ids}
    
    # 3. Generate matches with constraints
    while attempts < max_attempts:
        # Find player with fewest matches
        min_matches = min(player_matches.values())
        if min_matches >= 2:
            break  # All players have 2 matches
        
        # Find best opponent (prioritize those with fewer matches)
        # Avoid recent opponents if possible
        # Avoid duplicate pairings
    
    return matches
```

#### Step 6: Database Persistence
```python
# Save matches to database
for match in all_matches:
    # Insert into ranking_matches table
    db.execute('''
        INSERT INTO ranking_matches (round_id, player1_id, player2_id, group_type)
        VALUES (%s, %s, %s, %s)
    ''', (round_id, match['player1_id'], match['player2_id'], match['group_type']))
    
    # Save draw history for audit trail
    db.execute('''
        INSERT INTO ranking_draws (round_id, player1_id, player2_id, group_type)
        VALUES (%s, %s, %s, %s)
    ''', (round_id, match['player1_id'], match['player2_id'], match['group_type']))

# Update round status
db.execute('UPDATE ranking_rounds SET status = %s WHERE id = %s', ('drawn', round_id))
```

### System Relationships

#### 1. Database Tables

**ranking_seasons**
- Stores season information (year, dates, status)
- Referenced by: ranking_rounds, ranking_participants, ranking_season_config

**ranking_season_config**
- Stores season-specific configuration (elite_cutoff, points, etc.)
- Key field: `elite_cutoff` (default: 8)

**ranking_rounds**
- Stores monthly rounds within a season
- Status: pending → drawn → open → closed

**ranking_participants**
- Stores player rankings and stats
- Ordered by `position` (1, 2, 3, ...)
- Used to determine group membership

**ranking_matches**
- Stores generated matches
- Fields: player1_id, player2_id, group_type ('elite' or 'challenger')

**ranking_draws**
- Audit trail of all draws
- Used to avoid recent opponent pairings

#### 2. API Endpoints

**POST /api/ranking/rounds/{round_id}/draw**
- Triggers draw generation
- Requires admin authentication
- Calls `DrawEngine.generate_draw(round_id)`

**DELETE /api/ranking/rounds/{round_id}/draw**
- Cancels a draw (if no results recorded)
- Deletes matches and draw history

**GET /api/ranking/leaderboard/{season_id}?group=elite|challenger|all**
- Returns participants filtered by group
- Uses `elite_cutoff` to determine group membership

#### 3. Frontend Components

**AdminRanking.jsx**
- Season management interface
- Triggers draw generation via API

**RankingLeaderboard.jsx**
- Displays participants by group (Elite/Challenger)
- Filters based on position and elite_cutoff

**RankingMatches.jsx**
- Displays matches grouped by type (elite/challenger)

#### 4. Service Dependencies

```
DrawEngine
    ├── RankingConfigService (get elite_cutoff)
    ├── Database (get_db)
    └── Used by: ranking.py (generate_draw endpoint)

RankingConfigService
    ├── Database (ranking_season_config table)
    └── Used by: DrawEngine, ranking.py, PointsCalculator
```

### Current Configuration

**Default Values (RankingConfigService.DEFAULT_CONFIG):**
```python
{
    'elite_cutoff': 8,              # Top 8 players = Elite
    'matches_per_round': 2,         # 2 matches per player
    'win_points': 100,
    'loss_points': 25,
    'wo_win_points': 132,
    'wo_loss_points': -30,
    'set_win_points': 10,
    'set_loss_points': -10,
    'game_win_points': 1,
    'game_loss_points': -1,
    'temp_points_expire_month': 3,
    'regular_rounds': 10,
    'finals_month': 11
}
```

---

## Proposed Three-Tier Group System

### New Group Structure

**Elite Group**: Positions 1-8 (configurable)
**Challenger Group**: Positions 9-16 (configurable)
**Next Gen Group**: Positions 17+ (all remaining players)

### Implementation Changes Required

#### 1. Configuration Updates

**Add new config parameter:**
```python
DEFAULT_CONFIG = {
    'elite_cutoff': 8,           # Positions 1-8
    'challenger_cutoff': 16,     # NEW: Positions 9-16
    'matches_per_round': 2,
    # ... rest of config
}
```

#### 2. Database Schema Changes

**Update ranking_matches.group_type constraint:**
```sql
-- Current constraint
group_type VARCHAR(20) CHECK (group_type IN ('elite', 'challenger'))

-- New constraint
group_type VARCHAR(20) CHECK (group_type IN ('elite', 'challenger', 'nextgen'))
```

**Migration file needed:** `src/database/migrations/XXX_add_nextgen_group.sql`

#### 3. Draw Engine Changes

**Modified group split logic:**
```python
def generate_draw(round_id):
    # ... existing code ...
    
    config = RankingConfigService.get_config(round_info['season_id'])
    elite_cutoff = config['elite_cutoff']           # 8
    challenger_cutoff = config['challenger_cutoff']  # 16
    
    # Split into three groups
    elite_players = participants[:elite_cutoff]                      # 1-8
    challenger_players = participants[elite_cutoff:challenger_cutoff] # 9-16
    nextgen_players = participants[challenger_cutoff:]               # 17+
    
    # Generate matches for each group
    elite_matches = DrawEngine._generate_group_matches(elite_players, 'elite', round_id)
    challenger_matches = DrawEngine._generate_group_matches(challenger_players, 'challenger', round_id)
    nextgen_matches = DrawEngine._generate_group_matches(nextgen_players, 'nextgen', round_id)
    
    # Combine all matches
    all_matches = elite_matches + challenger_matches + nextgen_matches
    
    # ... rest of existing code ...
```

**No changes needed to `_generate_group_matches()` method** - it's already generic and works with any group size.

#### 4. API Endpoint Changes

**Update leaderboard endpoint:**
```python
@ranking_bp.route('/leaderboard/<int:season_id>', methods=['GET'])
def get_leaderboard(season_id):
    group = request.args.get('group', 'all')  # elite, challenger, nextgen, all
    
    config = RankingConfigService.get_config(season['id'])
    elite_cutoff = config['elite_cutoff']
    challenger_cutoff = config['challenger_cutoff']
    
    participants = db.execute('''
        SELECT rp.*, u.name, u.short_name
        FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.season_id = %s AND rp.is_active = true
        ORDER BY rp.position ASC
    ''', (season['id'],)).fetchall()
    
    if group == 'elite':
        participants = participants[:elite_cutoff]
    elif group == 'challenger':
        participants = participants[elite_cutoff:challenger_cutoff]
    elif group == 'nextgen':
        participants = participants[challenger_cutoff:]
    
    return jsonify([dict(p) for p in participants])
```

**Update recent results endpoint:**
```python
@ranking_bp.route('/recent-results', methods=['GET'])
def get_recent_results():
    # ... existing code ...
    
    config = RankingConfigService.get_config(result['season_id'])
    elite_cutoff = config.get('elite_cutoff', 8)
    challenger_cutoff = config.get('challenger_cutoff', 16)
    
    # Determine group type based on players' positions
    if (p1_position and p1_position['position'] <= elite_cutoff) or \
       (p2_position and p2_position['position'] <= elite_cutoff):
        result_dict['group_type'] = 'elite'
    elif (p1_position and p1_position['position'] <= challenger_cutoff) or \
         (p2_position and p2_position['position'] <= challenger_cutoff):
        result_dict['group_type'] = 'challenger'
    else:
        result_dict['group_type'] = 'nextgen'
```

**Update player-on-fire endpoint:**
```python
@ranking_bp.route('/player-on-fire', methods=['GET'])
def get_player_on_fire():
    # ... existing code ...
    
    config = RankingConfigService.get_config(season_id)
    elite_cutoff = config.get('elite_cutoff', 8)
    challenger_cutoff = config.get('challenger_cutoff', 16)
    
    elite_streaks = []
    challenger_streaks = []
    nextgen_streaks = []
    
    for uid, streak in streaks.items():
        if streak > 0:
            player = participants_map[uid]
            player_data = {
                'user_id': uid,
                'name': player['short_name'] or player['name'],
                'streak': streak,
                'position': player['position']
            }
            
            if player['position'] <= elite_cutoff:
                elite_streaks.append(player_data)
            elif player['position'] <= challenger_cutoff:
                challenger_streaks.append(player_data)
            else:
                nextgen_streaks.append(player_data)
    
    return jsonify({
        'elite': elite_streaks[:5],
        'challenger': challenger_streaks[:5],
        'nextgen': nextgen_streaks[:5]
    })
```

#### 5. Frontend Changes

**RankingLeaderboard.jsx:**
- Add "Next Gen" tab
- Update group filter to include 'nextgen'

**RankingMatches.jsx:**
- Add "Next Gen" section for match display
- Update group badge colors/labels

**AdminRanking.jsx:**
- Add configuration field for `challenger_cutoff`

**Statistics components:**
- Update group filtering to include 'nextgen'

#### 6. Test Updates

**test_ranking_system.py:**
- Add tests for three-tier group split
- Test draw generation with nextgen group
- Test leaderboard filtering with nextgen

---

## Implementation Checklist

### Phase 1: Database & Configuration
- [ ] Create migration file: `XXX_add_nextgen_group.sql`
- [ ] Update `ranking_matches.group_type` constraint
- [ ] Update `ranking_draws.group_type` constraint (no constraint, but consistency)
- [ ] Add `challenger_cutoff` to `RankingConfigService.DEFAULT_CONFIG`
- [ ] Update architecture documentation

### Phase 2: Backend Logic
- [ ] Update `DrawEngine.generate_draw()` for three groups
- [ ] Update `ranking.py` leaderboard endpoint
- [ ] Update `ranking.py` recent-results endpoint
- [ ] Update `ranking.py` player-on-fire endpoint
- [ ] Update any other endpoints that filter by group

### Phase 3: Frontend Updates
- [ ] Update `RankingLeaderboard.jsx` (add Next Gen tab)
- [ ] Update `RankingMatches.jsx` (add Next Gen section)
- [ ] Update `AdminRanking.jsx` (add challenger_cutoff config)
- [ ] Update statistics components
- [ ] Update any group badge/label components

### Phase 4: Testing
- [ ] Add unit tests for three-tier draw
- [ ] Test with various participant counts (7, 15, 20, 30 players)
- [ ] Test edge cases (exactly 8, exactly 16 players)
- [ ] Test with 0 players in a group
- [ ] E2E tests for draw generation

### Phase 5: Documentation
- [ ] Update API documentation (Swagger)
- [ ] Update user manual
- [ ] Update architecture documentation
- [ ] Add migration notes

---

## Edge Cases to Consider

### 1. Insufficient Players
- **Elite only (< 9 players)**: No Challenger or Next Gen matches
- **Elite + Challenger only (< 17 players)**: No Next Gen matches
- **Odd number in group**: One player may get fewer matches

### 2. Configuration Validation
- Ensure `challenger_cutoff > elite_cutoff`
- Ensure both values are positive integers
- Handle missing config (use defaults)

### 3. Group Transitions
- Player moves from Next Gen → Challenger → Elite as ranking improves
- Historical matches retain original group_type
- Leaderboard displays current position

### 4. Draw Cancellation
- Delete matches from all three groups
- Maintain referential integrity

---

## Benefits of Three-Tier System

1. **Better Skill Matching**: Players face opponents closer to their level
2. **Clearer Progression Path**: Next Gen → Challenger → Elite
3. **Increased Engagement**: More meaningful matches for mid-tier players
4. **Scalability**: System handles larger participant pools better
5. **Motivation**: Clear goals for advancement between tiers

---

## Backward Compatibility

The implementation maintains backward compatibility:
- Existing two-tier seasons continue to work (challenger_cutoff defaults to total participants)
- Database migration is additive (no data loss)
- Frontend gracefully handles missing 'nextgen' group
- API endpoints support both old and new group filters

---

## Performance Considerations

- **Draw Generation Time**: Minimal impact (same algorithm, just three iterations)
- **Database Queries**: No additional queries needed
- **Frontend Rendering**: Slightly more data to display (one additional group)
- **Match Count**: Same (2 matches per player regardless of group)

---

## Summary

The current draw engine is well-architected and requires minimal changes to support three-tier grouping. The main modifications are:

1. **Configuration**: Add `challenger_cutoff` parameter
2. **Database**: Update group_type constraint to include 'nextgen'
3. **Draw Logic**: Split participants into three groups instead of two
4. **API Endpoints**: Update filtering logic for three groups
5. **Frontend**: Add Next Gen UI elements

The existing pairing algorithm (`_generate_group_matches`) requires no changes and will work seamlessly with the new group structure.
