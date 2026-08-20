-- Fase E: asignación FIFO y costo histórico por lote vendido.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS finished_stock_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
  manufacturing_batch_id INTEGER REFERENCES manufacturing_batches(id),
  combo_batch_id INTEGER REFERENCES combo_batches(id),
  quantity REAL NOT NULL CHECK(quantity>0),
  frozen_unit_cost_cents INTEGER NOT NULL CHECK(frozen_unit_cost_cents>=0),
  frozen_total_cost_cents INTEGER NOT NULL CHECK(frozen_total_cost_cents>=0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((manufacturing_batch_id IS NOT NULL) <> (combo_batch_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS finished_stock_allocations_sale_item_idx ON finished_stock_allocations(sale_item_id);
CREATE INDEX IF NOT EXISTS finished_stock_allocations_manufacturing_idx ON finished_stock_allocations(manufacturing_batch_id);
CREATE INDEX IF NOT EXISTS finished_stock_allocations_combo_idx ON finished_stock_allocations(combo_batch_id);

CREATE TABLE IF NOT EXISTS combo_batch_item_lot_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_batch_item_id INTEGER NOT NULL REFERENCES combo_batch_items(id),
  manufacturing_batch_id INTEGER REFERENCES manufacturing_batches(id),
  source_combo_batch_id INTEGER REFERENCES combo_batches(id),
  quantity REAL NOT NULL CHECK(quantity>0),
  frozen_unit_cost_cents INTEGER NOT NULL CHECK(frozen_unit_cost_cents>=0),
  frozen_total_cost_cents INTEGER NOT NULL CHECK(frozen_total_cost_cents>=0),
  CHECK((manufacturing_batch_id IS NOT NULL) <> (source_combo_batch_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS combo_batch_item_lot_allocations_item_idx ON combo_batch_item_lot_allocations(combo_batch_item_id);

PRAGMA optimize;
