import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("las reservas y sus items habilitan RLS", async () => {
  const migration = await read("supabase/migrations/202609100001_khora_store_reservations_rls.sql");
  assert.match(migration, /ALTER TABLE public\.store_reservations ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.store_reservation_items ENABLE ROW LEVEL SECURITY/);
});

test("los roles del navegador no tienen acceso directo", async () => {
  const migration = await read("supabase/migrations/202609100001_khora_store_reservations_rls.sql");
  for (const table of ["store_reservations", "store_reservation_items"]) {
    assert.match(migration, new RegExp(`REVOKE ALL PRIVILEGES ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`));
  }
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*WITH CHECK\s*\(\s*true\s*\)/i);
});

test("las secuencias y la función de disponibilidad tampoco quedan públicas", async () => {
  const migration = await read("supabase/migrations/202609100001_khora_store_reservations_rls.sql");
  assert.match(migration, /REVOKE ALL PRIVILEGES ON SEQUENCE public\.store_reservations_id_seq FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON SEQUENCE public\.store_reservation_items_id_seq FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON FUNCTION public\.khora_available_product_stock\(text\) FROM PUBLIC, anon, authenticated/);
});

test("el navegador usa la API y la conexión privada queda en código servidor", async () => {
  const [page, storeRoute, database] = await Promise.all([
    read("app/tienda/page.tsx"),
    read("app/api/tienda/route.ts"),
    read("db/postgres.ts"),
  ]);
  assert.match(page, /fetch\("\/api\/tienda"/);
  assert.doesNotMatch(page, /\.from\(["']store_reservations["']\)/);
  assert.doesNotMatch(page, /\.from\(["']store_reservation_items["']\)/);
  assert.match(storeRoute, /store_reservations/);
  assert.match(storeRoute, /store_reservation_items/);
  assert.match(database, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(database, /NEXT_PUBLIC_/);
});