CREATE TABLE IF NOT EXISTS telegram_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO telegram_settings (key, value) VALUES
    ('enabled', 'false'),
    ('reminder_days', '3,1,0'),
    ('overdue_notify', 'true'),
    ('savings_enabled', 'false'),
    ('savings_reminder_days', '30,15,7')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS telegram_auto_log (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL,
    schedule_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reminder_type VARCHAR(30) NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(loan_id, schedule_id, user_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_telegram_auto_log_schedule ON telegram_auto_log(schedule_id, reminder_type);