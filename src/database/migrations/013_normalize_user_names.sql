-- 013_normalize_user_names.sql
-- Strip leading/trailing whitespace from existing user names and enforce trimmed
-- values going forward. Idempotent.
--
-- NOT included (manual decision needed): unique index on LOWER(short_name).
-- Two active users currently share short_name "Amanda" (ids 43, 45). Resolve
-- by renaming one before adding the unique constraint.

UPDATE users
SET name = TRIM(name)
WHERE name <> TRIM(name);

UPDATE users
SET short_name = TRIM(short_name)
WHERE short_name IS NOT NULL AND short_name <> TRIM(short_name);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_trimmed;
ALTER TABLE users ADD CONSTRAINT users_name_trimmed
    CHECK (name = TRIM(name));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_short_name_trimmed;
ALTER TABLE users ADD CONSTRAINT users_short_name_trimmed
    CHECK (short_name IS NULL OR short_name = TRIM(short_name));
