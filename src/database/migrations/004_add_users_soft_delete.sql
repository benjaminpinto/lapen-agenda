-- Add soft delete support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
