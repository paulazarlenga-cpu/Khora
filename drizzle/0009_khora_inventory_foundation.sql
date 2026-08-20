-- Fase A: amplía los maestros existentes sin crear un inventario paralelo.
PRAGMA foreign_keys = ON;

ALTER TABLE categories ADD COLUMN prefix TEXT;
ALTER TABLE raw_materials ADD COLUMN preferred_supplier_id INTEGER REFERENCES suppliers(id);
ALTER TABLE raw_materials ADD COLUMN notes TEXT;

UPDATE categories SET prefix = CASE
  WHEN lower(name) LIKE '%envase%' THEN 'ENV'
  WHEN lower(name) LIKE '%esencia%' THEN 'ESE'
  WHEN lower(name) LIKE '%alcohol%' OR lower(name) LIKE '%líquido%' THEN 'ALC'
  WHEN lower(name) LIKE '%varilla%' THEN 'VAR'
  WHEN lower(name) LIKE '%tapa%' THEN 'TAP'
  WHEN lower(name) LIKE '%etiqueta%' THEN 'ETI'
  WHEN lower(name) LIKE '%caja%' THEN 'CAJ'
  WHEN lower(name) LIKE '%packaging%' THEN 'PAC'
  WHEN lower(name) LIKE '%accesorio%' THEN 'ACC'
  ELSE NULL
END
WHERE kind = 'MATERIAL' AND prefix IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_prefix_uq
ON categories(prefix)
WHERE prefix IS NOT NULL;

CREATE INDEX IF NOT EXISTS raw_materials_preferred_supplier_idx
ON raw_materials(preferred_supplier_id, active);

PRAGMA optimize;
