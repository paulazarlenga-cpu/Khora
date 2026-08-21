import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const envFile = readFileSync(resolve(projectRoot, ".env.local"), "utf8");
const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
if (!match) throw new Error("DATABASE_URL no está definida en .env.local");

const databaseUrl = match[1].replace(/^['\"]|['\"]$/g, "");
const migration = readFileSync(
  resolve(projectRoot, "supabase", "migrations", "202608210003_finance_foundation.sql"),
  "utf8",
);
const sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  prepare: false,
  ssl: "require",
});

try {
  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
  });
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'financial_payment_events', 'reinvestment_plans',
        'reinvestment_movements', 'monthly_finance_closures'
      )
    order by table_name
  `;
  console.log(JSON.stringify({ applied: true, tables: tables.map((row) => row.table_name) }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
