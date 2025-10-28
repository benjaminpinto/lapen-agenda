-- PostgreSQL migration to add soft delete support
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_deleted_at ON schedules(deleted_at);
