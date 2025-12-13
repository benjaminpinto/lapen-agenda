-- Migration: Backfill missing player IDs in match_statistics_unified
-- Match player names to user IDs using unaccent for accent-insensitive matching

UPDATE match_statistics_unified m
SET player1_id = u.id
FROM users u
WHERE m.player1_id IS NULL
  AND unaccent(LOWER(TRIM(u.short_name))) = unaccent(LOWER(TRIM(m.player1_name)));

UPDATE match_statistics_unified m
SET player2_id = u.id
FROM users u
WHERE m.player2_id IS NULL
  AND unaccent(LOWER(TRIM(u.short_name))) = unaccent(LOWER(TRIM(m.player2_name)));

UPDATE match_statistics_unified m
SET winner_id = u.id
FROM users u
WHERE m.winner_id IS NULL
  AND unaccent(LOWER(TRIM(u.short_name))) = unaccent(LOWER(TRIM(m.winner_name)));
