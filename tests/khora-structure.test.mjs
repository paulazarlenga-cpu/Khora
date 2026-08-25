import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("incluye todas las áreas principales del negocio", async () => {
  const [data, sections] = await Promise.all([
    read("app/khora-data.ts"),
    read("app/khora-sections.tsx"),
  ]);
  for (const area of ["inicio", "ventas", "clientes", "productos", "fabricacion", "stock", "compras", "proveedores", "finanzas", "calendario"]) {
    assert.match(data, new RegExp(`id: "${area}"`));
  }
  for (const screen of ["Dashboard", "Sales", "Customers", "Products", "Manufacturing", "Stock", "Purchases", "Suppliers", "Finance", "CalendarPage"]) {
    assert.match(sections, new RegExp(`function ${screen}\\b`));
  }
  assert.doesNotMatch(data, /\{ id: "pedidos", label:/);
  assert.doesNotMatch(sections, /function Orders\b/);
});

test("el modelo cubre pedidos, pagos, envíos, remitos y auditoría", async () => {
  const [schema, migration] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0005_khora_orders_payments_shipping.sql"),
  ]);
  for (const table of ["orders", "order_items", "payments", "shipments", "delivery_notes", "purchase_orders", "purchase_order_items", "audit_logs", "app_settings"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(schema, /export const orders = sqliteTable/);
  assert.match(schema, /export const auditLogs = sqliteTable/);
  assert.match(migration, /PRAGMA optimize/);
});

test("los flujos delicados dejan auditoría y validan estados", async () => {
  const route = await read("app/api/khora/route.ts");
  for (const action of ["save_order", "set_order_status", "register_payment", "save_shipment", "issue_delivery_note"]) {
    assert.match(route, new RegExp(`action==="${action}"`));
  }
  assert.match(route, /INSERT INTO audit_logs/);
  assert.match(route, /CANCELLED/);
});

test("la interfaz es responsive y no usa almacenamiento del navegador", async () => {
  const [page, sections, css] = await Promise.all([
    read("app/page.tsx"),
    read("app/khora-sections.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(page, /aria-label="Búsqueda global"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(sections, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(sections, /stock-chip/);
  assert.doesNotMatch(`${page}\n${sections}`, /localStorage|sessionStorage/);
});

test("la navegación desktop es horizontal y Calendario es un módulo independiente", async () => {
  const [page, sections, data, css] = await Promise.all([
    read("app/page.tsx"),
    read("app/khora-sections.tsx"),
    read("app/khora-data.ts"),
    read("app/globals.css"),
  ]);
  assert.match(page, /className="desktop-navbar"/);
  assert.match(css, /\.desktop-navbar\{[^}]*position:sticky/);
  assert.doesNotMatch(sections, /type OrderView/);
  assert.match(sections, /section === "calendario"/);
  assert.match(data, /id: "calendario", label: "Calendario"/);
  assert.doesNotMatch(page, /<button title="Configuración"/);
  assert.match(sections, /event\.date === key/);
  assert.doesNotMatch(sections, /isOrderOverdue/);
});

test("la operación reutiliza datos reales para agenda, alertas y búsqueda sin exponer Pedidos", async () => {
  const [page, sections, operations, data] = await Promise.all([
    read("app/page.tsx"),
    read("app/khora-sections.tsx"),
    read("app/khora-operations.ts"),
    read("app/khora-data.ts"),
  ]);
  assert.match(operations, /getOperationalOverview/);
  assert.match(operations, /searchKhora/);
  assert.doesNotMatch(operations, /getOrderTimeline/);
  for (const category of ["Clientes", "Productos", "Materias primas", "Lotes", "Proveedores"]) {
    assert.match(operations, new RegExp(`category: "${category}"`));
  }
  assert.doesNotMatch(operations, /category: "Pedidos"/);
  assert.match(page, /GlobalSearchPalette/);
  assert.match(page, /NotificationCenter/);
  assert.match(page, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(sections, /operations-center/);
  assert.doesNotMatch(sections, /set_order_status/);
  assert.match(data, /history:/);
});

test("la escala visual usa tokens compartidos y breakpoints de notebook", async () => {
  const css = await read("app/globals.css");
  for (const token of ["--text-meta", "--text-small", "--text-body", "--text-nav", "--text-section", "--text-value", "--navbar-height"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /--navbar-height:80px/);
  assert.match(css, /@media\(max-width:1539px\) and \(min-width:1280px\)/);
  assert.doesNotMatch(css, /\bzoom\s*:|transform\s*:\s*scale\(/);
});

test("la Fase 2 centraliza preparación, fabricación, combos y compras", async () => {
  const [sections, planning, data] = await Promise.all([
    read("app/khora-sections.tsx"),
    read("app/khora-planning.ts"),
    read("app/khora-data.ts"),
  ]);
  for (const service of ["analyzeOrder", "getProductionPlan", "getPurchaseNeeds", "getComboBreakdown"]) {
    assert.match(planning, new RegExp(`export function ${service}\\b`));
  }
  assert.match(planning, /Math\.max\(required - product\.stock, 0\)/);
  assert.match(planning, /minimum \+ requiredForPlan - material\.stock/);
  assert.match(sections, /Confirmar fabricación/);
  assert.match(sections, /Planificador/);
  assert.match(sections, /Necesidades de compra/);
  assert.match(sections, /Ver trazabilidad/);
  assert.match(data, /comboDefinitions/);
  assert.match(data, /materialComponents/);
});

test("los combos admiten packaging con trazabilidad histórica y migración aditiva", async () => {
  const [schema, migration, route] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0007_khora_combo_materials.sql"),
    read("app/api/khora/route.ts"),
  ]);
  assert.match(schema, /export const comboMaterialItems = sqliteTable/);
  assert.match(schema, /export const comboBatchMaterials = sqliteTable/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS combo_material_items/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS combo_batch_materials/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(route, /materialItems/);
  assert.match(route, /INSERT INTO combo_batch_materials/);
  assert.match(route, /action==="assemble_combo"/);
});

test("la Fase 3 centraliza clientes, recuperación, rentabilidad y simulaciones", async () => {
  const [sections, salesService, data] = await Promise.all([
    read("app/khora-sections.tsx"),
    read("app/khora-sales.ts"),
    read("app/khora-data.ts"),
  ]);
  for (const service of ["getCustomerInsight", "getRecoveryCustomers", "getProductProfitability", "recommendedPrice", "simulateMaterialIncrease", "buildWhatsAppMessage"]) {
    assert.match(salesService, new RegExp(`export function ${service}\\b`));
  }
  assert.match(salesService, /cost \/ \(1 - safeMargin \/ 100\)/);
  assert.match(sections, /FICHA DEL CLIENTE/);
  assert.match(sections, /Para recuperar/);
  assert.match(sections, /WhatsAppComposer/);
  assert.match(sections, /RENTABILIDAD REAL/);
  assert.match(sections, /Simular precio/);
  assert.match(data, /customerPurchases/);
});

test("las listas de precios son aditivas y preservan precios históricos", async () => {
  const [schema, migration, route] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0008_khora_customer_sales.sql"),
    read("app/api/khora/route.ts"),
  ]);
  assert.match(schema, /export const priceLists = sqliteTable/);
  assert.match(schema, /export const priceListItems = sqliteTable/);
  assert.match(schema, /priceListId:integer\("price_list_id"\)/);
  assert.match(migration, /ALTER TABLE clients ADD COLUMN price_list_id/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS price_list_items/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(route, /resolved_price_cents/);
  assert.match(route, /frozen_unit_price_cents/);
  assert.match(route, /action==="save_price_list"/);
});

test("la Fase 4 centraliza caja y cierre mensual sin duplicar contabilidad", async () => {
  const [sections, finance, data, route] = await Promise.all([
    read("app/khora-sections.tsx"),
    read("app/khora-finance.ts"),
    read("app/khora-data.ts"),
    read("app/api/khora/route.ts"),
  ]);
  for (const service of ["getCashPanel", "getMonthlyClose", "getAvailableClosures"]) {
    assert.match(finance, new RegExp(`export function ${service}\\b`));
  }
  assert.match(finance, /incoming - outgoing/);
  assert.match(finance, /grossProfit - month\.expenses/);
  assert.match(sections, /PANEL DE CAJA/);
  assert.match(sections, /CIERRE MENSUAL/);
  assert.match(sections, /Resultado histórico protegido/);
  assert.match(data, /cashTransactions/);
  assert.match(data, /monthlyBusinessDetails/);
  assert.match(route, /entity==="cash_summary"/);
  assert.match(route, /entity==="monthly_close"/);
});

test("caja usa fechas efectivas y evita duplicar compras vinculadas a gastos", async () => {
  const route = await read("app/api/khora/route.ts");
  assert.match(route, /p\.paid_at occurred_at/);
  assert.match(route, /e\.raw_material_purchase_id IS NULL/);
  assert.match(route, /financial_payment_events/);
  assert.match(route, /PURCHASE_PAYMENT/);
  assert.match(route, /EXPENSE_PAYMENT/);
  assert.match(route, /frozen_unit_price_cents/);
  assert.match(route, /frozen_unit_cost_cents/);
});

test("la Fase 5 unifica el calendario global con capas operativas reutilizables", async () => {
  const [sections, calendar, route, calendarPage] = await Promise.all([
    read("app/khora-sections.tsx"),
    read("app/khora-calendar.ts"),
    read("app/api/khora/route.ts"),
    read("app/calendario/page.tsx"),
  ]);
  for (const layer of ["manufacturing", "purchases", "payments"]) {
    assert.match(calendar, new RegExp(`\\"${layer}\\"`));
  }
  assert.doesNotMatch(calendar, /"orders"|"deliveries"/);
  assert.match(calendar, /export function getBusinessCalendarEvents/);
  assert.match(calendar, /export function countCalendarEvents/);
  assert.match(sections, /CALENDARIO DEL NEGOCIO/);
  assert.match(sections, /calendar-layers/);
  assert.match(sections, /function BusinessCalendar/);
  assert.match(sections, /onNavigate\("fabricacion", reference\)/);
  assert.match(sections, /onNavigate\("compras", reference\)/);
  assert.match(sections, /onNavigate\("ventas", reference\)/);
  assert.match(calendarPage, /export \{ default \} from "\.\.\/page"/);
  assert.match(route, /entity==="calendar_events"/);
});

test("el calendario integral deriva eventos de las tablas operativas sin tabla paralela", async () => {
  const [route, schema] = await Promise.all([read("app/api/khora/route.ts"), read("db/schema.ts")]);
  assert.doesNotMatch(route.match(/if\(entity==="calendar_events"\)[\s\S]*?if\(entity==="cash_summary"\)/)?.[0] ?? "", /FROM orders o/);
  assert.match(route, /FROM manufacturing_batches mb/);
  assert.match(route, /FROM purchase_orders po/);
  assert.match(route, /FROM payments p/);
  assert.doesNotMatch(schema, /calendar_events = sqliteTable/);
});

test("la Fase A amplía los maestros existentes sin crear un inventario paralelo", async () => {
  const [schema, migration, inventory] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0009_khora_inventory_foundation.sql"),
    read("app/khora-inventory.ts"),
  ]);
  assert.match(schema, /prefix:text\("prefix"\)/);
  assert.match(schema, /preferredSupplierId:integer\("preferred_supplier_id"\)/);
  assert.match(schema, /notes:text\("notes"\)/);
  assert.match(migration, /ALTER TABLE categories ADD COLUMN prefix/);
  assert.match(migration, /ALTER TABLE raw_materials ADD COLUMN preferred_supplier_id/);
  assert.doesNotMatch(migration, /CREATE TABLE/);
  for (const service of ["normalizeUnit", "convertUnit", "suggestMaterialCode", "materialStockStatus", "productsUsingMaterial"]) {
    assert.match(inventory, new RegExp(`export function ${service}\\b`));
  }
});

test("crear una materia prima comienza en cero y no simula una compra", async () => {
  const [sections, route] = await Promise.all([
    read("app/khora-sections.tsx"),
    read("app/api/khora/route.ts"),
  ]);
  assert.match(sections, /Nueva materia prima/);
  assert.match(sections, /Stock inicial: 0/);
  assert.match(sections, /Crear el insumo no registra una compra ni modifica existencias/);
  assert.match(sections, /Productos que la utilizan/);
  assert.match(route, /action==="save_material"/);
  assert.match(route, /current_stock,minimum_stock,current_cost_cents,notes\) VALUES\(\(SELECT id FROM code_base WHERE code=\?\),\?,\?,\?,0,\?,0,\?\)/);
  assert.match(route, /entity==="material_detail"/);
  assert.doesNotMatch(route.match(/if\(action==="save_material"\)[\s\S]*?return ok\(\{ok:true,code:visible,currentStock:0,unit\}\)\}/)?.[0] ?? "", /raw_material_purchases|stock_movements/);
});

test("las categorías de materias primas se eliminan con confirmación y protección de dependencias", async () => {
  const [route, sections, styles] = await Promise.all([
    read("app/api/khora/route.ts"),
    read("app/khora-sections.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(route, /action==="delete_category"/);
  assert.match(route, /FROM raw_materials WHERE category_id=\?/);
  assert.match(route, /FROM code_base WHERE category_id=\?/);
  assert.match(route, /FROM products WHERE category_id=\?/);
  assert.match(route, /FROM expenses WHERE category_id=\?/);
  assert.match(route, /CATEGORY_IN_USE/);
  assert.match(route, /DELETE FROM categories WHERE id=\?/);
  assert.match(sections, /CategoryDeleteDialog/);
  assert.match(sections, /category-delete-button/);
  assert.match(sections, /Eliminar categoría/);
  assert.match(styles, /category-delete-button:hover/);
});

test("la Fase B convierte unidades y calcula promedio ponderado móvil", async () => {
  const inventory = await import("../app/khora-inventory.ts");
  assert.equal(inventory.convertUnit(5, "litro", "ml"), 5000);
  assert.equal(inventory.weightedAverageCost(1000, 2000, 4000, 12000000), 2800);
  assert.deepEqual(inventory.purchaseProjection(5000, 2400, 5, "litro", "ml", 15000000), { baseQuantity: 5000, newStock: 10000, unitCost: 2700 });
  assert.equal(inventory.weightedAverageCost(0, 0, 5000, 12000000), 2400);
  assert.throws(() => inventory.convertUnit(1, "kg", "litro"));
});

test("la compra atómica guarda entrada, conversión, movimiento y promedio", async () => {
  const [schema, migration, route, sections] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0010_khora_weighted_purchase_cost.sql"),
    read("app/api/khora/route.ts"),
    read("app/khora-sections.tsx"),
  ]);
  for (const field of ["input_quantity", "input_unit", "base_quantity", "payment_status"]) assert.match(migration, new RegExp(field));
  assert.match(schema, /inputQuantity:real\("input_quantity"\)/);
  assert.match(route, /weightedAverageCost/);
  assert.match(route, /convertUnit\(inputQuantity,inputUnit,baseUnit\)/);
  assert.match(route, /INSERT INTO stock_movements/);
  assert.match(route, /weightedAverageCostCents:averageCost/);
  assert.match(sections, /COMPRAS · COSTO PROMEDIO/);
  assert.match(sections, /Materia prima existente/);
  assert.match(sections, /Nuevo promedio/);
});

test("la Fase C crea producto y receta por IDs sin mover inventario", async () => {
  const [route, sections] = await Promise.all([
    read("app/api/khora/route.ts"),
    read("app/khora-sections.tsx"),
  ]);
  assert.match(route, /action==="save_product_with_recipe"/);
  assert.match(route, /new Set\(materialIds\)\.size!==materialIds\.length/);
  assert.match(route, /INSERT INTO recipe_items\(recipe_id,material_id,quantity_per_yield\)/);
  assert.match(route, /INSERT INTO products\(code_base_id,type,sale_price_cents,estimated_cost_cents,current_stock,minimum_stock,profit_percentage\)/);
  assert.match(route, /hasRecipe\?"MANUFACTURED":"SIMPLE"/);
  const productAction = route.match(/if\(action==="save_product_with_recipe"\)[\s\S]*?(?=\n  if\(action==="update_product_definition")/)?.[0] ?? "";
  assert.doesNotMatch(productAction, /stock_movements|manufacturing_batches|UPDATE raw_materials SET current_stock/);
  assert.match(sections, /Seleccioná los insumos guardados y cuánto necesitás para fabricar UNA unidad/);
  assert.match(sections, /Cantidad necesaria por unidad/);
  assert.match(sections, /Costo estimado actual/);
  assert.match(sections, /Margen estimado/);
  assert.match(sections, /Crear este producto no modifica inventario/);
});

test("los códigos automáticos respetan máximo, padding y secuencias independientes", async () => {
  const { nextSequentialCode } = await import("../app/khora-codes.ts");
  assert.equal(nextSequentialCode(["P01", "P02", "P03", "P04"], "PRODUCT"), "P05");
  assert.equal(nextSequentialCode(["P01", "P02", "P04"], "PRODUCT"), "P05");
  assert.equal(nextSequentialCode(["P08", "P09"], "PRODUCT"), "P10");
  assert.equal(nextSequentialCode(["C01", "C02", "C07"], "COMBO"), "C08");
  assert.equal(nextSequentialCode(["P01", "P25"], "PRODUCT"), "P26");
  assert.equal(nextSequentialCode(["C01", "C04"], "COMBO"), "C05");
  assert.equal(nextSequentialCode(["PRO-001", "PRO-004"], "PRODUCT"), "PRO-005");
  assert.equal(nextSequentialCode([], "COMBO"), "COM-001");
});

test("dos altas concurrentes reintentan el código sin duplicarlo", async () => {
  const { createWithSequentialCode } = await import("../app/khora-codes.ts");
  const occupied = new Set(["P01"]);
  const create = async (code) => {
    await new Promise((resolve) => setImmediate(resolve));
    if (occupied.has(code)) throw new Error("UNIQUE constraint failed: code_base.code");
    occupied.add(code);
    return code;
  };
  const [first, second] = await Promise.all([
    createWithSequentialCode({ kind: "PRODUCT", listCodes: async () => [...occupied], create }),
    createWithSequentialCode({ kind: "PRODUCT", listCodes: async () => [...occupied], create }),
  ]);
  assert.deepEqual(new Set([first.code, second.code]), new Set(["P02", "P03"]));
  assert.equal(occupied.size, 3);
});

test("los códigos de materias primas usan máximo por prefijo y cambian con la categoría", async () => {
  const { suggestMaterialCode } = await import("../app/khora-inventory.ts");
  const codes = ["ESE-001", "ESE-002", "ESE-004", "ENV-001", "ENV-002", "OTR-099"];
  assert.equal(suggestMaterialCode("ESE", codes), "ESE-005");
  assert.equal(suggestMaterialCode("ENV", codes), "ENV-003");
  assert.equal(suggestMaterialCode("ALC", codes), "ALC-001");
  assert.equal(suggestMaterialCode("ese", ["ESE-020", "ENV-999"]), "ESE-021");
});

test("dos materias primas concurrentes reservan códigos únicos dentro de la categoría", async () => {
  const { createWithGeneratedCode } = await import("../app/khora-codes.ts");
  const { suggestMaterialCode } = await import("../app/khora-inventory.ts");
  const occupied = new Set(["ESE-001"]);
  const create = async (code) => {
    await new Promise((resolve) => setImmediate(resolve));
    if (occupied.has(code)) throw new Error("UNIQUE constraint failed: code_base.code");
    occupied.add(code);
    return code;
  };
  const options = { listCodes: async () => [...occupied], nextCode: (codes) => suggestMaterialCode("ESE", codes), create };
  const [first, second] = await Promise.all([createWithGeneratedCode(options), createWithGeneratedCode(options)]);
  assert.deepEqual(new Set([first.code, second.code]), new Set(["ESE-002", "ESE-003"]));
});

test("el alta de materia prima calcula el código en backend y conserva el existente al editar", async () => {
  const [route, sections, migration] = await Promise.all([
    read("app/api/khora/route.ts"),
    read("app/khora-sections.tsx"),
    read("drizzle/0009_khora_inventory_foundation.sql"),
  ]);
  assert.match(route, /entity==="next_material_code"/);
  assert.match(route, /createWithGeneratedCode\(\{listCodes:\(\)=>listMaterialCodes\(prefix\)/);
  assert.match(route, /SELECT rm\.code_base_id,cb\.code FROM raw_materials/);
  assert.doesNotMatch(route.match(/if\(action==="save_material"\)[\s\S]*?const created=/)?.[0] ?? "", /required\(b\.code/);
  assert.match(sections, /entity=next_material_code&categoryId=/);
  assert.match(sections, /value=\{suggestedCode\} readOnly/);
  assert.doesNotMatch(sections.match(/body: JSON\.stringify\(\{ action: "save_material"[\s\S]*?\}\) \}\)/)?.[0] ?? "", /\bcode\b/);
  assert.match(sections, /El código queda estable después de crear la materia prima/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS categories_prefix_uq/);
});

test("el modal de producto ofrece receta real, vacíos útiles y acceso al alta de insumos", async () => {
  const sections = await read("app/khora-sections.tsx");
  assert.match(sections, /data-testid="product-recipe-editor"/);
  assert.doesNotMatch(sections, /\{hasRecipe && <section className="recipe-editor"/);
  assert.match(sections, /\+ Agregar materia prima/);
  assert.match(sections, /Materia prima guardada/);
  assert.match(sections, /Cantidad necesaria por unidad/);
  assert.match(sections, /\{material\.code\} · \{material\.name\}/);
  assert.match(sections, /Agregá la primera materia prima para comenzar\./);
  assert.match(sections, /Todavía no hay materias primas cargadas/);
  assert.match(sections, /Crear materia prima/);
  assert.match(sections, /Receta desactivada/);
  assert.match(sections, /selected\.unit === "u\." \? "unidad" : selected\.unit/);
  assert.match(sections, /Math\.round\(quantityValue\(item\.quantity\) \* \(selected\?\.cost \?\? 0\)\)/);
});

test("el alta unificada selecciona insumos guardados, cantidades, unidades y códigos solo lectura", async () => {
  const [route, sections, schema] = await Promise.all([
    read("app/api/khora/route.ts"),
    read("app/khora-sections.tsx"),
    read("db/schema.ts"),
  ]);
  assert.match(sections, /entity=next_code&kind=PRODUCT/);
  assert.match(sections, /entity=next_code&kind=COMBO/);
  assert.match(sections, /Generado automáticamente/);
  assert.match(sections, /\{ materialId: 0, quantity: "" \}/);
  assert.match(sections, /data-testid=\{`recipe-material-row-\$\{index\}`\}/);
  assert.match(sections, /data-testid="recipe-material-list"/);
  assert.match(sections, /list\.scrollTo\(\{ top: list\.scrollHeight, behavior: "smooth" \}\)/);
  assert.match(sections, /<select value=\{item\.materialId\}/);
  assert.match(sections, /<option value=\{0\}>Seleccionar materia prima/);
  assert.match(sections, /aria-label=\{`Cantidad de \$\{selected\?\.name/);
  assert.match(sections, /type="text" inputMode="decimal"/);
  assert.match(sections, /items: hasRecipe \? items\.map/);
  assert.match(sections, /Agregá al menos una materia prima a la receta\./);
  assert.match(sections, /action: product \? "update_product_definition" : "save_product_with_recipe"/);
  assert.match(sections, /action: "save_combo_definition"/);
  assert.match(sections, /Productos del combo/);
  assert.match(sections, /comboItems/);
  assert.match(sections, /Materias primas e insumos/);
  assert.match(sections, /materialItems/);
  assert.match(sections, /Costo estimado de fabricación/);
  assert.match(sections, /action: "update_combo_definition"/);
  assert.match(sections, /type="text" inputMode="decimal"/);
  assert.match(sections, /Tabs tabs=\{\["Productos", "Combos", "Recetas", "Categorías"\]\}/);
  assert.match(sections, /document\.addEventListener\("focusin", selectNumberOnFocus\)/);
  assert.match(sections, /unitOptions\.map/);
  assert.match(route, /createWithSequentialCode\(\{kind:"PRODUCT"/);
  assert.match(route, /kind:SequentialCodeKind=type==="COMBO"\?"COMBO":"PRODUCT"/);
  assert.match(route, /combo_id/);
  assert.match(route, /SELECT cb\.code FROM products p JOIN code_base cb/);
  assert.match(schema, /uniqueIndex\("code_base_code_uq"\)/);
  assert.match(await read("app/globals.css"), /\.recipe-lines\{height:100%;max-height:none;min-height:0;overflow-y:scroll/);
  assert.match(await read("app/globals.css"), /input\[type="number"\].*-moz-appearance:textfield/);
  assert.match(await read("app/globals.css"), /::-webkit-inner-spin-button/);
  assert.match(await read("app/khora-inventory.ts"), /sin_unidad/);
});

test("la Fase D simula, valida y confirma fabricación atómica con snapshots", async () => {
  const [schema, migration, route, sections] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0011_khora_finished_lot_balances.sql"),
    read("app/api/khora/route.ts"),
    read("app/khora-sections.tsx"),
  ]);
  assert.match(schema, /initialQuantity:real\("initial_quantity"\)/);
  assert.match(schema, /availableQuantity:real\("available_quantity"\)/);
  assert.match(migration, /manufacturing_batches_fifo_idx/);
  assert.match(route, /entity==="manufacture_preview"/);
  assert.match(route, /INSERT INTO manufacturing_materials/);
  assert.match(route, /frozen_unit_cost_cents/);
  assert.match(route, /initial_quantity,available_quantity/);
  assert.match(route, /Stock insuficiente/);
  assert.match(sections, /FABRICACIÓN · SIMULACIÓN/);
  assert.match(sections, /Materias primas necesarias/);
  assert.match(sections, /No se puede fabricar/);
  assert.match(sections, /El stock cambia únicamente cuando confirmás la fabricación/);
});

test("la Fase E asigna lotes FIFO y congela el costo histórico", async () => {
  const fifo = await import("../app/khora-fifo.ts");
  const result = fifo.allocateFinishedStockFIFO(12, [
    { id: 2, source: "MANUFACTURED", batchNumber: "B", occurredAt: "2026-08-02", availableQuantity: 10, unitCostCents: 500000 },
    { id: 1, source: "MANUFACTURED", batchNumber: "A", occurredAt: "2026-08-01", availableQuantity: 10, unitCostCents: 400000 },
  ]);
  assert.deepEqual(result.allocations.map((item) => [item.batchNumber, item.quantity]), [["A", 10], ["B", 2]]);
  assert.equal(result.totalCostCents, 5000000);
  assert.equal(result.availableAfter, 8);
  assert.throws(() => fifo.allocateFinishedStockFIFO(21, [{ id: 1, source: "MANUFACTURED", batchNumber: "A", occurredAt: "2026-08-01", availableQuantity: 20, unitCostCents: 1 }]));
});

test("las ventas y combos descuentan saldos de lote y conservan asignaciones", async () => {
  const [schema, migration, route] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0012_khora_finished_stock_fifo.sql"),
    read("app/api/khora/route.ts"),
  ]);
  assert.match(schema, /finishedStockAllocations = sqliteTable/);
  assert.match(schema, /comboBatchItemLotAllocations = sqliteTable/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS finished_stock_allocations/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS combo_batch_item_lot_allocations/);
  assert.match(route, /finishedFifoPlan/);
  assert.match(route, /entity==="fifo_preview"/);
  assert.match(route, /INSERT INTO finished_stock_allocations/);
  assert.match(route, /SET available_quantity=available_quantity-\?/);
  assert.match(route, /INSERT INTO combo_batch_item_lot_allocations/);
});

test("la Fase F vincula cada pedido con una sola venta y separa confirmación de entrega", async () => {
  const [schema, migration, route] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0013_khora_order_sale_link.sql"),
    read("app/api/khora/route.ts"),
  ]);
  assert.match(schema, /confirmedAt:text\("confirmed_at"\)/);
  assert.match(schema, /stockConsumedAt:text\("stock_consumed_at"\)/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS idx_orders_main_sale_unique/);
  assert.match(migration, /source_order_item_id/);
  assert.match(route, /const confirmOrder=/);
  assert.match(route, /op=`ORDER-\$\{orderId\}`/);
  assert.match(route, /INSERT OR IGNORE INTO sales/);
  const confirmation = route.match(/const confirmOrder=[\s\S]*?return \{saleId:n\(linked\?\.sale_id\),created:true\};\n\};/)?.[0] ?? "";
  assert.doesNotMatch(confirmation, /UPDATE products SET current_stock|finished_stock_allocations/);
  assert.match(route, /const fulfillOrder=/);
  assert.match(route, /stock_consumed_at=CURRENT_TIMESTAMP/);
  assert.match(route, /INSERT INTO finished_stock_allocations/);
});

test("los cobros usan la venta como fuente económica y sincronizan el pedido", async () => {
  const route = await read("app/api/khora/route.ts");
  assert.match(route, /INSERT INTO payments\(order_id,sale_id,direction,method/);
  assert.match(route, /const nextState=paymentState/);
  assert.match(route, /UPDATE sales SET payment_status=/);
  assert.match(route, /UPDATE orders SET payment_status=/);
  assert.match(route, /sus pagos se preservaron/);
});

test("la Fase G implementa venta directa multítem con productos y conceptos", async () => {
  const [schema, migration, route, sections] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0014_khora_direct_multi_item_sale.sql"),
    read("app/api/khora/route.ts"),
    read("app/khora-sections.tsx"),
  ]);
  assert.match(schema, /saleManualItems = sqliteTable/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sale_manual_items/);
  assert.match(route, /entity==="sale_catalog"/);
  assert.match(route, /inventoryItems=items\.filter/);
  assert.match(route, /manualItems=items\.filter/);
  assert.match(route, /origin,sold_at,notes/);
  assert.match(route, /"DIRECT"/);
  assert.match(route, /initialPayment/);
  assert.match(route, /INSERT INTO payments\(sale_id,direction,method/);
  assert.match(sections, /Nueva venta directa/);
  assert.match(sections, /Agregar producto/);
  assert.match(sections, /Concepto manual/);
  assert.match(sections, /Stock insuficiente/);
  assert.match(sections, /Ganancia histórica/);
});

test("la Fase H genera PDFs multítem válidos y vinculados a la venta", async () => {
  const pdf = await import("../app/khora-pdf.ts");
  const bytes = pdf.buildKhoraPdf({
    title: "Comprobante interno",
    reference: "V-1058",
    meta: ["Cliente: Casa Calma", "Fecha: 2026-08-14"],
    lines: ["2 x Difusor Lavanda", "3 x Home Spray Jazmín", "TOTAL: $ 64.800"],
  });
  const content = new TextDecoder().decode(bytes);
  assert.match(content, /^%PDF-1\.4/);
  assert.match(content, /Difusor Lavanda/);
  assert.match(content, /Home Spray Jazmin/);
  assert.match(content, /%%EOF$/);

  const [schema, migration, route, sections] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0015_khora_sale_documents.sql"),
    read("app/api/khora/route.ts"),
    read("app/khora-sections.tsx"),
  ]);
  assert.match(schema, /saleDocuments = sqliteTable/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sale_documents/);
  assert.match(migration, /UNIQUE\(sale_id,type,version\)/);
  assert.match(route, /const generateSaleDocument=/);
  assert.match(route, /status='ERROR'/);
  assert.match(route, /entity==="document_pdf"/);
  assert.match(route, /action==="generate_document"/);
  assert.match(route, /Comprobante de venta interno - no fiscal/);
  assert.match(sections, /Generar remito/);
  assert.match(sections, /Generar comprobante interno/);
  assert.match(sections, /Descargar/);
});

test("KHORA centraliza el lenguaje iconográfico de todos los módulos", async () => {
  const [icons, data, operations, calendar, page, sections] = await Promise.all([
    read("app/khora-icons.tsx"),
    read("app/khora-data.ts"),
    read("app/khora-operations.ts"),
    read("app/khora-calendar.ts"),
    read("app/page.tsx"),
    read("app/khora-sections.tsx"),
  ]);
  for (const icon of ["home", "cash", "package", "users", "box", "settings-automation", "building-warehouse", "shopping-cart", "truck-delivery", "chart-line", "calendar", "settings", "bell", "chevron-down", "delivery"]) {
    assert.match(icons, new RegExp(`(?:\\"${icon}\\"|${icon}:)`));
  }
  assert.match(icons, /stroke="currentColor"/);
  assert.match(icons, /strokeWidth="1\.8"/);
  assert.doesNotMatch(data, /icon: moduleIcons\.pedidos/);
  assert.match(operations, /icon: moduleIcons\.proveedores/);
  assert.match(calendar, /icon: moduleIcons\.fabricacion/);
  assert.match(calendar, /icon: moduleIcons\.compras/);
  assert.match(calendar, /icon: moduleIcons\.ventas/);
  assert.doesNotMatch(calendar, /icon: moduleIcons\.entregas/);
  assert.match(page, /KhoraIcon name=\{item\.icon\}/);
  assert.match(sections, /KhoraIcon name=\{layer\.icon\}/);
  for (const source of [data, operations, calendar, page, sections]) assert.doesNotMatch(source, /(?:glyph\s*:|\.glyph\b|glyph=)/);
});

test("la navegación superior agrupa contactos y producción sin duplicar notificaciones", async () => {
  const [data, page] = await Promise.all([read("app/khora-data.ts"), read("app/page.tsx")]);
  assert.match(data, /primaryNavigation/);
  assert.match(data, /id: "contactos"[\s\S]*clientes[\s\S]*proveedores/);
  assert.match(data, /id: "produccion"[\s\S]*fabricacion[\s\S]*stock/);
  assert.match(page, /aria-haspopup="menu"/);
  assert.match(page, /aria-expanded=\{expanded\}/);
  assert.match(page, /setOpenNavGroup\(null\)/);
  assert.match(page, /mobile-alert-button/);
  assert.doesNotMatch(page, /className="navbar-notification"/);
});

test("las tablas reutilizables tienen zebra striping sutil sin perder hover ni estados", async () => {
  const [sections, styles] = await Promise.all([read("app/khora-sections.tsx"), read("app/globals.css")]);
  assert.match(sections, /function DataTable\(\{ headers, children \}/);
  assert.match(sections, /title="Ventas recientes"/);
  assert.match(sections, /title="Gastos de agosto"/);
  assert.match(sections, /function ProfitHistory\(\)/);
  assert.match(styles, /--table-row-alt:#f5f7f4/);
  assert.match(styles, /\.data-table tbody tr:nth-child\(even\)\{background:var\(--table-row-alt\)\}/);
  assert.match(styles, /\.data-table tbody tr:hover\{background:#fbfcfa\}/);
  assert.match(styles, /\.data-table tbody tr\[aria-selected="true"\]/);
});

test("KHORA comparte tokens y estados accesibles de microinteracción", async () => {
  const [sections, styles] = await Promise.all([read("app/khora-sections.tsx"), read("app/globals.css")]);
  for (const token of ["--motion-press", "--motion-fast", "--motion-normal", "--ease-standard", "--focus-ring", "--shadow-hover"]) {
    assert.match(styles, new RegExp(token));
  }
  assert.match(styles, /button:focus-visible,a:focus-visible,input:focus-visible/);
  assert.match(styles, /\.primary-button\[aria-busy="true"\]:before/);
  assert.match(styles, /@keyframes khora-drawer-in/);
  assert.match(styles, /@keyframes khora-popover-in/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /input\[aria-invalid="true"\]/);
  assert.match(sections, /aria-busy=\{saving\}/);
  assert.match(sections, /disabled=\{saving\}/);
});

test("finanzas compara cierres inmutables y permite exportar reportes reales", async () => {
  const [sections, styles] = await Promise.all([read("app/khora-sections.tsx"), read("app/globals.css")]);
  assert.match(sections, /function FinanceClosureComparison/);
  assert.match(sections, /title="Comparación mensual"/);
  assert.match(sections, /financeVariation/);
  assert.match(sections, /function FinanceReports/);
  assert.match(sections, /Imprimir \/ PDF/);
  assert.match(sections, /Exportar CSV/);
  assert.match(sections, /kind: "sale"/);
  assert.match(sections, /Registrar cobro/);
  assert.match(sections, /action: "register_payment"/);
  assert.match(sections, /khora:data-changed/);
  assert.match(styles, /\.finance-comparison-selectors/);
});

test("las alertas operativas se pueden descartar y permanecen ocultas", async () => {
  const [route, page] = await Promise.all([read("app/api/khora/route.ts"), read("app/page.tsx")]);
  assert.match(route, /entity==="dismissed_alerts"/);
  assert.match(route, /dismissed_operational_alerts/);
  assert.match(page, /function dismissAlert/);
  assert.match(page, /action: "save_setting"/);
  assert.match(page, /dismissedAlertIds/);
});

test("los combos aceptan productos y materias primas directas", async () => {
  const [route, sections] = await Promise.all([read("app/api/khora/route.ts"), read("app/khora-sections.tsx")]);
  assert.match(sections, /Materias primas e insumos/);
  assert.match(sections, /Agregar materia prima/);
  assert.match(sections, /Todavía no agregaste materias primas/);
  assert.match(sections, /materialItems: materialItems\.map/);
  assert.match(sections, /Precio unitario/);
  assert.match(sections, /salePriceCents: Number\(row\.sale_price_cents/);
  assert.match(route, /INSERT INTO combo_material_items/);
  assert.match(route, /Agregá al menos un producto o insumo al combo/);
});

test("productos y combos se editan o archivan sin alterar el historial", async () => {
  const [route, sections] = await Promise.all([read("app/api/khora/route.ts"), read("app/khora-sections.tsx")]);
  assert.match(route, /entity==="product_definition"/);
  assert.match(route, /entity==="combo_definition"/);
  assert.match(route, /action==="update_product_definition"/);
  assert.match(route, /action==="update_combo_definition"/);
  assert.match(route, /action==="archive_product_definition"\|\|action==="archive_combo_definition"/);
  assert.match(route, /currentStockPreserved/);
  assert.match(route, /historyPreserved:true/);
  assert.match(route, /producto participa en pedidos abiertos/);
  assert.match(route, /producto integra un combo activo/);
  assert.match(sections, /Editar producto/);
  assert.match(sections, /Editar combo/);
  assert.match(sections, /Código estable · no se modifica/);
  assert.match(sections, /function DefinitionArchiveDialog/);
  assert.match(sections, /Se conservarán el código, el stock actual, los lotes, las ventas y todos los costos históricos/);
});

test("las ventas directas se editan o anulan con reversión transaccional y trazabilidad", async () => {
  const [route, sections, styles] = await Promise.all([read("app/api/khora/route.ts"), read("app/khora-sections.tsx"), read("app/globals.css")]);
  assert.match(route, /finishedFifoPlanForSaleEdit/);
  assert.match(route, /entity==="sale_definition"/);
  assert.match(route, /FROM audit_logs WHERE entity_type='SALE' AND entity_id=/);
  assert.match(route, /FROM sale_documents WHERE sale_id=/);
  assert.match(route, /action==="update_sale"/);
  assert.match(route, /Reversión por edición de venta/);
  assert.match(route, /DELETE FROM finished_stock_allocations/);
  assert.match(route, /Venta reasignada después de edición/);
  assert.match(route, /action==="cancel_sale_full"/);
  assert.match(route, /UPDATE payments SET status='CANCELLED'/);
  assert.match(route, /Venta V-\$\{id\} anulada con reversión de stock y lotes/);
  assert.match(route, /monthly_finance_closures WHERE status='CLOSED'/);
  assert.match(sections, /action: sale \? "update_sale" : "sale"/);
  assert.match(sections, /Disponible para esta edición/);
  assert.match(sections, /function SaleCancelDialog/);
  assert.match(sections, /function SaleDetailDialog/);
  assert.match(sections, /Detalle económico, cobros, documentos e historial de cambios/);
  assert.match(sections, /Anular venta/);
  assert.match(styles, /\.sale-row-actions/);
  assert.match(styles, /\.sale-edit-payment/);
  assert.match(styles, /\.sale-detail-summary/);
});
