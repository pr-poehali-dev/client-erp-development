CREATE TABLE IF NOT EXISTS organization_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO organization_settings (key, value) VALUES
    ('name', ''),
    ('inn', ''),
    ('ogrn', ''),
    ('director_fio', ''),
    ('bank_name', ''),
    ('bik', ''),
    ('rs', '')
ON CONFLICT (key) DO NOTHING;