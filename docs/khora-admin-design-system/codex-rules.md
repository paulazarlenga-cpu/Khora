# Reglas de trabajo para Codex

Estas reglas convierten el sistema visual en una lista operativa para cualquier cambio futuro en KHORA Administrador.

## Preflight obligatorio

1. Leer `README.md` y la página del patrón involucrado.
2. Inspeccionar `app/page.tsx`, `app/khora-data.ts`, `app/khora-sections.tsx`, `app/khora-button.tsx`, `app/khora-icons.tsx`, `app/khora-logo.tsx` y `app/globals.css` según el alcance.
3. Buscar con `rg` el texto, clase, variante o flujo similar antes de escribir JSX/CSS.
4. Confirmar si el comportamiento vive en una ruta, sección, helper de dominio o API; no duplicar la lógica para “hacer funcionar” una pantalla.
5. Identificar impacto responsive, accesibilidad, alertas y navegación.

## Orden de decisión

**Reutilizar > extender > crear.**

- Reutilizar `Button`, `KhoraIcon`, `KhoraLogo`, `Panel`, `Badge`, `Tabs`, `Toolbar` y `DataTable` cuando el propósito coincida.
- Extender con una prop/variante solo si la nueva semántica es reutilizable y no rompe llamadas existentes.
- Crear una pieza nueva únicamente si no existe equivalente; documentar por qué y sus estados.

Antes de agregar un botón, input, dropdown, badge, card, tabla, modal o icono, buscar el equivalente existente. No crear una abstracción llamada `StatusBadge` o `Modal` por supuesto: hoy los equivalentes reales son `Badge` y dialogs específicos.

## CSS y tokens

- Preferir tokens/clases existentes de `globals.css`; no pegar hex, sombra o radio aislado.
- No introducir una tercera paleta, tipografía, familia de iconos o escala de spacing.
- Recordar que la hoja contiene aliases históricos y una primitive moderna; seleccionar el selector correcto y registrar diferencias.
- `app/khora-forms.css` existe, pero no se debe asumir que está importado globalmente: confirmar el alcance.
- Tailwind v4 está disponible por CSS/PostCSS; no inventar un `tailwind.config.*` para una necesidad puntual.

## Comportamiento

- No cambiar rutas, datos, Supabase, movimientos, FIFO, costos o auditoría para resolver un problema visual.
- No hacer que una preview mueva stock ni presentar un cálculo como confirmado antes de la acción real.
- Las eliminaciones, cancelaciones y reversiones deben conservar el contrato del dominio y su confirmación.
- Un contador o alerta debe provenir de la misma fuente de datos que el detalle.

## Accesibilidad y responsive

Verificar keyboard/focus-visible, labels persistentes, `aria-label` en icon-only, `aria-selected`, `aria-busy`, `aria-invalid` y `role=dialog`. Probar los cinco anchos recomendados en [responsive.md](responsive.md). Mantener targets táctiles de 40–44 px y estrategia de overflow para tablas.

## Validación antes de entregar

1. Ejecutar `git diff --check`.
2. Ejecutar lint/build o la validación proporcional al cambio.
3. Revisar que solo se hayan tocado los archivos autorizados (`git diff --name-only`).
4. Comprobar estados normal, hover, pressed, focus, loading, disabled, vacío y error.
5. Si se publica, registrar commit, versión y URL; no declarar deploy exitoso sin verificar su estado.

## Fuente de verdad y documentación

El comportamiento vigente se verifica en código. Las nuevas decisiones visuales se comparan con este Design System. Si aparece una inconsistencia, documentarla y proponer una migración por familia; no corregirla silenciosamente desde una pantalla local.

## Fuera de alcance

Este sistema es exclusivamente para KHORA Administrador. No aplicar estas reglas a KHORA Tienda sin crear y aprobar un sistema separado. No modificar pantallas, lógica, base de datos, dependencias ni configuraciones globales como parte de una actualización documental.
