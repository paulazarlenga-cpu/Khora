# Componentes

Este inventario refleja lo que existe en el repositorio. La ruta principal es `app/`; no crear componentes con el mismo propósito en otra carpeta.

## Primitives de marca

### `Button` / `KhoraButton`

Archivo: `app/khora-button.tsx`. Variantes reales: `primary`, `success`, `secondary`, `neutral`, `danger`, `utility`. Tamaños: `lg`, `md`, `sm`, `xs`; también `iconOnly`, `fullWidth`, `loading` y `disabled`. El estado loading deshabilita el control, anuncia `aria-busy` y usa “Cargando…” si no se da otro label.

Usar `primary` para la acción principal de la vista, `secondary` para una acción alternativa, `neutral` para cancelar/volver/cerrar, `danger` para eliminar/anular y `utility` para filtros, overflow o acciones pequeñas. `success` queda para confirmaciones explícitamente positivas. No usar color de módulo como variante nueva.

La implementación moderna convive con aliases históricos (`primary-button`, `new-button`, `context-create`, `secondary-button`, `period-button`, `table-open-button`, `danger-button`) y botones raw. Antes de migrar uno, revisar sus estados y alcance.

### `KhoraIcon`

Archivo: `app/khora-icons.tsx`. Es una familia SVG inline de 24×24, `currentColor`, stroke 1.8, linecap/linejoin round. Incluye navegación (`home`, `cash`, `package`, `users`, `box`, `settings-automation`, `building-warehouse`, `shopping-cart`, `truck-delivery`, `chart-line`, `calendar`), acciones (`search`, `plus`, `check`, `pencil`, `trash`, `download`, `printer`, `arrow-left`, `x`, `eye`, `more-horizontal`, `filter`, `save`, `wallet`, `package-check`) y utilidades (`settings`, `bell`, `chevron-down`, `delivery`). Usar `aria-label` solo cuando el icono no sea decorativo.

Algunos flujos todavía imprimen glyphs (`⌕`, `⌄`, `•••`, `→`, `⚗`). No añadir más; la recomendación futura es migrar gradualmente a esta familia sin cambiar significado.

### `KhoraLogo`

Archivo: `app/khora-logo.tsx`. Variantes `full`, `horizontal`, `icon`; tamaños `sm`, `md`, `lg`; temas `green`, `white`. Usar el wrapper para conservar alt, tamaños y asset correctos. Ver [foundations.md](foundations.md).

## Estructura y datos

Los helpers están en `app/khora-sections.tsx` y se reutilizan en las vistas:

| Componente/helper | Responsabilidad | Regla |
| --- | --- | --- |
| `Panel` | section blanca con `panel-head`, título, subtítulo, acción y `panel-body` | usar para bloques de contenido de primer nivel |
| `Metric` | métrica de dashboard con tono, valor, detalle y flecha opcional | el valor debe tener unidad/contexto |
| `MiniStat` | tarjeta compacta con franja de tono | reservar para resumen secundario |
| `Badge` | pill de estado con punto y tono | acompañar con texto; no inventar estados |
| `Avatar` | iniciales o identidad de persona | usar para cliente/proveedor/perfil |
| `CellPerson` | nombre, contacto y metadato de tabla | mantiene jerarquía en celdas |
| `StockValue` | cantidad, unidad y barra de stock | mostrar mínimo/estado cerca cuando aplique |
| `Health` | indicador de salud/resumen | conservar su semántica de tono |
| `Tabs` | `role=tablist`, `aria-selected` y tab activo | una sola tab activa y destino claro |
| `Toolbar` | búsqueda y botones utility | búsqueda debe filtrar el conjunto visible |
| `DataTable` | wrapper `.data-table-wrap` + `.data-table` | permite scroll horizontal en viewport estrecho |
| `MonthlyChart` | comparación de ventas/compras | leyenda, periodo y unidades visibles |
| `MoreButton` | overflow con `Button` utility xs icon-only | requiere label accesible |

## Cards y paneles

`panel`, `product-card`, `mixture-card`, `report-card` y `mini-stat` son familias existentes, no intercambiables automáticamente. Panel y product card usan fondo blanco, borde fino, radio aproximado 13 px y sombra suave; report cards llegan a 16 px. Mantener padding y encabezado del componente que se extienda.

## Tablas

`DataTable` concentra header de bajo contraste, filas alternadas con `--table-row-alt`, hover de superficie y celdas de acción. La tabla debe conservar encabezados legibles, unidades y alineación consistente. En mobile, permitir scroll horizontal donde la tabla sea realmente tabular; no ocultar columnas críticas sin una vista de detalle.

## Estados de stock y badges

`Badge` recibe tonos `success`, `warning`, `danger`, `info`, `neutral`. Stock terminado/material/mezcla se calcula con helpers de dominio y se expresa como disponible/normal, poco stock/bajo o agotado/crítico. El color es un refuerzo, no la única señal. Altura objetivo de badges: 24–28 px, radio pill.

## Formularios, drawers y dialogs

Los formularios usan `Field`, `.field`, `.form-grid`, `.drawer-form` y controles con foco visible. Las operaciones de creación/edición extensas se presentan en drawers (`drawer-layer`, `drawer`, `inventory-form-drawer`); confirmaciones, detalles breves y cancelaciones usan dialogs con backdrop y `role=dialog`. No existe todavía un `Modal` universal: los dialogs son funciones por flujo con clases compartidas.

Familias existentes incluyen `ProductFormDialog`, `MaterialFormDialog`, `CategoryFormDialog`, `PurchaseFormDialog`, `DirectSaleFormDialog`, `ContactEditDialog`, `SupplierDetail`, `ProductStockDetail`, `BatchDetail`, `SaleDetailDialog` y las confirmaciones de borrar/anular. Antes de crear un formulario, localizar la familia más cercana.

## Navegación y acciones contextuales

`page.tsx` compone navbar, topbar, búsqueda global, notificaciones, menú “Nuevo”, perfil y `SectionContent`. Acciones de encabezado deben vivir en `panel-head` o en el header de la página; no duplicar un CTA global dentro de cada card si ya existe uno contextual.

## Accesibilidad y estados

Todos los componentes interactivos nuevos necesitan focus-visible, disabled, loading y feedback de error. Icon-only debe tener label; dialogs deben cerrar de manera predecible y devolver el foco; tabs deben exponer estado. Ver contrato completo en [states-and-alerts.md](states-and-alerts.md).

## Diferencias conocidas

- Existe una primitive moderna, pero no todo el JSX histórico la usa.
- `app/khora-forms.css` existe, aunque el layout importa `globals.css`; comprobar si una clase está activa antes de reutilizarla.
- La aplicación no tiene una única abstracción universal de modal, skeleton o `StatusBadge`; los equivalentes actuales son `Badge`, dialogs específicos y loading textual.
