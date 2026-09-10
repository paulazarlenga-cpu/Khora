import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("el perfil sensorial usa catálogo y relaciones normalizadas", async () => {
  const migration = await read("supabase/migrations/202609100002_khora_product_sensory_profile.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.sensory_options/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.product_sensory_options/);
  assert.match(migration, /UNIQUE \(kind, slug\)/);
  assert.match(migration, /FOREIGN KEY \(option_id, kind\)/);
  assert.match(migration, /WHERE kind IN \('INTENSITY', 'MOMENT'\)/);
});

test("la migración siembra el catálogo inicial completo", async () => {
  const migration = await read("supabase/migrations/202609100002_khora_product_sensory_profile.sql");
  for (const label of [
    "Dulce", "Cítrica", "Ambarada", "Vainilla", "Sándalo", "Eucalipto",
    "Relajante", "Sofisticada", "Suave", "Intensa", "Dormitorio",
    "Local comercial", "Día", "Todo el día",
  ]) assert.match(migration, new RegExp(`'${label}'`));
  assert.match(migration, /ON CONFLICT \(kind, slug\) DO UPDATE/);
});

test("el catálogo sensorial queda cerrado para roles del navegador", async () => {
  const migration = await read("supabase/migrations/202609100002_khora_product_sensory_profile.sql");
  assert.match(migration, /ALTER TABLE public\.sensory_options ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.product_sensory_options ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.sensory_options FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.product_sensory_options FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*WITH CHECK\s*\(\s*true\s*\)/i);
});

test("el esquema local refleja las tablas sensoriales", async () => {
  const schema = await read("db/schema.ts");
  assert.match(schema, /export const sensoryOptions = sqliteTable\("sensory_options"/);
  assert.match(schema, /export const productSensoryOptions = sqliteTable\("product_sensory_options"/);
  assert.match(schema, /productId:integer\("product_id"\).*references\(\(\)=>products\.id/);
});

test("el ejecutor aplica y verifica únicamente la migración sensorial", async () => {
  const runner = await read("scripts/apply-sensory-profile.mjs");
  assert.match(runner, /202609100002_khora_product_sensory_profile\.sql/);
  assert.match(runner, /DATABASE_URL/);
  assert.match(runner, /relrowsecurity/);
  assert.match(runner, /has_table_privilege/);
  assert.doesNotMatch(runner, /console\.log\([^)]*databaseUrl/);
});