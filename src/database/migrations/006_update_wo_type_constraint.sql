-- Migration: Update wo_type constraint to include 'user' value
-- Date: 2026-01-16

ALTER TABLE ranking_matches DROP CONSTRAINT IF EXISTS ranking_matches_wo_type_check;
ALTER TABLE ranking_matches ADD CONSTRAINT ranking_matches_wo_type_check 
    CHECK (wo_type IN ('none', 'admin', 'forfeit', 'user'));