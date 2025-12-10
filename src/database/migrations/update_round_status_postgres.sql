-- Update ranking_rounds status constraint for PostgreSQL
-- Run this on production database

-- Drop the old constraint
ALTER TABLE ranking_rounds DROP CONSTRAINT IF EXISTS ranking_rounds_status_check;

-- Add the new constraint
ALTER TABLE ranking_rounds ADD CONSTRAINT ranking_rounds_status_check 
CHECK (status IN ('pending', 'drawn', 'open', 'closed'));
