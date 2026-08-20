# KHORA

Sistema interno de gestión para un emprendimiento de productos aromáticos y decoración.

## Qué incluye

- Dashboard con ventas, ganancia, alertas, productos destacados y clientes para recuperar.
- Ventas, pedidos con vista Kanban, clientes y proveedores.
- Productos, recetas, combos, fabricación por lotes y costos históricos.
- Stock separado entre productos terminados y materias primas, con movimientos auditables.
- Compras, gastos, cuentas por cobrar/pagar, ganancias y reportes.
- Modelo persistente para pagos, envíos, remitos, compras con múltiples ítems y auditoría.
- Diseño responsive para computadora, tablet y celular.

La interfaz utiliza datos ficticios realistas mientras se completa la conexión con las cuentas de producción. La API y el esquema D1 existentes se conservan como entorno local de desarrollo. La migración final a Supabase/PostgreSQL se realizará al crear el proyecto externo.

## Desarrollo local

Requiere Node.js 22.13 o posterior.

```bash
pnpm install
pnpm dev
```

## Verificación

```bash
pnpm lint
pnpm test
```

`pnpm test` compila la aplicación y verifica las áreas principales, el modelo relacional, los flujos auditables y la adaptación responsive.

## Datos y migraciones

- Esquema Drizzle: `db/schema.ts`.
- Migraciones actuales: `drizzle/0001_*.sql` a `drizzle/0015_*.sql`.
- Acceso actual: binding D1 `DB`, declarado en `.openai/hosting.json`.
- No se usan `localStorage` ni `sessionStorage` como fuente de verdad.

No aplicar migraciones destructivas ni importar información real sin una copia de seguridad y aprobación explícita.

## Próxima conexión externa

Cuando estén disponibles las sesiones de la cuenta administradora de la dueña:

1. Crear o vincular el repositorio de GitHub.
2. Crear el proyecto de Supabase y convertir el esquema SQLite a PostgreSQL.
3. Configurar autenticación y variables de entorno.
4. Importar primero datos de prueba y validar reglas de stock/costos.
5. Desplegar en Vercel.
