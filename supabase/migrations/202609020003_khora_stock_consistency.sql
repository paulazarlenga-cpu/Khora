-- KHORA: integridad y sincronización de stock entre Tienda, carritos y pedidos.
-- El stock físico continúa viviendo en products.current_stock. Las siguientes
-- estructuras solo protegen la relación auditable con reservas y pedidos.
CREATE UNIQUE INDEX IF NOT EXISTS orders_store_reservation_uq
  ON public.orders(store_reservation_id)
  WHERE store_reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_product_store_idx
  ON public.order_items(product_id, order_id);
CREATE INDEX IF NOT EXISTS store_orders_commitment_idx
  ON public.orders(store_source, store_status, expected_at)
  WHERE store_source = 'STORE' AND store_stock_committed_at IS NOT NULL;
COMMENT ON TABLE public.store_reservations IS 'Reservas temporales de carrito; no modifican stock físico.';
COMMENT ON COLUMN public.orders.store_stock_committed_at IS 'Marca de compromiso comercial; el consumo físico ocurre una sola vez al entregar.';