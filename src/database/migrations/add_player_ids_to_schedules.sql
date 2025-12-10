-- Add player IDs to schedules table (nullable for guests)
ALTER TABLE schedules 
    ADD COLUMN IF NOT EXISTS player1_id INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS player2_id INTEGER REFERENCES users(id);

-- Backfill existing schedules
UPDATE schedules s
SET player1_id = u.id
FROM users u
WHERE (LOWER(u.short_name) = LOWER(s.player1_name) OR LOWER(u.name) = LOWER(s.player1_name))
  AND s.player1_id IS NULL;

UPDATE schedules s
SET player2_id = u.id
FROM users u
WHERE (LOWER(u.short_name) = LOWER(s.player2_name) OR LOWER(u.name) = LOWER(s.player2_name))
  AND s.player2_id IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_schedules_player1_id ON schedules(player1_id);
CREATE INDEX IF NOT EXISTS idx_schedules_player2_id ON schedules(player2_id);

-- Verify
SELECT 
    COUNT(*) as total_schedules,
    COUNT(player1_id) as player1_with_id,
    COUNT(player2_id) as player2_with_id,
    COUNT(*) - COUNT(player1_id) as player1_guests,
    COUNT(*) - COUNT(player2_id) as player2_guests
FROM schedules
WHERE deleted_at IS NULL;
