-- Betting functionality database schema for SQLite (Local Development)

-- Users table for authentication
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_matches_schedule_id ON matches(schedule_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_match_id ON bets(match_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_match_results_match_id ON match_results(match_id);