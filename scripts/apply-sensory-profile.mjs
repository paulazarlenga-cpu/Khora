import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const envFile = readFileSync(resolve(projectRoot, ".env.local"), "utf8");
const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
if (!match) throw new Error("DATABASE_URL no está definida en .env.local");

const databaseUrl = match[1].replace(/^["']|["']$/g, "");
const migration = readFileSync(
  resolve(projectRoot, "supabase", "migrations", "202609100002_khora_product_sensory_profile.sql"),
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
  await sql.unsafe(migration);
  const counts = await sql`
    SELECT kind, COUNT(*)::integer count
    FROM public.sensory_options
    WHERE active = TRUE
    GROUP BY kind
    ORDER BY kind
  `;
  const security = await sql`
    SELECT c.relname table_name, c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT') anon_select,
      has_table_privilege('authenticated', c.oid, 'SELECT') authenticated_select
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('sensory_options', 'product_sensory_options')
    ORDER BY c.relname
  `;
  const expected = { FAMILY: 9, NOTE: 13, SENSATION: 8, INTENSITY: 3, ROOM: 8, MOMENT: 3 };
  for (const [kind, count] of Object.entries(expected)) {
    if (Number(counts.find((row) => row.kind === kind)?.count) !== count) {
      throw new Error(`Catálogo incompleto para ${kind}`);
    }
  }
  if (security.length !== 2 || security.some((row) => !row.relrowsecurity || row.anon_select || row.authenticated_select)) {
    throw new Error("La protección RLS del perfil sensorial no quedó aplicada correctamente.");
  }
  console.log(JSON.stringify({ applied: true, counts, security }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}