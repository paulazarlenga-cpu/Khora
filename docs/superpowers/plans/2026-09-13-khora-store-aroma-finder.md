# KHORA Tienda: Encontrá tu aroma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Crear una experiencia pública independiente para descubrir aromas y mostrar perfiles sensoriales reales en KHORA Tienda sin alterar reservas, carrito ni datos privados.

**Architecture:** El endpoint público extiende el catálogo existente con opciones sensoriales activas y perfiles normalizados por producto. Un módulo puro calcula coincidencias de 0 a 4; componentes separados presentan el cuestionario, resultados y perfil editorial. app/tienda/page.tsx conserva el flujo actual y agrega vista=aroma.

**Tech Stack:** Next.js App Router, React 19, TypeScript, PostgreSQL/Supabase mediante API routes del servidor, CSS Modules y Node test runner.

**Spec:** docs/superpowers/specs/2026-09-12-khora-store-aroma-finder-design.md

## Global Constraints

- Usar solamente opciones y asociaciones sensoriales administradas en KHORA Administración.
- No exponer code_base.description, opciones inactivas ni notas privadas.
- Reutilizar listStoreProducts y khora_available_product_stock para reglas de publicación, precio y disponibilidad.
- Recomendar únicamente productos con availableStock > 0; los productos sin perfil permanecen en el catálogo normal.
- No modificar carrito, reservas, WhatsApp, checkout, pedidos, autenticación, mayorista, colecciones o buscador existente.
- No usar IA ni porcentajes; las etiquetas provienen de score entero 0–4.
- Mantener CSS Modules de Tienda, prefers-reduced-motion y cero scroll horizontal en mobile.

---

## File Structure

- Create: app/khora-aroma-match.ts — contrato público, normalización y scoring puro.
- Create: app/khora-aroma-finder.tsx — cuestionario, progreso y resultados; sin red.
- Create: app/khora-sensory-display.tsx — perfil editorial público reutilizable.
- Modify: app/api/tienda/route.ts — proyección pública del perfil y catálogo de opciones activas.
- Modify: app/tienda/page.tsx — ruteo aroma, links de entrada y ficha.
- Modify: app/tienda/store.module.css — finder, resultados, perfil y breakpoints.
- Create: tests/khora-store-aroma-finder.test.mjs — tests de lógica, privacidad, interfaz y responsive.
- Modify: package.json — sumar el test nuevo a pnpm test.

### Task 1: Tipos públicos y scoring determinístico

**Files:**
- Create: app/khora-aroma-match.ts
- Create: tests/khora-store-aroma-finder.test.mjs
- Modify: package.json

**Interfaces:**
- Produces: PublicSensoryOption, PublicSensoryProfile, AromaAnswers, AromaMatch, publicSensoryProfileFromRows, calculateAromaMatch, aromaMatchLabel y hasPublicSensoryContent.
- Consumed by: Tasks 2–5.

- [ ] **Step 1: Write the failing test**

    import {
      calculateAromaMatch,
      publicSensoryProfileFromRows,
    } from "../app/khora-aroma-match.ts";

    test("el match suma una coincidencia por cada respuesta", () => {
      const profile = publicSensoryProfileFromRows([
        { kind: "SENSATION", slug: "relajante", label: "Relajante", sort_order: 10 },
        { kind: "ROOM", slug: "dormitorio", label: "Dormitorio", sort_order: 10 },
        { kind: "FAMILY", slug: "floral", label: "Floral", sort_order: 10 },
        { kind: "INTENSITY", slug: "media", label: "Media", sort_order: 10 },
      ]);
      assert.deepEqual(calculateAromaMatch(profile, {
        sensation: "relajante", room: "dormitorio", family: "floral", intensity: "media",
      }), { score: 4, label: "Excelente compatibilidad" });
    });

    test("el match etiqueta scores 3, 2, 1 y 0 sin porcentajes", () => {
      assert.equal(aromaMatchLabel(3), "Muy buena compatibilidad");
      assert.equal(aromaMatchLabel(2), "Buena compatibilidad");
      assert.equal(aromaMatchLabel(1), "Compatibilidad baja");
      assert.equal(aromaMatchLabel(0), "");
    });

