import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const envFile = readFileSync(resolve(projectDirectory, ".env.local"), "utf8");
const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);

if (!match) throw new Error("DATABASE_URL no está definida en .env.local");
const databaseUrl = match[1].replace(/^['\"]|['\"]$/g, "");
if (/\[YOUR-PASSWORD\]|YOUR_PASSWORD|YOUR-PASSWORD/.test(databaseUrl)) {
  throw new Error("DATABASE_URL todavía contiene el marcador de contraseña");
}

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

const tableReference = (table) => `public.\"${table}\"`;
const counts = {};

try {
  const existingRows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  `;
  const existing = new Set(existingRows.map((row) => row.table_name));
  const tables = businessTables.filter((table) => existing.has(table));

  for (const table of tables) {
    const [result] = await sql.unsafe(`select count(*)::integer as count from ${tableReference(table)}`);
    counts[table] = result.count;
  }

  const [storageResult] = await sql`
    select count(*)::integer as count
    from storage.objects
    where bucket_id in ('product-images', 'business-documents')
  `;
  counts.private_files = storageResult.count;

  if (!process.argv.includes("--confirm-empty-khora")) {
    console.log(JSON.stringify({ mode: "audit", counts }, null, 2));
    process.exitCode = 0;
  } else {
    const backup = { createdAt: new Date().toISOString(), tables: {}, storageObjectMetadata: [] };
    for (const table of tables) {
      backup.tables[table] = await sql.unsafe(`select * from ${tableReference(table)} order by 1`);
    }
    backup.storageObjectMetadata = await sql`
      select id, bucket_id, name, created_at, updated_at, metadata
      from storage.objects
      where bucket_id in ('product-images', 'business-documents')
      order by bucket_id, name
    `;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDirectory = resolve(projectDirectory, "backups");
    const backupPath = resolve(backupDirectory, `khora-before-empty-${stamp}.json`);
    mkdirSync(backupDirectory, { recursive: true });
    writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");

    await sql.begin(async (transaction) => {
      await transaction.unsafe(
        `truncate table ${tables.map(tableReference).join(", ")} restart identity cascade`,
      );
      await transaction`
        insert into public.price_lists(code, name, price_modifier, is_default)
        values ('STD', 'Precio estándar', 1, 1)
      `;
      await transaction`
        insert into public.app_settings(key, value_json)
        values
          ('document_remito_prefix', '"sales-documents/remitos"'),
          ('document_receipt_prefix', '"sales-documents/comprobantes"'),
          ('document_remito_include_prices', 'false')
      `;
    });

    const finalCounts = {};
    for (const table of tables) {
      const [result] = await sql.unsafe(`select count(*)::integer as count from ${tableReference(table)}`);
      finalCounts[table] = result.count;
    }
    const [finalStorage] = await sql`
      select count(*)::integer as count
      from storage.objects
      where bucket_id in ('product-images', 'business-documents')
    `;
    finalCounts.private_files = finalStorage.count;

    console.log(JSON.stringify({ mode: "reset", before: counts, after: finalCounts, backupPath }, null, 2));
  }
} finally {
  await sql.end({ timeout: 5 });
}
