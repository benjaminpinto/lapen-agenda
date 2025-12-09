# Statistics Module - Implementation Guide

## Overview
Complete statistics module for tracking and analyzing tennis match results with head-to-head comparisons, filtering capabilities, and future image sharing functionality.

## Features Implemented

### 1. Database Schema
- **Table:** `match_statistics`
- **Fields:**
  - `id` - Primary key
  - `schedule_id` - Reference to scheduled match
  - `player1_name`, `player2_name` - Player names
  - `winner_name` - Match winner
  - `player1_sets`, `player2_sets` - Sets won by each player
  - `player1_games`, `player2_games` - Games won by each player
  - `match_type` - Type of match (Ranking, Amistoso, Liga)
  - `match_date` - Date of the match
  - `created_at` - Timestamp

- **Migrations:**
  - SQLite: `src/database/migrations/add_match_statistics_sqlite.sql`
  - PostgreSQL: `src/database/migrations/add_match_statistics_postgres.sql`

### 2. Backend API Routes

**Base URL:** `/api/statistics`

#### POST `/match-result`
Add result for a past scheduled or ranking match
- **Auth:** Required
- **Body:**
  ```json
  {
    "schedule_id": 1,
    "winner_name": "Player Name",
    "player1_sets": 2,
    "player2_sets": 1,
    "player1_games": 12,
    "player2_games": 10
  }
  ```

#### GET `/player`
Get statistics for specific players with filters
- **Query Params:**
  - `player1` (required) - First player name
  - `player2` (optional) - Second player for head-to-head
  - `match_type` (optional) - Filter by match type
- **Response:**
  ```json
  {
    "total_matches": 10,
    "wins": 6,
    "losses": 4,
    "sets_won": 15,
    "sets_lost": 12,
    "games_won": 120,
    "games_lost": 110,
    "head_to_head": {
      "player1": "Player A",
      "player2": "Player B",
      "player1_wins": 3,
      "player2_wins": 2
    },
    "matches": [...]
  }
  ```

#### GET `/past-matches`
Get past scheduled matches without results
- **Auth:** Required
- **Response:** List of matches that need results

#### GET `/players`
Get list of all players from match statistics
- **Response:** Array of player names

### 3. Frontend Components

#### `/statistics` - Statistics Page
**Location:** `src/components/statistics/Statistics.jsx`

**Features:**
- Filter by Player 1 (required)
- Filter by Player 2 (optional) for head-to-head
- Filter by match type (Ranking, Amistoso, Liga)
- Display statistics cards:
  - Total matches
  - Wins with win percentage
  - Sets won/lost
  - Games won/lost
- Head-to-head comparison when two players selected
- Match history with detailed results
- Share button (placeholder for future image sharing)

**Data Attributes:**
- `data-testid="statistics-page"`
- `data-testid="statistics-filters"`
- `data-testid="player1-select"`
- `data-testid="player2-select"`
- `data-testid="match-type-select"`
- `data-testid="fetch-stats-btn"`
- `data-testid="share-stats-btn"`
- `data-testid="head-to-head-card"`
- `data-testid="total-matches-card"`
- `data-testid="wins-card"`
- `data-testid="sets-card"`
- `data-testid="games-card"`
- `data-testid="matches-history-card"`

#### `/statistics/add-result` - Add Match Result
**Location:** `src/components/statistics/AddMatchResult.jsx`

**Features:**
- Select from past matches without results
- Choose winner
- Input sets won by each player
- Input games won by each player
- Form validation
- Success/error notifications

**Data Attributes:**
- `data-testid="add-match-result-page"`
- `data-testid="add-result-form"`
- `data-testid="match-select"`
- `data-testid="winner-select"`
- `data-testid="player1-sets-input"`
- `data-testid="player2-sets-input"`
- `data-testid="player1-games-input"`
- `data-testid="player2-games-input"`
- `data-testid="submit-result-btn"`

### 4. Navigation
- Added "Estatísticas" link to Header (desktop and mobile)
- Icon: BarChart3 from lucide-react
- Routes registered in App.jsx

### 5. API Documentation
Updated `swagger.yaml` with:
- New "Statistics" tag
- All statistics endpoints documented
- Request/response schemas
- Authentication requirements

## Usage Flow

### Adding a Match Result
1. User navigates to `/statistics/add-result`
2. Selects a past match from dropdown
3. Chooses the winner
4. Inputs sets and games for both players
5. Submits the form
6. Result is saved to `match_statistics` table

### Viewing Statistics
1. User navigates to `/statistics`
2. Selects Player 1 (required)
3. Optionally selects Player 2 for head-to-head
4. Optionally filters by match type
5. Clicks "Buscar Estatísticas"
6. Views comprehensive statistics and match history

### Head-to-Head Comparison
1. Select both Player 1 and Player 2
2. System shows:
   - Direct wins for each player
   - Overall statistics for Player 1
   - Complete match history between them

## Future Enhancements

### Image Sharing (Pending)
- Generate image with statistics (Player A vs Player B)
- Similar to bet results sharing
- Share via WhatsApp/social media
- Implementation placeholder exists in `shareStats()` function

### Additional Statistics
- Win streaks
- Performance by court type
- Monthly/yearly trends
- Tournament-specific statistics
- Average games per set
- Tiebreak statistics

## Testing

### E2E Test Coverage Needed
- Add match result flow
- View statistics with filters
- Head-to-head comparison
- Mobile responsiveness
- Form validation
- Error handling

### Test Data Attributes
All interactive elements have `data-testid` attributes for Playwright E2E tests.

## Database Compatibility
✅ SQLite (local development)
✅ PostgreSQL (Vercel production)

Both migrations use compatible data types and syntax.

## Mobile Optimization
- Responsive grid layouts (1 column on mobile, 3-4 on desktop)
- Touch-friendly buttons (minimum 44px)
- Mobile-first CSS approach
- Collapsible filters on small screens

## Security
- Authentication required for adding results
- Input validation on backend
- SQL injection prevention via parameterized queries
- XSS protection via React's built-in escaping

## Performance
- Indexed columns: player names, match_type, match_date
- Efficient queries with proper JOINs
- Pagination ready (can be added if needed)

## Integration Points
- Works with existing schedules table
- Can be extended to ranking matches
- Compatible with betting system
- Follows project architecture patterns
