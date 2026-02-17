# Closing Rounds with Pending Matches

## Feature Overview
Admins can now close ranking rounds even when there are pending (unplayed) matches. Pending matches will be marked as "Não realizado" (Not Played) with 0 points awarded to both players.

## Implementation Details

### Database Changes
- Added `'not_played'` status to `ranking_matches.status` enum
- Migration file: `src/database/migrations/012_add_not_played_status.sql`
- Updated schema: `src/database/postgres_schema.sql`

### Backend Changes
**File:** `src/routes/ranking.py`

**Endpoint:** `PUT /api/ranking/rounds/<round_id>/close`

**Request Body:**
```json
{
  "mark_pending_as_not_played": true
}
```

**Behavior:**
1. If there are pending matches and `mark_pending_as_not_played` is `false` or not provided:
   - Returns 400 error with `pending_count` in response
   - Error message: "X partida(s) ainda sem resultado"

2. If there are pending matches and `mark_pending_as_not_played` is `true`:
   - Updates all pending matches to status `'not_played'`
   - Sets score to "Não realizado"
   - Sets `points_p1` and `points_p2` to 0
   - Closes the round successfully

### Frontend Changes
**File:** `src/components/admin/SeasonRounds.jsx`

**UI Flow:**
1. Admin clicks "Fechar Rodada" button
2. If there are pending matches:
   - Dialog appears showing count of pending matches
   - Checkbox: "Marcar partidas pendentes como 'Não realizado' (0 pontos para ambos jogadores)"
   - "Fechar Rodada" button is disabled until checkbox is checked
3. Admin must explicitly confirm by checking the box
4. Round closes with pending matches marked as "Não realizado"

## Usage

### Admin Workflow
1. Navigate to **Admin → Ranking → Rodadas**
2. Select a round with status "Aberta" (Open)
3. Click **"Fechar Rodada"**
4. If pending matches exist:
   - Review the count of pending matches
   - Check the confirmation box
   - Click **"Fechar Rodada"** to confirm
5. Round status changes to "Fechada" (Closed)
6. Pending matches show as "Não realizado" with 0 points

### Match Status Values
- `scheduled` - Match is pending (not played yet)
- `completed` - Match finished with result
- `cancelled` - Match was cancelled
- `wo` - Match finished by walkover
- `not_played` - Match was not played (0 points)

## Points Calculation
- **Not Played matches:** Both players receive 0 points
- **No impact on ranking:** Since both players get 0 points, positions remain unchanged
- **Statistics:** Not played matches are not included in win/loss records

## Database Query Example
```sql
-- Find all not_played matches
SELECT rm.*, u1.short_name as player1, u2.short_name as player2
FROM ranking_matches rm
JOIN users u1 ON rm.player1_id = u1.id
JOIN users u2 ON rm.player2_id = u2.id
WHERE rm.status = 'not_played';
```

## Testing
To test the feature:
1. Create a round and generate draw
2. Open the round
3. Submit results for some matches (leave others pending)
4. Try to close the round
5. Verify dialog appears with pending count
6. Check the confirmation box
7. Verify round closes and pending matches are marked as "Não realizado"
