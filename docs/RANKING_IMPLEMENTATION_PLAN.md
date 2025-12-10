# LAPEN Ranking System 2026 - Implementation Plan

## Overview
Implement annual ranking system with monthly draws, match results tracking, and year-specific configuration based on regulamento2026.html requirements.

## Core Requirements
- ✅ Annual ranking with points system
- ✅ Monthly draws (Elite vs Challenger groups)
- ✅ Match result submission with statistics
- ✅ Only registered users can have results recorded
- ✅ Year-specific configuration (rules can change annually)
- ✅ W.O. administrative system with evidence tracking
- ✅ Temporary points system (Jan-Feb only)

---

## Phase 1: Database Schema

### New Tables

#### 1. ranking_seasons
```sql
id INTEGER PRIMARY KEY
year INTEGER UNIQUE NOT NULL
start_date TEXT NOT NULL
end_date TEXT NOT NULL
status TEXT CHECK (status IN ('draft', 'active', 'finished'))
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### 2. ranking_season_config
Year-specific settings (no hardcoded values)
```sql
id INTEGER PRIMARY KEY
season_id INTEGER NOT NULL REFERENCES ranking_seasons(id)
key TEXT NOT NULL
value TEXT NOT NULL
data_type TEXT CHECK (data_type IN ('int', 'float', 'string', 'boolean'))
UNIQUE(season_id, key)
```

**Config Keys:**
- `elite_cutoff` - Position split (default: 8)
- `matches_per_round` - Matches per player monthly (default: 2)
- `win_points` - Base win points (default: 100)
- `loss_points` - Base loss points (default: 25)
- `wo_win_points` - W.O. win (default: 132)
- `wo_loss_points` - W.O. loss (default: -30)
- `set_win_points` - Per set won (default: 10)
- `set_loss_points` - Per set lost (default: -10)
- `game_win_points` - Per game won (default: 1)
- `game_loss_points` - Per game lost (default: -1)
- `temp_points_expire_month` - Month to remove temp points (default: 3)
- `regular_rounds` - Regular rounds count (default: 10)
- `finals_month` - Finals month (default: 11)

#### 3. ranking_temp_points_rules
Initial standings for season start
```sql
id INTEGER PRIMARY KEY
season_id INTEGER NOT NULL REFERENCES ranking_seasons(id)
position_min INTEGER NOT NULL
position_max INTEGER NOT NULL
points INTEGER NOT NULL
label TEXT
```

#### 4. ranking_rounds
```sql
id INTEGER PRIMARY KEY
season_id INTEGER NOT NULL REFERENCES ranking_seasons(id)
round_number INTEGER NOT NULL
month INTEGER NOT NULL
year INTEGER NOT NULL
draw_date DATETIME
status TEXT CHECK (status IN ('pending', 'drawn', 'in_progress', 'completed'))
is_finals BOOLEAN DEFAULT FALSE
UNIQUE(season_id, round_number)
```

#### 5. ranking_participants
```sql
id INTEGER PRIMARY KEY
season_id INTEGER NOT NULL REFERENCES ranking_seasons(id)
user_id INTEGER NOT NULL REFERENCES users(id)
temp_points INTEGER DEFAULT 0
total_points INTEGER DEFAULT 0
wins INTEGER DEFAULT 0
losses INTEGER DEFAULT 0
sets_won INTEGER DEFAULT 0
sets_lost INTEGER DEFAULT 0
games_won INTEGER DEFAULT 0
games_lost INTEGER DEFAULT 0
wo_wins INTEGER DEFAULT 0
wo_losses INTEGER DEFAULT 0
position INTEGER
UNIQUE(season_id, user_id)
```

#### 6. ranking_matches
```sql
id INTEGER PRIMARY KEY
round_id INTEGER NOT NULL REFERENCES ranking_rounds(id)
schedule_id INTEGER REFERENCES schedules(id)
player1_id INTEGER NOT NULL REFERENCES users(id)
player2_id INTEGER NOT NULL REFERENCES users(id)
group_type TEXT CHECK (group_type IN ('elite', 'challenger'))
status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled', 'wo'))
winner_id INTEGER REFERENCES users(id)
score TEXT
sets_p1 INTEGER DEFAULT 0
sets_p2 INTEGER DEFAULT 0
games_p1 INTEGER DEFAULT 0
games_p2 INTEGER DEFAULT 0
wo_type TEXT CHECK (wo_type IN ('none', 'admin', 'forfeit'))
points_p1 INTEGER DEFAULT 0
points_p2 INTEGER DEFAULT 0
played_at DATETIME
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### 7. ranking_draws
Draw history for transparency
```sql
id INTEGER PRIMARY KEY
round_id INTEGER NOT NULL REFERENCES ranking_rounds(id)
player1_id INTEGER NOT NULL REFERENCES users(id)
player2_id INTEGER NOT NULL REFERENCES users(id)
group_type TEXT NOT NULL
drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### 8. match_scheduling_logs
Evidence for W.O. administrative decisions
```sql
id INTEGER PRIMARY KEY
match_id INTEGER NOT NULL REFERENCES ranking_matches(id)
user_id INTEGER NOT NULL REFERENCES users(id)
proposed_slots TEXT NOT NULL
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

