-- Fase D: los lotes conservan cantidad inicial y saldo disponible.
PRAGMA foreign_keys = ON;

ALTER TABLE manufacturing_batches ADD COLUMN initial_quantity REAL;
ALTER TABLE manufacturing_batches ADD COLUMN available_quantity REAL;
ALTER TABLE combo_batches ADD COLUMN initial_quantity REAL;
ALTER TABLE combo_batches ADD COLUMN available_quantity REAL;

UPDATE manufacturing_batches SET initial_quantity=quantity WHERE initial_quantity IS NULL;
UPDATE manufacturing_batches AS mb
SET available_quantity = MAX(0, MIN(mb.quantity,
  (SELECT p.current_stock FROM products p WHERE p.id=mb.product_id) -
  COALESCE((SELECT SUM(newer.quantity) FROM manufacturing_batches newer
    WHERE newer.product_id=mb.product_id
      AND (newer.manufactured_at>mb.manufactured_at OR (newer.manufactured_at=mb.manufactured_at AND newer.id>mb.id))),0)
))
WHERE available_quantity IS NULL;

UPDATE combo_batches SET initial_quantity=quantity WHERE initial_quantity IS NULL;
UPDATE combo_batches AS cb
SET available_quantity = MAX(0, MIN(cb.quantity,
  (SELECT p.current_stock FROM combos c JOIN products p ON p.id=c.product_id WHERE c.id=cb.combo_id) -
  COALESCE((SELECT SUM(newer.quantity) FROM combo_batches newer
    WHERE newer.combo_id=cb.combo_id
      AND (newer.assembled_at>cb.assembled_at OR (newer.assembled_at=cb.assembled_at AND newer.id>cb.id))),0)
))
WHERE available_quantity IS NULL;

CREATE INDEX IF NOT EXISTS manufacturing_batches_fifo_idx ON manufacturing_batches(product_id, manufactured_at, id);
CREATE INDEX IF NOT EXISTS combo_batches_fifo_idx ON combo_batches(combo_id, assembled_at, id);

PRAGMA optimize;
