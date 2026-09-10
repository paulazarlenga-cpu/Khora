-- Las reservas de KHORA Tienda se gestionan exclusivamente desde las rutas
-- privadas /api/tienda y /api/khora mediante DATABASE_URL. El navegador no
-- necesita acceso directo a estas tablas ni a sus secuencias.
BEGIN;

ALTER TABLE public.store_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_reservation_items ENABLE ROW LEVEL SECURITY;

-- Defensa en profundidad: aunque RLS queda en modo default-deny (sin políticas
-- para visitantes), también retiramos los privilegios concedidos por los
-- defaults del esquema public.
REVOKE ALL PRIVILEGES ON TABLE public.store_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.store_reservation_items FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.store_reservations_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.store_reservation_items_id_seq FROM PUBLIC, anon, authenticated;

-- El rol de servidor de Supabase conserva acceso para tareas administrativas.
-- La aplicación actual usa la conexión PostgreSQL privada (rol BYPASSRLS).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_reservations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_reservation_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.store_reservations_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.store_reservation_items_id_seq TO service_role;

-- Esta función calcula disponibilidad usando reservas, por lo que tampoco debe
-- convertirse en un canal público alternativo para consultar esos datos.
REVOKE ALL PRIVILEGES ON FUNCTION public.khora_available_product_stock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khora_available_product_stock(text) TO service_role;

COMMENT ON TABLE public.store_reservations IS
  'Reservas temporales de carrito. RLS default-deny; acceso exclusivo desde el servidor de KHORA.';
COMMENT ON TABLE public.store_reservation_items IS
  'Ítems de reservas temporales. RLS default-deny; sin acceso directo de visitantes.';

COMMIT;