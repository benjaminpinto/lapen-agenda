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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_name_trimmed CHECK (name = TRIM(name)),
    CONSTRAINT users_short_name_trimmed CHECK (short_name IS NULL OR short_name = TRIM(short_name))
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
    group_type VARCHAR(20) CHECK (group_type IN ('elite', 'challenger', 'nextgen')) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('scheduled', 'completed', 'cancelled', 'wo', 'not_played')) DEFAULT 'scheduled',
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

-- Tournament module (independent of ranking tables). Must come before match_statistics_unified, which references it.
-- Tournaments. At most one tournament may be "active" at a time (see unique index below).
CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    location VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    registration_opens_at TIMESTAMP,
    registration_closes_at TIMESTAMP,
    rules_text TEXT,
    contact_info TEXT,
    match_format VARCHAR(30) NOT NULL DEFAULT 'best_of_3_super_tb',
    no_ad BOOLEAN NOT NULL DEFAULT TRUE,
    match_tiebreak_points INTEGER NOT NULL DEFAULT 10,
    schedule_published_at TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournaments_match_format_valid CHECK (match_format IN ('best_of_3_super_tb', 'pro_set_8', 'single_set_6')),
    CONSTRAINT tournaments_match_tiebreak_points_valid CHECK (match_tiebreak_points > 0),
    CONSTRAINT tournaments_status_valid CHECK (status IN ('draft', 'registration_open', 'registration_closed', 'in_progress', 'finished', 'cancelled')),
    CONSTRAINT tournaments_dates_valid CHECK (end_date >= start_date),
    CONSTRAINT tournaments_registration_window_valid CHECK (registration_opens_at IS NULL OR registration_closes_at IS NULL OR registration_closes_at > registration_opens_at)
);

-- Only one active tournament at a time: every active row maps to the same index key
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_single_active
    ON tournaments ((TRUE))
    WHERE status IN ('registration_open', 'registration_closed', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

-- Categories (provas) inside a tournament. NULL max_entries means no limit.
CREATE TABLE IF NOT EXISTS tournament_categories (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    max_entries INTEGER,
    min_entries INTEGER NOT NULL DEFAULT 4,
    draw_format VARCHAR(30) NOT NULL DEFAULT 'knockout',
    group_target_size INTEGER,
    qualifiers_per_group INTEGER,
    num_seeds INTEGER NOT NULL DEFAULT 0,
    wo_tolerance_min INTEGER NOT NULL DEFAULT 15,
    min_rest_min INTEGER NOT NULL DEFAULT 60,
    status VARCHAR(30) NOT NULL DEFAULT 'awaiting_draw',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tournament_id, name),
    CONSTRAINT tournament_categories_entries_valid CHECK (min_entries >= 2 AND (max_entries IS NULL OR max_entries >= min_entries)),
    CONSTRAINT tournament_categories_draw_format_valid CHECK (draw_format IN ('knockout', 'round_robin', 'groups_knockout')),
    CONSTRAINT tournament_categories_group_size_valid CHECK (group_target_size IS NULL OR group_target_size IN (3, 4)),
    CONSTRAINT tournament_categories_qualifiers_valid CHECK (qualifiers_per_group IS NULL OR qualifiers_per_group IN (1, 2)),
    CONSTRAINT tournament_categories_groups_config CHECK (draw_format <> 'groups_knockout' OR (group_target_size IS NOT NULL AND qualifiers_per_group IS NOT NULL)),
    CONSTRAINT tournament_categories_num_seeds_valid CHECK (num_seeds >= 0),
    CONSTRAINT tournament_categories_minutes_valid CHECK (wo_tolerance_min >= 0 AND min_rest_min >= 0),
    CONSTRAINT tournament_categories_status_valid CHECK (status IN ('awaiting_draw', 'drawn', 'published', 'group_stage', 'knockout_stage', 'finished'))
);

CREATE INDEX IF NOT EXISTS idx_tournament_categories_tournament ON tournament_categories(tournament_id);

