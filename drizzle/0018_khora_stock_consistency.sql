-- KHORA: integridad y sincronización de stock entre Tienda, carritos y pedidos.
CREATE UNIQUE INDEX IF NOT EXISTS orders_store_reservation_uq ON orders(store_reservation_id) WHERE store_reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_product_store_idx ON order_items(product_id,order_id);
CREATE INDEX IF NOT EXISTS store_orders_commitment_idx ON orders(store_source,store_status,expected_at) WHERE store_source='STORE' AND store_stock_committed_at IS NOT NULL;