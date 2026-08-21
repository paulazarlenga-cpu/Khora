import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(resolve(scriptDirectory, "..", ".env.local"), "utf8");
const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
if (!match) throw new Error("DATABASE_URL no está definida en .env.local");

const databaseUrl = match[1].replace(/^['\"]|['\"]$/g, "");
const businessTables = [
  "price_lists", "clients", "suppliers", "categories", "code_base",
  "raw_materials", "raw_material_purchases", "products", "price_list_items",
  "recipes", "recipe_items", "combos", "combo_recipe_items",
  "combo_material_items", "manufacturing_batches", "manufacturing_materials",
  "combo_batches", "combo_batch_items", "combo_batch_item_lot_allocations",
  "combo_batch_materials", "sales", "sale_items", "sale_manual_items",
  "finished_stock_allocations", "expenses", "material_sale_items",
  "stock_movements", "monthly_profits", "profit_history", "orders",
  "order_items", "payments", "shipments", "delivery_notes", "sale_documents",
  "purchase_orders", "purchase_order_items", "audit_logs", "app_settings",
];

const sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  prepare: false,
  ssl: "require",
});

try {
  const existingRows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `;
  const existing = new Set(existingRows.map((row) => row.table_name));
  const counts = {};
  for (const table of businessTables.filter((name) => existing.has(name))) {
    const [result] = await sql.unsafe(`select count(*)::integer as count from public.\"${table}\"`);
    counts[table] = result.count;
  }
  const [storage] = await sql`
    select count(*)::integer as count
    from storage.objects
    where bucket_id in ('product-images', 'business-documents')
  `;
  counts.private_files = storage.count;
  const [auth] = await sql`select count(*)::integer as count from auth.users`;
  console.log(JSON.stringify({ mode: "read-only-audit", counts, authUsers: auth.count }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
