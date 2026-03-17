
CREATE TABLE push_auto_log (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL,
    schedule_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reminder_type VARCHAR(30) NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(loan_id, schedule_id, user_id, reminder_type)
);

CREATE INDEX idx_push_auto_log_schedule ON push_auto_log(schedule_id, reminder_type);
