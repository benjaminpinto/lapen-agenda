-- Add short_name column to users table
ALTER TABLE users ADD COLUMN short_name TEXT;

-- Populate short_name with first two names from existing users
UPDATE users 
SET short_name = CASE 
    WHEN instr(substr(name, instr(name, ' ') + 1), ' ') > 0 
    THEN substr(name, 1, instr(name, ' ') + instr(substr(name, instr(name, ' ') + 1), ' '))
    ELSE name
END;
