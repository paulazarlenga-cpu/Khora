# Responsive

La interfaz conserva la misma jerarquía y el mismo lenguaje visual en cada viewport. Cambian navegación, columnas y densidad; no cambian significado, nombres de estado ni acción principal.

## Breakpoints observados

El CSS usa varios cortes (`1040`, `980`, `900`, `767/760`, `650`, `620`, `520`, `480/479`, `460`, `430`, `420`). Los tres comportamientos principales son:

| Viewport | Comportamiento |
| --- | --- |
| >1040 px | navbar de escritorio, contenido en grids y paneles amplios |
| 480–1040 px | sidebar/topbar compacto, grids que reducen columnas, logo horizontal compacto |
| <480 px | isotipo, menú móvil, layouts de una columna y acciones apiladas |

Hay cortes intermedios para formularios, cards, calendario, métricas y tablas; usar el breakpoint del componente en vez de agregar uno arbitrario.

## Logo

`KhoraLogo` responsive actual:

- Escritorio base: horizontal alrededor de 140×40 px.
- Desde 1280 px: alrededor de 160×46 px.
- Desde 1540 px: alrededor de 260×66 px para aprovechar el navbar ancho.
- Tablet: horizontal compacto de 120 px; entre 480–767 px, aproximadamente 110×30 px.
- Mobile <479 px: isotipo de 32 px.

Estas medidas son de CSS, no porcentajes; mantener proporción y área de seguridad.

## Layout y controles

El contenido usa `max-width:1680px` y padding fluido (`36px clamp(22px,4vw,54px) 70px`). Los grids de métricas/cards colapsan progresivamente; formularios pasan a una columna antes que el texto se comprima. Inputs y botones mantienen 40–44 px de alto y zonas táctiles cómodas.

En mobile el topbar permite que la búsqueda ocupe el ancho disponible y las acciones se apilen o pasen a menú. Los headers de paneles deben conservar título y CTA sin desbordar.

## Tablas, drawers y charts

Las tablas que necesitan más ancho usan wrapper con scroll horizontal; no forzar todas a cards si se pierde comparación entre filas. Drawers ocupan el ancho disponible y mantienen scroll interno. Los gráficos reducen etiquetas/densidad, pero conservan leyenda, periodo y unidad.

## Checklist de verificación

- ¿Se puede identificar la sección y la acción principal sin zoom?
- ¿El logo usado corresponde al contexto y sigue siendo legible?
- ¿Los filtros, botones y close tienen un target de al menos 40 px?
- ¿La tabla tiene estrategia de overflow y no corta datos?
- ¿El drawer/dialog no queda detrás del topbar y permite volver/cerrar?
- ¿El estado sigue comunicándose con texto además del color?

Probar especialmente 1440/1536 px, 1024 px, 768 px, 480 px y 375 px. No cambiar navegación global para corregir un único viewport: ajustar el componente responsable.
