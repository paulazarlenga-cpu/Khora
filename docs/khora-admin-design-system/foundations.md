# Fundamentos visuales

## Alcance

KHORA Administrador es un back-office operativo: debe permitir leer el estado del negocio, detectar excepciones y ejecutar acciones con confianza. La interfaz prioriza claridad, trazabilidad, densidad moderada y una sensación de herramienta estable. Esta página describe la identidad; los valores exactos y su correspondencia con CSS están en [design-tokens.md](design-tokens.md).

## Personalidad y principios

- **Clara:** una acción primaria, un resultado evidente y títulos descriptivos.
- **Serena:** fondos crema, superficies blancas y verdes profundos; el color intenso queda reservado para estados y acciones.
- **Operativa:** mostrar cantidad, unidad, fecha, costo y estado cerca del objeto que afectan.
- **Trazable:** no ocultar el origen de un dato ni inventar un estado visual sin respaldo en datos.
- **Consistente:** reutilizar componentes y no resolver un caso local cambiando la identidad global.

Evitar adornos que compitan con el dato, degradados decorativos, colores nuevos por módulo, sombras pesadas, exceso de mayúsculas y texto ambiguo como “Listo” cuando hace falta indicar qué ocurrió.

## Logo y marca

La implementación real está en `app/khora-logo.tsx` y `public/brand/`:

| Variante | Asset | Uso Admin |
| --- | --- | --- |
| Completo vertical | `khora-logo.svg` / `khora-logo-white.svg` (viewBox 240×170) | login, bienvenida y piezas con espacio vertical |
| Horizontal | `khora-logo-horizontal.svg` / `khora-logo-horizontal-white.svg` (viewBox 300×76) | navbar de escritorio, documentos y PDF |
| Isotipo | `khora-icon.svg` / `khora-icon-white.svg` (viewBox 64×64) | mobile, espacios reducidos, favicon y app icon |

`KhoraLogo` expone `variant` (`full`, `horizontal`, `icon`), `size` (`sm`, `md`, `lg`) y `theme` (`green`, `white`). Usar la versión blanca sobre el navbar verde y la versión verde sobre superficies claras. `favicon.svg`, `favicon-16.svg` y `app-icon.svg` son derivados para navegador y acceso directo; no sustituir el logo completo por ellos en una pantalla amplia.

Tamaños CSS actuales: horizontal `sm/md/lg` 100/120/140 px; full 170/200/220 px; icon 20/32/40 px. El navbar amplia el horizontal a 160×46 desde 1280 px y a 260×66 desde 1540 px. En mobile se usa isotipo de 32 px. El tamaño debe conservar legibilidad y área de seguridad, no fijarse por porcentaje visual.

Para PDF existe un helper vectorial en `app/khora-pdf.ts` con equivalentes de verde y dorado; mantenerlo coordinado con los assets SVG.

## Color

El verde KHORA estructura la navegación y las acciones principales. El dorado es acento de marca y puede señalar información destacada, nunca reemplazar al estado de error. Verde suave comunica disponibilidad o confirmación; ámbar, atención; rojo, riesgo o falta de stock; azul/teal, información secundaria. Siempre combinar color con texto, icono o posición: nunca comunicar un estado solo por color.

La paleta oficial semántica propuesta está en `design-tokens.md`. En el CSS actual convive con aliases históricos (`--forest`, `--terracotta`, `--red`) y colores funcionales azules; documentar la diferencia antes de unificar.

## Tipografía

El cuerpo usa `Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Muchos headings, valores destacados y títulos de tarjetas usan `Georgia` para el contraste editorial de KHORA. No afirmar que la interfaz es de una sola familia: la jerarquía actual es deliberadamente sans + serif.

Escala conceptual para nuevas vistas: display 36/600, H1 30/600, H2 24/600, H3 20/600, H4 18/600, cuerpo 15–16/400, label 14/500, small 12–13/400 y valores de dashboard 28–32. Verificar el componente existente antes de aplicar esta escala; el CSS legado contiene tamaños menores.

## Espaciado, superficies y profundidad

Usar la escala 4, 8, 12, 16, 24, 32, 48 y 64 px. Inputs y botones parten de 40–44 px de alto; el objetivo de interacción táctil es al menos 40 px. Las superficies principales son fondo crema, panel blanco y filas alternadas muy suaves. El borde es fino y de bajo contraste. Cards/panels usan radios 13–16 px según el componente; controles 9–10 px; pills 999 px.

La sombra debe sugerir separación, no elevar cada elemento. El token actual base es `0 10px 35px rgba(31,54,45,.06)`; la recomendación semántica para nuevas piezas es `0 2px 8px rgba(32,36,32,.05)`, con elevación hover solo cuando aporte feedback.

## Jerarquía y accesibilidad

Una pantalla debe leerse en este orden: breadcrumb y título, descripción, acción contextual, métricas, filtros, contenido, feedback. Mantener foco visible, `aria-label` en icon-only, `aria-selected` en tabs, `aria-busy` al cargar y `aria-invalid` en errores. No usar placeholder como único label. Los textos de estado deben seguir presentes aunque se quite el color.

## Voz y microcopy

El idioma es español rioplatense y directo: “Nueva venta”, “Guardar”, “Cancelar”, “Ver detalle”, “Poco stock”, “Agotado”, “No hay…”, “Cerrar”. Preferir verbos y contexto concretos. Los mensajes de error explican cómo corregir; los de éxito confirman la entidad afectada. Mantener acentos y unidades tal como se muestran en el dominio (`u.`, `ml`, fechas locales).

## Decisiones pendientes

La identidad ya está presente, pero la hoja global contiene dos generaciones de tokens y algunos componentes aún usan glyphs de texto (`⌕`, `⌄`, `•••`, `→`, `⚗`). Son oportunidades de unificación futura, no motivos para cambiar todas las pantallas durante una tarea local.
