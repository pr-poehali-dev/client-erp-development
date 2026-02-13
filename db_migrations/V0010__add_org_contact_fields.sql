INSERT INTO organization_settings (key, value) VALUES
    ('phone', ''),
    ('website', ''),
    ('email', ''),
    ('telegram', ''),
    ('whatsapp', '')
ON CONFLICT (key) DO NOTHING;