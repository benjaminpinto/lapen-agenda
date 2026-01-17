-- LAPEN Agenda - Complete PostgreSQL Database Schema
-- Includes all migrations: ranking system, match statistics, admin fields, short names

-- Enable unaccent extension for accent-insensitive comparisons
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Courts table
CREATE TABLE IF NOT EXISTS courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    image_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_courts_active ON courts(active);

-- Holidays and blocks table
CREATE TABLE IF NOT EXISTS holidays_blocks (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays_blocks(date);

-- Users table for authentication (must be before schedules due to foreign keys)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(255),
    phone VARCHAR(20),
    pix_key VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    is_lapen_member BOOLEAN DEFAULT FALSE,
    lapen_approved BOOLEAN DEFAULT FALSE,
    lapen_requested_at TIMESTAMP,
    lapen_approved_at TIMESTAMP,
    lapen_approved_by INTEGER REFERENCES users(id),
    is_admin BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Refresh tokens table for HTTP-only cookie authentication
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    device_info TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Schedules table (after users table)
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    player1_name VARCHAR(255) NOT NULL,
    player2_name VARCHAR(255) NOT NULL,
    player1_id INTEGER REFERENCES users(id),
    player2_id INTEGER REFERENCES users(id),
    match_type VARCHAR(50) NOT NULL,
    deleted_at TIMESTAMP DEFAULT NULL,
    FOREIGN KEY (court_id) REFERENCES courts(id)
);

