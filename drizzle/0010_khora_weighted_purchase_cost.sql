-- Fase B: conserva la cantidad ingresada y su conversión sin duplicar compras.
PRAGMA foreign_keys = ON;

ALTER TABLE raw_material_purchases ADD COLUMN input_quantity REAL;
ALTER TABLE raw_material_purchases ADD COLUMN input_unit TEXT;
ALTER TABLE raw_material_purchases ADD COLUMN base_quantity REAL;
ALTER TABLE raw_material_purchases ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PAID';

UPDATE raw_material_purchases
SET input_quantity = quantity,
    input_unit = COALESCE(purchased_unit, (SELECT unit FROM raw_materials WHERE id=material_id)),
    base_quantity = quantity
WHERE input_quantity IS NULL OR base_quantity IS NULL;

CREATE INDEX IF NOT EXISTS raw_material_purchases_material_date_idx
ON raw_material_purchases(material_id, purchased_at DESC, id DESC);

PRAGMA optimize;
