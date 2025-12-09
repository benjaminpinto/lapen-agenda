-- Add description column to ranking_rounds table
ALTER TABLE ranking_rounds ADD COLUMN IF NOT EXISTS description TEXT;
