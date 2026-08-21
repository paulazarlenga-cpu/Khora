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
  "financial_payment_events", "reinvestment_plans", "reinvestment_movements",
  "monthly_finance_closures",
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
  const finance = await sql`
    select
      (select coalesce(sum(total_cents), 0)::bigint from public.sales where status <> 'CANCELLED') as sales_cents,
      (select coalesce(sum(total_cost_cents), 0)::bigint from public.sales where status <> 'CANCELLED') as sold_cost_cents,
      (select coalesce(sum(total_cost_cents), 0)::bigint from public.raw_material_purchases where status = 'CONFIRMED') as purchases_cents,
      (select coalesce(sum(amount_cents), 0)::bigint from public.expenses where record_status = 'CONFIRMED' and raw_material_purchase_id is null) as general_expenses_cents,
      (select coalesce(sum(amount_cents), 0)::bigint from public.expenses where record_status = 'CONFIRMED' and raw_material_purchase_id is not null) as purchase_linked_expenses_cents
  `;
  const combos = existing.has("combos") ? await sql`
    select c.id, cb.code, cb.name, c.active, p.active as product_active
    from public.combos c
    join public.products p on p.id = c.product_id
    join public.code_base cb on cb.id = p.code_base_id
    order by c.id
  ` : [];
  const policies = await sql`
    select schemaname, tablename, policyname, roles, cmd
    from pg_catalog.pg_policies
    where schemaname in ('public', 'storage')
    order by schemaname, tablename, policyname
  `;
  console.log(JSON.stringify({
    mode: "read-only-audit",
    counts,
    authUsers: auth.count,
    finance: finance[0],
    combos,
    policies,
  }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
