PRAGMA foreign_keys = ON;

ALTER TABLE code_base ADD COLUMN manual_category TEXT;
ALTER TABLE code_base ADD COLUMN manual_type TEXT;

ALTER TABLE expenses ADD COLUMN code_base_id INTEGER REFERENCES code_base(id);
ALTER TABLE expenses ADD COLUMN quantity REAL;
ALTER TABLE expenses ADD COLUMN unit_cost_cents INTEGER;
ALTER TABLE expenses ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK(payment_status IN ('PAID','UNPAID'));
ALTER TABLE expenses ADD COLUMN record_status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(record_status IN ('CONFIRMED','CANCELLED'));
ALTER TABLE expenses ADD COLUMN invoice_number TEXT;
ALTER TABLE expenses ADD COLUMN raw_material_purchase_id INTEGER REFERENCES raw_material_purchases(id);

CREATE TABLE IF NOT EXISTS material_sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES raw_materials(id),
  quantity REAL NOT NULL CHECK(quantity > 0),
  frozen_unit_price_cents INTEGER NOT NULL CHECK(frozen_unit_price_cents >= 0),
  frozen_unit_cost_cents INTEGER NOT NULL CHECK(frozen_unit_cost_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK(line_total_cents >= 0),
  line_cost_cents INTEGER NOT NULL CHECK(line_cost_cents >= 0)
);

UPDATE code_base
SET manual_category = COALESCE((SELECT name FROM categories WHERE categories.id=code_base.category_id),'Sin categoría'),
    manual_type = COALESCE(description,name)
WHERE manual_category IS NULL;

CREATE INDEX IF NOT EXISTS code_base_manual_category_idx ON code_base(manual_category,active);
CREATE INDEX IF NOT EXISTS expenses_code_base_idx ON expenses(code_base_id,incurred_at);
CREATE INDEX IF NOT EXISTS material_sale_items_sale_idx ON material_sale_items(sale_id);

CREATE TRIGGER IF NOT EXISTS manufacturing_profit_after_insert
AFTER INSERT ON manufacturing_batches
BEGIN
  UPDATE products
  SET profit_percentage = CASE WHEN NEW.unit_cost_cents > 0 THEN ((sale_price_cents - NEW.unit_cost_cents) * 100.0 / NEW.unit_cost_cents) ELSE 0 END
  WHERE id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS combo_profit_after_insert
AFTER INSERT ON combo_batches
BEGIN
  UPDATE products
  SET profit_percentage = CASE WHEN NEW.unit_cost_cents > 0 THEN ((sale_price_cents - NEW.unit_cost_cents) * 100.0 / NEW.unit_cost_cents) ELSE 0 END
  WHERE id = (SELECT product_id FROM combos WHERE id = NEW.combo_id);
END;
