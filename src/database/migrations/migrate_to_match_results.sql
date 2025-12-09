-- Migrate existing data from match_statistics and ranking_matches to match_statistics_unified
-- Run this AFTER creating match_statistics_unified table

-- Step 1: Migrate from match_statistics (scheduled matches)
INSERT INTO match_statistics_unified (
    schedule_id,
    ranking_match_id,
    player1_id,
    player2_id,
    player1_name,
    player2_name,
    winner_id,
    winner_name,
    score,
    match_type,
    match_date,
    season_id,
    added_by,
    created_at
)
SELECT 
    ms.schedule_id,
    NULL as ranking_match_id,
    u1.id as player1_id,
    u2.id as player2_id,
    ms.player1_name,
    ms.player2_name,
    uw.id as winner_id,
    ms.winner_name,
    COALESCE(ms.score, ms.player1_sets || '-' || ms.player2_sets) as score,
    ms.match_type,
    ms.match_date,
    NULL as season_id,
    ms.added_by,
    ms.created_at
FROM match_statistics ms
LEFT JOIN users u1 ON LOWER(u1.short_name) = LOWER(ms.player1_name) OR LOWER(u1.name) = LOWER(ms.player1_name)
LEFT JOIN users u2 ON LOWER(u2.short_name) = LOWER(ms.player2_name) OR LOWER(u2.name) = LOWER(ms.player2_name)
LEFT JOIN users uw ON LOWER(uw.short_name) = LOWER(ms.winner_name) OR LOWER(uw.name) = LOWER(ms.winner_name);

-- Step 2: Migrate from ranking_matches (completed only)
INSERT INTO match_statistics_unified (
    schedule_id,
    ranking_match_id,
    player1_id,
    player2_id,
    player1_name,
    player2_name,
    winner_id,
    winner_name,
    score,
    match_type,
    match_date,
    season_id,
    added_by,
    created_at
)
SELECT 
    rm.schedule_id,
    rm.id as ranking_match_id,
    rm.player1_id,
    rm.player2_id,
    u1.short_name as player1_name,
    u2.short_name as player2_name,
    rm.winner_id,
    uw.short_name as winner_name,
    rm.score,
    'Ranking' as match_type,
    COALESCE(rm.played_at::date, s.date) as match_date,
    rr.season_id,
    rm.added_by,
    COALESCE(rm.played_at, rm.created_at) as created_at
FROM ranking_matches rm
JOIN users u1 ON rm.player1_id = u1.id
JOIN users u2 ON rm.player2_id = u2.id
JOIN users uw ON rm.winner_id = uw.id
JOIN ranking_rounds rr ON rm.round_id = rr.id
LEFT JOIN schedules s ON rm.schedule_id = s.id
WHERE rm.status = 'completed';

-- Step 3: Verify migration counts
SELECT 
    'match_statistics' as source,
    COUNT(*) as count
FROM match_statistics
UNION ALL
SELECT 
    'ranking_matches (completed)' as source,
    COUNT(*) as count
FROM ranking_matches WHERE status = 'completed'
UNION ALL
SELECT 
    'match_statistics_unified (total)' as source,
    COUNT(*) as count
FROM match_statistics_unified
UNION ALL
SELECT 
    'match_statistics_unified (scheduled)' as source,
    COUNT(*) as count
FROM match_statistics_unified WHERE schedule_id IS NOT NULL
UNION ALL
SELECT 
    'match_statistics_unified (ranking)' as source,
    COUNT(*) as count
FROM match_statistics_unified WHERE ranking_match_id IS NOT NULL;

-- Step 4: Sample verification - check a few records
SELECT 
    'Sample match_statistics_unified' as info,
    player1_name,
    player2_name,
    winner_name,
    score,
    match_type,
    match_date
FROM match_statistics_unified
ORDER BY created_at DESC
LIMIT 5;
