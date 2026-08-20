# Estado de KHORA

## Implementado

- Sistema visual global, navegación lateral, cabecera, búsqueda y acciones rápidas.
- Inicio, Ventas, Pedidos, Clientes, Productos, Fabricación, Stock, Compras, Proveedores y Finanzas.
- Subáreas de recetas, combos, movimientos, gastos, ganancias, cuentas y reportes.
- Formularios laterales accesibles y diseño responsive.
- Entidades de pedidos, renglones, pagos, envíos, remitos, compras con múltiples ítems, auditoría y configuración.
- API para crear pedidos, cambiar estados, registrar pagos, gestionar envíos y emitir remitos inmutables.
- Datos de demostración separados de la persistencia real.
- Fase A de consolidación del inventario: categorías con prefijo, alta independiente de materias primas, unidades base compatibles, proveedor preferido, stock mínimo y notas.
- Ficha de materia prima con resumen, compras, movimientos y productos que la utilizan.
- Fase B: compras de materias primas con conversión a unidad base, movimiento atómico y costo promedio ponderado móvil.
- Fase C: alta de productos con receta por IDs reales, costo/margen estimados y stock inicial en cero.
- Fase D: simulación de fabricación y combos, validación de faltantes, lotes con cantidad inicial/disponible y costos congelados.
- Fase E: consumo FIFO de productos terminados, asignaciones por lote y costo histórico inmutable en ventas y combos.
- Fase F: relación pedido–venta idempotente, confirmación comercial sin consumo, entrega con FIFO y pagos sincronizados.
- Fase G: venta directa con múltiples productos o conceptos manuales, precio por lista del cliente, stock visible, cobro inicial y cálculo histórico de ganancia.
- Fase H: remitos y comprobantes internos no fiscales en PDF, snapshot, versiones, descarga privada y regeneración sin duplicar la venta.
- Migraciones aditivas `0009` a `0015`, validadas sobre D1 local junto con el esquema anterior.
- Suite estructural y funcional con 27 pruebas y compilación de producción satisfactoria.

## Reglas preservadas

- Los costos históricos de fabricación y venta se congelan.
- Las operaciones de stock generan movimientos.
- Las anulaciones financieras o de inventario conservan historial.
- Los productos con historial se archivan o desactivan.
- La ganancia se calcula con costo de productos vendidos y no con compras del período.
- Crear una materia prima no crea compras ni movimientos: nace con stock y costo en cero.
- El código de la materia prima debe respetar el prefijo de su categoría.
- Confirmar un pedido crea una sola venta, pero el stock se consume únicamente al entregar.
- Los pagos tienen una sola fuente económica y derivan los estados pendiente, parcial o pagado.
- Un error al generar un PDF no revierte ni repite la venta; sólo deja el documento disponible para regenerar.
- El comprobante generado es interno y no fiscal: no inventa CAE ni numeración tributaria.

## Pendiente de servicios externos

- Crear GitHub, Supabase y Vercel con la cuenta definida por la dueña.
- Decidir si la persistencia final continúa en Cloudflare D1 o se migra de forma controlada a Supabase/PostgreSQL.
- Conectar los listados históricos restantes a la base de producción y reemplazar sus datos de demostración.
- Configurar Supabase Auth y el acceso de administradora.
- Si se adopta Supabase, migrar fotos y PDFs desde el almacenamiento lógico actual hacia un bucket privado.
- Ejecutar una importación controlada de la información histórica.
