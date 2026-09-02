-- KHORA Administración: ciclo operativo y auditoría de pedidos de Tienda.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_paid_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_paid_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_delivered_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_delivered_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_expired_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_cancel_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_customer_snapshot jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS store_payment_key text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_store_payment_key_uq ON public.payments(store_payment_key) WHERE store_payment_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_store_status_idx ON public.orders(store_source, store_status, created_at DESC);
UPDATE public.orders SET store_status = CASE WHEN status = 'DELIVERED' THEN 'DELIVERED' WHEN status = 'CANCELLED' THEN 'CANCELLED' WHEN payment_status = 'PAID' THEN 'PENDING_DELIVERY' ELSE 'PENDING_PAYMENT' END WHERE store_source = 'STORE' AND store_status IS NULL;