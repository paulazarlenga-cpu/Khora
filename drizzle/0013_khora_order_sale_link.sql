ALTER TABLE sales ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE sales ADD COLUMN origin TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE sale_items ADD COLUMN source_order_item_id INTEGER;

ALTER TABLE orders ADD COLUMN confirmed_at TEXT;
ALTER TABLE orders ADD COLUMN stock_consumed_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;

UPDATE sales
SET origin = 'ORDER'
WHERE id IN (SELECT sale_id FROM orders WHERE sale_id IS NOT NULL);

UPDATE sales
SET payment_status = CASE
  WHEN status = 'PAID' THEN 'PAID'
  ELSE 'PENDING'
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_main_sale_unique
ON orders(sale_id)
WHERE sale_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_items_source_order_item
ON sale_items(source_order_item_id)
WHERE source_order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment
ON orders(status, stock_consumed_at, expected_at);

CREATE INDEX IF NOT EXISTS idx_sales_origin_payment
ON sales(origin, payment_status, sold_at);