---

## Phase 2: Backend API Routes

### Configuration Management
```
GET    /api/ranking/seasons/:year/config
PUT    /api/ranking/seasons/:year/config (admin)
GET    /api/ranking/seasons/:year/temp-points-rules
POST   /api/ranking/seasons/:year/temp-points-rules (admin)
```

### Season Management
```
POST   /api/ranking/seasons (admin)
GET    /api/ranking/seasons
GET    /api/ranking/seasons/:year
PATCH  /api/ranking/seasons/:year (admin)
```

### Rounds & Draws
```
POST   /api/ranking/rounds (admin)
GET    /api/ranking/rounds/:season_id
POST   /api/ranking/rounds/:id/draw (admin)
GET    /api/ranking/rounds/:id/matches
```

### Match Results
```
POST   /api/ranking/matches/:id/result
GET    /api/ranking/matches/:id
POST   /api/ranking/matches/:id/wo-request
PUT    /api/ranking/matches/:id/wo-resolve (admin)
GET    /api/ranking/matches/:id/scheduling-logs
```

### Leaderboard & Stats
```
GET    /api/ranking/leaderboard/:year?group=elite|challenger
GET    /api/ranking/stats/:user_id/:year
GET    /api/ranking/history/:user_id
```

---

## Phase 3: Business Logic

### Config Service
```python
class RankingConfigService:
    def get_config(season_id):
        # Returns dict with typed values
        
    def get_temp_points_for_position(season_id, position):
        # Returns points based on rules
```

### Points Calculator
```python
class PointsCalculator:
    def calculate(match_result, season_id):
        cfg = get_config(season_id)
        if wo:
            return cfg['wo_win_points'] if won else cfg['wo_loss_points']
        
        base = cfg['win_points'] if won else cfg['loss_points']
        sets = (sets_won * cfg['set_win_points']) + (sets_lost * cfg['set_loss_points'])
        games = (games_won * cfg['game_win_points']) + (games_lost * cfg['game_loss_points'])
        return base + sets + games
```

### Draw Engine
```python
class DrawEngine:
    def generate_draw(round_id):
        cfg = get_config(season_id)
        cutoff = cfg['elite_cutoff']
        matches_per_player = cfg['matches_per_round']
        
        # Split participants by position
        elite = participants[:cutoff]
        challenger = participants[cutoff:]
        
        # Generate pairs within each group
        # Avoid repeat matchups from previous rounds
        # Create ranking_draws records
```

### Temp Points Manager
```python
class TempPointsManager:
    def check_expiry(season_id):
        cfg = get_config(season_id)
        if current_month >= cfg['temp_points_expire_month']:
            expire_temp_points(season_id)
```

### W.O. Resolver
```python
class WOResolver:
    def resolve(match_id):
        logs = get_scheduling_logs(match_id)
        player1_proposals = count_proposals(logs, player1_id)
        player2_proposals = count_proposals(logs, player2_id)
        
        winner = player1 if player1_proposals > player2_proposals else player2
        update_match_wo(match_id, winner)
```

---

## Phase 4: Frontend Components

### Admin Pages
- `/admin/ranking/seasons` - Manage seasons
- `/admin/ranking/config/:year` - Edit year config
- `/admin/ranking/temp-points/:year` - Define temp points rules
- `/admin/ranking/rounds/:year` - Create rounds, trigger draws
- `/admin/ranking/wo-requests` - Resolve W.O. disputes

### User Pages
- `/ranking` - Current season leaderboard (Elite/Challenger tabs)
- `/ranking/:year` - Historical season view
- `/ranking/matches/:id` - Match detail + result submission
- `/ranking/stats/:user_id` - Player statistics
- `/ranking/my-matches` - User's scheduled matches

### Components
- `RankingLeaderboard` - Table with position, player, points, W-L, sets, games
- `MatchResultForm` - Score input with validation (6-4, 6-3 format)
- `DrawVisualization` - Elite vs Challenger groups display
- `SchedulingLogTimeline` - W.O. evidence display
- `SeasonConfigEditor` - Admin config management
- `TempPointsRulesEditor` - Admin temp points setup

---

## Phase 5: Validations

### Match Result Submission
- ✅ Both players must be registered users (is_lapen_member = TRUE)
- ✅ Match must belong to current round
- ✅ Score format validation: "6-4, 6-3" or "6-4, 4-6, 10-8"
- ✅ Only match participants or admin can submit
- ✅ Cannot modify completed matches

