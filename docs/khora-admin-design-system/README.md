# KHORA Admin Design System v1.0

Documentación oficial de la identidad y los patrones de **KHORA Administrador**.

Estado: documentación inicial alineada con la implementación existente · versión 1.0 · 2 de septiembre de 2026.

> Esta carpeta describe el sistema visual y de interacción del back-office de KHORA. No corresponde a KHORA Tienda.

## Antes de desarrollar una nueva pantalla

### ANTES DE DESARROLLAR UNA NUEVA PANTALLA

1. Leer este índice y la página específica del patrón que se necesita.
2. Buscar en `app/` un componente, helper, clase CSS o flujo equivalente.
3. Reutilizar primero; extender un componente existente si falta una variante; crear algo nuevo únicamente cuando no exista un equivalente razonable.
4. Usar los tokens semánticos de [design-tokens.md](design-tokens.md) y los componentes de [components.md](components.md).
5. Mantener la jerarquía, navegación, responsive y microcopy definidos en [patterns.md](patterns.md), [navigation.md](navigation.md) y [responsive.md](responsive.md).
6. Comprobar estados normal, hover, pressed, focus, loading, disabled, vacío y error.
7. Validar en desktop, tablet y mobile; registrar cualquier diferencia intencional antes de publicarla.

## Principios obligatorios

> Una funcionalidad nueva se adapta a KHORA. KHORA no cambia su identidad visual cada vez que se agrega una funcionalidad.

> Antes de crear cualquier componente o pantalla nueva en KHORA Administrador, revisar los componentes existentes y reutilizar el KHORA Admin Design System. No introducir colores, tipografías, radios, sombras, iconos, botones, inputs, badges, tablas o patrones nuevos si ya existe un equivalente.

> No modificar el comportamiento ni la identidad visual global para resolver un problema local.

## Índice

- [Fundamentos](foundations.md): personalidad, logo, color, tipografía, espaciado, superficie y accesibilidad.
- [Componentes](components.md): inventario real de primitives, clases y componentes de `app/`.
- [Patrones](patterns.md): composición de pantallas, filtros, CRUD, formularios, tablas y microcopy.
- [Navegación](navigation.md): navbar, sidebar, grupos, topbar, perfil y destinos.
- [Estados y alertas](states-and-alerts.md): estados de stock, tonos, centro de notificaciones y feedback.
- [Responsive](responsive.md): breakpoints, tamaños de logo y comportamiento por viewport.
- [Reglas para Codex](codex-rules.md): flujo de trabajo para construir sin fragmentar el sistema.
- [Tokens](design-tokens.md): escala oficial propuesta y correspondencia con los tokens actuales.

## Cómo leer esta documentación

El código actual es la fuente de verdad del comportamiento. Las reglas semánticas de esta carpeta son la fuente de verdad para nuevas decisiones de interfaz. Cuando una recomendación difiere de una clase heredada, se documenta la diferencia: esta entrega no hace un reemplazo masivo ni altera pantallas existentes.

### Estado actual de implementación

- La aplicación usa Next.js/React con Tailwind v4 disponible vía `@import "tailwindcss"` y PostCSS; no existe un `tailwind.config.*` propio.
- La mayor parte del lenguaje visual activo está en `app/globals.css` (835 líneas), junto con componentes React en `app/khora-*.tsx`.
- Existe `app/khora-forms.css`, pero `app/layout.tsx` importa explícitamente `app/globals.css`; verificar el alcance antes de tomar esa hoja como fuente activa.
- Hay una primitive moderna (`Button`, `KhoraIcon`, `KhoraLogo`) conviviendo con aliases y botones JSX históricos. Esta documentación registra ambos para evitar crear una tercera variante.
- Las pantallas, rutas, lógica de negocio, base de datos, Supabase y dependencias no fueron modificadas para crear esta documentación.

## Mantenimiento

Actualizar los archivos de esta carpeta cuando una decisión visual sea intencional y reusable. Incluir la razón, el alcance y los componentes afectados. Si la necesidad es local, resolverla localmente y no cambiar un token global sin revisión.
