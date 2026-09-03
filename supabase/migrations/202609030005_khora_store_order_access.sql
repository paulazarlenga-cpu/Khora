-- KHORA Tienda: el número visible no autoriza el acceso al detalle del pedido.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_access_token text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_store_access_token_uq
ON public.orders(store_access_token)
WHERE store_access_token IS NOT NULL;

COMMENT ON COLUMN public.orders.store_access_token IS
  'Token opaco de acceso al detalle público de un pedido de KHORA Tienda.';
