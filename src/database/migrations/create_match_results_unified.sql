-- Unified match statistics table
-- Replaces dual storage in match_statistics + ranking_matches

CREATE TABLE IF NOT EXISTS match_statistics_unified (
    id SERIAL PRIMARY KEY,
    
    -- Source reference (one will be NULL)
    schedule_id INTEGER REFERENCES schedules(id),
    ranking_match_id INTEGER REFERENCES ranking_matches(id),
    
    -- Players (denormalized for fast queries)
    player1_id INTEGER REFERENCES users(id),
    player2_id INTEGER REFERENCES users(id),
    player1_name VARCHAR(255) NOT NULL,
    player2_name VARCHAR(255) NOT NULL,
    
    -- Result
    winner_id INTEGER REFERENCES users(id),
    winner_name VARCHAR(255) NOT NULL,
    score TEXT NOT NULL,  -- "6-4, 3-6, 10-8"
    
    -- Metadata
    match_type VARCHAR(50) NOT NULL,  -- 'Ranking', 'Amistoso', 'Liga'
    match_date DATE NOT NULL,
    season_id INTEGER REFERENCES ranking_seasons(id),  -- NULL for non-ranking
    
    -- Audit
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints: must have either schedule_id OR ranking_match_id, not both
    CHECK (schedule_id IS NOT NULL OR ranking_match_id IS NOT NULL),
    CHECK (schedule_id IS NULL OR ranking_match_id IS NULL)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_players ON match_statistics_unified(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_names ON match_statistics_unified(player1_name, player2_name);
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_date ON match_statistics_unified(match_date);
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_type ON match_statistics_unified(match_type);
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_season ON match_statistics_unified(season_id) WHERE season_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_schedule ON match_statistics_unified(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_ranking ON match_statistics_unified(ranking_match_id) WHERE ranking_match_id IS NOT NULL;

-- Verify table created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'match_statistics_unified') as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'match_statistics_unified';
