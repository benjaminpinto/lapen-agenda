-- Add short_name column to users table (PostgreSQL)
ALTER TABLE users ADD COLUMN IF NOT EXISTS short_name TEXT;

-- Populate short_name with first two names from existing users
UPDATE users 
SET short_name = CASE 
    WHEN position(' ' in substring(name from position(' ' in name) + 1)) > 0 
    THEN substring(name from 1 for position(' ' in name) + position(' ' in substring(name from position(' ' in name) + 1)))
    ELSE name
END
WHERE short_name IS NULL;