CREATE INDEX IF NOT EXISTS idx_schedules_deleted_at ON schedules(deleted_at);
CREATE INDEX IF NOT EXISTS idx_schedules_player1_id ON schedules(player1_id);
CREATE INDEX IF NOT EXISTS idx_schedules_player2_id ON schedules(player2_id);
CREATE INDEX IF NOT EXISTS idx_schedules_court_date ON schedules(court_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_date_time ON schedules(date, start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

-- Recurring schedules table
CREATE TABLE IF NOT EXISTS recurring_schedules (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    FOREIGN KEY (court_id) REFERENCES courts(id)
);

CREATE INDEX IF NOT EXISTS idx_recurring_day_dates ON recurring_schedules(day_of_week, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_recurring_court ON recurring_schedules(court_id);

-- Matches table to link schedules with betting
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled')),
    betting_enabled BOOLEAN DEFAULT TRUE,
    total_pool DECIMAL(10,2) DEFAULT 0.00,
    house_edge DECIMAL(3,2) DEFAULT 0.20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

CREATE INDEX IF NOT EXISTS idx_matches_schedule_id ON matches(schedule_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_status_schedule ON matches(status, schedule_id);

-- Bets table to store individual bets
CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    match_id INTEGER NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    potential_return DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'refunded')),
    payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_match_id ON bets(match_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_bets_match_user ON bets(match_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bets_match_status ON bets(match_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_user_status ON bets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_player ON bets(player_name);

-- Match results table to store outcomes
CREATE TABLE IF NOT EXISTS match_results (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL,
    winner_name VARCHAR(255) NOT NULL,
    score VARCHAR(100),
    finished_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled BOOLEAN DEFAULT FALSE,
    total_winnings DECIMAL(10,2),
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);

-- Payment logs table for tracking payment events
CREATE TABLE IF NOT EXISTS payment_logs (
    id SERIAL PRIMARY KEY,
    payment_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    amount DECIMAL(10,2),
    error_message TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_event_type ON payment_logs(event_type);

-- Ranking seasons table
CREATE TABLE IF NOT EXISTS ranking_seasons (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) CHECK (status IN ('draft', 'active', 'finished')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Year-specific configuration
CREATE TABLE IF NOT EXISTS ranking_season_config (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    data_type VARCHAR(20) CHECK (data_type IN ('int', 'float', 'string', 'boolean')) DEFAULT 'int',
    UNIQUE(season_id, key)
);

-- Temporary points rules for season start
CREATE TABLE IF NOT EXISTS ranking_temp_points_rules (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    position_min INTEGER NOT NULL,
    position_max INTEGER NOT NULL,
    points INTEGER NOT NULL,
    label VARCHAR(100)
);

-- Monthly rounds
CREATE TABLE IF NOT EXISTS ranking_rounds (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES ranking_seasons(id),
    round_number INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    draw_date TIMESTAMP,
    description TEXT,
    status VARCHAR(20) CHECK (status IN ('pending', 'drawn', 'open', 'closed')) DEFAULT 'pending',
    is_finals BOOLEAN DEFAULT FALSE,
    UNIQUE(season_id, round_number)
);

-- Season participants
CREATE TABLE IF NOT EXISTS ranking_participants (
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
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(season_id, user_id)
);

-- Ranking matches
CREATE TABLE IF NOT EXISTS ranking_matches (
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
    wo_type VARCHAR(20) CHECK (wo_type IN ('none', 'admin', 'forfeit', 'user')) DEFAULT 'none',
    points_p1 INTEGER DEFAULT 0,
    points_p2 INTEGER DEFAULT 0,
    played_at TIMESTAMP,
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Draw history for transparency
CREATE TABLE IF NOT EXISTS ranking_draws (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES ranking_rounds(id),
    player1_id INTEGER NOT NULL REFERENCES users(id),
    player2_id INTEGER NOT NULL REFERENCES users(id),
    group_type VARCHAR(20) NOT NULL,
    drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evidence for W.O. administrative decisions
CREATE TABLE IF NOT EXISTS match_scheduling_logs (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES ranking_matches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    proposed_slots TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ranking_participants_season_user ON ranking_participants(season_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ranking_matches_round ON ranking_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_ranking_matches_players ON ranking_matches(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_ranking_draws_round ON ranking_draws(round_id);
CREATE INDEX IF NOT EXISTS idx_match_scheduling_logs_match ON match_scheduling_logs(match_id);

-- Unified match statistics table
CREATE TABLE IF NOT EXISTS match_statistics_unified (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id),
    ranking_match_id INTEGER REFERENCES ranking_matches(id),
    player1_id INTEGER REFERENCES users(id),
    player2_id INTEGER REFERENCES users(id),
    player1_name VARCHAR(255) NOT NULL,
    player2_name VARCHAR(255) NOT NULL,
    winner_id INTEGER REFERENCES users(id),
    winner_name VARCHAR(255) NOT NULL,
    score TEXT NOT NULL,
    match_type VARCHAR(50) NOT NULL,
    match_date DATE NOT NULL,
    season_id INTEGER REFERENCES ranking_seasons(id),
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (schedule_id IS NOT NULL OR ranking_match_id IS NOT NULL),
    CHECK (schedule_id IS NULL OR ranking_match_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_match_stats_unified_players ON match_statistics_unified(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_names ON match_statistics_unified(player1_name, player2_name);
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_date ON match_statistics_unified(match_date);
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_type ON match_statistics_unified(match_type);
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_season ON match_statistics_unified(season_id) WHERE season_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_schedule ON match_statistics_unified(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_stats_unified_ranking ON match_statistics_unified(ranking_match_id) WHERE ranking_match_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_stats_unified_schedule_unique ON match_statistics_unified(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_stats_unified_ranking_unique ON match_statistics_unified(ranking_match_id) WHERE ranking_match_id IS NOT NULL;

-- Update trigger for users table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    challenger_id INTEGER NOT NULL REFERENCES users(id),
    challenged_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) CHECK (status IN ('pending', 'active', 'rejected', 'completed', 'cancelled')) DEFAULT 'pending',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    target_type VARCHAR(20) CHECK (target_type IN ('victories', 'balance', 'sets')) NOT NULL,
    target_amount INTEGER,
    prize_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_challenges_players ON challenges(challenger_id, challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_dates ON challenges(start_date, end_date);
