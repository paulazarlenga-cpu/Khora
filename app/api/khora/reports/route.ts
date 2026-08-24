import ExcelJS, { type Worksheet } from "exceljs";
import { khoraDb } from "@/db/postgres";
import { getKhoraUser } from "@/lib/supabase/auth";

type Row = Record<string, unknown>;
type ReportType = "financial" | "sales" | "purchases" | "expenses" | "profitability" | "stock" | "complete";
type Column = { header: string; key: string; width?: number; kind?: "money" | "date" | "number" | "percent" };

const forest = "1E4C3D", terracotta = "C96C4D", cream = "F6F1E8";
const moneyFormat = '$ #,##0.00;[Red]-$ #,##0.00';
const percentFormat = '0.0%';

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()); }
function safeFilename(value: string) { return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-"); }
function dateValue(value: unknown) { const text = String(value ?? "").slice(0, 10); return validDate(text) ? new Date(`${text}T12:00:00Z`) : null; }
function pesos(value: unknown) { return Number(value ?? 0) / 100; }

function setupSheet(sheet: Worksheet, title: string, subtitle: string) {
  sheet.properties.defaultRowHeight = 19;
  sheet.addRow([title]);
  sheet.addRow([subtitle]);
  sheet.addRow([]);
  sheet.getRow(1).height = 28;
  sheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: forest } };
  sheet.getCell("A2").font = { name: "Aptos", size: 10, color: { argb: "66766E" } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
}

function addDataSheet(workbook: ExcelJS.Workbook, name: string, title: string, periodLabel: string, columns: Column[], rows: Row[]) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  setupSheet(sheet, title, periodLabel);
  const tableRows = rows.length ? rows.map((row) => columns.map((column) => row[column.key] ?? null)) : [columns.map((column, index) => index === 0 ? "Sin movimientos en el período seleccionado" : null)];
  sheet.addTable({ name: `T${workbook.worksheets.length}_${safeFilename(name)}`.replace(/-/g, "_"), ref: "A4", headerRow: true, totalsRow: false, style: { theme: "TableStyleMedium4", showRowStripes: true }, columns: columns.map((column) => ({ name: column.header })), rows: tableRows });
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  const header = sheet.getRow(4);
  header.height = 23;
  header.eachCell((cell) => { cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: forest } }; cell.alignment = { vertical: "middle" }; });
  columns.forEach((column, index) => {
    const excelColumn = sheet.getColumn(index + 1);
    excelColumn.width = column.width ?? Math.min(42, Math.max(12, column.header.length + 3, ...rows.slice(0, 100).map((row) => String(row[column.key] ?? "").length + 2)));
    if (column.kind === "money") excelColumn.numFmt = moneyFormat;
    if (column.kind === "date") excelColumn.numFmt = "dd/mm/yyyy";
    if (column.kind === "number") excelColumn.numFmt = "#,##0.00";
    if (column.kind === "percent") excelColumn.numFmt = percentFormat;
  });
  sheet.eachRow((row, rowNumber) => { if (rowNumber > 4) row.alignment = { vertical: "middle" }; });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };
  return sheet;
}

async function rows(source: string, ...parameters: unknown[]) { return (await khoraDb.prepare(source).bind(...parameters).all<Row>()).results; }

