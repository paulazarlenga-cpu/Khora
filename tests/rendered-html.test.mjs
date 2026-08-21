import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("la aplicación Next publica identidad y acceso de KHORA", async () => {
  const [layout, login, loginActions, page] = await Promise.all([
    read("app/layout.tsx"),
    read("app/login/page.tsx"),
    read("app/login/actions.ts"),
    read("app/page.tsx"),
  ]);

  assert.match(layout, /KHORA \| Gestión del emprendimiento/);
  assert.match(layout, /lang="es"/);
  assert.match(loginActions, /createClient/);
  assert.match(login, /type="email"/);
  assert.match(login, /type="password"/);
  assert.match(page, /createSupabaseClient/);
  assert.match(page, /signOut/);
});

test("el build de producción y la protección de sesión están presentes", async () => {
  const [proxy, sessionProxy, packageJson, buildId] = await Promise.all([
    read("proxy.ts"),
    read("lib/supabase/proxy.ts"),
    read("package.json"),
    read(".next/BUILD_ID"),
  ]);

  assert.match(proxy, /updateSession/);
  assert.match(sessionProxy, /\/login/);
  assert.match(packageJson, /"build": "next build"/);
  assert.match(packageJson, /@supabase\/ssr/);
  assert.ok(buildId.trim().length > 8);
  await access(new URL(".next/server", root));
});
