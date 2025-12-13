-- Migration: Add unaccent extension for accent-insensitive text comparisons
-- This allows queries to match "Rômulo", "romulo", "rómulo" as equal

CREATE EXTENSION IF NOT EXISTS unaccent;
