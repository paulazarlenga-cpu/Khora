# Navegación

## Modelo actual

La configuración vive en `app/khora-data.ts`. `SectionId` contempla `inicio`, `ventas`, `pedidos`, `clientes`, `productos`, `fabricacion`, `stock`, `compras`, `proveedores`, `finanzas` y `calendario`.

La navegación primaria de escritorio muestra:

- Inicio
- Ventas
- Productos
- Compras
- Contactos: Clientes y Proveedores
- Producción: Fabricación y Stock
- Finanzas
- Calendario

Cada módulo usa el icono correspondiente de `moduleIcons`; los grupos muestran chevron y menú. La navegación lateral contiene la lista completa y aparece en tablet/mobile.

## Navbar de escritorio

`page.tsx` renderiza `desktop-navbar` sticky sobre fondo verde KHORA, logo horizontal blanco, enlaces con icono, grupos y perfil a la derecha. El navbar actual mide 68 px; el topbar de búsqueda y acciones queda debajo, con 58 px. Mantener contraste alto y un estado activo visible por fondo/underline, no solo por color.

## Sidebar, tablet y mobile

Hasta 1040 px se oculta el navbar de escritorio y aparece sidebar/topbar compacto. Entre 480 y 767 px se usa logo horizontal compacto; por debajo de 479 px se usa isotipo de 32 px y botón de menú. La navegación debe conservar el mismo orden y destinos; solo cambia la presentación.

## Topbar y acciones globales

El topbar ofrece búsqueda global (“Buscar cliente, producto o lote…”), acceso rápido de teclado, notificaciones y menú “Nuevo”. El menú de perfil muestra Paula / Administradora y opciones de configuración, perfil y cierre de sesión. No mover acciones de módulo al topbar global salvo que sean realmente globales.

## Rutas y `goTo`

La shell usa una navegación por sección; `goTo` mantiene la mayoría de módulos dentro de `/` y asigna `/calendario` al calendario. `SectionContent` decide el contenido en función del `SectionId`. Actualmente `pedidos` reutiliza `Sales` y no aparece como enlace primario independiente: es una decisión de implementación que debe considerarse antes de crear una nueva ruta.

## Breadcrumb y header

El breadcrumb identifica KHORA y el módulo; el H1 nombra el área y la descripción explica su propósito. El CTA del header debe ser único y contextual. No repetir “Nuevo” global y “Nuevo [entidad]” en el mismo nivel sin una razón clara.

## Navegación futura

Si se incorpora una sección, actualizar `SectionId`, `navigation`, `primaryNavigation`, `moduleIcons`, sidebar, permisos y documentación en conjunto. No crear un menú paralelo ni cambiar el orden global para resolver una pantalla aislada.
