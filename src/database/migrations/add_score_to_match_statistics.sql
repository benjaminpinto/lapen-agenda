-- Add score column to match_statistics table
ALTER TABLE match_statistics ADD COLUMN IF NOT EXISTS score TEXT;