### Draw Generation
- ✅ Round must be in 'pending' status
- ✅ Sufficient participants in season
- ✅ Avoid duplicate pairings within same round
- ✅ Respect group boundaries (Elite/Challenger)

### W.O. Request
- ✅ Match must be past due date
- ✅ Requester must be match participant
- ✅ Must provide scheduling evidence (proposed_slots)

---

## Phase 6: Migration Strategy

### Files
1. `src/database/migrations/001_ranking_tables.sql` (SQLite)
2. `src/database/migrations/001_ranking_tables_postgres.sql` (PostgreSQL)
3. `src/database/migrations/002_seed_2026_config.sql`
4. `src/database/migrations/003_seed_2026_temp_points.sql`

### Seed Data for 2026
```sql
-- Season
INSERT INTO ranking_seasons (year, start_date, end_date, status) 
VALUES (2026, '2026-01-01', '2026-12-31', 'active');

-- Config (13 keys)
INSERT INTO ranking_season_config (season_id, key, value, data_type) VALUES
(1, 'elite_cutoff', '8', 'int'),
(1, 'matches_per_round', '2', 'int'),
(1, 'win_points', '100', 'int'),
(1, 'loss_points', '25', 'int'),
(1, 'wo_win_points', '132', 'int'),
(1, 'wo_loss_points', '0', 'int'),
(1, 'set_win_points', '10', 'int'),
(1, 'set_loss_points', '-10', 'int'),
(1, 'game_win_points', '1', 'int'),
(1, 'game_loss_points', '-1', 'int'),
(1, 'temp_points_expire_month', '3', 'int'),
(1, 'regular_rounds', '10', 'int'),
(1, 'finals_month', '11', 'int');

-- Temp Points Rules (7 tiers)
INSERT INTO ranking_temp_points_rules (season_id, position_min, position_max, points, label) VALUES
(1, 1, 2, 2500, '1º e 2º'),
(1, 3, 4, 2000, '3º e 4º'),
(1, 5, 6, 1600, '5º e 6º'),
(1, 7, 8, 1200, '7º e 8º'),
(1, 9, 10, 1000, '9º e 10º'),
(1, 11, 16, 800, '11º ao 16º'),
(1, 17, 999, 0, '17º+ / Novos');
```

---

## Phase 7: Integration with Existing System

### Link to Schedules
- When creating schedule with `match_type = 'Liga'`, optionally link to `ranking_matches.schedule_id`
- Admin can manually link existing schedules to ranking matches

### User Requirements
- Only users with `is_lapen_member = TRUE` can participate in ranking
- Match results require both players to be registered users

### Swagger Documentation
- Update `docs/API_DOCUMENTATION.md`
- Add all new endpoints with request/response schemas

---

## Phase 8: Testing Requirements

### Unit Tests
- Config service type casting
- Points calculator with various scenarios
- Draw engine group splitting
- Temp points expiry logic
- W.O. resolver evidence comparison

### E2E Tests
- Create season with config
- Generate monthly draw
- Submit match result
- View leaderboard (Elite/Challenger split)
- Request and resolve W.O.
- Verify temp points removal on March 1st

### Test Data
- Seed test season with 20 participants
- Create 2 rounds with draws
- Submit various match results
- Test edge cases (ties, W.O., super tie-breaks)

---

## Phase 9: Future Enhancements (Post-MVP)

- [ ] Finals tournament bracket (November)
- [ ] Historical season comparison
- [ ] Player head-to-head records
- [ ] Export leaderboard to PDF
- [ ] WhatsApp notifications for draws
- [ ] Mobile app integration
- [ ] Prize/trophy tracking

---

## Implementation Order

1. **Database** - Create tables, seed 2026 config
2. **Backend** - Config service, points calculator, basic CRUD
3. **Admin UI** - Season management, config editor
4. **Draw Engine** - Monthly draw generation
5. **Match Results** - Submission form, points calculation
6. **Leaderboard** - Elite/Challenger display
7. **W.O. System** - Evidence logging, admin resolution
8. **Testing** - Unit + E2E coverage
9. **Documentation** - API docs, user guide

---

## Key Design Principles

✅ **Configuration over Code** - All rules in database, not hardcoded  
✅ **Year Independence** - Each season has isolated config  
✅ **Audit Trail** - Track draws, results, W.O. decisions  
✅ **Validation First** - Strict checks on all operations  
✅ **Mobile Responsive** - Touch-friendly UI  
✅ **Portuguese UI** - All user-facing text in PT-BR  

---

## Estimated Effort

- Database: 4 hours
- Backend API: 12 hours
- Frontend Components: 16 hours
- Testing: 8 hours
- Documentation: 4 hours

**Total: ~44 hours** (5-6 days)