Agregar el nuevo archivo a la lista de node --experimental-strip-types --test de package.json.

- [ ] **Step 2: Run test to verify it fails**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs

Expected: FAIL porque app/khora-aroma-match.ts no existe.

- [ ] **Step 3: Write minimal implementation**

    export type PublicSensoryOption = {
      kind: "FAMILY" | "NOTE" | "SENSATION" | "INTENSITY" | "ROOM" | "MOMENT";
      slug: string;
      label: string;
    };

    export type PublicSensoryProfile = {
      families: PublicSensoryOption[];
      notes: PublicSensoryOption[];
      sensations: PublicSensoryOption[];
      intensity: PublicSensoryOption | null;
      rooms: PublicSensoryOption[];
      moment: PublicSensoryOption | null;
    };

    export type AromaAnswers = {
      sensation: string; room: string; family: string; intensity: string;
    };
    export type AromaMatch = { score: 0 | 1 | 2 | 3 | 4; label: string };

    export function calculateAromaMatch(
      profile: PublicSensoryProfile, answers: AromaAnswers,
    ): AromaMatch {
      const score = [
        profile.sensations.some((item) => item.slug === answers.sensation),
        profile.rooms.some((item) => item.slug === answers.room),
        profile.families.some((item) => item.slug === answers.family),
        profile.intensity?.slug === answers.intensity,
      ].filter(Boolean).length as AromaMatch["score"];
      return { score, label: aromaMatchLabel(score) };
    }

Normalizar por sort_order, ignorar kinds desconocidos, usar arrays vacíos/null cuando falte un grupo y devolver string vacío para aromaMatchLabel(0).

- [ ] **Step 4: Run test to verify it passes**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs

Expected: PASS para normalización, score 0–4, etiquetas y hasPublicSensoryContent.

- [ ] **Step 5: Commit**

    git add app/khora-aroma-match.ts tests/khora-store-aroma-finder.test.mjs package.json
    git commit -m "feat: add store aroma matching"

### Task 2: Proyección pública segura del perfil sensorial

**Files:**
- Modify: app/api/tienda/route.ts:141-166,376-384
- Modify: tests/khora-store-aroma-finder.test.mjs

**Interfaces:**
- Consumes: PublicSensoryOption y publicSensoryProfileFromRows de Task 1.
- Produces: entity=products responde products, collections, sensoryOptions y reservationExpiresAt; cada producto contiene sensoryProfile.
- Consumed by: Tasks 4–5.

- [ ] **Step 1: Write the failing test**

    test("la tienda proyecta solo opciones activas y no notas privadas", async () => {
      const route = await read("app/api/tienda/route.ts");
      assert.match(route, /JOIN sensory_options so ON so\.id=pso\.option_id AND so\.kind=pso\.kind/);
      assert.match(route, /so\.active=TRUE/);
      assert.match(route, /sensoryOptions/);
      assert.match(route, /publicSensoryProfileFromRows/);
      assert.doesNotMatch(route, /code_base\.description[\s\S]*sensory/i);
    });

    test("el catálogo conserva la fuente central de disponibilidad", async () => {
      const route = await read("app/api/tienda/route.ts");
      assert.match(route, /khora_available_product_stock\(\?\)/);
      assert.match(route, /p\.active=1 AND p\.store_published=TRUE AND p\.sale_price_cents>0/);
    });

- [ ] **Step 2: Run test to verify it fails**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs

Expected: FAIL porque entity=products todavía no contiene perfil ni catálogo sensorial.

- [ ] **Step 3: Write minimal implementation**

