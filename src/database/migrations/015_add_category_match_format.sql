-- 015: Match format per category. NULL means the category follows the tournament's own setting.
-- Each of the three fields falls back on its own, so a category can override only the format.
-- Idempotent: safe to run multiple times (run_migrations.py reruns every file).

ALTER TABLE tournament_categories
    ADD COLUMN IF NOT EXISTS match_format VARCHAR(30),
    ADD COLUMN IF NOT EXISTS no_ad BOOLEAN,
    ADD COLUMN IF NOT EXISTS match_tiebreak_points INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'tournament_categories'::regclass AND conname = 'tournament_categories_match_format_valid'
    ) THEN
        ALTER TABLE tournament_categories
            ADD CONSTRAINT tournament_categories_match_format_valid
            CHECK (match_format IS NULL OR match_format IN ('best_of_3_super_tb', 'pro_set_8', 'single_set_6'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'tournament_categories'::regclass AND conname = 'tournament_categories_match_tiebreak_points_valid'
    ) THEN
        ALTER TABLE tournament_categories
            ADD CONSTRAINT tournament_categories_match_tiebreak_points_valid
            CHECK (match_tiebreak_points IS NULL OR match_tiebreak_points > 0);
    END IF;
END $$;
