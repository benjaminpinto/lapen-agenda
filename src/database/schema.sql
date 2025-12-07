-- LAPEN Agenda - Complete SQLite Database Schema

-- Courts table
CREATE TABLE courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    image_url TEXT
);

-- Players table
CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

-- Holidays and blocks table
CREATE TABLE holidays_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, -- YYYY-MM-DD
    start_time TEXT, -- HH:MM (optional, for partial day blocks)
    end_time TEXT,   -- HH:MM (optional, for partial day blocks)
    description TEXT
);

-- Schedules table
CREATE TABLE schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    court_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    start_time TEXT NOT NULL, -- HH:MM
    player1_name TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    match_type TEXT NOT NULL, -- ENUM: 'Amistoso', 'Liga'
    deleted_at DATETIME DEFAULT NULL,
    FOREIGN KEY (court_id) REFERENCES courts(id)
);

CREATE INDEX idx_schedules_deleted_at ON schedules(deleted_at);

-- Recurring schedules table
CREATE TABLE recurring_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    court_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Monday, 6=Sunday
    start_time TEXT NOT NULL, -- HH:MM
    end_time TEXT NOT NULL, -- HH:MM
    description TEXT,
    start_date TEXT NOT NULL, -- YYYY-MM-DD
    end_date TEXT NOT NULL, -- YYYY-MM-DD
    FOREIGN KEY (court_id) REFERENCES courts(id)
);

-- Users table for authentication
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    pix_key TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    reset_token TEXT,
    reset_token_expires DATETIME,
    is_lapen_member BOOLEAN DEFAULT FALSE,
    lapen_approved BOOLEAN DEFAULT FALSE,
    lapen_requested_at DATETIME,
    lapen_approved_at DATETIME,
    lapen_approved_by INTEGER REFERENCES users(id),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Matches table to link schedules with betting
CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled')),
    betting_enabled BOOLEAN DEFAULT TRUE,
    total_pool DECIMAL(10,2) DEFAULT 0.00,
    house_edge DECIMAL(3,2) DEFAULT 0.20, -- 20%
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

CREATE INDEX idx_matches_schedule_id ON matches(schedule_id);
CREATE INDEX idx_matches_status ON matches(status);

-- Bets table to store individual bets
CREATE TABLE bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    match_id INTEGER NOT NULL,
    player_name TEXT NOT NULL, -- player1_name or player2_name from schedule
    amount DECIMAL(10,2) NOT NULL,
    potential_return DECIMAL(10,2),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'refunded')),
    payment_id TEXT, -- Payment gateway transaction ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_match_id ON bets(match_id);
CREATE INDEX idx_bets_status ON bets(status);

-- Match results table to store outcomes
CREATE TABLE match_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    winner_name TEXT NOT NULL,
    score TEXT,
    finished_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    settled BOOLEAN DEFAULT FALSE,
    total_winnings DECIMAL(10,2),
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

CREATE INDEX idx_match_results_match_id ON match_results(match_id);

-- Payment logs table for tracking payment events
CREATE TABLE payment_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- payment_success, payment_failed, refund_created, etc.
    status TEXT NOT NULL, -- succeeded, failed, pending, etc.
    amount DECIMAL(10,2),
    error_message TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_logs_payment_id ON payment_logs(payment_id);
CREATE INDEX idx_payment_logs_event_type ON payment_logs(event_type);