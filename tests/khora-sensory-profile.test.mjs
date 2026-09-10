import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  emptySensoryProfile,
  parseSensoryProfile,
  sensoryProfileFromRows,
  sensorySelections,
} from "../app/khora-sensory.ts";

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
test("el parser distingue perfil omitido de perfil vacío y deduplica", () => {
  assert.deepEqual(parseSensoryProfile(undefined), { provided: false, profile: emptySensoryProfile() });
  const parsed = parseSensoryProfile({
    families: [2, 2, 1], notes: [], sensations: [4], intensity: 8,
    rooms: [9, 9], moment: null,
  });
  assert.equal(parsed.provided, true);
  assert.deepEqual(parsed.profile.families, [2, 1]);
  assert.deepEqual(parsed.profile.rooms, [9]);
});

test("el parser rechaza formas e IDs inválidos", () => {
  assert.throws(() => parseSensoryProfile({ families: "Dulce" }), /familias/i);
  assert.throws(() => parseSensoryProfile({ families: [-1] }), /entero positivo/i);
  assert.throws(() => parseSensoryProfile({ intensity: [1, 2] }), /intensidad/i);
});

test("las selecciones conservan tipo y orden y pueden reagruparse", () => {
  const parsed = parseSensoryProfile({
    families: [2, 1], notes: [3], sensations: [], intensity: 4,
    rooms: [5], moment: 6,
  });
  const selections = sensorySelections(parsed.profile);
  assert.deepEqual(selections.slice(0, 2), [
    { optionId: 2, kind: "FAMILY", sortOrder: 0 },
    { optionId: 1, kind: "FAMILY", sortOrder: 1 },
  ]);
  assert.deepEqual(sensoryProfileFromRows(selections.map((row) => ({
    option_id: row.optionId, kind: row.kind, sort_order: row.sortOrder,
  }))), parsed.profile);
});
test("la API administrativa expone catálogo activo y perfil agrupado", async () => {
  const route = await read("app/api/khora/route.ts");
  assert.match(route, /entity==="sensory_options"/);
  assert.match(route, /FROM sensory_options WHERE active=TRUE/);
  assert.match(route, /FROM product_sensory_options WHERE product_id=\?/);
  assert.match(route, /sensory_profile:sensoryProfileFromRows/);
  assert.match(route, /ORDER BY kind,sort_order,label,id/);
});
test("crear y editar validan y guardan el perfil en la transacción existente", async () => {
  const route = await read("app/api/khora/route.ts");
  assert.match(route, /parseSensoryProfile\(b\.sensoryProfile\)/);
  assert.match(route, /SELECT id,kind FROM sensory_options WHERE active=TRUE AND id IN/);
  assert.match(route, /La opción sensorial .* no corresponde/i);
  assert.match(route, /INSERT INTO product_sensory_options/);
  assert.match(route, /DELETE FROM product_sensory_options WHERE product_id=\?/);
  assert.match(route, /if\(parsedSensory\.provided\)/);
  assert.match(route, /withKhoraTransaction\(async\(tx\)=>/);
});

test("el flujo de combos no recibe persistencia sensorial", async () => {
  const route = await read("app/api/khora/route.ts");
  const comboBlock = route.slice(route.indexOf('if(action==="update_combo_definition")'), route.indexOf('if(action==="archive_product_definition"'));
  assert.doesNotMatch(comboBlock, /product_sensory_options|sensoryProfile/);
});
test("el editor sensorial ofrece todos los campos, preview y controles accesibles", async () => {
  const component = await read("app/khora-sensory-profile.tsx");
  for (const label of [
    "Perfil sensorial", "Familia olfativa", "Notas aromáticas", "Sensación",
    "Intensidad", "Ambiente ideal", "Momento recomendado", "Descripción pública",
    "Vista previa",
  ]) assert.match(component, new RegExp(label));
  assert.match(component, /aria-pressed/);
  assert.match(component, /role="radiogroup"/);
  assert.match(component, /aria-checked/);
  assert.match(component, /type="button"/);
  assert.match(component, /placeholder="Buscar una nota/);
  assert.match(component, /export function SensoryProfileEditor/);
  assert.doesNotMatch(component, /fetch\(/);
});