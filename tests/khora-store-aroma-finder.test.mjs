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
test("la navegación de aroma se repliega antes de quedar sin espacio y no deja variables muertas", async () => {
  const page = await read("app/tienda/page.tsx");
  const css = await read("app/tienda/store.module.css");

  assert.match(css, /@media \(max-width:1100px\)\{\.header nav\{display:none\}\}/);
  assert.doesNotMatch(page, /const careCopy\s*=/);
});
test("el CTA del buscador se reserva al hero móvil y queda debajo de descubrir KHORA", async () => {
  const css = await read("app/tienda/store.module.css");

  assert.match(css, /\.heroAromaCta \{ display:none;/);
  assert.match(css, /@media \(max-width:850px\) \{ \.heroAromaCta \{ display:flex; width:max-content;/);
});

test("los accesos de regreso comparten una microinteracción accesible", async () => {
  const page = await read("app/tienda/page.tsx");
  const finder = await read("app/khora-aroma-finder.tsx");
  const css = await read("app/tienda/store.module.css");

  assert.match(page, /styles\.backLinkArrow/);
  assert.match(finder, /styles\.backLinkArrow/);
  assert.match(css, /\.backLinkArrow/);
  assert.match(css, /\.backLink:hover::after/);
  assert.match(css, /prefers-reduced-motion:reduce\)[\s\S]*\.backLinkArrow/);
});
test("el hero integra la foto como una portada editorial continua", async () => {
  const page = await read("app/tienda/page.tsx");
  const css = await read("app/tienda/store.module.css");

  assert.match(page, /className=\{styles\.hero\}/);
  assert.match(page, /src="\/khora-store-hero\.png"/);
  const heroRules = [...css.matchAll(/\.hero\{([^}]*)\}/g)].map((match) => match[1]);
  const editorialHeroRule = heroRules.find((rule) => rule.includes("grid-template-columns:48fr 52fr")) ?? "";
  assert.match(editorialHeroRule, /max-width:none/);
  assert.match(editorialHeroRule, /margin:0/);
  assert.match(editorialHeroRule, /padding:0/);
  assert.match(editorialHeroRule, /background:#1f3d33/);
  assert.match(editorialHeroRule, /grid-template-columns:48fr 52fr/);
  assert.match(editorialHeroRule, /gap:0/);
  assert.match(css, /\.heroImage\{[^}]*width:100%[^}]*max-width:none[^}]*height:100%/);
  assert.match(css, /\.heroImage img\{[^}]*mask-image:linear-gradient/);
  assert.match(css, /\.hero \.discoverButton\{[^}]*background:#f2ede4[^}]*color:#1f3d33/);
  assert.match(css, /@media \(max-width:850px\)\{[^}]*\.hero\{[^}]*background:#1f3d33/);
});
test("el buscador de aromas presenta un cuestionario editorial amplio sin alterar sus cuatro decisiones", async () => {
  const finder = await read("app/khora-aroma-finder.tsx");
  const css = await read("app/tienda/store.module.css");

  assert.match(finder, /aromaHero/);
  assert.match(finder, /Sensación/);
  assert.match(finder, /Familia aromática/);
  assert.match(finder, /Aromas que transforman tu bienestar/);
  assert.match(finder, /Inspirados en la naturaleza/);
  assert.match(finder, /Hogares más conscientes/);
  assert.match(css, /\.aromaHero\{/);
  assert.match(css, /\.aromaQuestionsGrid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.aromaBenefits\{/);
  assert.match(css, /prefers-reduced-motion:reduce\)[\s\S]*\.aromaHero/);
});
test("el hero de aromas centra el bloque editorial sobre la fotografía", async () => {
  const css = await read("app/tienda/store.module.css");
  const heroRule = /\.aromaHero\{([^}]*)\}/.exec(css)?.[1] ?? "";

  assert.match(heroRule, /display:flex/);
  assert.match(heroRule, /flex-direction:column/);
  assert.match(heroRule, /align-items:center/);
  assert.match(heroRule, /justify-content:center/);
  assert.match(heroRule, /text-align:center/);
});
test("el hero de aromas usa una fotografía editorial con desvanecido únicamente vertical", async () => {
  const css = await read("app/tienda/store.module.css");
  const heroRule = /\.aromaHero\{([^}]*)\}/.exec(css)?.[1] ?? "";

  assert.match(heroRule, /url\("\/khora-aroma-hero\.jpg"\)/);
  assert.match(heroRule, /linear-gradient\(0deg,rgba\(242,237,228,1\) 0%,rgba\(242,237,228,\.76\) 22%,rgba\(242,237,228,0\) 58%\)/);
  assert.doesNotMatch(heroRule, /linear-gradient\(90deg/);
});