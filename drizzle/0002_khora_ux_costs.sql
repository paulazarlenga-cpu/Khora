PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN profit_percentage REAL NOT NULL DEFAULT 30 CHECK(profit_percentage >= 0);
ALTER TABLE products ADD COLUMN suggested_price_cents INTEGER NOT NULL DEFAULT 0 CHECK(suggested_price_cents >= 0);
ALTER TABLE products ADD COLUMN last_batch_unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(last_batch_unit_cost_cents >= 0);

ALTER TABLE raw_material_purchases ADD COLUMN invoice_number TEXT;
ALTER TABLE raw_material_purchases ADD COLUMN purchased_unit TEXT;

ALTER TABLE code_base ADD COLUMN category_id INTEGER REFERENCES categories(id);
ALTER TABLE code_base ADD COLUMN description TEXT;
ALTER TABLE code_base ADD COLUMN unit TEXT;

ALTER TABLE manufacturing_batches ADD COLUMN batch_number TEXT;
ALTER TABLE combo_batches ADD COLUMN batch_number TEXT;

ALTER TABLE stock_movements ADD COLUMN notes TEXT;
ALTER TABLE stock_movements ADD COLUMN reversed_movement_id INTEGER REFERENCES stock_movements(id);

ALTER TABLE recipes ADD COLUMN updated_at TEXT;
ALTER TABLE combos ADD COLUMN updated_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS manufacturing_batch_number_uq ON manufacturing_batches(batch_number) WHERE batch_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS combo_batch_number_uq ON combo_batches(batch_number) WHERE batch_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_client_status_date_idx ON sales(client_id,status,sold_at);
CREATE INDEX IF NOT EXISTS materials_category_active_idx ON raw_materials(category_id,active);
CREATE INDEX IF NOT EXISTS products_category_active_idx ON products(category_id,active);

UPDATE products
SET suggested_price_cents = ROUND(CASE WHEN last_batch_unit_cost_cents > 0 THEN last_batch_unit_cost_cents ELSE estimated_cost_cents END * (1 + profit_percentage / 100.0));