export async function GET(request: Request) {
  try {
    const user = await getKhoraUser();
    if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
    const url = new URL(request.url), type = (url.searchParams.get("type") || "financial") as ReportType;
    const from = url.searchParams.get("from") || `${new Date().toISOString().slice(0, 7)}-01`, to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
    if (!["financial", "sales", "purchases", "expenses", "profitability", "stock", "complete"].includes(type)) return Response.json({ error: "Tipo de reporte inválido" }, { status: 400 });
    if (!validDate(from) || !validDate(to) || from > to) return Response.json({ error: "El período seleccionado no es válido" }, { status: 400 });
    const periodLabel = `Período: ${new Intl.DateTimeFormat("es-AR").format(new Date(`${from}T12:00:00Z`))} al ${new Intl.DateTimeFormat("es-AR").format(new Date(`${to}T12:00:00Z`))}`;

    const salesRaw = await rows(`SELECT s.id,s.sold_at,c.name client,s.origin,s.status,s.payment_status,s.total_cents,s.total_cost_cents,s.profit_cents,s.notes,COALESCE(string_agg(DISTINCT p.method,', ') FILTER(WHERE p.status='CONFIRMED'),'Sin cobro') payment_methods,COALESCE(SUM(CASE WHEN p.status='CONFIRMED' THEN p.amount_cents ELSE 0 END),0) paid_cents FROM sales s LEFT JOIN clients c ON c.id=s.client_id LEFT JOIN payments p ON p.sale_id=s.id AND p.direction='IN' WHERE CAST(s.sold_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) GROUP BY s.id,c.name ORDER BY s.sold_at,s.id`, from, to);
    const saleItemsRaw = await rows(`SELECT s.id sale_id,s.sold_at,c.name client,cb.code product_code,cb.name product,si.quantity,si.frozen_unit_price_cents,si.line_total_cents,si.line_cost_cents,s.status FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id JOIN code_base cb ON cb.id=p.code_base_id LEFT JOIN clients c ON c.id=s.client_id WHERE CAST(s.sold_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY s.sold_at,s.id,cb.name`, from, to);
    const purchasesRaw = await rows(`SELECT rp.id,rp.purchased_at,s.name supplier,cb.code material_code,cb.name material,COALESCE(rp.input_quantity,rp.quantity) input_quantity,COALESCE(rp.input_unit,rp.purchased_unit,rm.unit) input_unit,COALESCE(rp.base_quantity,rp.quantity) base_quantity,rm.unit base_unit,rp.total_cost_cents,rp.unit_cost_cents,rp.payment_status,rp.status,rp.invoice_number,rp.notes FROM raw_material_purchases rp JOIN raw_materials rm ON rm.id=rp.material_id JOIN code_base cb ON cb.id=rm.code_base_id LEFT JOIN suppliers s ON s.id=rp.supplier_id WHERE CAST(rp.purchased_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY rp.purchased_at,rp.id`, from, to);
    const expensesRaw = await rows(`SELECT e.id,e.incurred_at,COALESCE(cb.manual_category,c.name,'Sin categoría') category,COALESCE(cb.manual_type,e.description) description,e.amount_cents,e.payment_status,e.record_status,e.invoice_number,e.notes FROM expenses e LEFT JOIN code_base cb ON cb.id=e.code_base_id LEFT JOIN categories c ON c.id=e.category_id WHERE e.raw_material_purchase_id IS NULL AND CAST(e.incurred_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY e.incurred_at,e.id`, from, to);
    const clientsRaw = await rows(`SELECT c.id,c.code,c.name,c.email,c.phone,pl.name price_list,COUNT(DISTINCT s.id) sales_count,COALESCE(SUM(CASE WHEN s.status<>'CANCELLED' THEN s.total_cents ELSE 0 END),0) total_cents FROM clients c LEFT JOIN price_lists pl ON pl.id=c.price_list_id LEFT JOIN sales s ON s.client_id=c.id AND CAST(s.sold_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) GROUP BY c.id,pl.name ORDER BY total_cents DESC,c.name`, from, to);
    const productsSoldRaw = await rows(`SELECT p.id,cb.code,cb.name product,COALESCE(SUM(CASE WHEN s.status<>'CANCELLED' THEN si.quantity ELSE 0 END),0) quantity,COALESCE(SUM(CASE WHEN s.status<>'CANCELLED' THEN si.line_total_cents ELSE 0 END),0) sales_cents,COALESCE(SUM(CASE WHEN s.status<>'CANCELLED' THEN si.line_cost_cents ELSE 0 END),0) cost_cents FROM products p JOIN code_base cb ON cb.id=p.code_base_id LEFT JOIN sale_items si ON si.product_id=p.id LEFT JOIN sales s ON s.id=si.sale_id AND CAST(s.sold_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) GROUP BY p.id,cb.code,cb.name ORDER BY quantity DESC,cb.name`, from, to);
    const suppliersRaw = await rows(`SELECT s.id,s.code,s.name,s.email,s.phone,COUNT(rp.id) purchases_count,COALESCE(SUM(CASE WHEN rp.status='CONFIRMED' THEN rp.total_cost_cents ELSE 0 END),0) total_cents FROM suppliers s LEFT JOIN raw_material_purchases rp ON rp.supplier_id=s.id AND CAST(rp.purchased_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) GROUP BY s.id ORDER BY total_cents DESC,s.name`, from, to);
    const materialsBoughtRaw = await rows(`SELECT rm.id,cb.code,cb.name material,rm.unit,COALESCE(SUM(CASE WHEN rp.status='CONFIRMED' THEN COALESCE(rp.base_quantity,rp.quantity) ELSE 0 END),0) quantity,COALESCE(SUM(CASE WHEN rp.status='CONFIRMED' THEN rp.total_cost_cents ELSE 0 END),0) total_cents FROM raw_materials rm JOIN code_base cb ON cb.id=rm.code_base_id LEFT JOIN raw_material_purchases rp ON rp.material_id=rm.id AND CAST(rp.purchased_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) GROUP BY rm.id,cb.code,cb.name ORDER BY quantity DESC,cb.name`, from, to);
    const closuresRaw = await rows(`SELECT * FROM monthly_finance_closures WHERE status='CLOSED' AND month BETWEEN ? AND ? ORDER BY month`, from.slice(0, 7), to.slice(0, 7));
    const reinvestmentsRaw = await rows(`SELECT month,occurred_at,concept,category,amount_cents,status,notes FROM reinvestment_movements WHERE status='CONFIRMED' AND CAST(occurred_at AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) ORDER BY occurred_at,id`, from, to);
    const productStockRaw = await rows(`SELECT cb.code,cb.name product,p.type,p.current_stock,p.minimum_stock,CASE WHEN p.last_batch_unit_cost_cents>0 THEN p.last_batch_unit_cost_cents ELSE p.estimated_cost_cents END unit_cost_cents,ROUND(p.current_stock*(CASE WHEN p.last_batch_unit_cost_cents>0 THEN p.last_batch_unit_cost_cents ELSE p.estimated_cost_cents END)) stock_value_cents,CASE WHEN p.current_stock<=0 THEN 'Crítico' WHEN p.current_stock<=p.minimum_stock THEN 'Stock bajo' ELSE 'Normal' END stock_status FROM products p JOIN code_base cb ON cb.id=p.code_base_id WHERE p.active=1 ORDER BY cb.name`);
    const materialStockRaw = await rows(`SELECT cb.code,cb.name material,c.name category,rm.unit,rm.current_stock,rm.minimum_stock,rm.current_cost_cents,ROUND(rm.current_stock*rm.current_cost_cents) stock_value_cents,CASE WHEN rm.current_stock<=0 THEN 'Crítico' WHEN rm.current_stock<=rm.minimum_stock THEN 'Stock bajo' ELSE 'Normal' END stock_status,s.name supplier FROM raw_materials rm JOIN code_base cb ON cb.id=rm.code_base_id LEFT JOIN categories c ON c.id=rm.category_id LEFT JOIN suppliers s ON s.id=rm.preferred_supplier_id WHERE rm.active=1 ORDER BY cb.name`);

    const sales: Array<Row & { sold_at: Date | null; total: number; cost: number; profit: number; paid: number; pending: number }> = salesRaw.map((row) => ({ ...row, sold_at: dateValue(row.sold_at), total: pesos(row.total_cents), cost: pesos(row.total_cost_cents), profit: pesos(row.profit_cents), paid: pesos(row.paid_cents), pending: pesos(Number(row.total_cents) - Number(row.paid_cents)) }));
    const saleItems: Array<Row & { sold_at: Date | null; unit_price: number; total: number; cost: number; profit: number }> = saleItemsRaw.map((row) => ({ ...row, sold_at: dateValue(row.sold_at), unit_price: pesos(row.frozen_unit_price_cents), total: pesos(row.line_total_cents), cost: pesos(row.line_cost_cents), profit: pesos(Number(row.line_total_cents) - Number(row.line_cost_cents)) }));
    const purchases: Array<Row & { purchased_at: Date | null; total: number; unit_cost: number }> = purchasesRaw.map((row) => ({ ...row, purchased_at: dateValue(row.purchased_at), total: pesos(row.total_cost_cents), unit_cost: pesos(row.unit_cost_cents) }));
    const expenses: Array<Row & { incurred_at: Date | null; amount: number }> = expensesRaw.map((row) => ({ ...row, incurred_at: dateValue(row.incurred_at), amount: pesos(row.amount_cents) }));
    const clients: Array<Row & { total: number }> = clientsRaw.map((row) => ({ ...row, total: pesos(row.total_cents) }));
    const productsSold: Array<Row & { sales: number; cost: number; profit: number }> = productsSoldRaw.map((row) => ({ ...row, sales: pesos(row.sales_cents), cost: pesos(row.cost_cents), profit: pesos(Number(row.sales_cents) - Number(row.cost_cents)) }));
    const suppliers: Array<Row & { total: number }> = suppliersRaw.map((row) => ({ ...row, total: pesos(row.total_cents) }));
    const materialsBought: Array<Row & { total: number }> = materialsBoughtRaw.map((row) => ({ ...row, total: pesos(row.total_cents) }));
    const expenseSummary = [...new Set(expenses.map((row) => String(row["category"])))].map((category) => { const categoryRows = expenses.filter((row) => String(row["category"]) === category && row["record_status"] !== "CANCELLED"); return { category, operations: categoryRows.length, total: categoryRows.reduce((sum, row) => sum + Number(row.amount), 0) }; }).sort((a, b) => b.total - a.total);
    const profitability: Array<Row & { sales: number; sold_cost: number; purchases: number; expenses: number; gross_profit: number; net_profit: number; reserved: number; available: number; margin: number }> = closuresRaw.map((row) => ({ ...row, sales: pesos(row.sales_generated_cents), sold_cost: pesos(row.sold_cost_cents), purchases: pesos(row.purchases_cents), expenses: pesos(row.expenses_cents), gross_profit: pesos(row.gross_profit_cents), net_profit: pesos(row.net_profit_cents), reserved: pesos(row.reinvestment_reserved_cents), available: pesos(row.available_profit_cents), margin: Number(row.sales_generated_cents) ? Number(row.net_profit_cents) / Number(row.sales_generated_cents) : 0 }));
    const reinvestments: Array<Row & { occurred_at: Date | null; amount: number }> = reinvestmentsRaw.map((row) => ({ ...row, occurred_at: dateValue(row.occurred_at), amount: pesos(row.amount_cents) }));
    const productStock: Array<Row & { unit_cost: number; stock_value: number }> = productStockRaw.map((row) => ({ ...row, unit_cost: pesos(row.unit_cost_cents), stock_value: pesos(row.stock_value_cents) }));
    const materialStock: Array<Row & { unit_cost: number; stock_value: number }> = materialStockRaw.map((row) => ({ ...row, unit_cost: pesos(row.current_cost_cents), stock_value: pesos(row.stock_value_cents) }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = `KHORA · ${user.email ?? "usuario"}`; workbook.created = new Date(); workbook.modified = new Date(); workbook.company = "KHORA";
    const include = (...types: ReportType[]) => type === "complete" || types.includes(type);
    if (include("financial")) {
      const activeSales = sales.filter((row) => row.status !== "CANCELLED"), activePurchases = purchases.filter((row) => row.status === "CONFIRMED"), activeExpenses = expenses.filter((row) => row.record_status !== "CANCELLED");
      addDataSheet(workbook, "Resumen", "Resumen financiero", periodLabel, [{ header: "Indicador", key: "label", width: 32 }, { header: "Importe", key: "value", width: 20, kind: "money" }], [
        { label: "Ventas generadas", value: activeSales.reduce((sum, row) => sum + Number(row.total), 0) }, { label: "Cobrado", value: activeSales.reduce((sum, row) => sum + Number(row.paid), 0) }, { label: "Por cobrar", value: activeSales.reduce((sum, row) => sum + Number(row.pending), 0) }, { label: "Costo vendido", value: activeSales.reduce((sum, row) => sum + Number(row.cost), 0) }, { label: "Compras", value: activePurchases.reduce((sum, row) => sum + Number(row.total), 0) }, { label: "Gastos", value: activeExpenses.reduce((sum, row) => sum + Number(row.amount), 0) }, { label: "Ganancia neta", value: activeSales.reduce((sum, row) => sum + Number(row.profit), 0) - activeExpenses.reduce((sum, row) => sum + Number(row.amount), 0) },
      ]);
      addDataSheet(workbook, "Ventas", "Ventas del período", periodLabel, [{ header: "Venta", key: "id" }, { header: "Fecha", key: "sold_at", kind: "date" }, { header: "Cliente", key: "client", width: 28 }, { header: "Origen", key: "origin" }, { header: "Total", key: "total", kind: "money" }, { header: "Cobrado", key: "paid", kind: "money" }, { header: "Pendiente", key: "pending", kind: "money" }, { header: "Costo", key: "cost", kind: "money" }, { header: "Ganancia", key: "profit", kind: "money" }, { header: "Estado", key: "status" }, { header: "Medios de pago", key: "payment_methods", width: 24 }], sales);
      addDataSheet(workbook, "Compras", "Compras del período", periodLabel, [{ header: "Compra", key: "id" }, { header: "Fecha", key: "purchased_at", kind: "date" }, { header: "Proveedor", key: "supplier", width: 25 }, { header: "Materia prima", key: "material", width: 25 }, { header: "Cantidad", key: "input_quantity", kind: "number" }, { header: "Unidad", key: "input_unit" }, { header: "Total", key: "total", kind: "money" }, { header: "Costo unitario", key: "unit_cost", kind: "money" }, { header: "Pago", key: "payment_status" }, { header: "Estado", key: "status" }], purchases);
      addDataSheet(workbook, "Gastos", "Gastos del período", periodLabel, [{ header: "Gasto", key: "id" }, { header: "Fecha", key: "incurred_at", kind: "date" }, { header: "Categoría", key: "category" }, { header: "Descripción", key: "description", width: 32 }, { header: "Importe", key: "amount", kind: "money" }, { header: "Pago", key: "payment_status" }, { header: "Estado", key: "record_status" }, { header: "Comprobante", key: "invoice_number", width: 20 }], expenses);
    }
    if (include("sales")) {
      if (type !== "complete") addDataSheet(workbook, "Ventas", "Ventas y productos", periodLabel, [{ header: "Venta", key: "sale_id" }, { header: "Fecha", key: "sold_at", kind: "date" }, { header: "Cliente", key: "client", width: 28 }, { header: "Código", key: "product_code" }, { header: "Producto", key: "product", width: 28 }, { header: "Cantidad", key: "quantity", kind: "number" }, { header: "Precio unitario", key: "unit_price", kind: "money" }, { header: "Total", key: "total", kind: "money" }, { header: "Costo", key: "cost", kind: "money" }, { header: "Ganancia", key: "profit", kind: "money" }, { header: "Estado", key: "status" }], saleItems);
      addDataSheet(workbook, "Clientes", "Clientes y actividad", periodLabel, [{ header: "Código", key: "code" }, { header: "Cliente", key: "name", width: 28 }, { header: "Email", key: "email", width: 28 }, { header: "Teléfono", key: "phone" }, { header: "Lista de precios", key: "price_list" }, { header: "Ventas", key: "sales_count" }, { header: "Facturación", key: "total", kind: "money" }], clients);
      addDataSheet(workbook, "Productos vendidos", "Productos vendidos", periodLabel, [{ header: "Código", key: "code" }, { header: "Producto", key: "product", width: 28 }, { header: "Cantidad", key: "quantity", kind: "number" }, { header: "Ventas", key: "sales", kind: "money" }, { header: "Costo", key: "cost", kind: "money" }, { header: "Ganancia", key: "profit", kind: "money" }], productsSold);
    }
    if (include("purchases")) {
      if (type !== "complete") addDataSheet(workbook, "Compras", "Compras del período", periodLabel, [{ header: "Compra", key: "id" }, { header: "Fecha", key: "purchased_at", kind: "date" }, { header: "Proveedor", key: "supplier", width: 25 }, { header: "Materia prima", key: "material", width: 25 }, { header: "Cantidad", key: "input_quantity", kind: "number" }, { header: "Unidad", key: "input_unit" }, { header: "Total", key: "total", kind: "money" }, { header: "Estado", key: "status" }], purchases);
      addDataSheet(workbook, "Proveedores", "Proveedores y compras", periodLabel, [{ header: "Código", key: "code" }, { header: "Proveedor", key: "name", width: 28 }, { header: "Email", key: "email", width: 28 }, { header: "Teléfono", key: "phone" }, { header: "Compras", key: "purchases_count" }, { header: "Total comprado", key: "total", kind: "money" }], suppliers);
      addDataSheet(workbook, "Materias compradas", "Materias primas compradas", periodLabel, [{ header: "Código", key: "code" }, { header: "Materia prima", key: "material", width: 28 }, { header: "Cantidad base", key: "quantity", kind: "number" }, { header: "Unidad", key: "unit" }, { header: "Total", key: "total", kind: "money" }], materialsBought);
    }
    if (include("expenses")) {
      if (type !== "complete") addDataSheet(workbook, "Gastos", "Gastos del período", periodLabel, [{ header: "Gasto", key: "id" }, { header: "Fecha", key: "incurred_at", kind: "date" }, { header: "Categoría", key: "category" }, { header: "Descripción", key: "description", width: 32 }, { header: "Importe", key: "amount", kind: "money" }, { header: "Pago", key: "payment_status" }, { header: "Estado", key: "record_status" }], expenses);
      addDataSheet(workbook, "Resumen de gastos", "Gastos agrupados por categoría", periodLabel, [{ header: "Categoría", key: "category", width: 28 }, { header: "Operaciones", key: "operations" }, { header: "Total", key: "total", kind: "money" }], expenseSummary);
    }
    if (include("profitability")) {
      addDataSheet(workbook, "Rentabilidad", "Rentabilidad histórica", periodLabel, [{ header: "Mes", key: "month" }, { header: "Ventas", key: "sales", kind: "money" }, { header: "Costo vendido", key: "sold_cost", kind: "money" }, { header: "Compras", key: "purchases", kind: "money" }, { header: "Gastos", key: "expenses", kind: "money" }, { header: "Ganancia bruta", key: "gross_profit", kind: "money" }, { header: "Ganancia neta", key: "net_profit", kind: "money" }, { header: "Margen", key: "margin", kind: "percent" }, { header: "Reinversión", key: "reserved", kind: "money" }, { header: "Disponible", key: "available", kind: "money" }], profitability);
      addDataSheet(workbook, "Reinversiones", "Movimientos de reinversión", periodLabel, [{ header: "Mes", key: "month" }, { header: "Fecha", key: "occurred_at", kind: "date" }, { header: "Concepto", key: "concept", width: 30 }, { header: "Categoría", key: "category" }, { header: "Importe", key: "amount", kind: "money" }, { header: "Notas", key: "notes", width: 32 }], reinvestments);
    }
    if (include("stock")) {
      addDataSheet(workbook, "Productos", "Stock y costo de productos", "Fotografía actual del inventario", [{ header: "Código", key: "code" }, { header: "Producto", key: "product", width: 28 }, { header: "Tipo", key: "type" }, { header: "Stock", key: "current_stock", kind: "number" }, { header: "Mínimo", key: "minimum_stock", kind: "number" }, { header: "Estado", key: "stock_status" }, { header: "Costo unitario", key: "unit_cost", kind: "money" }, { header: "Valor en stock", key: "stock_value", kind: "money" }], productStock);
      addDataSheet(workbook, "Materias primas", "Stock y costo de materias primas", "Fotografía actual del inventario", [{ header: "Código", key: "code" }, { header: "Materia prima", key: "material", width: 28 }, { header: "Categoría", key: "category" }, { header: "Stock", key: "current_stock", kind: "number" }, { header: "Unidad", key: "unit" }, { header: "Mínimo", key: "minimum_stock", kind: "number" }, { header: "Estado", key: "stock_status" }, { header: "Costo unitario", key: "unit_cost", kind: "money" }, { header: "Valor en stock", key: "stock_value", kind: "money" }, { header: "Proveedor", key: "supplier", width: 24 }], materialStock);
    }
    workbook.eachSheet((sheet) => { sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }; sheet.headerFooter.oddHeader = `&L&"Aptos,Bold"&14 KHORA&C${periodLabel}&R${new Date().toLocaleDateString("es-AR")}`; sheet.headerFooter.oddFooter = "&LKHORA · Información privada&C&P de &N&RReporte generado desde datos reales"; sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: cream } }; sheet.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: terracotta } }; });
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `KHORA-${type}-${from}-${to}.xlsx`;
    return new Response(buffer as ArrayBuffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("KHORA report error", error);
    return Response.json({ error: "No pudimos generar el reporte. Intentá nuevamente." }, { status: 500 });
  }
}
