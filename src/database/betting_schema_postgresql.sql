-- Betting functionality database schema for PostgreSQL (Vercel Production)

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches table to link schedules with betting
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled')),
    betting_enabled BOOLEAN DEFAULT TRUE,
    total_pool DECIMAL(10,2) DEFAULT 0.00,
    house_edge DECIMAL(3,2) DEFAULT 0.20, -- 20%
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

-- Bets table to store individual bets
CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    match_id INTEGER NOT NULL,
    player_name VARCHAR(255) NOT NULL, -- player1_name or player2_name from schedule
    amount DECIMAL(10,2) NOT NULL,
    potential_return DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'refunded')),
    payment_id VARCHAR(255), -- Payment gateway transaction ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_matches_schedule_id ON matches(schedule_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_match_id ON bets(match_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);

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