
INSERT INTO organizations (id, name, inn, ogrn, director_fio, bank_name, bik, rs, phone, email, website, telegram, whatsapp)
SELECT 
    1,
    COALESCE((SELECT value FROM organization_settings WHERE key='name'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='inn'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='ogrn'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='director_fio'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='bank_name'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='bik'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='rs'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='phone'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='email'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='website'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='telegram'), ''),
    COALESCE((SELECT value FROM organization_settings WHERE key='whatsapp'), '')
WHERE EXISTS (SELECT 1 FROM organization_settings LIMIT 1);

SELECT setval('organizations_id_seq', GREATEST((SELECT MAX(id) FROM organizations), 1));

UPDATE loans SET org_id = 1 WHERE org_id IS NULL;
UPDATE savings SET org_id = 1 WHERE org_id IS NULL;
UPDATE share_accounts SET org_id = 1 WHERE org_id IS NULL;
