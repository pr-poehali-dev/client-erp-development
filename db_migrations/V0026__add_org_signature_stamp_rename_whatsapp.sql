ALTER TABLE organizations RENAME COLUMN whatsapp TO max_messenger;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS signature_url TEXT DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stamp_url TEXT DEFAULT '';