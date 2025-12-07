-- LAPEN Ranking System 2026 - PostgreSQL Schema

-- Ranking seasons table
CREATE TABLE ranking_seasons (
    id SERIAL PRIMARY KEY,
    year INTEGER UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('draft', 'active', 'finished')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Year-specific configuration
CREATE TABLE ranking_season_config (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    data_type VARCHAR(20) CHECK (data_type IN ('int', 'float', 'string', 'boolean')) DEFAULT 'int',
    UNIQUE(season_id, key)
);

-- Temporary points rules for season start
CREATE TABLE ranking_temp_points_rules (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    position_min INTEGER NOT NULL,
    position_max INTEGER NOT NULL,
    points INTEGER NOT NULL,
    label VARCHAR(100)
);

-- Monthly rounds
CREATE TABLE ranking_rounds (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    round_number INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    draw_date TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('pending', 'drawn', 'in_progress', 'completed')) DEFAULT 'pending',
    is_finals BOOLEAN DEFAULT FALSE,
    UNIQUE(season_id, round_number)
);

-- Season participants
CREATE TABLE ranking_participants (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    temp_points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    sets_won INTEGER DEFAULT 0,
    sets_lost INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    wo_wins INTEGER DEFAULT 0,
    wo_losses INTEGER DEFAULT 0,
    position INTEGER,
    UNIQUE(season_id, user_id)
);

-- Ranking matches
CREATE TABLE ranking_matches (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES ranking_rounds(id),
    schedule_id INTEGER REFERENCES schedules(id),
    player1_id INTEGER NOT NULL REFERENCES users(id),
    player2_id INTEGER NOT NULL REFERENCES users(id),
    group_type VARCHAR(20) CHECK (group_type IN ('elite', 'challenger')) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('scheduled', 'completed', 'cancelled', 'wo')) DEFAULT 'scheduled',
    winner_id INTEGER REFERENCES users(id),
    score TEXT,
    sets_p1 INTEGER DEFAULT 0,
    sets_p2 INTEGER DEFAULT 0,
    games_p1 INTEGER DEFAULT 0,
    games_p2 INTEGER DEFAULT 0,
    wo_type VARCHAR(20) CHECK (wo_type IN ('none', 'admin', 'forfeit')) DEFAULT 'none',
    points_p1 INTEGER DEFAULT 0,
    points_p2 INTEGER DEFAULT 0,
    played_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Draw history for transparency
CREATE TABLE ranking_draws (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES ranking_rounds(id),
    player1_id INTEGER NOT NULL REFERENCES users(id),
    player2_id INTEGER NOT NULL REFERENCES users(id),
    group_type VARCHAR(20) NOT NULL,
    drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evidence for W.O. administrative decisions
CREATE TABLE match_scheduling_logs (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES ranking_matches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    proposed_slots TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_ranking_participants_season_user ON ranking_participants(season_id, user_id);
CREATE INDEX idx_ranking_matches_round ON ranking_matches(round_id);
CREATE INDEX idx_ranking_matches_players ON ranking_matches(player1_id, player2_id);
CREATE INDEX idx_ranking_draws_round ON ranking_draws(round_id);
CREATE INDEX idx_match_scheduling_logs_match ON match_scheduling_logs(match_id);