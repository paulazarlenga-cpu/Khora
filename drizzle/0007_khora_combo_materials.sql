-- Fase 2: los combos pueden consumir packaging o materias primas directamente.
-- La migración es aditiva y conserva las composiciones y lotes existentes.

CREATE TABLE IF NOT EXISTS combo_material_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES raw_materials(id),
  quantity REAL NOT NULL CHECK(quantity > 0),
  UNIQUE(combo_id, material_id)
);

CREATE TABLE IF NOT EXISTS combo_batch_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES combo_batches(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES raw_materials(id),
  quantity_used REAL NOT NULL CHECK(quantity_used > 0),
  frozen_unit_cost_cents INTEGER NOT NULL CHECK(frozen_unit_cost_cents >= 0),
  frozen_total_cost_cents INTEGER NOT NULL CHECK(frozen_total_cost_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_combo_material_items_combo
ON combo_material_items(combo_id);

CREATE INDEX IF NOT EXISTS idx_combo_batch_materials_batch
ON combo_batch_materials(batch_id);

PRAGMA optimize;
