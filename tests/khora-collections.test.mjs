import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("1. las colecciones tienen modelo persistente muchos-a-muchos y borrado seguro", async () => {
  const migration = await read("supabase/migrations/202609070001_khora_collections.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.collections/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.collection_items/);
  assert.match(migration, /collection_id bigint NOT NULL REFERENCES public\.collections\(id\) ON DELETE CASCADE/);
  assert.match(migration, /product_id integer NOT NULL REFERENCES public\.products\(id\) ON DELETE CASCADE/);
  assert.match(migration, /UNIQUE \(collection_id, product_id\)/);
  assert.match(migration, /status IN \('DRAFT', 'PUBLISHED'\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
});

test("2. la migración conserva la Colección KHORA visible actual", async () => {
  const migration = await read("supabase/migrations/202609070001_khora_collections.sql");
  assert.match(migration, /'Colección KHORA'/);
  assert.match(migration, /'coleccion-khora'/);
  assert.match(migration, /'PUBLISHED'/);
  assert.match(migration, /p\.active = 1/);
  assert.match(migration, /p\.store_published = true/);
  assert.match(migration, /ON CONFLICT \(collection_id, product_id\) DO NOTHING/);
});

test("3. administración incluye listado, formulario, selector, orden y confirmación", async () => {
  const [sections, manager] = await Promise.all([
    read("app/khora-sections.tsx"),
    read("app/khora-collections.tsx"),
  ]);
  assert.match(sections, /"Colecciones"/);
  assert.match(sections, /CollectionsManager/);
  for (const label of ["Nueva colección", "Nombre de la colección", "Descripción", "Borrador", "Publicada", "Mostrar en KHORA Tienda", "Agregar productos o combos", "Eliminar colección"]) {
    assert.match(manager, new RegExp(label));
  }
  assert.match(manager, /draggable/);
  assert.match(manager, /type="checkbox"/);
  assert.match(manager, /Los productos y combos no serán eliminados/);
});

test("4. la API administrativa guarda relaciones atómicamente y deja auditoría", async () => {
  const route = await read("app/api/khora/route.ts");
  assert.match(route, /entity==="collections"/);
  assert.match(route, /entity==="collection_definition"/);
  assert.match(route, /action==="save_collection"/);
  assert.match(route, /action==="delete_collection"/);
  assert.match(route, /withKhoraTransaction/);
  assert.match(route, /INSERT INTO collection_items/);
  assert.match(route, /'COLLECTION'/);
  assert.match(route, /slug=s\(before\?\.slug\)/);
});

test("5. la tienda usa únicamente colecciones publicadas y visibles", async () => {
  const [route, page] = await Promise.all([
    read("app/api/tienda/route.ts"),
    read("app/tienda/page.tsx"),
  ]);
  assert.match(route, /collection\.status='PUBLISHED' AND collection\.visible_in_store=TRUE/);
  assert.match(route, /c\.status='PUBLISHED' AND c\.visible_in_store=TRUE/);
  assert.match(route, /collection_memberships/);
  assert.match(page, /collectionMemberships/);
  assert.match(page, /collections\.map/);
  assert.match(page, />Todas<\/button>/);
  assert.doesNotMatch(route, /category:\s*asString\(row\.category\) \|\| "Colección KHORA"/);
});

test("6. el orden de colecciones y elementos se aplica en servidor y cliente", async () => {
  const [route, page] = await Promise.all([
    read("app/api/tienda/route.ts"),
    read("app/tienda/page.tsx"),
  ]);
  assert.match(route, /ORDER BY c\.sort_order,c\.name,c\.id/);
  assert.match(route, /ORDER BY collection\.sort_order,ci\.sort_order,ci\.id/);
  assert.match(page, /leftOrder-rightOrder/);
});
