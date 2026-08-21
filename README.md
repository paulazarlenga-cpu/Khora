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

La interfaz conserva datos ficticios realistas en las secciones que todavía no tienen carga productiva. La API utiliza PostgreSQL mediante el Transaction pooler de Supabase y el acceso está protegido con Supabase Auth.

## Desarrollo local

Requiere Node.js 22.13 o posterior.

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Completá en `.env.local`:

- `DATABASE_URL`, con la conexión privada del Transaction pooler de Supabase.
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, desde Connect > Framework > Next.js.
- `KHORA_ALLOWED_EMAIL`, con el único correo administrador autorizado.

El archivo local está excluido de Git y nunca debe subirse al repositorio.

## Verificación

```bash
pnpm lint
pnpm test
pnpm check:db
```

`pnpm test` compila la aplicación y verifica las áreas principales, el modelo relacional, los flujos auditables y la adaptación responsive.

## Datos y migraciones

- Esquema histórico D1/SQLite: `db/schema.ts` y `drizzle/0001_*.sql` a `drizzle/0015_*.sql`.
- Migración consolidada de producción: `supabase/migrations/202608200001_khora_initial.sql`.
- Acceso de producción: PostgreSQL de Supabase mediante `DATABASE_URL` y consultas preparadas desactivadas para compatibilidad con el Transaction pooler.
- Las 39 tablas públicas tienen Row Level Security habilitado y no exponen políticas anónimas.
- Supabase Auth mantiene la sesión en cookies y protege tanto las pantallas como `/api/khora`.
- No existe registro público: las cuentas se administran desde Supabase y se valida el correo permitido.
- Supabase Storage usa los buckets privados `product-images` y `business-documents`, con políticas exclusivas para la administradora.
- No se usan `localStorage` ni `sessionStorage` como fuente de verdad.

No aplicar migraciones destructivas ni importar información real sin una copia de seguridad y aprobación explícita.

## Próximos pasos de producción

1. Retirar los datos ficticios restantes o reemplazarlos por carga real.
2. Configurar variables privadas y públicas en Vercel.
3. Importar datos, validar stock/costos y desplegar.
