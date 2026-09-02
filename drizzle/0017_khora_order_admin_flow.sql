-- KHORA Administración: ciclo operativo y auditoría de pedidos de Tienda.
ALTER TABLE orders ADD COLUMN store_status TEXT;
ALTER TABLE orders ADD COLUMN store_paid_at TEXT;
ALTER TABLE orders ADD COLUMN store_paid_by TEXT;
ALTER TABLE orders ADD COLUMN store_delivered_at TEXT;
ALTER TABLE orders ADD COLUMN store_delivered_by TEXT;
ALTER TABLE orders ADD COLUMN store_expired_at TEXT;
ALTER TABLE orders ADD COLUMN store_cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN store_customer_snapshot TEXT;
ALTER TABLE payments ADD COLUMN store_payment_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS payments_store_payment_key_uq ON payments(store_payment_key) WHERE store_payment_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_store_status_idx ON orders(store_source, store_status, created_at DESC);
UPDATE orders SET store_status = CASE WHEN status = 'DELIVERED' THEN 'DELIVERED' WHEN status = 'CANCELLED' THEN 'CANCELLED' WHEN payment_status = 'PAID' THEN 'PENDING_DELIVERY' ELSE 'PENDING_PAYMENT' END WHERE store_source = 'STORE' AND store_status IS NULL;