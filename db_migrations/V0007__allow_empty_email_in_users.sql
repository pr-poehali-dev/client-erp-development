ALTER TABLE users ALTER COLUMN email SET DEFAULT '';
ALTER TABLE users DROP CONSTRAINT users_email_key;
CREATE UNIQUE INDEX users_email_unique ON users(email) WHERE email IS NOT NULL AND email != '';