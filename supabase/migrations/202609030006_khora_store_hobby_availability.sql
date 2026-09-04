-- KHORA Tienda: disponibilidad calculada para Vercel Hobby.
-- Las filas vencidas pueden permanecer para auditoría; esta función las excluye
-- usando la hora del servidor, sin depender de un cron frecuente.
CREATE OR REPLACE FUNCTION public.khora_available_product_stock(
  excluded_reservation_token text DEFAULT NULL
)
RETURNS TABLE (
  product_id integer,
  reserved_stock numeric,
  committed_stock numeric,
  available_stock numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH reserved AS (
    SELECT sri.product_id, SUM(sri.quantity) AS quantity
    FROM public.store_reservation_items sri
    JOIN public.store_reservations sr ON sr.id = sri.reservation_id
    WHERE sr.status = 'ACTIVE'
      AND sr.expires_at > CURRENT_TIMESTAMP
      AND (
        excluded_reservation_token IS NULL
        OR sr.token <> excluded_reservation_token
      )
    GROUP BY sri.product_id
  ), committed AS (
    SELECT oi.product_id, SUM(oi.quantity) AS quantity
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id IS NOT NULL
      AND o.store_source = 'STORE'
      AND o.store_stock_committed_at IS NOT NULL
      AND (
        COALESCE(
          o.store_status,
          CASE
            WHEN o.status = 'DELIVERED' THEN 'DELIVERED'
            WHEN o.status = 'CANCELLED' THEN 'CANCELLED'
            WHEN o.payment_status = 'PAID' THEN 'PENDING_DELIVERY'
            ELSE 'PENDING_PAYMENT'
          END
        ) IN ('PAID', 'PENDING_DELIVERY')
        OR (
          COALESCE(o.store_status, 'PENDING_PAYMENT') = 'PENDING_PAYMENT'
          AND o.expected_at IS NOT NULL
          AND CAST(o.expected_at AS timestamptz) > CURRENT_TIMESTAMP
        )
      )
    GROUP BY oi.product_id
  )
  SELECT
    p.id,
    COALESCE(reserved.quantity, 0),
    COALESCE(committed.quantity, 0),
    GREATEST(
      0,
      p.current_stock - COALESCE(reserved.quantity, 0) - COALESCE(committed.quantity, 0)
    )
  FROM public.products p
  LEFT JOIN reserved ON reserved.product_id = p.id
  LEFT JOIN committed ON committed.product_id = p.id;
$$;

REVOKE ALL ON FUNCTION public.khora_available_product_stock(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.khora_available_product_stock(text) TO service_role;

COMMENT ON FUNCTION public.khora_available_product_stock(text) IS
  'Disponibilidad de KHORA Tienda: stock físico menos reservas activas y pedidos comprometidos no vencidos, según CURRENT_TIMESTAMP.';
