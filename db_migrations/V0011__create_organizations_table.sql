
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    short_name VARCHAR(200),
    inn VARCHAR(12),
    ogrn VARCHAR(15),
    kpp VARCHAR(9),
    director_fio VARCHAR(200),
    director_position VARCHAR(200) DEFAULT 'Директор',
    legal_address VARCHAR(500),
    actual_address VARCHAR(500),
    bank_name VARCHAR(300),
    bik VARCHAR(9),
    rs VARCHAR(20),
    ks VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(200),
    website VARCHAR(200),
    telegram VARCHAR(100),
    whatsapp VARCHAR(100),
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE loans ADD COLUMN org_id INTEGER REFERENCES organizations(id);
ALTER TABLE savings ADD COLUMN org_id INTEGER REFERENCES organizations(id);
ALTER TABLE share_accounts ADD COLUMN org_id INTEGER REFERENCES organizations(id);