-- Registrations. user_id is set only for approved LAPEN members (logged in or linked by an admin).
-- email and phone are private: never exposed by public endpoints.
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES tournament_categories(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    seed INTEGER,
    terms_accepted_at TIMESTAMP NOT NULL,
    data_consent_at TIMESTAMP NOT NULL,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    ip_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournament_registrations_status_valid CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'waitlist', 'withdrawn')),
    CONSTRAINT tournament_registrations_seed_valid CHECK (seed IS NULL OR seed >= 1)
);

-- Same e-mail cannot hold two live registrations in a category (rejected or cancelled ones can retry)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_reg_unique_email
    ON tournament_registrations (category_id, LOWER(email))
    WHERE status NOT IN ('rejected', 'cancelled', 'withdrawn');

-- Same member cannot hold two live registrations in a category
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_reg_unique_user
    ON tournament_registrations (category_id, user_id)
    WHERE user_id IS NOT NULL AND status NOT IN ('rejected', 'cancelled', 'withdrawn');

-- A seed number is used at most once per category
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_reg_unique_seed
    ON tournament_registrations (category_id, seed)
    WHERE seed IS NOT NULL AND status NOT IN ('rejected', 'cancelled', 'withdrawn');

CREATE INDEX IF NOT EXISTS idx_tournament_reg_category_status ON tournament_registrations(category_id, status);
CREATE INDEX IF NOT EXISTS idx_tournament_reg_user ON tournament_registrations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournament_reg_ip_recent ON tournament_registrations(ip_hash, created_at) WHERE ip_hash IS NOT NULL;

-- Groups (round-robin phase)
CREATE TABLE IF NOT EXISTS tournament_groups (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES tournament_categories(id) ON DELETE CASCADE,
    name VARCHAR(10) NOT NULL,
    UNIQUE (category_id, name)
);

