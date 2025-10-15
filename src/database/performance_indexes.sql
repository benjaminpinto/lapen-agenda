-- Performance Indexes for LAPEN Agenda
-- These indexes dramatically improve query performance for critical operations
-- Compatible with both SQLite (local) and PostgreSQL (Vercel)

-- ============================================
-- SCHEDULES TABLE INDEXES
-- ============================================
-- Used for: Booking schedules, checking availability, viewing calendar
CREATE INDEX IF NOT EXISTS idx_schedules_court_date ON schedules(court_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_date_time ON schedules(date, start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

-- ============================================
-- MATCHES TABLE INDEXES
-- ============================================
-- Used for: Betting dashboard, match management, finishing matches
CREATE INDEX IF NOT EXISTS idx_matches_schedule ON matches(schedule_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_status_schedule ON matches(status, schedule_id);

-- ============================================
-- BETS TABLE INDEXES
-- ============================================
-- Used for: Placing bets, calculating odds, user bet history
CREATE INDEX IF NOT EXISTS idx_bets_match_user ON bets(match_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_bets_match_status ON bets(match_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_user_status ON bets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_player ON bets(player_name);

-- ============================================
-- RECURRING SCHEDULES INDEXES
-- ============================================
-- Used for: Checking blocked times, recurring schedule management
CREATE INDEX IF NOT EXISTS idx_recurring_day_dates ON recurring_schedules(day_of_week, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_recurring_court ON recurring_schedules(court_id);

-- ============================================
-- HOLIDAYS/BLOCKS INDEXES
-- ============================================
-- Used for: Checking blocked dates, holiday management
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays_blocks(date);

-- ============================================
-- USERS TABLE INDEXES
-- ============================================
-- Used for: Authentication, user lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- COURTS TABLE INDEXES
-- ============================================
-- Used for: Active court lookups
CREATE INDEX IF NOT EXISTS idx_courts_active ON courts(active);