Después de obtener productos, consultar por lote:

    SELECT pso.product_id, so.kind, so.slug, so.label, pso.sort_order
    FROM product_sensory_options pso
    JOIN sensory_options so ON so.id=pso.option_id AND so.kind=pso.kind
    WHERE so.active=TRUE AND pso.product_id IN (lista-de-ids)
    ORDER BY pso.product_id, so.kind, pso.sort_order, so.id

Agrupar por product_id con publicSensoryProfileFromRows. Consultar sensory_options activos una vez, ordenados por kind, sort_order, label, id, y mapear solo kind, slug y label como sensoryOptions de nivel superior.

No crear acceso directo de navegador a Supabase ni modificar los filtros existentes de active, store_published, precio o khora_available_product_stock.

- [ ] **Step 4: Run test to verify it passes**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs tests/khora-store-hobby.test.mjs

Expected: PASS; las pruebas de reserva siguen intactas.

- [ ] **Step 5: Commit**

    git add app/api/tienda/route.ts tests/khora-store-aroma-finder.test.mjs
    git commit -m "feat: expose public sensory store data"

### Task 3: Bloque editorial de Perfil Sensorial

**Files:**
- Create: app/khora-sensory-display.tsx
- Modify: app/tienda/store.module.css
- Modify: tests/khora-store-aroma-finder.test.mjs

**Interfaces:**
- Consumes: PublicSensoryProfile y hasPublicSensoryContent.
- Produces: SensoryProfileDisplay({ profile, description }) y SensorySummary({ profile }).
- Consumed by: Task 5.

- [ ] **Step 1: Write the failing test**

    test("el display público usa grupos editoriales y omite valores vacíos", async () => {
      const component = await read("app/khora-sensory-display.tsx");
      const css = await read("app/tienda/store.module.css");
      assert.match(component, /PERFIL SENSORIAL/);
      assert.match(component, /Familia aromática/);
      assert.match(component, /Notas principales/);
      assert.match(component, /Ideal para/);
      assert.match(component, /Intensidad/);
      assert.match(component, /hasPublicSensoryContent/);
      assert.match(css, /\.sensoryProfile/);
      assert.match(css, /@media \(max-width: 560px\)/);
    });

- [ ] **Step 2: Run test to verify it fails**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs

Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Write minimal implementation**

    export function SensoryProfileDisplay({ profile, description }: {
      profile: PublicSensoryProfile;
      description: string;
    }) {
      if (!hasPublicSensoryContent(profile)) return null;
      return <section className={styles.sensoryProfile} aria-labelledby="sensory-profile-title">
        <p className={styles.sensoryEyebrow}>PERFIL SENSORIAL</p>
        <h2 id="sensory-profile-title">Cómo se percibe</h2>
      </section>;
    }

Renderizar familias, notas, sensaciones y ambientes como chips no interactivos. Renderizar intensidad con cinco puntos, etiqueta y texto accesible por ejemplo Intensidad media: 3 de 5. Colocar descripción pública después de los grupos cargados. SensorySummary debe ser compacto, sin descripción ni etiquetas vacías.

Usar clases sensoryProfile y sensorySummary. A max-width: 560px apilar detalles y permitir wrap usando min-width: 0, max-width: 100% y overflow-wrap: anywhere. Incluir selectores de movimiento en prefers-reduced-motion.

- [ ] **Step 4: Run test to verify it passes**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs

Expected: PASS para copy pública, campos condicionales y hooks responsive.

- [ ] **Step 5: Commit**

    git add app/khora-sensory-display.tsx app/tienda/store.module.css tests/khora-store-aroma-finder.test.mjs
    git commit -m "feat: add public sensory profile display"

### Task 4: Experiencia guiada Encontrá tu aroma

**Files:**
- Create: app/khora-aroma-finder.tsx
- Modify: app/tienda/store.module.css
- Modify: tests/khora-store-aroma-finder.test.mjs

**Interfaces:**
- Consumes: AromaAnswers, PublicSensoryOption, PublicSensoryProfile, calculateAromaMatch y SensorySummary.
- Produces: AromaFinder({ products, options, onOpenProduct, onAddProduct, onBack, saving }).
- Consumed by: Task 5.

