import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  aromaMatchLabel,
  calculateAromaMatch,
  hasPublicSensoryContent,
  publicSensoryProfileFromRows,
} from "../app/khora-aroma-match.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("el buscador suma una coincidencia por cada respuesta elegida", () => {
  const profile = publicSensoryProfileFromRows([
    { kind: "SENSATION", slug: "relajante", label: "Relajante", sort_order: 10 },
    { kind: "ROOM", slug: "dormitorio", label: "Dormitorio", sort_order: 10 },
    { kind: "FAMILY", slug: "floral", label: "Floral", sort_order: 10 },
    { kind: "INTENSITY", slug: "media", label: "Media", sort_order: 10 },
  ]);

  assert.deepEqual(
    calculateAromaMatch(profile, {
      sensation: "relajante",
      room: "dormitorio",
      family: "floral",
      intensity: "media",
    }),
    { score: 4, label: "Excelente compatibilidad" },
  );
});

test("el buscador clasifica resultados parciales sin porcentajes", () => {
  assert.equal(aromaMatchLabel(3), "Muy buena compatibilidad");
  assert.equal(aromaMatchLabel(2), "Buena compatibilidad");
  assert.equal(aromaMatchLabel(1), "Compatibilidad baja");
  assert.equal(aromaMatchLabel(0), "");
});

test("el perfil público ordena sus opciones y detecta contenido real", () => {
  const profile = publicSensoryProfileFromRows([
    { kind: "NOTE", slug: "vainilla", label: "Vainilla", sort_order: 20 },
    { kind: "FAMILY", slug: "dulce", label: "Dulce", sort_order: 10 },
    { kind: "NOTE", slug: "cedro", label: "Cedro", sort_order: 10 },
    { kind: "UNKNOWN", slug: "ignored", label: "Ignored", sort_order: 0 },
  ]);

  assert.deepEqual(profile.notes.map((option) => option.slug), ["cedro", "vainilla"]);
  assert.deepEqual(profile.families.map((option) => option.slug), ["dulce"]);
  assert.equal(hasPublicSensoryContent(profile), true);
  assert.equal(hasPublicSensoryContent(publicSensoryProfileFromRows([])), false);
});

test("la tienda proyecta perfiles activos sin exponer notas privadas", async () => {
  const route = await read("app/api/tienda/route.ts");

  assert.match(route, /JOIN sensory_options so ON so\.id=pso\.option_id AND so\.kind=pso\.kind/);
  assert.match(route, /so\.active=TRUE/);
  assert.match(route, /publicSensoryProfileFromRows/);
  assert.match(route, /sensoryOptions/);
  assert.doesNotMatch(route, /code_base\.description[\s\S]*sensory/i);
});

test("la fuente de disponibilidad del catálogo se conserva para recomendaciones", async () => {
  const route = await read("app/api/tienda/route.ts");

  assert.match(route, /khora_available_product_stock\(\?\)/);
  assert.match(route, /p\.active=1 AND p\.store_published=TRUE AND p\.sale_price_cents>0/);
});
test("el perfil público presenta grupos editoriales y omite los vacíos", async () => {
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
test("el finder guía cuatro preguntas y reutiliza las acciones de Tienda", async () => {
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
test("la tienda ofrece Encontrá tu aroma como vista independiente", async () => {
  const page = await read("app/tienda/page.tsx");

  assert.match(page, /"aroma"/);
  assert.match(page, /params\.get\("vista"\) === "aroma"/);
  assert.match(page, /onAroma/);
  assert.match(page, /<AromaFinder/);
  assert.match(page, /ENCONTRÁ TU AROMA/);
});

test("la ficha usa perfil sensorial solo para productos con datos", async () => {
  const page = await read("app/tienda/page.tsx");

  assert.match(page, /<SensoryProfileDisplay/);
  assert.match(page, /hasPublicSensoryContent/);
  assert.match(page, /Materiales y cuidado/);
});