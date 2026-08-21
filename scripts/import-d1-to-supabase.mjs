import { readFileSync } from "node:fs";
import postgres from "postgres";

const IMPORT_ORDER = [
  "categories",
  "code_base",
  "suppliers",
  "clients",
  "raw_materials",
  "products",
  "raw_material_purchases",
  "recipes",
  "recipe_items",
  "combos",
  "combo_recipe_items",
  "manufacturing_batches",
  "manufacturing_materials",
  "combo_batches",
  "combo_batch_items",
  "sales",
  "sale_items",
  "material_sale_items",
  "expenses",
  "stock_movements",
  "monthly_profits",
  "profit_history",
];

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
if (!match) throw new Error("DATABASE_URL no está definida en .env.local");

const databaseUrl = match[1].replace(/^['"]|['"]$/g, "");
const exported = JSON.parse(
  readFileSync(
    new URL("../.tmp-phase-a-d1/khora-production-export.json", import.meta.url),
    "utf8",
  ),
);
if (exported.version !== 1) throw new Error("La exportación local no es compatible");

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
const sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  prepare: false,
  ssl: "require",
});

try {
  const existing = {};
  for (const table of IMPORT_ORDER) {
    const [row] = await sql.unsafe(
      `select count(*)::integer as count from public.${quoteIdentifier(table)}`,
    );
    existing[table] = row.count;
  }
  const occupied = Object.entries(existing).filter(([, count]) => count > 0);
  if (occupied.length) {
    throw new Error(
      `Importación cancelada: Supabase ya contiene datos en ${occupied
        .map(([table, count]) => `${table} (${count})`)
        .join(", ")}`,
    );
  }

  await sql.begin(async (transaction) => {
    for (const table of IMPORT_ORDER) {
      const rows = exported.tables[table] ?? [];
      if (!rows.length) continue;

      const columnsResult = await transaction`
        select column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = ${table}
      `;
      const targetColumns = new Set(columnsResult.map((row) => row.column_name));

      for (const sourceRow of rows) {
        const columns = Object.keys(sourceRow).filter((column) => targetColumns.has(column));
        const values = columns.map((column) => sourceRow[column]);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        await transaction.unsafe(
          `insert into public.${quoteIdentifier(table)} (${columns
            .map(quoteIdentifier)
            .join(", ")}) values (${placeholders})`,
          values,
        );
      }

      await transaction.unsafe(`
        select setval(
          pg_get_serial_sequence('public.${table}', 'id'),
          greatest(coalesce((select max(id) from public.${quoteIdentifier(table)}), 1), 1),
          (select count(*) > 0 from public.${quoteIdentifier(table)})
        )
      `);
    }

    await transaction.unsafe(`
      update public.sales
      set payment_status = case
        when status = 'PAID' then 'PAID'
        when status = 'CANCELLED' then 'CANCELLED'
        else 'PENDING'
      end
    `);
    await transaction.unsafe(`
      update public.manufacturing_batches
      set initial_quantity = quantity, available_quantity = 0
    `);
    await transaction.unsafe(`
      with allocation as (
        select mb.id,
          greatest(0, least(
            mb.quantity,
            p.current_stock - coalesce(sum(mb.quantity) over (
              partition by mb.product_id
              order by mb.manufactured_at desc, mb.id desc
              rows between unbounded preceding and 1 preceding
            ), 0)
          )) as available
        from public.manufacturing_batches mb
        join public.products p on p.id = mb.product_id
      )
      update public.manufacturing_batches mb
      set available_quantity = allocation.available
      from allocation
      where allocation.id = mb.id
    `);
    await transaction.unsafe(`
      update public.combo_batches
      set initial_quantity = quantity, available_quantity = 0
    `);
    await transaction.unsafe(`
      with allocation as (
        select cb.id,
          greatest(0, least(
            cb.quantity,
            p.current_stock - coalesce(sum(cb.quantity) over (
              partition by c.product_id
              order by cb.assembled_at desc, cb.id desc
              rows between unbounded preceding and 1 preceding
            ), 0)
          )) as available
        from public.combo_batches cb
        join public.combos c on c.id = cb.combo_id
        join public.products p on p.id = c.product_id
      )
      update public.combo_batches cb
      set available_quantity = allocation.available
      from allocation
      where allocation.id = cb.id
    `);
  });

  const imported = {};
  for (const table of IMPORT_ORDER) {
    const [row] = await sql.unsafe(
      `select count(*)::integer as count from public.${quoteIdentifier(table)}`,
    );
    imported[table] = row.count;
  }
  const mismatches = IMPORT_ORDER.filter(
    (table) => imported[table] !== (exported.tables[table] ?? []).length,
  );
  if (mismatches.length) {
    throw new Error(`Conteos inconsistentes después de importar: ${mismatches.join(", ")}`);
  }

  console.log(JSON.stringify({ imported: true, counts: imported }));
} finally {
  await sql.end({ timeout: 5 });
}
