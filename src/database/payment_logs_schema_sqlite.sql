-- Payment logs table for tracking payment events
CREATE TABLE IF NOT EXISTS payment_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- payment_success, payment_failed, refund_created, etc.
    status TEXT NOT NULL, -- succeeded, failed, pending, etc.
    amount DECIMAL(10,2),
    error_message TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_event_type ON payment_logs(event_type);