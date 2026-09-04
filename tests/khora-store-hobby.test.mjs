import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("1. la disponibilidad vive en una función SQL central", async () => {
  const migration = await read("supabase/migrations/202609030006_khora_store_hobby_availability.sql");
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.khora_available_product_stock/);
});

test("2. una reserva vencida no descuenta disponibilidad", async () => {
  const migration = await read("supabase/migrations/202609030006_khora_store_hobby_availability.sql");
  assert.match(migration, /sr\.expires_at > CURRENT_TIMESTAMP/);
});

test("3. un pedido pendiente vencido no conserva stock comprometido", async () => {
  const migration = await read("supabase/migrations/202609030006_khora_store_hobby_availability.sql");
  assert.match(migration, /CAST\(o\.expected_at AS timestamptz\) > CURRENT_TIMESTAMP/);
});

test("4. reservas activas sí descuentan disponibilidad", async () => {
  const migration = await read("supabase/migrations/202609030006_khora_store_hobby_availability.sql");
  assert.match(migration, /sr\.status = 'ACTIVE'/);
});

test("5. pedidos pagados o pendientes de entrega siguen comprometidos", async () => {
  const migration = await read("supabase/migrations/202609030006_khora_store_hobby_availability.sql");
  assert.match(migration, /IN \('PAID', 'PENDING_DELIVERY'\)/);
});

test("6. una reserva propia no se cuenta dos veces", async () => {
  const migration = await read("supabase/migrations/202609030006_khora_store_hobby_availability.sql");
  assert.match(migration, /excluded_reservation_token IS NULL/);
  assert.match(migration, /sr\.token <> excluded_reservation_token/);
});

test("7. carrito y checkout consultan la misma disponibilidad", async () => {
  const route = await read("app/api/tienda/route.ts");
  assert.ok((route.match(/khora_available_product_stock\(\?\)/g) ?? []).length >= 3);
});

test("8. checkout mantiene el cierre transaccional y el lock por producto", async () => {
  const route = await read("app/api/tienda/route.ts");
  assert.match(route, /withKhoraTransaction/);
  assert.match(route, /pg_advisory_xact_lock/);
});

test("9. checkout valida el vencimiento con la hora de la base", async () => {
  const route = await read("app/api/tienda/route.ts");
  assert.match(route, /\(status='ACTIVE' AND expires_at>CURRENT_TIMESTAMP\) is_active/);
  assert.doesNotMatch(route, /reservation\.expires_at\)\)\.getTime\(\) <= Date\.now\(\)/);
});

test("10. pago administrativo vuelve a comprobar las 24 horas en la actualización atómica", async () => {
  const route = await read("app/api/khora/route.ts");
  assert.match(route, /CAST\(expected_at AS TIMESTAMPTZ\)>CURRENT_TIMESTAMP RETURNING id/);
});

test("11. Vercel no programa vencimientos horarios", async () => {
  const vercel = await read("vercel.json");
  assert.doesNotMatch(vercel, /orders_auto_expire/);
  assert.doesNotMatch(vercel, /0 \* \* \* \*/);
});
