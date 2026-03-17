
CREATE TABLE IF NOT EXISTS notification_channels (
    id SERIAL PRIMARY KEY,
    channel TEXT NOT NULL CHECK (channel IN ('push','telegram','email')),
    enabled BOOLEAN NOT NULL DEFAULT false,
    settings JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO notification_channels (channel, enabled, settings) VALUES
('push', true, '{}'),
('telegram', false, '{"bot_token":"","welcome_message":"Вы подписались на уведомления"}'),
('email', false, '{"from_name":"","from_email":"","smtp_host":"","smtp_port":587,"smtp_user":"","smtp_pass":""}')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS telegram_subscribers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    chat_id BIGINT NOT NULL,
    username TEXT,
    first_name TEXT,
    subscribed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(user_id, chat_id)
);

CREATE TABLE IF NOT EXISTS notification_history (
    id SERIAL PRIMARY KEY,
    channel TEXT NOT NULL CHECK (channel IN ('push','telegram','email')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT,
    target TEXT NOT NULL DEFAULT 'all',
    target_user_ids INTEGER[],
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('draft','sending','sent','error')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP,
    error_text TEXT
);

CREATE TABLE IF NOT EXISTS notification_history_log (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL REFERENCES notification_history(id),
    user_id INTEGER REFERENCES users(id),
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','pending')),
    error_text TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON notification_history(channel);
CREATE INDEX IF NOT EXISTS idx_notification_history_created ON notification_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_log_nid ON notification_history_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_user ON telegram_subscribers(user_id);
