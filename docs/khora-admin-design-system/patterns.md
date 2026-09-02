# Patrones de interfaz

## Composición estándar de una pantalla

1. **Contexto:** breadcrumb `KHORA / MÓDULO` y título de página.
2. **Orientación:** descripción breve que explica qué se controla.
3. **Acción:** CTA contextual en el header solo si corresponde a toda la vista.
4. **Resumen:** métricas o mini stats con dato, unidad y detalle.
5. **Exploración:** toolbar con búsqueda, filtros y periodo.
6. **Trabajo:** panel, cards, tabla o calendario.
7. **Feedback:** toast, estado vacío, loading o alerta contextual.

No repetir la misma métrica en el heading, una card y una tabla sin aportar contexto nuevo. Una cifra puede aparecer en un resumen y en su detalle, pero debe conservar etiqueta y unidad.

## Dashboard e inicio

El inicio usa un **Centro de operaciones**: saludo, fecha de datos, contador de asuntos, cards de compras/ventas/stocks/materiales, columnas de prioridad, gráfico “Ventas vs Compras”, productos destacados, clientes a recuperar y compras recientes. La prioridad se entiende por contenido y tono: crítico primero, atención después, información al final.

El contador “asuntos para revisar” responde a la suma de operaciones que requieren atención (por ejemplo, stocks críticos/bajos y otros pendientes calculados por `getOperationalOverview`); no es un registro separado. No agregar otro panel que duplique ese mismo resumen sin una diferencia funcional.

## Listados y CRUD

Un listado estándar combina métricas opcionales, toolbar y panel con título y cantidad visible. La búsqueda filtra por los campos anunciados en el placeholder (nombre, código, contacto, producto, lote, etc.). Un filtro debe modificar el conjunto visible y actualizar el contador; si no puede hacerlo, no debe presentarse como interactivo.

Crear/editar se hace desde el CTA principal y un drawer; ver detalle se abre en drawer/dialog o en el detalle del objeto. Eliminar/anular requiere confirmación explícita, explica el impacto y distingue una reversión de un borrado definitivo.

## Búsqueda y filtros

- Placeholder específico del dominio: “Buscar producto o código…”, “Buscar proveedor, contacto o localidad…” o equivalente.
- Agrupar filtros por dimensión: categoría, estado, fecha, lista de precios, proveedor.
- “Todas…” es el estado inicial; al elegir una opción, conservarla visible y permitir volver a todas.
- Cuando el dominio usa fechas, ofrecer presets y carga manual si se necesita precisión.
- No ocultar el resultado de un filtro bajo un cambio de ruta inesperado.

## Formularios

Ordenar campos de lo general a lo específico, agrupar por entidad y mostrar unidad/formato junto al input. Los labels son persistentes; placeholders son ejemplos. Mostrar error junto al campo, resumir el error en el contexto de la acción y mantener datos ingresados cuando sea seguro.

Botones de drawer: acción primaria “Guardar/Confirmar” y neutral “Cancelar/Cerrar”. La acción destructiva debe separarse visualmente y nombrar el objeto (“Eliminar proveedor”). En loading, conservar el ancho y deshabilitar doble envío.

## Drawers, dialogs y menús

Drawer para tareas largas o formularios; dialog para confirmación, detalle corto y decisiones irreversibles. Mantener backdrop, encabezado con título, cierre accesible, foco y scroll interno. Menús desplegables deben abrir cerca del control, tener opciones accionables y cerrarse al elegir o perder foco.

## Tablas y detalle

Las tablas muestran la entidad principal primero, luego contacto/fecha, cantidades, costo, estado y acciones. Mantener header visible, zebra sutil y hover. Acciones frecuentes (“Ver ficha”) tienen texto; overflow usa icon-only con label. En pantallas estrechas, scroll horizontal o detalle por fila; no comprimir hasta volver ilegible.

## Stock, compras y ventas

Mostrar cantidad con unidad, mínimo, estado y costo unitario. Una venta, compra, fabricación o cancelación puede generar movimientos auditables; la UI debe distinguir operación real, reversión y corrección. No presentar stock calculado como confirmado antes de guardar/confirmar.

## Alertas y feedback

El feedback combina tono, título, detalle y acción (“Revisar”, “Ver ficha”, “Corregir”). Una alerta crítica debe poder rastrearse a la entidad. Los toasts informan resultado inmediato; el Centro de operaciones/notificaciones agrupa asuntos persistentes. Ver [states-and-alerts.md](states-and-alerts.md).

## Vacío y loading

Un vacío útil dice qué está vacío y qué hacer (“No hay proveedores activos. Crear proveedor” cuando corresponda). El loading actual usa “Actualizando…” y estados de botón; no existe skeleton universal. No inventar skeletons distintos por pantalla sin acordar un patrón.

## Microcopy y jerarquía

Usar frases cortas, verbos en infinitivo para acciones y español rioplatense. Evitar “Aceptar” sin contexto, “Procesar” cuando se puede decir “Confirmar compra” y mensajes que oculten el dato afectado. Priorizar título > valor > estado > acción; usar el color solo como refuerzo.

## Regla de alcance

Una necesidad local se resuelve en el componente o pantalla local. Cambiar `globals.css`, navegación, tokens o comportamiento de varias rutas requiere una decisión explícita y pruebas de regresión.
