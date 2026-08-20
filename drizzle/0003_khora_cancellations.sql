PRAGMA foreign_keys = ON;
ALTER TABLE raw_material_purchases ADD COLUMN status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','CANCELLED'));
ALTER TABLE raw_material_purchases ADD COLUMN cancelled_at TEXT;
CREATE INDEX IF NOT EXISTS purchases_status_idx ON raw_material_purchases(status,purchased_at);
