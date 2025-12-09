-- LAPEN Ranking System 2026 - SQLite Schema

-- Ranking seasons table
CREATE TABLE ranking_seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT CHECK (status IN ('draft', 'active', 'finished')) DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Year-specific configuration
CREATE TABLE ranking_season_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    data_type TEXT CHECK (data_type IN ('int', 'float', 'string', 'boolean')) DEFAULT 'int',
    UNIQUE(season_id, key)
);

-- Temporary points rules for season start
CREATE TABLE ranking_temp_points_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    position_min INTEGER NOT NULL,
    position_max INTEGER NOT NULL,
    points INTEGER NOT NULL,
    label TEXT
);

-- Monthly rounds
CREATE TABLE ranking_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    round_number INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    draw_date DATETIME,
    status TEXT CHECK (status IN ('pending', 'drawn', 'open', 'closed')) DEFAULT 'pending',
    is_finals BOOLEAN DEFAULT FALSE,
    UNIQUE(season_id, round_number)
);

-- Season participants
CREATE TABLE ranking_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(season_id, user_id)
);

-- Ranking matches
CREATE TABLE ranking_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL REFERENCES ranking_rounds(id),
    schedule_id INTEGER REFERENCES schedules(id),
    player1_id INTEGER NOT NULL REFERENCES users(id),
    player2_id INTEGER NOT NULL REFERENCES users(id),
    group_type TEXT CHECK (group_type IN ('elite', 'challenger')) NOT NULL,
    status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled', 'wo')) DEFAULT 'scheduled',
    winner_id INTEGER REFERENCES users(id),
    score TEXT,
    sets_p1 INTEGER DEFAULT 0,
    sets_p2 INTEGER DEFAULT 0,
    games_p1 INTEGER DEFAULT 0,
    games_p2 INTEGER DEFAULT 0,
    wo_type TEXT CHECK (wo_type IN ('none', 'admin', 'forfeit')) DEFAULT 'none',
    points_p1 INTEGER DEFAULT 0,
    points_p2 INTEGER DEFAULT 0,
    played_at DATETIME,
    added_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Draw history for transparency
CREATE TABLE ranking_draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL REFERENCES ranking_rounds(id),
    player1_id INTEGER NOT NULL REFERENCES users(id),
    player2_id INTEGER NOT NULL REFERENCES users(id),
    group_type TEXT NOT NULL,
    drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Evidence for W.O. administrative decisions
CREATE TABLE match_scheduling_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES ranking_matches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    proposed_slots TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_ranking_participants_season_user ON ranking_participants(season_id, user_id);
CREATE INDEX idx_ranking_matches_round ON ranking_matches(round_id);
CREATE INDEX idx_ranking_matches_players ON ranking_matches(player1_id, player2_id);
CREATE INDEX idx_ranking_draws_round ON ranking_draws(round_id);
CREATE INDEX idx_match_scheduling_logs_match ON match_scheduling_logs(match_id);