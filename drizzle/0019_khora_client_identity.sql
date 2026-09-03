-- KHORA: identidad de clientes para la base local de Drizzle/SQLite.
ALTER TABLE clients ADD COLUMN phone_normalized TEXT;
ALTER TABLE clients ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE clients ADD COLUMN possible_duplicate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN duplicate_note TEXT;
ALTER TABLE clients ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE clients
SET phone_normalized = COALESCE(NULLIF(phone_normalized, ''), NULLIF(store_phone_normalized, ''), NULLIF(phone, ''))
WHERE phone_normalized IS NULL OR phone_normalized = '';

UPDATE clients SET origin = 'MANUAL' WHERE origin IS NULL OR origin = '';
CREATE INDEX IF NOT EXISTS clients_phone_normalized_idx ON clients(phone_normalized);
CREATE INDEX IF NOT EXISTS clients_email_normalized_idx ON clients(email) WHERE email IS NOT NULL;