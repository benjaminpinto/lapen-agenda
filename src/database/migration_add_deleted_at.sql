-- SQLite migration to add soft delete support
ALTER TABLE schedules ADD COLUMN deleted_at DATETIME DEFAULT NULL;
CREATE INDEX idx_schedules_deleted_at ON schedules(deleted_at);
