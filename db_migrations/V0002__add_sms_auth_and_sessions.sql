
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_code VARCHAR(6) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_code_expires TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS client_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_sessions_token ON client_sessions(token);
CREATE INDEX IF NOT EXISTS idx_client_sessions_user ON client_sessions(user_id);
