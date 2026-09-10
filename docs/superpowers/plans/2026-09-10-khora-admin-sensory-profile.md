# KHORA Admin Sensory Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar un Perfil sensorial estructurado, seguro y responsive al formulario administrativo de productos sin modificar KHORA Tienda, combos, stock ni pedidos.

**Architecture:** Dos tablas normalizadas almacenan el catálogo controlado y sus relaciones con productos; `/api/khora` es el único punto de lectura y escritura y valida cada selección antes de guardarla en la transacción existente. Un módulo de dominio puro comparte tipos y normalización entre servidor y cliente, mientras un componente React enfocado renderiza el editor y la vista previa dentro de `ProductFormDialog`.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, PostgreSQL/Supabase, Drizzle SQLite schema mirror, Node.js test runner, CSS global existente.

**Spec:** `docs/superpowers/specs/2026-09-10-khora-admin-sensory-profile-design.md`

## Global Constraints

- Implementar únicamente el Perfil sensorial en KHORA Administración.
- No modificar KHORA Tienda, “Encontrá tu aroma”, guía de aromas, búsqueda, stock, reservas, pedidos, ventas, precios ni visibilidad comercial.
- No agregar Perfil sensorial al formulario de combos.
- Reutilizar `products.store_description`; no crear otra columna de descripción pública.
- Mantener las notas privadas en `code_base.description` y fuera de la vista previa sensorial.
- Los productos existentes sin perfil deben seguir cargando y guardando.
- Las nuevas tablas deben tener RLS habilitado y acceso directo denegado a `PUBLIC`, `anon` y `authenticated`.
- No crear políticas RLS con `USING (true)` ni `WITH CHECK (true)`.
- Las escrituras de producto, receta y perfil deben ser atómicas.
- No agregar dependencias nuevas.
- Mantener Node.js `>=22.13.0` y pnpm `11.19.0`.
- Preservar cambios ajenos del workspace, especialmente `.gitignore`.

---

## File Map

- `supabase/migrations/202609100002_khora_product_sensory_profile.sql`: fuente de verdad PostgreSQL para tablas, restricciones, semillas, permisos y RLS.
- `scripts/apply-sensory-profile.mjs`: ejecutor idempotente de la migración y verificación remota sin exponer credenciales.
- `db/schema.ts`: espejo Drizzle/SQLite de las dos entidades nuevas.
- `app/khora-sensory.ts`: tipos y funciones puras de parseo, deduplicación, agrupación y serialización.
- `app/api/khora/route.ts`: catálogo, carga de perfil, validación contra DB y persistencia transaccional.
- `app/khora-sensory-profile.tsx`: controles sensoriales y vista previa, sin lógica de red.
- `app/khora-sections.tsx`: carga y submit del perfil dentro de `ProductFormDialog`.
- `app/globals.css`: presentación del editor, chips, selector, vista previa y responsive.
- `tests/khora-sensory-profile.test.mjs`: contrato ejecutable de migración, dominio, API, integración y estilos.
- `package.json`: inclusión explícita del nuevo test en la suite.

---

### Task 1: Persistencia segura y catálogo inicial

**Files:**
- Create: `supabase/migrations/202609100002_khora_product_sensory_profile.sql`
- Create: `scripts/apply-sensory-profile.mjs`
- Modify: `db/schema.ts:14-18`
- Create: `tests/khora-sensory-profile.test.mjs`
- Modify: `package.json:13`

**Interfaces:**
- Consumes: `public.products(id integer)` y el patrón RLS de `supabase/migrations/202609100001_khora_store_reservations_rls.sql`.
- Produces: `sensory_options(id, kind, slug, label, sort_order, active)` y `product_sensory_options(product_id, option_id, kind, sort_order)`.

- [ ] **Step 1: Escribir la prueba fallida de migración y esquema**

