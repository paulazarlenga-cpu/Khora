-- KHORA Tienda: publicación, reservas temporales y pedidos públicos.
ALTER TABLE products ADD COLUMN store_published INTEGER NOT NULL DEFAULT 1 CHECK(store_published IN (0,1));
ALTER TABLE clients ADD COLUMN store_phone_normalized TEXT;
ALTER TABLE orders ADD COLUMN store_source TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE orders ADD COLUMN store_idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN store_reservation_id INTEGER;
ALTER TABLE orders ADD COLUMN store_stock_committed_at TEXT;
UPDATE products SET store_published = 1 WHERE store_published IS NULL;
CREATE TABLE IF NOT EXISTS store_reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMMITTED','EXPIRED','RELEASED')), expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS store_reservation_items (id INTEGER PRIMARY KEY AUTOINCREMENT, reservation_id INTEGER NOT NULL REFERENCES store_reservations(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), quantity REAL NOT NULL CHECK(quantity>0), unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0), UNIQUE(reservation_id,product_id));
CREATE UNIQUE INDEX IF NOT EXISTS orders_store_idempotency_uq ON orders(store_idempotency_key) WHERE store_idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS store_reservations_active_idx ON store_reservations(status,expires_at);
CREATE INDEX IF NOT EXISTS store_reservation_items_product_idx ON store_reservation_items(product_id);
CREATE INDEX IF NOT EXISTS clients_store_phone_idx ON clients(store_phone_normalized);

