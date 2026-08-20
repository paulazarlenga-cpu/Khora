# KHORA — arquitectura Cloudflare D1

KHORA usa exclusivamente el binding `DB` de Cloudflare D1. No usa Google Sheets, AppSheet, `localStorage`, memoria del navegador ni datos precargados.

## Tablas y relaciones

- Maestros: `clients`, `suppliers`, `categories` y `code_base`.
- Insumos: `raw_materials` pertenece a `code_base` y opcionalmente a `categories`; `raw_material_purchases` referencia materia prima y proveedor.
- Productos: `products` pertenece a `code_base` y puede ser `MANUFACTURED` o `COMBO`.
- Recetas: `recipes` pertenece a un producto; `recipe_items` une receta con materias primas.
- Combos: `combos` pertenece a un producto; `combo_recipe_items` une el combo con sus productos componentes.
- Producción: `manufacturing_batches` y `manufacturing_materials` congelan cantidades y costos consumidos.
- Armado: `combo_batches` y `combo_batch_items` congelan cantidades y costos de productos componentes.
- Ventas: `sales` referencia cliente; `sale_items` congela precio, costo y totales de cada renglón.
- Gestión: `expenses`, `stock_movements`, `monthly_profits` y `profit_history`.

Todas las entidades poseen un ID interno. Los códigos y nombres visibles importantes tienen restricciones únicas. Las claves foráneas protegen las relaciones y los `CHECK` impiden cantidades, costos o saldos negativos.

## Operaciones transaccionales

La API ejecuta cada operación compuesta mediante `DB.batch`, que D1 trata como un lote transaccional:

1. Una compra crea el comprobante, incrementa la materia prima, actualiza su costo actual y registra el movimiento.
2. Una fabricación valida la receta y existencias, congela el costo de cada materia prima, descuenta insumos, incrementa producto y registra todos los movimientos.
3. Un armado de combo valida componentes, congela costos, descuenta productos, incrementa combo y registra movimientos.
4. Una venta valida stock, congela precio y costo, descuenta productos, registra movimientos y recalcula el mes.

`operation_key` agrupa todas las filas generadas por una misma operación y evita duplicados de cabecera.

## Costos e historial

- `current_cost_cents` es el costo vigente de la materia prima según la última compra.
- `estimated_cost_cents` es el costo vigente calculado del producto o combo.
- Los detalles de fabricación, combo y venta usan columnas `frozen_*`; una compra futura no modifica resultados históricos.
- `monthly_profits` conserva el último cálculo por mes.
- Antes de recalcular un mes, su versión anterior se copia a `profit_history`.

## Migración y ejecución local

La migración está en `drizzle/0001_khora_core.sql`. Fue aplicada a la D1 local con Wrangler y ejecutó 27 sentencias correctamente. La base local se conserva en `.wrangler/state` y sobrevivió una prueba de reinicio del servidor.

El servidor local se inicia con `pnpm run dev` y escucha en `http://localhost:3000/`. No se realizó ninguna publicación.
