# Ranking System - Schedule Integration

## Overview

This document describes the automatic integration between the ranking system and the scheduling/statistics modules. When players schedule a "Liga" match and add results through statistics, the system now automatically recognizes and updates the corresponding ranking match.

## Problem Solved

Previously, when players:
1. Had a ranking match drawn (status: `scheduled`)
2. Scheduled it using the calendar (match_type: `Liga`)
3. Added the result via statistics

The ranking match remained in `scheduled` status and had to be manually updated by an admin. This created duplicate work and potential inconsistencies.

## Solution

### 1. Automatic Linking on Schedule Creation

When a player creates a schedule with `match_type='Liga'`:

**File:** `src/routes/public.py` - `create_schedule()`

```python
# If Liga match and both players are registered, link to pending ranking match
if match_type == 'Liga' and p1_user and p2_user:
    ranking_match = db.execute('''
        SELECT rm.id FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        WHERE rr.status = 'open' AND rm.status = 'scheduled'
          AND ((rm.player1_id = %s AND rm.player2_id = %s) 
            OR (rm.player1_id = %s AND rm.player2_id = %s))
        LIMIT 1
    ''', (p1_user['id'], p2_user['id'], p2_user['id'], p1_user['id'])).fetchone()
    
    if ranking_match:
        db.execute('UPDATE ranking_matches SET schedule_id = %s WHERE id = %s', 
                  (schedule_id, ranking_match['id']))
```

**Logic:**
- Checks if both players are registered users (not guests)
- Searches for an open round with a scheduled match between these two players
- Links the schedule to the ranking match via `schedule_id` field

### 2. Automatic Ranking Update on Result Submission

When a player adds a result via statistics:

**File:** `src/routes/statistics.py` - `add_match_result()`

```python
# Check if this schedule is linked to a ranking match
linked_ranking_match = db.execute('''
    SELECT rm.*, rr.season_id, rr.status as round_status
    FROM ranking_matches rm
    JOIN ranking_rounds rr ON rm.round_id = rr.id
    WHERE rm.schedule_id = %s AND rm.status = 'scheduled'
''', (schedule_id,)).fetchone()

if linked_ranking_match:
    # Update the ranking match with result
    # Calculate points using PointsCalculator
    # Update ranking_participants stats
    # Update positions
```

**Logic:**
- When adding a result for a schedule, checks if it's linked to a ranking match
- If linked, automatically:
  - Updates the ranking match status to `completed`
  - Calculates and assigns points using the season's configuration
  - Updates participant statistics (wins, losses, sets, games)
  - Recalculates positions in the leaderboard
  - Creates a unified statistics entry with both `schedule_id` and `ranking_match_id`

### 3. Updated Past Matches Query

**File:** `src/routes/statistics.py` - `get_past_matches()`

```python
schedule_matches = db.execute('''
    SELECT s.id, s.date, s.start_time, s.player1_name, s.player2_name, s.match_type,
           rm.id as ranking_match_id
    FROM schedules s
    LEFT JOIN match_statistics_unified mr ON s.id = mr.schedule_id
    LEFT JOIN ranking_matches rm ON s.id = rm.schedule_id AND rm.status = 'scheduled'
    WHERE s.deleted_at IS NULL AND mr.id IS NULL AND s.date <= CURRENT_DATE
    ORDER BY s.date DESC, s.start_time DESC
''').fetchall()

ranking_matches = db.execute('''
    SELECT rm.id, NULL as date, NULL as start_time, 
           u1.short_name as player1_name, u2.short_name as player2_name, 
           'Ranking' as match_type, rm.id as ranking_match_id
    FROM ranking_matches rm
    JOIN users u1 ON rm.player1_id = u1.id
    JOIN users u2 ON rm.player2_id = u2.id
    WHERE rm.status = 'scheduled' AND rm.schedule_id IS NULL
''').fetchall()
```

**Logic:**
- Shows schedules without results, including their linked ranking match ID
- Shows unlinked ranking matches (those not yet scheduled)
- Prevents duplicate entries by excluding ranking matches that are already linked to schedules

## User Flow

### Scenario 1: Player Schedules and Adds Result

1. **Admin draws ranking round** → Creates `ranking_matches` with status `scheduled`
2. **Player schedules Liga match** → System links schedule to ranking match via `schedule_id`
3. **Match is played**
4. **Player adds result in statistics** → System automatically:
   - Updates ranking match to `completed`
   - Calculates points based on season configuration
   - Updates participant statistics
   - Recalculates leaderboard positions
   - Creates unified statistics entry

### Scenario 2: Admin Adds Result Manually

1. **Admin draws ranking round** → Creates `ranking_matches` with status `scheduled`
2. **Match is played (not scheduled in calendar)**
3. **Admin adds result in ranking panel** → Manual process (unchanged)

## Database Schema

### Key Fields

**schedules table:**
- `player1_id`, `player2_id` - Links to users (NULL for guests)
- `match_type` - 'Liga', 'Amistoso', 'Aula', 'Torneio'

**ranking_matches table:**
- `schedule_id` - Links to schedules (NULL if not scheduled)
- `status` - 'scheduled', 'completed', 'cancelled', 'wo'
- `player1_id`, `player2_id` - Required user IDs

**match_statistics_unified table:**
- `schedule_id` - Links to schedules (NULL for manual ranking entries)
- `ranking_match_id` - Links to ranking matches (NULL for non-ranking matches)
- `season_id` - Links to ranking season (NULL for non-ranking matches)

## Benefits

1. **Eliminates Duplicate Work** - No need to manually update ranking matches after adding statistics
2. **Prevents Inconsistencies** - Single source of truth for match results
3. **Automatic Points Calculation** - Uses season-specific configuration
4. **Seamless Integration** - Works transparently for users
5. **Backward Compatible** - Manual admin entry still works for unscheduled matches
6. **Audit Trail** - Maintains complete history in both systems

## Edge Cases Handled

1. **Guest Players** - Only links if both players are registered users
2. **Multiple Open Rounds** - Uses LIMIT 1 to prevent ambiguity
3. **Already Completed Matches** - Only links to `scheduled` status matches
4. **Unlinked Ranking Matches** - Still appear in past matches for manual entry
5. **Non-Liga Matches** - Only Liga matches trigger ranking integration

## Testing Checklist

- [ ] Create Liga schedule with two registered players → Verify `schedule_id` set in `ranking_matches`
- [ ] Add result via statistics → Verify ranking match updated to `completed`
- [ ] Check participant points → Verify points calculated correctly
- [ ] Check leaderboard → Verify positions updated
- [ ] Create Liga schedule with guest player → Verify no linking occurs
- [ ] Add result for non-Liga match → Verify no ranking update
- [ ] Add result for unlinked ranking match → Verify manual entry still works
- [ ] Check past matches endpoint → Verify no duplicates shown

## Future Enhancements

1. **Notification System** - Notify players when their ranking match result is recorded
2. **Conflict Detection** - Warn if trying to schedule Liga match without pending ranking match
3. **Bulk Import** - Import multiple results from tournament brackets
4. **Mobile App Integration** - Push notifications for ranking updates