-- manual_rank is the admin decision for a tie that no criterion could break
CREATE TABLE IF NOT EXISTS tournament_group_entries (
    group_id INTEGER NOT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
    registration_id INTEGER NOT NULL REFERENCES tournament_registrations(id) ON DELETE CASCADE,
    final_position INTEGER,
    manual_rank INTEGER,
    PRIMARY KEY (group_id, registration_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_group_entries_registration ON tournament_group_entries(registration_id);

-- Matches of both phases. entryN_source labels an open slot, e.g. "1o Grupo A" or "Vencedor do jogo 3".
-- bracket_position is the 1-based order inside the round (inside the group for group matches).
-- A bye is a completed match with outcome 'bye' and a single entry.
CREATE TABLE IF NOT EXISTS tournament_matches (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES tournament_categories(id) ON DELETE CASCADE,
    stage VARCHAR(10) NOT NULL,
    group_id INTEGER REFERENCES tournament_groups(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    bracket_position INTEGER NOT NULL,
    entry1_id INTEGER REFERENCES tournament_registrations(id),
    entry2_id INTEGER REFERENCES tournament_registrations(id),
    entry1_source VARCHAR(100),
    entry2_source VARCHAR(100),
    winner_entry_id INTEGER REFERENCES tournament_registrations(id),
    next_match_id INTEGER REFERENCES tournament_matches(id) ON DELETE SET NULL,
    next_slot SMALLINT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    outcome VARCHAR(15),
    score VARCHAR(100),
    planned_date DATE,
    planned_time TIME,
    court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    played_at TIMESTAMP,
    result_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    result_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournament_matches_stage_valid CHECK (stage IN ('group', 'knockout')),
    CONSTRAINT tournament_matches_stage_group CHECK ((stage = 'group') = (group_id IS NOT NULL)),
    CONSTRAINT tournament_matches_position_valid CHECK (round_number >= 1 AND bracket_position >= 1),
    CONSTRAINT tournament_matches_planned_pair CHECK ((planned_date IS NULL) = (planned_time IS NULL)),
    CONSTRAINT tournament_matches_next_slot_valid CHECK (next_slot IS NULL OR next_slot IN (1, 2)),
    CONSTRAINT tournament_matches_status_valid CHECK (status IN ('pending', 'completed')),
    CONSTRAINT tournament_matches_outcome_valid CHECK (outcome IS NULL OR outcome IN ('normal', 'wo', 'double_wo', 'retired', 'bye')),
    CONSTRAINT tournament_matches_completed_has_outcome CHECK ((status = 'completed') = (outcome IS NOT NULL)),
    CONSTRAINT tournament_matches_distinct_entries CHECK (entry1_id IS NULL OR entry2_id IS NULL OR entry1_id <> entry2_id),
    CONSTRAINT tournament_matches_winner_is_entry CHECK (winner_entry_id IS NULL OR winner_entry_id = entry1_id OR winner_entry_id = entry2_id),
    CONSTRAINT tournament_matches_completed_has_winner CHECK (status <> 'completed' OR outcome = 'double_wo' OR winner_entry_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_matches_knockout_pos
    ON tournament_matches(category_id, round_number, bracket_position)
    WHERE stage = 'knockout';
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_matches_group_pos
    ON tournament_matches(group_id, round_number, bracket_position)
    WHERE stage = 'group';
-- One match per window (court, day, start time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_matches_slot
    ON tournament_matches(court_id, planned_date, planned_time)
    WHERE court_id IS NOT NULL AND planned_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournament_matches_category ON tournament_matches(category_id, stage);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_next ON tournament_matches(next_match_id) WHERE next_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournament_matches_planned ON tournament_matches(planned_date) WHERE planned_date IS NOT NULL;

-- Schedule. A session is a stretch of one day when some courts belong to the tournament, cut into 90 minute windows.
-- A window is identified by (court, day, start time) and holds at most one match (see idx_tournament_matches_slot).
CREATE TABLE IF NOT EXISTS tournament_sessions (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    play_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournament_sessions_time_valid CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_tournament_sessions_tournament ON tournament_sessions(tournament_id, play_date);

CREATE TABLE IF NOT EXISTS tournament_session_courts (
    session_id INTEGER NOT NULL REFERENCES tournament_sessions(id) ON DELETE CASCADE,
    court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, court_id)
);

-- A window nobody can use (rain, maintenance)
CREATE TABLE IF NOT EXISTS tournament_slot_blocks (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    play_date DATE NOT NULL,
    start_time TIME NOT NULL,
    UNIQUE (court_id, play_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_tournament_slot_blocks_tournament ON tournament_slot_blocks(tournament_id);

-- Times when a registered player cannot play. NULL start_time means the whole day. Private: never public.
CREATE TABLE IF NOT EXISTS tournament_unavailability (
    id SERIAL PRIMARY KEY,
    registration_id INTEGER NOT NULL REFERENCES tournament_registrations(id) ON DELETE CASCADE,
    play_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    note VARCHAR(200),
    CONSTRAINT tournament_unavailability_times_valid CHECK ((start_time IS NULL) = (end_time IS NULL) AND (start_time IS NULL OR end_time > start_time))
);

CREATE INDEX IF NOT EXISTS idx_tournament_unavailability_registration ON tournament_unavailability(registration_id);

-- Audit trail: draws, manual adjustments, registration reviews, results, tie decisions, schedule changes
CREATE TABLE IF NOT EXISTS tournament_audit_log (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES tournament_categories(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    payload JSONB,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournament_audit_tournament ON tournament_audit_log(tournament_id, created_at);

-- Unified match statistics table
CREATE TABLE IF NOT EXISTS match_statistics_unified (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id),
    ranking_match_id INTEGER REFERENCES ranking_matches(id),
    tournament_match_id INTEGER REFERENCES tournament_matches(id) ON DELETE CASCADE,
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
    CONSTRAINT chk_match_stats_single_source CHECK (num_nonnulls(schedule_id, ranking_match_id, tournament_match_id) = 1)
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_stats_unified_tournament_unique ON match_statistics_unified(tournament_match_id) WHERE tournament_match_id IS NOT NULL;

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
