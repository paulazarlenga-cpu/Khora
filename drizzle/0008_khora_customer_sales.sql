CREATE TABLE IF NOT EXISTS price_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  price_modifier REAL NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS price_lists_code_uq ON price_lists(code);
CREATE UNIQUE INDEX IF NOT EXISTS price_lists_name_uq ON price_lists(name);

INSERT OR IGNORE INTO price_lists(code,name,price_modifier,is_default)
VALUES
  ('RETAIL','Minorista',1,1),
  ('WHOLESALE','Mayorista',0.8,0),
  ('SPECIAL','Especial',0.9,0);

ALTER TABLE clients ADD COLUMN price_list_id INTEGER REFERENCES price_lists(id);

UPDATE clients
SET price_list_id=(SELECT id FROM price_lists WHERE code='RETAIL')
WHERE price_list_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_price_list_id ON clients(price_list_id);

CREATE TABLE IF NOT EXISTS price_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price_list_id INTEGER NOT NULL REFERENCES price_lists(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  price_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS price_list_items_list_product_uq
ON price_list_items(price_list_id,product_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_product_sale
ON sale_items(product_id,sale_id);

CREATE INDEX IF NOT EXISTS idx_sales_client_date
ON sales(client_id,sold_at);

PRAGMA optimize;
