
CREATE TABLE push_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO push_settings (key, value) VALUES
    ('enabled', 'true'),
    ('reminder_days', '3,1,0'),
    ('overdue_notify', 'true'),
    ('remind_time', '09:00');
