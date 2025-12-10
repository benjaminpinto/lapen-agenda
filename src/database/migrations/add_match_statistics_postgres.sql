-- Match statistics table for PostgreSQL
CREATE TABLE IF NOT EXISTS match_statistics (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL,
    player1_name VARCHAR(255) NOT NULL,
    player2_name VARCHAR(255) NOT NULL,
    winner_name VARCHAR(255) NOT NULL,
    player1_sets INTEGER NOT NULL DEFAULT 0,
    player2_sets INTEGER NOT NULL DEFAULT 0,
    player1_games INTEGER NOT NULL DEFAULT 0,
    player2_games INTEGER NOT NULL DEFAULT 0,
    match_type VARCHAR(50) NOT NULL,
    match_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

CREATE INDEX IF NOT EXISTS idx_match_statistics_player1 ON match_statistics(player1_name);
CREATE INDEX IF NOT EXISTS idx_match_statistics_player2 ON match_statistics(player2_name);
CREATE INDEX IF NOT EXISTS idx_match_statistics_match_type ON match_statistics(match_type);
CREATE INDEX IF NOT EXISTS idx_match_statistics_date ON match_statistics(match_date);
