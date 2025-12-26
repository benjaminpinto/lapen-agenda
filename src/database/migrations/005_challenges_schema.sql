-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    challenger_id INTEGER NOT NULL REFERENCES users(id),
    challenged_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) CHECK (status IN ('pending', 'active', 'rejected', 'completed', 'cancelled')) DEFAULT 'pending',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    target_type VARCHAR(20) CHECK (target_type IN ('victories', 'balance', 'sets')) NOT NULL,
    target_amount INTEGER, -- Optional: Can be used as a goal or just for UI scaling
    prize_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_challenges_players ON challenges(challenger_id, challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_dates ON challenges(start_date, end_date);
