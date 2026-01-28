# Bug Fix: Match 43 Zero Points Issue

## Problem
Ranking match ID 43 was saved with 0 points for both players despite having a valid score "0-6, 2-6".

## Root Cause
The `recalculate_ranking` function in `/src/routes/ranking.py` had a critical bug:
- It was reading the **existing** `points_p1`, `points_p2`, `sets_p1`, `sets_p2`, `games_p1`, `games_p2` from the database
- It was **NOT recalculating** these values from the score
- It was just re-applying the stored values back to the participants

This meant:
1. If a match was saved incorrectly with 0 points (due to a bug elsewhere)
2. The recalculate button would just re-apply those 0 points
3. The issue would never be fixed

## The Fix
Modified the `recalculate_ranking` function to:
1. Parse the score string using `PointsCalculator.parse_score()`
2. Recalculate points using `PointsCalculator.calculate()`
3. Update the match record with the correct sets, games, and points
4. Then apply these recalculated values to participant stats

## Changes Made
File: `/src/routes/ranking.py`
Function: `recalculate_ranking` (lines 636-680)

**Before:**
```python
matches = db.execute('''
    SELECT rm.id, rm.player1_id, rm.player2_id, rm.winner_id, rm.points_p1, rm.points_p2,
           rm.sets_p1, rm.sets_p2, rm.games_p1, rm.games_p2, rm.wo_type
    ...
''')

for match in matches:
    # Just re-apply stored values
    for player_id, is_winner, sets_won, sets_lost, games_won, games_lost, points in [
        (match['player1_id'], ..., match['sets_p1'], match['sets_p2'], ..., match['points_p1']),
        ...
    ]:
```

**After:**
```python
matches = db.execute('''
    SELECT rm.id, rm.player1_id, rm.player2_id, rm.winner_id, rm.score, rm.wo_type
    ...
''')

for match in matches:
    # Parse score and recalculate
    p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score(match['score'])
    winner_points, loser_points = PointsCalculator.calculate(match_result, season['id'])
    
    # Update match with recalculated values
    db.execute('UPDATE ranking_matches SET sets_p1 = %s, ..., points_p1 = %s, ...')
    
    # Then apply to participants
    for player_id, is_winner, sets_won, sets_lost, games_won, games_lost, points in [
        (match['player1_id'], ..., p1_sets, p2_sets, ..., points_p1),
        ...
    ]:
```

## How to Fix Match 43
Now that the bug is fixed, simply:
1. Go to Admin → Ranking → Season 1
2. Click "Recalculate Ranking"
3. Match 43 will be recalculated with correct values:
   - Player 1 (Neto Rezende): 0 sets, 2 games, 27 points (loser)
   - Player 2 (Douglas Castro): 2 sets, 8 games, 128 points (winner)

## Expected Results After Recalculate
```
Match 43:
- Score: "0-6, 2-6"
- Sets: 0-2
- Games: 2-8
- Points: 27-128 (loser gets 25 + 0*10 + 2*1 = 27, winner gets 100 + 2*10 + 8*1 = 128)
```

## Prevention
This fix ensures that:
1. The recalculate button actually recalculates from scores
2. Any future data corruption can be fixed by recalculating
3. The system is more resilient to bugs in other parts of the code

## Testing
After deploying this fix:
1. Test recalculate on season 1
2. Verify match 43 has correct points
3. Verify participant totals are updated correctly
4. Check that positions are recalculated properly
