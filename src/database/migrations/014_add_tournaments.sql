-- 014: Tournament module (independent of ranking_* tables)
-- Idempotent: safe to run multiple times (run_migrations.py reruns every file).
-- Keep comments free of semicolons: init_db() splits schema files on that character.

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

-- Statistics: a result now has exactly one origin (schedule, ranking match or tournament match)
ALTER TABLE match_statistics_unified
    ADD COLUMN IF NOT EXISTS tournament_match_id INTEGER REFERENCES tournament_matches(id) ON DELETE CASCADE;

-- The two legacy CHECKs are unnamed (Postgres generated their names), so find them by definition
DO $$
DECLARE
    legacy RECORD;
BEGIN
    FOR legacy IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'match_statistics_unified'::regclass
          AND contype = 'c'
          AND conname <> 'chk_match_stats_single_source'
          AND pg_get_constraintdef(oid) LIKE '%schedule_id%'
          AND pg_get_constraintdef(oid) LIKE '%ranking_match_id%'
    LOOP
        EXECUTE format('ALTER TABLE match_statistics_unified DROP CONSTRAINT %I', legacy.conname);
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'match_statistics_unified'::regclass
          AND conname = 'chk_match_stats_single_source'
    ) THEN
        ALTER TABLE match_statistics_unified
            ADD CONSTRAINT chk_match_stats_single_source
            CHECK (num_nonnulls(schedule_id, ranking_match_id, tournament_match_id) = 1);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_stats_unified_tournament_unique
    ON match_statistics_unified(tournament_match_id)
    WHERE tournament_match_id IS NOT NULL;
