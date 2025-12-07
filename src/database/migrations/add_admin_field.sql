-- Add admin field to users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
