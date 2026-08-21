import { readFileSync } from "node:fs";
import postgres from "postgres";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);

if (!match) {
  throw new Error("DATABASE_URL no está definida en .env.local");
}

const databaseUrl = match[1].replace(/^['"]|['"]$/g, "");
if (/\[YOUR-PASSWORD\]|YOUR_PASSWORD|YOUR-PASSWORD/.test(databaseUrl)) {
  throw new Error("DATABASE_URL todavía contiene el marcador de contraseña");
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  throw new Error("DATABASE_URL tiene un formato inválido; revisá espacios y caracteres especiales");
}

console.log(
  JSON.stringify({
    safeConfiguration: {
      transactionPooler:
        parsedUrl.port === "6543" && parsedUrl.hostname.endsWith(".pooler.supabase.com"),
      projectQualifiedUser: decodeURIComponent(parsedUrl.username).startsWith("postgres."),
      passwordPresent: parsedUrl.password.length > 0,
    },
  }),
);

const sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  prepare: false,
  ssl: "require",
});

try {
  const [tables] = await sql`
    select count(*)::integer as table_count
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  `;
  const [security] = await sql`
    select count(*)::integer as rls_table_count
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and rowsecurity = true
  `;
  const [core] = await sql`
    select
      to_regclass('public.products') is not null as products,
      to_regclass('public.raw_materials') is not null as raw_materials,
      to_regclass('public.sales') is not null as sales,
      to_regclass('public.orders') is not null as orders
  `;

  console.log(
    JSON.stringify({
      connected: true,
      publicTables: tables.table_count,
      rlsProtectedTables: security.rls_table_count,
      coreTables: core,
    }),
  );
} finally {
  await sql.end({ timeout: 5 });
}
