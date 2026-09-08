CREATE TABLE collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (length(trim(slug)) > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED')),
  visible_in_store INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 1 CHECK (sort_order >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX collections_name_ci_uq ON collections(lower(trim(name)));
CREATE INDEX collections_store_order_idx ON collections(sort_order,name,id);

CREATE TABLE collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(collection_id,product_id)
);
CREATE INDEX collection_items_order_idx ON collection_items(collection_id,sort_order,id);
CREATE INDEX collection_items_product_idx ON collection_items(product_id,collection_id);

INSERT OR IGNORE INTO collections(name,slug,description,status,visible_in_store,sort_order)
VALUES('Colección KHORA','coleccion-khora','Selección original de KHORA Tienda.','PUBLISHED',1,1);

INSERT OR IGNORE INTO collection_items(collection_id,product_id,sort_order)
SELECT (SELECT id FROM collections WHERE slug='coleccion-khora'),p.id,
  row_number() OVER (ORDER BY cb.name,p.id)
FROM products p
JOIN code_base cb ON cb.id=p.code_base_id
LEFT JOIN categories c ON c.id=p.category_id
WHERE p.active=1 AND p.store_published=1 AND p.sale_price_cents>0
  AND (p.category_id IS NULL OR lower(trim(c.name))='colección khora');
