-- Add 'nextgen' group type to ranking system
-- Migration: 007_add_nextgen_group.sql

-- Drop existing constraint and add new one with 'nextgen'
ALTER TABLE ranking_matches DROP CONSTRAINT IF EXISTS ranking_matches_group_type_check;
ALTER TABLE ranking_matches ADD CONSTRAINT ranking_matches_group_type_check 
    CHECK (group_type IN ('elite', 'challenger', 'nextgen'));