Crear `tests/khora-sensory-profile.test.mjs` con estas primeras pruebas:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("el perfil sensorial usa catálogo y relaciones normalizadas", async () => {
  const migration = await read("supabase/migrations/202609100002_khora_product_sensory_profile.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.sensory_options/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.product_sensory_options/);
  assert.match(migration, /UNIQUE \(kind, slug\)/);
  assert.match(migration, /FOREIGN KEY \(option_id, kind\)/);
  assert.match(migration, /WHERE kind IN \('INTENSITY', 'MOMENT'\)/);
});

test("la migración siembra el catálogo inicial completo", async () => {
  const migration = await read("supabase/migrations/202609100002_khora_product_sensory_profile.sql");
  for (const label of [
    "Dulce", "Cítrica", "Ambarada", "Vainilla", "Sándalo", "Eucalipto",
    "Relajante", "Sofisticada", "Suave", "Intensa", "Dormitorio",
    "Local comercial", "Día", "Todo el día",
  ]) assert.match(migration, new RegExp(`'${label}'`));
  assert.match(migration, /ON CONFLICT \(kind, slug\) DO UPDATE/);
});

test("el catálogo sensorial queda cerrado para roles del navegador", async () => {
  const migration = await read("supabase/migrations/202609100002_khora_product_sensory_profile.sql");
  assert.match(migration, /ALTER TABLE public\.sensory_options ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.product_sensory_options ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.sensory_options FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.product_sensory_options FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*WITH CHECK\s*\(\s*true\s*\)/i);
});

test("el esquema local refleja las tablas sensoriales", async () => {
  const schema = await read("db/schema.ts");
  assert.match(schema, /export const sensoryOptions = sqliteTable\("sensory_options"/);
  assert.match(schema, /export const productSensoryOptions = sqliteTable\("product_sensory_options"/);
  assert.match(schema, /productId:integer\("product_id"\).*references\(\(\)=>products\.id/);
});
test("el ejecutor aplica y verifica únicamente la migración sensorial", async () => {
  const runner = await read("scripts/apply-sensory-profile.mjs");
  assert.match(runner, /202609100002_khora_product_sensory_profile\.sql/);
  assert.match(runner, /DATABASE_URL/);
  assert.match(runner, /relrowsecurity/);
  assert.match(runner, /has_table_privilege/);
  assert.doesNotMatch(runner, /console\.log\([^)]*databaseUrl/);
});
```

Agregar `tests/khora-sensory-profile.test.mjs` al final del comando `test` de `package.json`.

- [ ] **Step 2: Ejecutar la prueba para confirmar el fallo**

Run:

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
```

Expected: FAIL con `ENOENT` para `202609100002_khora_product_sensory_profile.sql` y sin falsos positivos de otro módulo.

- [ ] **Step 3: Crear la migración PostgreSQL mínima y completa**

Crear `supabase/migrations/202609100002_khora_product_sensory_profile.sql` con esta estructura:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.sensory_options (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('FAMILY', 'NOTE', 'SENSATION', 'INTENSITY', 'ROOM', 'MOMENT')),
  slug text NOT NULL CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text NOT NULL CHECK (btrim(label) <> ''),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, slug),
  UNIQUE (id, kind)
);

CREATE TABLE IF NOT EXISTS public.product_sensory_options (
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_id integer NOT NULL,
  kind text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, option_id),
  FOREIGN KEY (option_id, kind)
    REFERENCES public.sensory_options(id, kind)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sensory_options_catalog_idx
  ON public.sensory_options(kind, active, sort_order, label);
CREATE INDEX IF NOT EXISTS product_sensory_options_product_idx
  ON public.product_sensory_options(product_id, kind, sort_order);
CREATE INDEX IF NOT EXISTS product_sensory_options_option_idx
  ON public.product_sensory_options(option_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_sensory_options_single_value_uq
  ON public.product_sensory_options(product_id, kind)
  WHERE kind IN ('INTENSITY', 'MOMENT');

INSERT INTO public.sensory_options(kind, slug, label, sort_order)
VALUES
  ('FAMILY', 'dulce', 'Dulce', 10),
  ('FAMILY', 'fresca', 'Fresca', 20),
  ('FAMILY', 'citrica', 'Cítrica', 30),
  ('FAMILY', 'floral', 'Floral', 40),
  ('FAMILY', 'amaderada', 'Amaderada', 50),
  ('FAMILY', 'especiada', 'Especiada', 60),
  ('FAMILY', 'frutal', 'Frutal', 70),
  ('FAMILY', 'herbal', 'Herbal', 80),
  ('FAMILY', 'ambarada', 'Ambarada', 90),
  ('NOTE', 'vainilla', 'Vainilla', 10),
  ('NOTE', 'ambar', 'Ámbar', 20),
  ('NOTE', 'sandalo', 'Sándalo', 30),
  ('NOTE', 'lavanda', 'Lavanda', 40),
  ('NOTE', 'jazmin', 'Jazmín', 50),
  ('NOTE', 'limon', 'Limón', 60),
  ('NOTE', 'naranja', 'Naranja', 70),
  ('NOTE', 'bergamota', 'Bergamota', 80),
  ('NOTE', 'rosa', 'Rosa', 90),
  ('NOTE', 'coco', 'Coco', 100),
  ('NOTE', 'canela', 'Canela', 110),
  ('NOTE', 'cedro', 'Cedro', 120),
  ('NOTE', 'eucalipto', 'Eucalipto', 130),
  ('SENSATION', 'relajante', 'Relajante', 10),
  ('SENSATION', 'energizante', 'Energizante', 20),
  ('SENSATION', 'acogedora', 'Acogedora', 30),
  ('SENSATION', 'elegante', 'Elegante', 40),
  ('SENSATION', 'fresca', 'Fresca', 50),
  ('SENSATION', 'sofisticada', 'Sofisticada', 60),
  ('SENSATION', 'calida', 'Cálida', 70),
  ('SENSATION', 'limpia', 'Limpia', 80),
  ('INTENSITY', 'suave', 'Suave', 10),
  ('INTENSITY', 'media', 'Media', 20),
  ('INTENSITY', 'intensa', 'Intensa', 30),
  ('ROOM', 'living', 'Living', 10),
  ('ROOM', 'dormitorio', 'Dormitorio', 20),
  ('ROOM', 'bano', 'Baño', 30),
  ('ROOM', 'cocina', 'Cocina', 40),
  ('ROOM', 'oficina', 'Oficina', 50),
  ('ROOM', 'comedor', 'Comedor', 60),
  ('ROOM', 'espacios-de-relax', 'Espacios de relax', 70),
  ('ROOM', 'local-comercial', 'Local comercial', 80),
  ('MOMENT', 'dia', 'Día', 10),
  ('MOMENT', 'noche', 'Noche', 20),
  ('MOMENT', 'todo-el-dia', 'Todo el día', 30)
ON CONFLICT (kind, slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  active = true,
  updated_at = now();

ALTER TABLE public.sensory_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sensory_options ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.sensory_options FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.product_sensory_options FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.sensory_options_id_seq FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sensory_options TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_sensory_options TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sensory_options_id_seq TO service_role;

COMMENT ON TABLE public.sensory_options IS
  'Catálogo sensorial controlado. RLS default-deny; administración vía servidor KHORA.';
COMMENT ON TABLE public.product_sensory_options IS
  'Relaciones sensoriales de productos. RLS default-deny; sin acceso directo público.';

COMMIT;
```

No crear una política: RLS sin políticas más los `REVOKE` dejan el acceso del navegador en default-deny. No intentar revocar una secuencia para `product_sensory_options`, porque esa tabla no tiene identity.

- [ ] **Step 4: Reflejar el modelo en Drizzle/SQLite**

Agregar inmediatamente después de `products` en `db/schema.ts`:

```ts
export const sensoryOptions = sqliteTable("sensory_options", {
  id:id(),
  kind:text("kind").notNull(),
  slug:text("slug").notNull(),
  label:text("label").notNull(),
  sortOrder:integer("sort_order").notNull().default(0),
  active:active(),
  createdAt:created(),
  updatedAt:text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
}, t=>[
  uniqueIndex("sensory_options_kind_slug_uq").on(t.kind,t.slug),
  uniqueIndex("sensory_options_id_kind_uq").on(t.id,t.kind),
  index("sensory_options_catalog_idx").on(t.kind,t.active,t.sortOrder,t.label),
]);

export const productSensoryOptions = sqliteTable("product_sensory_options", {
  productId:integer("product_id").notNull().references(()=>products.id,{onDelete:"cascade"}),
  optionId:integer("option_id").notNull().references(()=>sensoryOptions.id),
  kind:text("kind").notNull(),
  sortOrder:integer("sort_order").notNull().default(0),
  createdAt:created(),
}, t=>[
  uniqueIndex("product_sensory_options_product_option_uq").on(t.productId,t.optionId),
  index("product_sensory_options_product_idx").on(t.productId,t.kind,t.sortOrder),
  index("product_sensory_options_option_idx").on(t.optionId,t.productId),
]);
```

La migración PostgreSQL sigue siendo la autoridad para la FK compuesta y el índice parcial; el espejo SQLite documenta las entidades sin introducir SQL específico de PostgreSQL.

- [ ] **Step 5: Crear un ejecutor idempotente y verificable**

Crear `scripts/apply-sensory-profile.mjs` siguiendo el patrón existente de `scripts/apply-finance-foundation.mjs`:

```js
import { readFileSync } from "node:fs";
import postgres from "postgres";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
if (!match) throw new Error("DATABASE_URL no está definida en .env.local");

const databaseUrl = match[1].replace(/^["']|["']$/g, "");
const migration = readFileSync(
  new URL("../supabase/migrations/202609100002_khora_product_sensory_profile.sql", import.meta.url),
  "utf8",
);
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15, idle_timeout: 5, prepare: false, ssl: "require" });

try {
  await sql.unsafe(migration);
  const counts = await sql`
    SELECT kind,COUNT(*)::integer count
    FROM public.sensory_options
    WHERE active=TRUE
    GROUP BY kind
    ORDER BY kind
  `;
  const security = await sql`
    SELECT c.relname table_name,c.relrowsecurity,
      has_table_privilege('anon',c.oid,'SELECT') anon_select,
      has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN ('sensory_options','product_sensory_options')
    ORDER BY c.relname
  `;
  const expected = { FAMILY: 9, NOTE: 13, SENSATION: 8, INTENSITY: 3, ROOM: 8, MOMENT: 3 };
  for (const [kind, count] of Object.entries(expected)) {
    if (Number(counts.find((row) => row.kind === kind)?.count) !== count) throw new Error(`Catálogo incompleto para ${kind}`);
  }
  if (security.length !== 2 || security.some((row) => !row.relrowsecurity || row.anon_select || row.authenticated_select)) {
    throw new Error("La protección RLS del perfil sensorial no quedó aplicada correctamente.");
  }
  console.log(JSON.stringify({ applied: true, counts, security }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
```

Agregar a `package.json`:

```json
"db:migrate:sensory-profile": "node scripts/apply-sensory-profile.mjs"
```

El script sólo imprime conteos y permisos; nunca imprime `DATABASE_URL`.

- [ ] **Step 6: Ejecutar las pruebas del task**

Run:

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
```

Expected: 5 tests PASS.

- [ ] **Step 7: Verificar formato y commit**

Run:

```powershell
git diff --check
git status --short
git add -- supabase/migrations/202609100002_khora_product_sensory_profile.sql scripts/apply-sensory-profile.mjs db/schema.ts tests/khora-sensory-profile.test.mjs package.json
git commit -m "feat: add sensory profile data model"
```

Expected: el commit contiene sólo esos cuatro archivos; `.gitignore` permanece fuera.

---

### Task 2: Contrato de dominio sensorial

**Files:**
- Create: `app/khora-sensory.ts`
- Modify: `tests/khora-sensory-profile.test.mjs`

**Interfaces:**
- Consumes: payload desconocido de `sensoryProfile` y filas `{ option_id, kind, sort_order }` provenientes de PostgreSQL.
- Produces: `SensoryProfile`, `SensoryOption`, `emptySensoryProfile()`, `parseSensoryProfile(value)`, `sensorySelections(profile)` y `sensoryProfileFromRows(rows)`.

- [ ] **Step 1: Agregar pruebas fallidas del contrato puro**

Agregar al test:

```js
import {
  emptySensoryProfile,
  parseSensoryProfile,
  sensoryProfileFromRows,
  sensorySelections,
} from "../app/khora-sensory.ts";

test("el parser distingue perfil omitido de perfil vacío y deduplica", () => {
  assert.deepEqual(parseSensoryProfile(undefined), { provided: false, profile: emptySensoryProfile() });
  const parsed = parseSensoryProfile({
    families: [2, 2, 1], notes: [], sensations: [4], intensity: 8,
    rooms: [9, 9], moment: null,
  });
  assert.equal(parsed.provided, true);
  assert.deepEqual(parsed.profile.families, [2, 1]);
  assert.deepEqual(parsed.profile.rooms, [9]);
});

test("el parser rechaza formas e IDs inválidos", () => {
  assert.throws(() => parseSensoryProfile({ families: "Dulce" }), /familias/i);
  assert.throws(() => parseSensoryProfile({ families: [-1] }), /entero positivo/i);
  assert.throws(() => parseSensoryProfile({ intensity: [1, 2] }), /intensidad/i);
});

test("las selecciones conservan tipo y orden y pueden reagruparse", () => {
  const parsed = parseSensoryProfile({
    families: [2, 1], notes: [3], sensations: [], intensity: 4,
    rooms: [5], moment: 6,
  });
  const selections = sensorySelections(parsed.profile);
  assert.deepEqual(selections.slice(0, 2), [
    { optionId: 2, kind: "FAMILY", sortOrder: 0 },
    { optionId: 1, kind: "FAMILY", sortOrder: 1 },
  ]);
  assert.deepEqual(sensoryProfileFromRows(selections.map((row) => ({
    option_id: row.optionId, kind: row.kind, sort_order: row.sortOrder,
  }))), parsed.profile);
});
```

- [ ] **Step 2: Ejecutar para confirmar el fallo**

Run:

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
```

Expected: FAIL con `ERR_MODULE_NOT_FOUND` para `app/khora-sensory.ts`.

- [ ] **Step 3: Implementar tipos, parseo y serialización**

Crear `app/khora-sensory.ts` sin imports de React ni de servidor:

```ts
export const SENSORY_KINDS = ["FAMILY", "NOTE", "SENSATION", "INTENSITY", "ROOM", "MOMENT"] as const;
export type SensoryKind = typeof SENSORY_KINDS[number];

export type SensoryOption = {
  id: number;
  kind: SensoryKind;
  slug: string;
  label: string;
  sort_order: number;
};

export type SensoryProfile = {
  families: number[];
  notes: number[];
  sensations: number[];
  intensity: number | null;
  rooms: number[];
  moment: number | null;
};

export function emptySensoryProfile(): SensoryProfile {
  return {
    families: [],
    notes: [],
    sensations: [],
    intensity: null,
    rooms: [],
    moment: null,
  };
}

export type SensorySelection = { optionId: number; kind: SensoryKind; sortOrder: number };
export type ParsedSensoryProfile = { provided: boolean; profile: SensoryProfile };

const positiveId = (value: unknown, label: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${label}: cada ID debe ser un entero positivo.`);
  return id;
};

const multipleIds = (value: unknown, label: string) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label}: se esperaba una lista.`);
  return [...new Set(value.map((item) => positiveId(item, label)))];
};

const singleId = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) throw new Error(`${label}: elegí una sola opción.`);
  return positiveId(value, label);
};

export function parseSensoryProfile(value: unknown): ParsedSensoryProfile {
  if (value === undefined) return { provided: false, profile: emptySensoryProfile() };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El perfil sensorial es inválido.");
  const input = value as Record<string, unknown>;
  return { provided: true, profile: {
    families: multipleIds(input.families, "Familias"),
    notes: multipleIds(input.notes, "Notas aromáticas"),
    sensations: multipleIds(input.sensations, "Sensaciones"),
    intensity: singleId(input.intensity, "Intensidad"),
    rooms: multipleIds(input.rooms, "Ambientes"),
    moment: singleId(input.moment, "Momento recomendado"),
  } };
}

const ordered = (ids: number[], kind: SensoryKind): SensorySelection[] =>
  ids.map((optionId, sortOrder) => ({ optionId, kind, sortOrder }));

export function sensorySelections(profile: SensoryProfile): SensorySelection[] {
  return [
    ...ordered(profile.families, "FAMILY"),
    ...ordered(profile.notes, "NOTE"),
    ...ordered(profile.sensations, "SENSATION"),
    ...(profile.intensity ? [{ optionId: profile.intensity, kind: "INTENSITY" as const, sortOrder: 0 }] : []),
    ...ordered(profile.rooms, "ROOM"),
    ...(profile.moment ? [{ optionId: profile.moment, kind: "MOMENT" as const, sortOrder: 0 }] : []),
  ];
}

export function sensoryProfileFromRows(rows: Array<Record<string, unknown>>): SensoryProfile {
  const profile: SensoryProfile = { families: [], notes: [], sensations: [], intensity: null, rooms: [], moment: null };
  const sorted = [...rows].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  for (const row of sorted) {
    const optionId = positiveId(row.option_id, "Perfil guardado");
    if (row.kind === "FAMILY") profile.families.push(optionId);
    else if (row.kind === "NOTE") profile.notes.push(optionId);
    else if (row.kind === "SENSATION") profile.sensations.push(optionId);
    else if (row.kind === "INTENSITY") profile.intensity = optionId;
    else if (row.kind === "ROOM") profile.rooms.push(optionId);
    else if (row.kind === "MOMENT") profile.moment = optionId;
  }
  return profile;
}
```

No usar `enum`, porque los tests ejecutan TypeScript con strip-types. Cada llamada a `emptySensoryProfile()` debe devolver arrays nuevos para que dos formularios nunca compartan estado mutable.

- [ ] **Step 4: Ejecutar la prueba y el lint del módulo**

Run:

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
pnpm exec eslint app/khora-sensory.ts tests/khora-sensory-profile.test.mjs
```

Expected: todos los tests PASS y ESLint sin errores.

- [ ] **Step 5: Commit**

```powershell
git add -- app/khora-sensory.ts tests/khora-sensory-profile.test.mjs
git commit -m "feat: define sensory profile contract"
```

---

### Task 3: Lectura del catálogo y del perfil desde `/api/khora`

**Files:**
- Modify: `app/api/khora/route.ts:1-25, 657-660, 699`
- Modify: `tests/khora-sensory-profile.test.mjs`

**Interfaces:**
- Consumes: `sensory_options` activas y filas `product_sensory_options` de un producto.
- Produces: `GET /api/khora?entity=sensory_options -> { options: SensoryOption[] }` y `product_definition.sensory_profile: SensoryProfile`.

- [ ] **Step 1: Agregar pruebas estructurales fallidas de lectura**

```js
test("la API administrativa expone catálogo activo y perfil agrupado", async () => {
  const route = await read("app/api/khora/route.ts");
  assert.match(route, /entity==="sensory_options"/);
  assert.match(route, /FROM sensory_options WHERE active=TRUE/);
  assert.match(route, /FROM product_sensory_options WHERE product_id=\?/);
  assert.match(route, /sensory_profile:sensoryProfileFromRows/);
  assert.match(route, /ORDER BY kind,sort_order,label,id/);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run:

```powershell
node --experimental-strip-types --test --test-name-pattern="API administrativa" tests/khora-sensory-profile.test.mjs
```

Expected: FAIL porque la ruta aún no contiene `entity==="sensory_options"`.

- [ ] **Step 3: Importar el contrato y agregar el endpoint del catálogo**

En los imports de `app/api/khora/route.ts`:

```ts
import {
  parseSensoryProfile,
  sensoryProfileFromRows,
  sensorySelections,
  type SensoryKind,
  type SensoryProfile,
  type SensorySelection,
} from "../../khora-sensory";
```

Antes del fallback `if(!views[entity])`, agregar:

```ts
if(entity==="sensory_options"){
  const options=(await db().prepare(
    "SELECT id,kind,slug,label,sort_order FROM sensory_options WHERE active=TRUE ORDER BY kind,sort_order,label,id"
  ).all()).results;
  return ok({options});
}
```

- [ ] **Step 4: Ampliar `product_definition` sin cambiar su contrato anterior**

Convertir la rama de la línea 659 en un bloque legible y sumar una cuarta consulta:

```ts
if(entity==="product_definition"){
  const productId=n(url.searchParams.get("id"));
  if(!productId)return fail("Producto inválido");
  const result=await db().batch([
    db().prepare("SELECT p.id,cb.code,cb.name,COALESCE(p.store_description,'') description,COALESCE(cb.description,'') private_notes,p.category_id,p.type,p.sale_price_cents,p.minimum_stock,p.current_stock,p.active,p.pricing_mode,p.target_margin_percentage,(SELECT value_json FROM app_settings WHERE key='product_image_'||p.id) image_path,r.id recipe_id,r.active recipe_active FROM products p JOIN code_base cb ON cb.id=p.code_base_id LEFT JOIN recipes r ON r.product_id=p.id WHERE p.id=?").bind(productId),
    db().prepare("SELECT ri.material_id,ri.quantity_per_yield quantity FROM recipe_items ri JOIN recipes r ON r.id=ri.recipe_id WHERE r.product_id=? ORDER BY ri.id").bind(productId),
    db().prepare("SELECT rmi.mixture_id,rmi.quantity_per_yield quantity FROM recipe_mixture_items rmi JOIN recipes r ON r.id=rmi.recipe_id WHERE r.product_id=? ORDER BY rmi.id").bind(productId),
    db().prepare("SELECT option_id,kind,sort_order FROM product_sensory_options WHERE product_id=? ORDER BY kind,sort_order,option_id").bind(productId),
  ]);
  const product=result[0].results[0]??null;
  if(!product)return fail("Producto inexistente",404);
  return ok({
    product,
    items:result[1].results,
    mixtureItems:result[2].results,
    sensory_profile:sensoryProfileFromRows(result[3].results),
  });
}
```

No agregar estas consultas a `combo_definition`.

- [ ] **Step 5: Ejecutar pruebas y lint focalizado**

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
pnpm exec eslint app/api/khora/route.ts app/khora-sensory.ts
```

Expected: PASS; no warnings por imports aún no usados. Si los imports de escritura todavía no se usan, importar en este task sólo `sensoryProfileFromRows` y reservar el resto para Task 4.

- [ ] **Step 6: Commit**

```powershell
git add -- app/api/khora/route.ts tests/khora-sensory-profile.test.mjs
git commit -m "feat: expose admin sensory profiles"
```

---

### Task 4: Validación y guardado atómico del perfil

**Files:**
- Modify: `app/api/khora/route.ts:1-35, 1100-1137`
- Modify: `tests/khora-sensory-profile.test.mjs`

**Interfaces:**
- Consumes: `parseSensoryProfile(b.sensoryProfile)` y el catálogo activo de DB.
- Produces: validación `validateSensorySelections(selections, transaction)` y statements `appendSensoryInserts(queryDb, statements, productReference, selections)` integrados a ambas acciones de producto.

- [ ] **Step 1: Agregar pruebas fallidas de validación y atomicidad**

```js
test("crear y editar validan y guardan el perfil en la transacción existente", async () => {
  const route = await read("app/api/khora/route.ts");
  assert.match(route, /parseSensoryProfile\(b\.sensoryProfile\)/);
  assert.match(route, /SELECT id,kind FROM sensory_options WHERE active=TRUE AND id IN/);
  assert.match(route, /La opción sensorial .* no corresponde/i);
  assert.match(route, /INSERT INTO product_sensory_options/);
  assert.match(route, /DELETE FROM product_sensory_options WHERE product_id=\?/);
  assert.match(route, /if\(parsedSensory\.provided\)/);
  assert.match(route, /withKhoraTransaction\(async\(tx\)=>/);
});

test("el flujo de combos no recibe persistencia sensorial", async () => {
  const route = await read("app/api/khora/route.ts");
  const comboBlock = route.slice(route.indexOf('if(action==="update_combo_definition")'), route.indexOf('if(action==="archive_product_definition"'));
  assert.doesNotMatch(comboBlock, /product_sensory_options|sensoryProfile/);
});
```

- [ ] **Step 2: Ejecutar y confirmar el fallo**

```powershell
node --experimental-strip-types --test --test-name-pattern="validan|combos" tests/khora-sensory-profile.test.mjs
```

Expected: el primer test FAIL por ausencia del parser y los statements; el test de combos PASS.

- [ ] **Step 3: Agregar validación de IDs y tipos contra PostgreSQL**

Importar `parseSensoryProfile`, `sensorySelections`, `SensorySelection` y `KhoraTransaction`. Junto a los helpers iniciales de la ruta agregar:

```ts
type SensoryQuery = Pick<KhoraTransaction, "prepare">;

async function validateSensorySelections(selections: SensorySelection[], queryDb: SensoryQuery = db()) {
  if (!selections.length) return;
  const ids = selections.map((selection) => selection.optionId);
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await queryDb.prepare(
    `SELECT id,kind FROM sensory_options WHERE active=TRUE AND id IN (${placeholders})`
  ).bind(...ids).all()).results as NRow[];
  const actual = new Map(rows.map((row) => [n(row.id), s(row.kind)]));
  for (const selection of selections) {
    if (actual.get(selection.optionId) !== selection.kind) {
      throw new Error(`La opción sensorial ${selection.optionId} no corresponde a ${selection.kind} o ya no está activa.`);
    }
  }
}

function appendSensoryInserts(
  queryDb: SensoryQuery,
  q: Statement[],
  productIdSql: string,
  productIdBindings: unknown[],
  selections: SensorySelection[],
) {
  for (const selection of selections) {
    q.push(queryDb.prepare(
      `INSERT INTO product_sensory_options(product_id,option_id,kind,sort_order) VALUES(${productIdSql},?,?,?)`
    ).bind(...productIdBindings, selection.optionId, selection.kind, selection.sortOrder));
  }
}
```

Usar exclusivamente placeholders generados por cantidad. `productIdSql` sólo puede recibir uno de los dos literales escritos en las ramas de creación/edición; nunca debe derivar de `b` ni de texto del cliente.

- [ ] **Step 4: Integrar creación preservando el código secuencial**

Al inicio de `save_product_with_recipe`, parsear el payload y preparar las selecciones sin consultar aún la base:

```ts
const parsedSensory=parseSensoryProfile(b.sensoryProfile);
const sensory=parsedSensory.provided?sensorySelections(parsedSensory.profile):[];
```

Dentro del callback de `createWithSequentialCode`, reemplazar el `db().batch(q)` final por `withKhoraTransaction(async(tx)=>{ ... })`. Construir los statements con `tx.prepare`, llamar `await validateSensorySelections(sensory, tx)` antes de cualquier escritura y, después de crear producto/receta pero antes de auditoría, agregar:

```ts
appendSensoryInserts(
  tx,
  q,
  "(SELECT p.id FROM products p JOIN code_base cb ON cb.id=p.code_base_id WHERE cb.code=?)",
  [visible],
  sensory,
);
```

Ejecutar `await tx.batch(q)` y leer el producto creado con `tx.prepare(...)` dentro del mismo callback transaccional. Ampliar el `after_json` de auditoría con conteos, no descripciones:

```ts
sensorySelections: sensory.length,
sensoryKinds: [...new Set(sensory.map((item) => item.kind))],
```

- [ ] **Step 5: Integrar edición con semántica omitido versus vacío**

Al inicio de `update_product_definition` parsear el payload y formar `sensory` igual que en creación. Mantener las validaciones actuales de producto, receta y costos, pero envolver la construcción/ejecución del array final `q` en `withKhoraTransaction(async(tx)=>{ ... })`. Dentro del callback, ejecutar primero `await validateSensorySelections(sensory, tx)`, construir todos los statements actuales con `tx.prepare` y agregar sólo cuando el campo fue enviado:

```ts
if(parsedSensory.provided){
  q.push(tx.prepare("DELETE FROM product_sensory_options WHERE product_id=?").bind(productId));
  appendSensoryInserts(tx, q, "?", [productId], sensory);
}
```

Esto debe ocurrir antes de agregar auditoría y ejecutar `await tx.batch(q)`. Un payload antiguo sin `sensoryProfile` conserva relaciones; un payload con estructura vacía las elimina. No anidar `db().batch` dentro de `withKhoraTransaction`.

Agregar al `after_json`:

```ts
sensoryProfileUpdated: parsedSensory.provided,
sensorySelections: parsedSensory.provided ? sensory.length : undefined,
```

No registrar etiquetas, descripción pública ni notas privadas.

- [ ] **Step 6: Ejecutar pruebas y chequeo TypeScript mediante build**

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
pnpm exec eslint app/api/khora/route.ts app/khora-sensory.ts
pnpm build
```

Expected: tests PASS, lint limpio y build exitoso. Corregir cualquier incompatibilidad de `Statement`/`KhoraTransaction` usando los tipos exportados por `db/postgres.ts`, sin recurrir a `any`.

- [ ] **Step 7: Commit**

```powershell
git add -- app/api/khora/route.ts tests/khora-sensory-profile.test.mjs
git commit -m "feat: save sensory profiles atomically"
```

---

### Task 5: Editor sensorial controlado y accesible

**Files:**
- Create: `app/khora-sensory-profile.tsx`
- Modify: `tests/khora-sensory-profile.test.mjs`

**Interfaces:**
- Consumes: `options: SensoryOption[]`, `value: SensoryProfile`, `description`, estados de carga/error y callbacks controlados.
- Produces: `SensoryProfileEditor` sin fetch ni persistencia propia.

- [ ] **Step 1: Agregar prueba estructural fallida del editor**

```js
test("el editor sensorial ofrece todos los campos, preview y controles accesibles", async () => {
  const component = await read("app/khora-sensory-profile.tsx");
  for (const label of [
    "Perfil sensorial", "Familia olfativa", "Notas aromáticas", "Sensación",
    "Intensidad", "Ambiente ideal", "Momento recomendado", "Descripción pública",
    "Vista previa",
  ]) assert.match(component, new RegExp(label));
  assert.match(component, /aria-pressed/);
  assert.match(component, /role="radiogroup"/);
  assert.match(component, /aria-checked/);
  assert.match(component, /type="button"/);
  assert.match(component, /placeholder="Buscar una nota/);
  assert.match(component, /export function SensoryProfileEditor/);
  assert.doesNotMatch(component, /fetch\(/);
});
```

- [ ] **Step 2: Ejecutar y confirmar el fallo**

```powershell
node --experimental-strip-types --test --test-name-pattern="editor sensorial" tests/khora-sensory-profile.test.mjs
```

Expected: FAIL con `ENOENT` para `app/khora-sensory-profile.tsx`.

- [ ] **Step 3: Crear grupos de chips reutilizables**

Crear `app/khora-sensory-profile.tsx` con `"use client"`, imports de React y del contrato. Definir:

```tsx
type ChipGroupProps = {
  label: string;
  help: string;
  options: SensoryOption[];
  selected: number[];
  multiple: boolean;
  onChange: (ids: number[]) => void;
};

function SensoryChipGroup({ label, help, options, selected, multiple, onChange }: ChipGroupProps) {
  const toggle = (id: number) => {
    if (multiple) onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
    else onChange(selected[0] === id ? [] : [id]);
  };
  return <fieldset className="sensory-fieldset">
    <legend>{label}</legend>
    <p>{help}</p>
    <div className="sensory-chip-list" role={multiple ? undefined : "radiogroup"} aria-label={multiple ? undefined : label}>
      {options.map((option) => <button
        key={option.id}
        type="button"
        role={multiple ? undefined : "radio"}
        aria-checked={multiple ? undefined : selected.includes(option.id)}
        aria-pressed={multiple ? selected.includes(option.id) : undefined}
        className={selected.includes(option.id) ? "sensory-chip selected" : "sensory-chip"}
        onClick={() => toggle(option.id)}
      >{option.label}</button>)}
    </div>
  </fieldset>;
}
```

- [ ] **Step 4: Implementar selector de notas con filtro local**

```tsx
function AromaNotesSelector({ options, selected, onChange }: {
  options: SensoryOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("es");
  const visible = options.filter((option) => option.label.toLocaleLowerCase("es").includes(normalized));
  const chosen = selected.map((id) => options.find((option) => option.id === id)).filter(Boolean) as SensoryOption[];
  return <fieldset className="sensory-fieldset sensory-notes-fieldset">
    <legend>Notas aromáticas</legend>
    <p>Buscá y elegí todas las notas que describen el aroma.</p>
    <input
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Buscar una nota aromática…"
      aria-label="Buscar una nota aromática"
    />
    <div className="sensory-selected-notes" aria-label="Notas seleccionadas">
      {chosen.map((option) => <button key={option.id} type="button" onClick={() => onChange(selected.filter((id) => id !== option.id))}>
        {option.label}<span aria-hidden="true">×</span>
      </button>)}
    </div>
    <div className="sensory-note-results">
      {visible.map((option) => <button key={option.id} type="button" aria-pressed={selected.includes(option.id)} onClick={() => {
        if (!selected.includes(option.id)) onChange([...selected, option.id]);
      }}>{option.label}</button>)}
      {!visible.length && <span>No encontramos notas con ese nombre.</span>}
    </div>
  </fieldset>;
}
```

Las notas seleccionadas permanecen visibles aunque el filtro no coincida. No agregar un botón para crear opciones libres.

- [ ] **Step 5: Implementar preview y editor exportado**

Definir helpers locales `groupOptions(options)` y `labelsFor(ids, options)`. La firma pública debe ser exacta:

```tsx
export function SensoryProfileEditor({
  options, value, description, loading, error, onChange, onDescriptionChange, onRetry,
}: {
  options: SensoryOption[];
  value: SensoryProfile;
  description: string;
  loading: boolean;
  error: string;
  onChange: (value: SensoryProfile) => void;
  onDescriptionChange: (value: string) => void;
  onRetry: () => void;
}) { /* composición de los seis controles, textarea y preview */ }
```

La implementación debe:

- agrupar opciones por `kind` una sola vez con `useMemo`;
- convertir intensidad y momento de `number | null` a arrays de cero/uno para `SensoryChipGroup`;
- renderizar `Cargando perfil sensorial…` mientras `loading`;
- mostrar el error y `Reintentar` cuando `error` no esté vacío;
- renderizar el textarea existente con valor controlado `description` al final de los controles;
- mostrar en `SensoryProfilePreview` sólo filas con valores;
- usar `aria-live="polite"` en la vista previa;
- mostrar “Completá el perfil para ver el resumen.” si no hay selecciones ni descripción.

- [ ] **Step 6: Ejecutar prueba y lint**

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
pnpm exec eslint app/khora-sensory-profile.tsx app/khora-sensory.ts
```

Expected: PASS sin imports o estados sin usar.

- [ ] **Step 7: Commit**

```powershell
git add -- app/khora-sensory-profile.tsx tests/khora-sensory-profile.test.mjs
git commit -m "feat: build sensory profile editor"
```

---

### Task 6: Integración exclusiva en `ProductFormDialog`

**Files:**
- Modify: `app/khora-sections.tsx:1-25, 865-990`
- Modify: `tests/khora-sensory-profile.test.mjs`

**Interfaces:**
- Consumes: `SensoryProfileEditor`, `emptySensoryProfile()`, `SensoryOption[]` y `product_definition.sensory_profile`.
- Produces: carga/reintento del catálogo, estado controlado y `sensoryProfile` incluido en los dos submits de producto.

- [ ] **Step 1: Agregar prueba de integración fallida**

```js
test("ProductFormDialog integra el perfil sin modificar ComboFormDialog", async () => {
  const sections = await read("app/khora-sections.tsx");
  assert.match(sections, /import \{ SensoryProfileEditor \}/);
  assert.match(sections, /entity=sensory_options/);
  assert.match(sections, /sensory_profile/);
  assert.match(sections, /sensoryProfile,/);
  assert.match(sections, /<SensoryProfileEditor/);
  const productBlock = sections.slice(sections.indexOf("function ProductFormDialog"), sections.indexOf("function ComboFormDialog"));
  const comboBlock = sections.slice(sections.indexOf("function ComboFormDialog"), sections.indexOf("function DefinitionArchiveDialog"));
  assert.match(productBlock, /Notas privadas/);
  assert.doesNotMatch(productBlock, /product-content-fields/);
  assert.doesNotMatch(comboBlock, /SensoryProfileEditor|sensoryProfile/);
});
```

Antes de usar `DefinitionArchiveDialog` como límite, confirmar su posición actual con:

```powershell
rg -n "function ComboFormDialog|function DefinitionArchiveDialog" app/khora-sections.tsx
```

Si el orden cambió, delimitar el bloque por el siguiente `function` real; no relajar la aserción a todo el archivo.

- [ ] **Step 2: Ejecutar y comprobar el fallo**

```powershell
node --experimental-strip-types --test --test-name-pattern="ProductFormDialog" tests/khora-sensory-profile.test.mjs
```

Expected: FAIL por ausencia del import y del editor.

- [ ] **Step 3: Agregar imports y estado controlado**

En `app/khora-sections.tsx`:

```ts
import { SensoryProfileEditor } from "./khora-sensory-profile";
import { emptySensoryProfile, type SensoryOption, type SensoryProfile } from "./khora-sensory";
```

Dentro de `ProductFormDialog`:

```ts
const [sensoryOptions, setSensoryOptions] = useState<SensoryOption[]>([]);
const [sensoryProfile, setSensoryProfile] = useState<SensoryProfile>(emptySensoryProfile);
const [sensoryLoading, setSensoryLoading] = useState(true);
const [sensoryError, setSensoryError] = useState("");
const [sensoryRevision, setSensoryRevision] = useState(0);
```

Cada instancia del formulario obtiene arrays nuevos mediante `emptySensoryProfile()`; no compartir ni mutar arrays entre formularios.

- [ ] **Step 4: Cargar catálogo con error recuperable**

Agregar un efecto independiente del efecto de materiales/definición, de modo que ambas cargas corran en paralelo:

```ts
useEffect(() => {
  let active = true;
  setSensoryLoading(true);
  setSensoryError("");
  fetch("/api/khora?entity=sensory_options")
    .then(async (response) => {
      const result = await response.json() as { options?: SensoryOption[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo cargar el catálogo sensorial.");
      return result.options ?? [];
    })
    .then((options) => { if (active) setSensoryOptions(options); })
    .catch((cause) => { if (active) setSensoryError(cause instanceof Error ? cause.message : "No se pudo cargar el catálogo sensorial."); })
    .finally(() => { if (active) setSensoryLoading(false); });
  return () => { active = false; };
}, [sensoryRevision]);
```

El callback `onRetry` incrementa `sensoryRevision`.

- [ ] **Step 5: Hidratar el perfil al editar**

Ampliar el tipo de `definitionResponse.json()` con:

```ts
sensory_profile?: SensoryProfile;
```

Después de hidratar producto y receta:

```ts
if (definitionData.sensory_profile) {
  setSensoryProfile({
    families: [...definitionData.sensory_profile.families],
    notes: [...definitionData.sensory_profile.notes],
    sensations: [...definitionData.sensory_profile.sensations],
    intensity: definitionData.sensory_profile.intensity,
    rooms: [...definitionData.sensory_profile.rooms],
    moment: definitionData.sensory_profile.moment,
  });
}
```

Una respuesta antigua sin el campo conserva el valor vacío inicial.

- [ ] **Step 6: Enviar el perfil y reorganizar el contenido**

Agregar `sensoryProfile` al objeto enviado en la línea actual del fetch de guardado.

Después de `OfficialProductPhotoField`, reemplazar `product-content-fields` por:

```tsx
<SensoryProfileEditor
  options={sensoryOptions}
  value={sensoryProfile}
  description={description}
  loading={sensoryLoading}
  error={sensoryError}
  onChange={setSensoryProfile}
  onDescriptionChange={setDescription}
  onRetry={() => setSensoryRevision((current) => current + 1)}
/>
<section className="product-private-notes" aria-labelledby="product-private-notes-title">
  <label>
    <span id="product-private-notes-title">Notas privadas <small>OPCIONAL</small></span>
    <textarea value={privateNotes} onChange={(event) => setPrivateNotes(event.target.value)} placeholder="Observaciones internas, proveedores o recordatorios…" />
    <small>Solo visible en Administración</small>
  </label>
</section>
```

No mover receta, costos, advertencias ni footer. No editar `ComboFormDialog`.

- [ ] **Step 7: Evitar borrados accidentales si falla el catálogo**

Construir el body antes del fetch:

```ts
const sensoryPayload = sensoryLoading || sensoryError ? {} : { sensoryProfile };
const payload = {
  action: product ? "update_product_definition" : "save_product_with_recipe",
  // campos actuales sin cambios
  ...sensoryPayload,
};
```

Esto aprovecha la semántica de Task 4: si el catálogo no está disponible, editar un producto conserva su perfil en el servidor. La interfaz deja visible el error y el botón Reintentar; no bloquea la edición de precio o receta.

- [ ] **Step 8: Ejecutar pruebas, lint y build**

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
pnpm exec eslint app/khora-sections.tsx app/khora-sensory-profile.tsx app/khora-sensory.ts
pnpm build
```

Expected: PASS; ninguna referencia a `SensoryProfileEditor` dentro de `ComboFormDialog`.

- [ ] **Step 9: Commit**

```powershell
git add -- app/khora-sections.tsx tests/khora-sensory-profile.test.mjs
git commit -m "feat: integrate sensory product form"
```

---

### Task 7: Estilos KHORA y comportamiento responsive

**Files:**
- Modify: `app/globals.css:631-641`
- Modify: `tests/khora-sensory-profile.test.mjs`

**Interfaces:**
- Consumes: clases `sensory-profile-editor`, `sensory-fieldset`, `sensory-chip`, `sensory-note-results`, `sensory-profile-preview` y `product-private-notes`.
- Produces: layout de dos columnas en desktop y una columna bajo `620px`, sin scroll horizontal.

- [ ] **Step 1: Agregar prueba estructural fallida de estilos**

```js
test("el perfil sensorial reutiliza variables KHORA y se apila en mobile", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /\.sensory-profile-editor/);
  assert.match(css, /\.sensory-chip\.selected/);
  assert.match(css, /\.sensory-profile-preview/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.sensory-profile-layout\{grid-template-columns:1fr/);
  assert.match(css, /overflow-wrap:anywhere/);
});
```

- [ ] **Step 2: Ejecutar y confirmar el fallo**

```powershell
node --experimental-strip-types --test --test-name-pattern="reutiliza variables" tests/khora-sensory-profile.test.mjs
```

Expected: FAIL porque las clases aún no existen.

- [ ] **Step 3: Agregar estilos base usando el sistema actual**

Agregar junto a los estilos de `product-content-fields`:

```css
.sensory-profile-editor{display:grid;gap:14px;padding:16px;border:1px solid var(--line);border-radius:11px;background:#fbfcfa;min-width:0}
.sensory-profile-editor>header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.sensory-profile-editor>header h3{margin:0;font:22px Georgia,serif;color:var(--forest)}
.sensory-profile-editor>header p,.sensory-fieldset>p{margin:4px 0 0;color:var(--muted);font-size:10px;line-height:1.5}
.sensory-profile-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(220px,.75fr);gap:16px;align-items:start;min-width:0}
.sensory-profile-fields{display:grid;gap:14px;min-width:0}
.sensory-fieldset{min-width:0;margin:0;padding:0;border:0;display:grid;gap:8px}
.sensory-fieldset legend{padding:0;font-size:10px;font-weight:750;color:#66766e}
.sensory-chip-list,.sensory-selected-notes{display:flex;flex-wrap:wrap;gap:7px;min-width:0}
.sensory-chip,.sensory-selected-notes button,.sensory-note-results button{min-height:32px;border:1px solid #d5dfd8;border-radius:999px;background:#fff;color:var(--forest);padding:6px 11px;font-size:10px;cursor:pointer;transition:background var(--motion-fast) var(--ease-standard),border-color var(--motion-fast) var(--ease-standard),color var(--motion-fast) var(--ease-standard)}
.sensory-chip.selected,.sensory-note-results button[aria-pressed="true"]{background:var(--forest);border-color:var(--forest);color:#fff}
.sensory-selected-notes button{display:inline-flex;align-items:center;gap:7px;background:#eef4f0}
.sensory-notes-fieldset input{min-width:0}
.sensory-note-results{max-height:154px;overflow:auto;display:flex;flex-wrap:wrap;gap:7px;padding:10px;border:1px solid var(--line);border-radius:9px;background:#fff}
.sensory-note-results>span{color:var(--muted);font-size:10px}
.sensory-public-description textarea{min-height:112px}
.sensory-profile-preview{position:sticky;top:0;display:grid;gap:10px;min-width:0;padding:14px;border:1px solid #d7e4dc;border-radius:10px;background:#f1f6f2}
.sensory-profile-preview h4{margin:0;font:18px Georgia,serif;color:var(--forest)}
.sensory-profile-preview dl{margin:0;display:grid;gap:9px}
.sensory-profile-preview dl>div{display:grid;gap:3px;padding-bottom:8px;border-bottom:1px solid rgba(25,76,60,.1);min-width:0}
.sensory-profile-preview dt{font-size:8px;letter-spacing:1px;text-transform:uppercase;color:#71837a}
.sensory-profile-preview dd{margin:0;font-size:11px;line-height:1.45;color:var(--ink);overflow-wrap:anywhere}
.sensory-profile-empty{margin:0;color:var(--muted);font-size:10px;line-height:1.5}
.sensory-profile-error{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #edc6c0;background:#fcf0ee;color:#a54d44;border-radius:8px;padding:10px;font-size:11px}
.sensory-profile-error button{border:0;background:transparent;color:inherit;text-decoration:underline;cursor:pointer}
.product-private-notes{padding:14px;border:1px solid var(--line);border-radius:11px;background:#fbfcfa}
.product-private-notes textarea{min-height:92px}
```

Usar `var(--motion-fast)` como duración y `var(--ease-standard)` como función de aceleración; ambas variables ya existen en `:root`.

- [ ] **Step 4: Agregar responsive sin afectar otros drawers**

```css
@media(max-width:620px){
  .sensory-profile-editor{padding:13px}
  .sensory-profile-editor>header{display:grid;gap:6px}
  .sensory-profile-layout{grid-template-columns:1fr}
  .sensory-profile-preview{position:static}
  .sensory-chip,.sensory-selected-notes button,.sensory-note-results button{max-width:100%;white-space:normal;text-align:left}
  .sensory-profile-error{align-items:flex-start;flex-direction:column}
}
```

No aplicar `overflow-x:hidden` al `body`; corregir el ancho dentro del componente.

- [ ] **Step 5: Ejecutar pruebas, lint y build**

```powershell
node --experimental-strip-types --test tests/khora-sensory-profile.test.mjs
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- app/globals.css tests/khora-sensory-profile.test.mjs
git commit -m "style: polish sensory profile editor"
```

---

### Task 8: Verificación integral y preparación de despliegue

**Files:**
- Verify only: todos los archivos anteriores
- Modify only if a verification exposes a defect directly relacionado: archivo responsable y test de regresión correspondiente

**Interfaces:**
- Consumes: feature completa de Tasks 1-7.
- Produces: evidencia automatizada y visual de que el perfil funciona sin regresiones.

- [ ] **Step 1: Ejecutar suite completa desde estado limpio**

```powershell
pnpm test
pnpm lint
git diff --check HEAD~7..HEAD
git status --short
```

Expected: build y todos los tests PASS; lint sin errores; `.gitignore` puede seguir modificado por el usuario pero no debe aparecer en ningún commit del feature.

- [ ] **Step 2: Aplicar la migración en el entorno de verificación autorizado**

Con autorización explícita para modificar la base configurada en `.env.local`, ejecutar el runner idempotente:

```powershell
pnpm check:db
pnpm db:migrate:sensory-profile
```

`pnpm check:db` debe confirmar conectividad antes de aplicar. El segundo comando puede ejecutarse tanto si la migración es nueva como si ya fue aplicada porque usa `IF NOT EXISTS` y `ON CONFLICT`; no inserta ni borra productos.

Expected:

- ambas tablas existen;
- hay 9 familias, 13 notas, 8 sensaciones, 3 intensidades, 8 ambientes y 3 momentos activos;
- RLS figura habilitado;
- `anon` y `authenticated` no poseen privilegios sobre tablas ni secuencia;
- el rol privado del servidor puede leer y escribir.

- [ ] **Step 3: Verificar manualmente creación y edición en Administración**

En un entorno local o de preview con datos de prueba:

1. Abrir Productos → Nuevo producto.
2. Confirmar que Perfil sensorial aparece después de Foto oficial y antes de Notas privadas/receta.
3. Elegir dos familias, tres notas, dos sensaciones, una intensidad, dos ambientes y un momento.
4. Completar la descripción pública y guardar.
5. Reabrir el producto y confirmar las mismas selecciones, orden y descripción.
6. Quitar todas las selecciones, guardar y reabrir para confirmar perfil vacío.
7. Crear otro producto sin tocar el perfil y confirmar que sigue funcionando.
8. Abrir y editar un combo; confirmar que el formulario no tiene Perfil sensorial y mantiene su comportamiento.

- [ ] **Step 4: Verificar recuperación de errores y compatibilidad**

1. En Chrome DevTools → Network request blocking, bloquear `*/api/khora?entity=sensory_options`, reabrir el drawer y confirmar mensaje específico + Reintentar; quitar el bloqueo y confirmar que Reintentar recupera el editor.
2. Con el catálogo fallando, editar sólo precio o receta de un producto existente y confirmar que su perfil guardado no se elimina.
3. Enviar manualmente un ID inexistente y confirmar HTTP 400 con mensaje de opción inválida y cero cambios parciales.
4. Enviar una opción de `NOTE` como familia y confirmar HTTP 400.
5. Confirmar que no se registran descripción pública ni notas privadas en logs nuevos.

- [ ] **Step 5: Verificar desktop y mobile**

Revisar como mínimo viewports `1440×900`, `1024×768`, `390×844` y `360×800`:

- drawer desplazable sólo en vertical;
- chips envuelven líneas;
- buscador y resultados de notas no desbordan;
- preview al costado en desktop y debajo en mobile;
- botones del footer permanecen utilizables;
- no hay scroll horizontal.

- [ ] **Step 6: Confirmar que Tienda y operaciones no cambiaron**

Comparar el diff completo y comprobar:

```powershell
git diff --name-only HEAD~7..HEAD
git diff HEAD~7..HEAD -- app/tienda app/api/tienda
```

Expected: el segundo comando no muestra cambios. En local o preview, realizar un smoke test de navegación por Tienda y listado de combos sin completar checkout ni modificar datos de producción.

- [ ] **Step 7: Cerrar la verificación**

Ejecutar nuevamente `pnpm test`, `pnpm lint`, `git diff --check` y `git status --short`. Si todos pasan y no surgieron correcciones, no crear un commit vacío. Si una verificación falla, volver al task propietario del comportamiento, agregar allí una prueba de regresión concreta y repetir este Task 8 completo antes de declarar terminado el feature.
