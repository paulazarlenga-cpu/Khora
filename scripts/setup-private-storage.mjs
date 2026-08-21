import { readFileSync } from "node:fs";
import postgres from "postgres";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);

if (!match) throw new Error("DATABASE_URL no está definida en .env.local");

const databaseUrl = match[1].replace(/^['"]|['"]$/g, "");
const migration = readFileSync(
  new URL("../supabase/migrations/202608210002_khora_private_storage.sql", import.meta.url),
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
  const buckets = await sql`
    select id, public, file_size_limit
    from storage.buckets
    where id in ('product-images', 'business-documents')
    order by id
  `;
  const [policies] = await sql`
    select count(*)::integer as policy_count
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'KHORA admin%private files'
  `;

  console.log(
    JSON.stringify({
      configured: buckets.length === 2 && policies.policy_count === 4,
      buckets,
      policies: policies.policy_count,
    }),
  );
} finally {
  await sql.end({ timeout: 5 });
}
