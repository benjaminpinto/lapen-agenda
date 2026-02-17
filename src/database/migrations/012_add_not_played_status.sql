-- Add 'not_played' status to ranking_matches
ALTER TABLE ranking_matches DROP CONSTRAINT IF EXISTS ranking_matches_status_check;
ALTER TABLE ranking_matches ADD CONSTRAINT ranking_matches_status_check 
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'wo', 'not_played'));
