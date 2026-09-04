import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("KHORA Tienda reserva y confirma pedidos con controles de concurrencia", async () => {
  const route = await read("app/api/tienda/route.ts");
  for (const fragment of [
    "withKhoraTransaction", "pg_advisory_xact_lock", "store_reservations", "store_reservation_items",
    "store_idempotency_key", "store_stock_committed_at", "priceChanged", "store_access_token",
  ]) assert.match(route, new RegExp(fragment));
  assert.match(route, /p\.active=1 AND p\.store_published=TRUE AND p\.sale_price_cents>0/);
  assert.match(route, /Solo quedan \$\{asNumber\(product\.available_stock\)\} unidades disponibles/);
});

test("el detalle público de un pedido exige un token opaco", async () => {
  const [route, sqliteMigration, postgresMigration] = await Promise.all([
    read("app/api/tienda/route.ts"),
    read("drizzle/0020_khora_store_order_access.sql"),
    read("supabase/migrations/202609030005_khora_store_order_access.sql"),
  ]);
  assert.match(route, /orderByNumber\(number: string, accessToken: string\)/);
  assert.match(route, /store_access_token=\?/);
  assert.match(route, /url\.searchParams\.get\("access"\)/);
  assert.match(sqliteMigration, /store_access_token/);
  assert.match(postgresMigration, /Token opaco de acceso/);
});

test("la tienda conserva recuperación visible para catálogo y productos inválidos", async () => {
  const page = await read("app/tienda/page.tsx");
  for (const text of [
    "No pudimos cargar la colección", "Reintentar", "Este producto ya no está disponible",
    "ProductImage", "onError={() => setFailed(true)}", "khora-store-checkout-key",
  ]) assert.ok(page.includes(text));
});

test("Administración expone el acceso a la Tienda pública sin tratarla como módulo de gestión", async () => {
  const [admin, proxy] = await Promise.all([
    read("app/page.tsx"),
    read("lib/supabase/proxy.ts"),
  ]);
  assert.match(admin, /className="navbar-store-link" href="\/tienda" target="_blank"/);
  assert.match(admin, /className="sidebar-store-link" href="\/tienda" target="_blank"/);
  assert.match(admin, /<span>Ver Tienda<\/span>/);
  assert.match(proxy, /const isStore = request\.nextUrl\.pathname === "\/tienda"/);
});
test("la tienda muestra recursos editoriales cuando un producto publicado no tiene foto", async () => {
  const page = await read("app/tienda/page.tsx");
  for (const asset of [
    "khora-product-aromatizador.png", "khora-product-difusor.png", "khora-product-combo.png",
  ]) assert.ok(page.includes(asset));
  assert.match(page, /productImage\(product\) \?\? fallbackProductImage\(product\)/);
});
