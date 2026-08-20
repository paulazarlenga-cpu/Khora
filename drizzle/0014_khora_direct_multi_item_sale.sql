CREATE TABLE IF NOT EXISTS sale_manual_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  frozen_unit_price_cents INTEGER NOT NULL CHECK(frozen_unit_price_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK(line_total_cents >= 0),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sale_manual_items_sale
ON sale_manual_items(sale_id);
