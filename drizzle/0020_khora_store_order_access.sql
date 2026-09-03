-- KHORA Tienda: acceso privado de confirmación para pedidos públicos.
ALTER TABLE orders ADD COLUMN store_access_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_store_access_token_uq
ON orders(store_access_token)
WHERE store_access_token IS NOT NULL;