- [ ] **Step 1: Write the failing test**

    test("el finder separa cuestionario, resultados y acciones existentes", async () => {
      const finder = await read("app/khora-aroma-finder.tsx");
      assert.match(finder, /ENCONTRÁ TU AROMA/);
      assert.match(finder, /¿Qué sensación buscás\?/);
      assert.match(finder, /¿Dónde lo vas a usar\?/);
      assert.match(finder, /¿Qué familia aromática preferís\?/);
      assert.match(finder, /¿Qué intensidad te gusta\?/);
      assert.match(finder, /VER RECOMENDACIONES/);
      assert.match(finder, /calculateAromaMatch/);
      assert.match(finder, /availableStock > 0/);
      assert.match(finder, /Cambiar respuestas/);
      assert.doesNotMatch(finder, /fetch\(/);
    });

- [ ] **Step 2: Run test to verify it fails**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs

Expected: FAIL porque el finder no existe.

- [ ] **Step 3: Write minimal implementation**

    export type AromaFinderProduct = {
      id: number;
      name: string;
      priceCents: number;
      availableStock: number;
      imagePath: string | null;
      sensoryProfile: PublicSensoryProfile;
    };

Derivar opciones de pregunta desde options por SENSATION, ROOM, FAMILY e INTENSITY. Conservar respuestas en estado. En desktop, mostrar panel editorial con cuatro grupos y progreso. Bajo 560px, renderizar solo el grupo actual con controles Atrás/Siguiente.

Derivar candidatos con:

    products
      .filter((product) => product.availableStock > 0 && hasPublicSensoryContent(product.sensoryProfile))
      .map((product) => ({ product, match: calculateAromaMatch(product.sensoryProfile, answers) }))
      .filter(({ match }) => match.score > 0)
      .sort((left, right) =>
        right.match.score - left.match.score ||
        left.product.name.localeCompare(right.product.name, "es"),
      );

Mostrar tres resultados, Ver todos los resultados si hay más, estado sin match con Cambiar respuestas y callbacks existentes de Ver producto / Agregar a la bolsa. No llamar fetch, crear reservas ni replicar estado de carrito.

Usar clases aromaFinder, chips con wrap y acciones a ancho completo en mobile. Incluir motion discreto y override de reduced motion.

- [ ] **Step 4: Run test to verify it passes**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs

Expected: PASS para copy, disponibilidad, scorer puro, frontera sin fetch y selectores mobile.

- [ ] **Step 5: Commit**

    git add app/khora-aroma-finder.tsx app/tienda/store.module.css tests/khora-store-aroma-finder.test.mjs
    git commit -m "feat: add store aroma finder"

### Task 5: Ruteo, navegación, ficha y callbacks reales

**Files:**
- Modify: app/tienda/page.tsx:7-124,148-156,237-275,508-512
- Modify: app/tienda/store.module.css
- Modify: tests/khora-store-aroma-finder.test.mjs

**Interfaces:**
- Consumes: datos de Task 2, AromaFinder de Task 4 y SensoryProfileDisplay de Task 3.
- Produces: view === aroma, accesible con ?vista=aroma.

- [ ] **Step 1: Write the failing test**

    test("la tienda ofrece Encontrá tu aroma como vista independiente", async () => {
      const page = await read("app/tienda/page.tsx");
      assert.match(page, /"aroma"/);
      assert.match(page, /params\.get\("vista"\) === "aroma"/);
      assert.match(page, /onAroma/);
      assert.match(page, /<AromaFinder/);
      assert.match(page, /ENCONTRÁ TU AROMA/);
    });

    test("la ficha usa Perfil Sensorial solo si el producto tiene datos", async () => {
      const page = await read("app/tienda/page.tsx");
      assert.match(page, /<SensoryProfileDisplay/);
      assert.match(page, /hasPublicSensoryContent/);
      assert.match(page, /Materiales y cuidado/);
    });

- [ ] **Step 2: Run test to verify it fails**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs

Expected: FAIL porque aroma no es una vista y Product no tiene sensoryProfile.

- [ ] **Step 3: Write minimal implementation**

Actualizar View, viewFromLocation y navigate para reconocer aroma y producir ?vista=aroma. Extender Product con sensoryProfile y cargar sensoryOptions de entity=products.

Pasar onAroma={() => navigate("aroma")} a StoreHeader; añadir botón accesible luego de Colecciones. Agregar CTA editorial en hero usando el mismo callback, sin anchor ni recarga.

    {view === "aroma" && <AromaFinder
      products={products}
      options={sensoryOptions}
      saving={saving}
      onBack={() => navigate("home")}
      onOpenProduct={(id) => navigate("product", id)}
      onAddProduct={(product) => addToCart(product)}
    />}

En ProductDetail, renderizar SensoryProfileDisplay cuando hasPublicSensoryContent(product.sensoryProfile) sea true; si no, conservar exactamente el fallback actual de Materiales y cuidado.

- [ ] **Step 4: Run tests to verify they pass**

Run: node --experimental-strip-types --test tests/khora-store-aroma-finder.test.mjs tests/khora-store-hobby.test.mjs tests/khora-store-rls.test.mjs

Expected: PASS; RLS y reservas no cambian.

- [ ] **Step 5: Commit**

    git add app/tienda/page.tsx app/tienda/store.module.css tests/khora-store-aroma-finder.test.mjs
    git commit -m "feat: integrate store aroma experience"

### Task 6: Verificación completa, visual y de regresión

**Files:**
- Modify solamente archivos de Tasks 1–5 si la verificación descubre un defecto específico.
- Test: tests/khora-store-aroma-finder.test.mjs y suite existente.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: implementación verificada lista para revisión e integración.

- [ ] **Step 1: Run the full suite**

Run: pnpm test

Expected: build de producción exitoso y todos los tests en PASS.

- [ ] **Step 2: Run lint and diff validation**

Run: pnpm lint

Expected: cero errores de lint; advertencias existentes se reportan separadas.

Run: git diff --check main...HEAD

Expected: cero errores de whitespace.

- [ ] **Step 3: Review privacy boundary**

Run: rg -n "private_notes|code_base\.description|sensory_options|product_sensory_options" app/api/tienda/route.ts app/tienda app/khora-aroma-*.ts* app/khora-sensory-display.tsx

Expected: tablas sensoriales solo en API de servidor y ningún source cliente contiene private_notes o code_base.description.

- [ ] **Step 4: Perform visual checks**

1. Desktop 1440×900: header abre ?vista=aroma; grupos, resultados y Cambiar respuestas no se superponen.
2. Mobile 390×844 y 360×800: una pregunta por vez, chips wrap, botones táctiles y document.scrollWidth igual al viewport.
3. Producto con perfil: grupos en orden aprobado y descripción al final.
4. Producto sin perfil: solo fallback de cuidado.
5. Resultado abre ficha existente y agregar a bolsa usa aviso de reserva actual.

- [ ] **Step 5: Commit a focused verification fix only if needed**

    git add app/khora-aroma-match.ts app/khora-aroma-finder.tsx app/khora-sensory-display.tsx app/api/tienda/route.ts app/tienda/page.tsx app/tienda/store.module.css tests/khora-store-aroma-finder.test.mjs
    git commit -m "fix: polish store aroma experience"

No crear commit si no hizo falta una corrección.

## Plan Self-Review

- Spec coverage: Tasks 1–2 cubren datos, privacidad, opciones activas, stock y scoring; Tasks 3–5 cubren ficha, ruta, header/hero, cuestionario, resultados y acciones existentes; Task 6 cubre tests y visuales.
- Placeholder scan: no hay decisiones de diseño sin resolver ni trabajo diferido.
- Type consistency: PublicSensoryProfile y AromaAnswers nacen en Task 1 y Tasks 2–5 consumen esos mismos contratos.
