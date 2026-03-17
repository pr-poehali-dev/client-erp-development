
CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE push_messages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    url VARCHAR(500),
    target VARCHAR(50) DEFAULT 'all',
    target_user_ids INTEGER[],
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP
);

CREATE TABLE push_message_log (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES push_messages(id),
    subscription_id INTEGER REFERENCES push_subscriptions(id),
    user_id INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    error_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_push_message_log_message ON push_message_log(message_id);
