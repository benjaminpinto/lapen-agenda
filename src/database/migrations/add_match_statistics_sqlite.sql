-- Match statistics table for SQLite
CREATE TABLE IF NOT EXISTS match_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    player1_name TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    winner_name TEXT NOT NULL,
    player1_sets INTEGER NOT NULL DEFAULT 0,
    player2_sets INTEGER NOT NULL DEFAULT 0,
    player1_games INTEGER NOT NULL DEFAULT 0,
    player2_games INTEGER NOT NULL DEFAULT 0,
    match_type TEXT NOT NULL,
    match_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

CREATE INDEX IF NOT EXISTS idx_match_statistics_player1 ON match_statistics(player1_name);
CREATE INDEX IF NOT EXISTS idx_match_statistics_player2 ON match_statistics(player2_name);
CREATE INDEX IF NOT EXISTS idx_match_statistics_match_type ON match_statistics(match_type);
CREATE INDEX IF NOT EXISTS idx_match_statistics_date ON match_statistics(match_date);
