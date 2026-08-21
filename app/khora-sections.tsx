"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { batches, comboDefinitions, expenses, materials, money, months, orders, products, purchases, recipeDefinitions, SectionId, suppliers, Tone } from "./khora-data";
import { getComboBreakdown, getProductionPlan, getPurchaseNeeds, type ProductionPlanItem, type PurchaseNeed, type RequirementCheck } from "./khora-planning";
import { buildWhatsAppLink, buildWhatsAppMessage, getProductMaterialImpacts, getProductProfitability, recommendedPrice, simulateMaterialIncrease, type WhatsAppTemplate } from "./khora-sales";
import { compareMonthlyClosures, getAvailableClosures, getCashPanel, getMonthlyClose, type CashPeriod } from "./khora-finance";
import { calendarLayers, countCalendarEvents, getBusinessCalendarEvents, type BusinessCalendarEvent, type CalendarLayer } from "./khora-calendar";
import { baseUnits, categoryPrefix, convertUnit, materialStockStatus, productsUsingMaterial, purchaseProjection, stockValue, suggestMaterialCode } from "./khora-inventory";
import { nextSequentialCode } from "./khora-codes";
import { KhoraIcon, moduleIcons, type KhoraIconName } from "./khora-icons";

type Props = { section: SectionId; search: string; onNavigate: (section: SectionId, query?: string) => void; onCreate?: (kind: string, section?: SectionId) => void };

export function SectionContent({ section, search, onNavigate, onCreate }: Props) {
  useEffect(() => {
    const selectNumberOnFocus = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.matches('input[type="number"]')) target.select();
    };
    document.addEventListener("focusin", selectNumberOnFocus);
    return () => document.removeEventListener("focusin", selectNumberOnFocus);
  }, []);
  if (section === "inicio") return <Dashboard onNavigate={onNavigate} />;
  if (section === "ventas") return <Sales search={search} />;
  if (section === "pedidos") return <Orders search={search} />;
  if (section === "clientes") return <Customers search={search} />;
  if (section === "productos") return <Products search={search} onCreateMaterial={() => onNavigate("stock")} />;
  if (section === "fabricacion") return <Manufacturing search={search} />;
  if (section === "stock") return <Stock search={search} />;
  if (section === "compras") return <Purchases search={search} onCreate={onCreate} />;
  if (section === "proveedores") return <Suppliers search={search} />;
  if (section === "calendario") return <CalendarPage onNavigate={onNavigate} />;
  return <Finance />;
}

function useKhoraRows<T extends Record<string, unknown>>(entity: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(`/api/khora?entity=${entity}`)
      .then(async (response) => { const data = await response.json() as { rows?: T[]; error?: string }; if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar los datos"); return data.rows ?? []; })
      .then((data) => { if (active) { setRows(data); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [entity, revision]);
  return { rows, loading, error, refresh: () => { setLoading(true); setRevision((value) => value + 1); } };
}

function Dashboard({ onNavigate }: { onNavigate: (section: SectionId, query?: string) => void }) {
  type Row = Record<string, unknown>;
  type DashboardState = { summary: Row; products: Row[]; materials: Row[]; sales: Row[]; clients: Row[]; orders: Row[]; profits: Row[]; profitability: Row[] };
  const empty: DashboardState = { summary: {}, products: [], materials: [], sales: [], clients: [], orders: [], profits: [], profitability: [] };
  const [data, setData] = useState<DashboardState>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const get = async (entity: string) => { const response = await fetch(`/api/khora?entity=${entity}`); if (!response.ok) throw new Error("No se pudieron cargar los datos reales"); return response.json() as Promise<{ rows?: Row[]; [key: string]: unknown }>; };
    Promise.all([get("summary"), get("products"), get("materials"), get("sales"), get("clients"), get("orders"), get("profits"), get("product_profitability")])
      .then(([summary, productRows, materialRows, saleRows, clientRows, orderRows, profitRows, profitabilityRows]) => { if (active) setData({ summary, products: productRows.rows ?? [], materials: materialRows.rows ?? [], sales: saleRows.rows ?? [], clients: clientRows.rows ?? [], orders: orderRows.rows ?? [], profits: profitRows.rows ?? [], profitability: profitabilityRows.rows ?? [] }); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos reales"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const number = (value: unknown) => Number(value) || 0;
  const pesos = (cents: unknown) => money(number(cents) / 100);
  const pendingOrders = data.orders.filter((row) => !["DELIVERED", "CANCELLED"].includes(String(row.status)));
  const unpaidSales = data.sales.filter((row) => !["PAID", "CANCELLED"].includes(String(row.payment_status)));
  const lowProducts = data.products.filter((row) => number(row.current_stock) <= number(row.minimum_stock));
  const lowMaterials = data.materials.filter((row) => number(row.current_stock) <= number(row.minimum_stock));
  const latestProfit = data.profits[0] ?? {};
  const topRealProducts = data.profitability.filter((row) => number(row.units_sold) > 0).slice(0, 5);
  const maxUnits = Math.max(1, ...topRealProducts.map((row) => number(row.units_sold)));
  const recoveryClients = data.clients.filter((row) => row.last_purchase && number(row.days_without_buying) >= 30).sort((a, b) => number(b.days_without_buying) - number(a.days_without_buying)).slice(0, 4);
  const alerts = [
    ...lowProducts.map((row) => ({ id: `product-${row.id}`, title: `${row.name} con stock bajo`, detail: `Quedan ${number(row.current_stock)} u. · mínimo ${number(row.minimum_stock)}`, section: "stock" as SectionId, tone: "danger" })),
    ...lowMaterials.map((row) => ({ id: `material-${row.id}`, title: `${row.material} necesita reposición`, detail: `Stock ${number(row.current_stock)} ${String(row.unit ?? "")}. · mínimo ${number(row.minimum_stock)}`, section: "compras" as SectionId, tone: "warning" })),
    ...unpaidSales.map((row) => ({ id: `sale-${row.id}`, title: `Venta V-${row.id} con cobro pendiente`, detail: `${String(row.client ?? "Consumidor final")} · faltan ${pesos(row.pending_cents)}`, section: "ventas" as SectionId, tone: "warning" })),
  ];
  const today = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return <div className="section-stack">
    {error && <div className="inline-notice error" role="alert"><span>!</span>{error}</div>}
    <section className="operations-center" aria-labelledby="today-title">
      <header className="operations-header"><div><p>CENTRO DE OPERACIONES</p><h2 id="today-title">Hoy</h2><span>{today} · datos actualizados desde Supabase</span></div><div className="operations-status"><i />{loading ? "Actualizando…" : alerts.length ? `${alerts.length} asuntos para revisar` : "Todo al día"}</div></header>
      <div className="today-agenda">
        <button onClick={() => onNavigate("pedidos")}><span className="agenda-glyph warning"><KhoraIcon name={moduleIcons.pedidos} /></span><span><strong>{pendingOrders.length} pedidos pendientes</strong><small>Revisar el tablero de trabajo</small></span><i>→</i></button>
        <button onClick={() => onNavigate("ventas")}><span className="agenda-glyph success"><KhoraIcon name={moduleIcons.ventas} /></span><span><strong>{data.sales.length} ventas registradas</strong><small>{unpaidSales.length} con cobro pendiente</small></span><i>→</i></button>
        <button onClick={() => onNavigate("stock")}><span className="agenda-glyph danger"><KhoraIcon name={moduleIcons.stock} /></span><span><strong>{lowProducts.length + lowMaterials.length} stocks para revisar</strong><small>Productos y materias primas</small></span><i>→</i></button>
        <button onClick={() => onNavigate("compras")}><span className="agenda-glyph info"><KhoraIcon name={moduleIcons.compras} /></span><span><strong>{lowMaterials.length} materias primas por comprar</strong><small>Según el mínimo configurado</small></span><i>→</i></button>
      </div>
      <div className="priority-columns">
        <div><h3><i className="priority-dot critical" />Requiere atención</h3>{alerts.filter((alert) => alert.tone === "danger").slice(0, 4).map((alert) => <button key={alert.id} onClick={() => onNavigate(alert.section)}><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><i>→</i></button>)}{!alerts.some((alert) => alert.tone === "danger") && <p className="empty-operation">✓ No hay faltantes críticos.</p>}</div>
        <div><h3><i className="priority-dot attention" />Para revisar</h3>{alerts.filter((alert) => alert.tone !== "danger").slice(0, 4).map((alert) => <button key={alert.id} onClick={() => onNavigate(alert.section)}><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><i>→</i></button>)}{!alerts.some((alert) => alert.tone !== "danger") && <p className="empty-operation">✓ No hay gestiones pendientes.</p>}</div>
      </div>
    </section>
    <div className="metric-grid">
      <Metric label="Pedidos pendientes" value={String(pendingOrders.length)} detail={`${data.orders.length} pedidos registrados`} tone="warning" icon={moduleIcons.pedidos} onClick={() => onNavigate("pedidos")} />
      <Metric label="Ventas registradas" value={pesos(data.summary.sales)} detail={`${data.sales.length} operaciones reales`} tone="success" icon={moduleIcons.ventas} />
      <Metric label="Ganancia neta" value={pesos(latestProfit.profit_cents)} detail={latestProfit.month ? `Cierre ${String(latestProfit.month)}` : "Sin cierre calculado"} tone="success" icon={moduleIcons.finanzas} />
      <Metric label="Productos bajos" value={String(number(data.summary.lowProducts))} detail="Según stock mínimo" tone="danger" icon={moduleIcons.productos} onClick={() => onNavigate("stock")} />
      <Metric label="Materias primas bajas" value={String(number(data.summary.lowMaterials))} detail="Requieren reposición" tone="warning" icon={moduleIcons.stock} onClick={() => onNavigate("stock")} />
    </div>
    <div className="dashboard-grid dashboard-main">
      <Panel className="chart-panel" title="Ventas y ganancias" subtitle="Cierres disponibles en Supabase" action={<button className="period-button">Histórico⌄</button>}>
        <DashboardMonthlyChart rows={data.profits} />
      </Panel>
      <Panel title="Centro de alertas" subtitle="Calculadas con los datos actuales" action={<span className="alert-total">{alerts.length} activas</span>}>
        <div className="alert-list">{alerts.slice(0, 6).map((alert) => <article className="alert-row" key={alert.id}><i className={`dot ${alert.tone}`} /><div><span className={`priority-label ${alert.tone === "danger" ? "critical" : "attention"}`}>{alert.tone === "danger" ? "CRÍTICO" : "ATENCIÓN"}</span><strong>{alert.title}</strong><p>{alert.detail}</p><button onClick={() => onNavigate(alert.section)}>Revisar →</button></div></article>)}{!alerts.length && <p className="empty-operation">✓ No hay alertas activas.</p>}</div>
      </Panel>
    </div>
    <div className="dashboard-grid dashboard-bottom">
      <Panel title="Productos más vendidos" subtitle="Historial real de ventas" action={<button className="text-button" onClick={() => onNavigate("productos")}>Ver productos →</button>}><div className="ranking">{topRealProducts.map((product, index) => <div className="rank-row" key={String(product.id)}><b>{index + 1}</b><div><span>{String(product.name)}</span><i><em style={{ width: `${(number(product.units_sold) / maxUnits) * 100}%` }} /></i></div><div><strong>{number(product.units_sold)} u.</strong><span>{pesos(product.accumulated_sales_cents)}</span></div></div>)}{!topRealProducts.length && <p className="empty-operation">Todavía no hay productos vendidos.</p>}</div></Panel>
      <Panel title="Clientes para recuperar" subtitle="30 días o más sin comprar" action={<button className="text-button" onClick={() => onNavigate("clientes")}>Ver clientes →</button>}><div className="recovery-list">{recoveryClients.map((client) => <article key={String(client.id)}><Avatar text={String(client.name).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()} /><div><strong>{String(client.name)}</strong><p>Última compra: {String(client.last_purchase).slice(0, 10)} · {number(client.sales_count)} compras</p></div><Badge tone="warning">{number(client.days_without_buying)} días</Badge></article>)}{!recoveryClients.length && <p className="empty-operation">No hay clientes para recuperar.</p>}</div></Panel>
      <Panel title="Pedidos próximos" subtitle="Ordenados por fecha prevista" action={<button className="text-button" onClick={() => onNavigate("pedidos")}>Ver tablero →</button>}><div className="mini-orders">{pendingOrders.slice(0, 4).map((order) => <article key={String(order.id)}><div><strong>{String(order.number)}</strong><span>{String(order.client ?? "Sin cliente")}</span></div><div><Badge tone="warning">{String(order.status)}</Badge><small>{order.expected_at ? String(order.expected_at).slice(0, 10) : "Sin fecha"}</small></div></article>)}{!pendingOrders.length && <p className="empty-operation">No hay pedidos pendientes.</p>}</div></Panel>
    </div>
  </div>;
}

function DashboardMonthlyChart({ rows }: { rows: Array<Record<string, unknown>> }) {
  const data = rows.slice(0, 6).reverse();
  if (!data.length) return <p className="empty-operation">Todavía no hay cierres mensuales para graficar.</p>;
  const value = (item: unknown) => Number(item) || 0;
  const maximum = Math.max(1, ...data.map((row) => value(row.sales_cents)));
  return <div className="chart"><div className="chart-y"><span>{money(maximum / 100)}</span><span>{money(maximum / 200)}</span><span>$0</span></div><div className="chart-area">{data.map((row) => <div className="chart-month" key={String(row.month)}><div className="bar-group"><i className="sales-bar" style={{ height: `${(value(row.sales_cents) / maximum) * 100}%` }} title={`Ventas ${money(value(row.sales_cents) / 100)}`} /><i className="profit-bar" style={{ height: `${Math.max(0, value(row.profit_cents)) / maximum * 100}%` }} title={`Ganancia ${money(value(row.profit_cents) / 100)}`} /></div><span>{String(row.month).slice(5, 7)}/{String(row.month).slice(2, 4)}</span></div>)}</div><div className="chart-legend"><span><i className="sales" />Ventas</span><span><i className="profit" />Ganancia</span></div></div>;
}

function Sales({ search }: { search: string }) {
  type SaleRow = { id: number; sold_at: string; client?: string; status: string; payment_status: string; origin: string; order_number?: string; total_cents: number; paid_cents: number; pending_cents: number } & Record<string, unknown>;
  const sales = useKhoraRows<SaleRow>("sales");
  const rows = sales.rows.filter((sale) => includesSearch(sale, search));
  const [tab, setTab] = useState("Ventas");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [documentLinks, setDocumentLinks] = useState<Array<{ id: number; filename: string }>>([]);
  const sold = rows.reduce((sum, sale) => sum + Number(sale.total_cents), 0), collected = rows.reduce((sum, sale) => sum + Number(sale.paid_cents), 0), pending = rows.reduce((sum, sale) => sum + Number(sale.pending_cents), 0), ticket = rows.length ? sold / rows.length : 0;
  const paymentLabel = (status: string) => status === "PAID" ? "Pagado" : status === "PARTIAL" ? "Parcial" : status === "CANCELLED" ? "Anulado" : "Pendiente";
  return <div className="section-stack"><Tabs tabs={["Ventas", "Listas de precios"]} active={tab} onChange={setTab} />{notice && <div className="inline-notice" role="status"><span>✓</span>{notice}</div>}{sales.error && <div className="inline-notice error" role="alert"><span>!</span>{sales.error}</div>}{documentLinks.length > 0 && <div className="sale-document-links"><div><strong>Documentos de la última venta</strong><span>El archivo oficial quedó vinculado a KHORA.</span></div>{documentLinks.map((document) => <div key={document.id}><a href={`/api/khora?entity=document_pdf&id=${document.id}`} target="_blank" rel="noreferrer">Ver PDF</a><a href={`/api/khora?entity=document_pdf&id=${document.id}&download=1`}>Descargar {document.filename}</a></div>)}</div>}{tab === "Ventas" ? <><div className="sale-create-row"><div><strong>Venta directa con entrega inmediata</strong><span>Podés sumar varios productos; KHORA valida stock y consume lotes FIFO al confirmar.</span></div><button className="primary-button" onClick={() => setShowForm(true)}>＋ Nueva venta</button></div><div className="summary-row"><MiniStat label="Vendido" value={money(sold / 100)} detail={`${rows.length} ventas registradas`} tone="success" /><MiniStat label="Cobrado" value={money(collected / 100)} detail={sold ? `${Math.round(collected / sold * 100)}% del total` : "Sin ventas"} tone="info" /><MiniStat label="Por cobrar" value={money(pending / 100)} detail={`${rows.filter((sale) => Number(sale.pending_cents) > 0).length} ventas pendientes`} tone="warning" /><MiniStat label="Ticket promedio" value={money(ticket / 100)} detail="Promedio del historial visible" tone="neutral" /></div><Toolbar placeholder="Buscar por cliente o número de venta…" filters={["Todas las fechas", "Todos los pagos", "Todos los medios"]} /><Panel title="Ventas recientes" subtitle={sales.loading ? "Actualizando…" : `${rows.length} movimientos encontrados`} action={<button className="secondary-button">↓ Exportar</button>}><DataTable headers={["Venta", "Fecha", "Cliente", "Origen", "Total", "Pago", "Estado", ""]}>{rows.map((sale) => <tr key={sale.id}><td><strong>V-{sale.id}</strong></td><td>{String(sale.sold_at).slice(0, 10)}</td><td><CellPerson name={sale.client || "Consumidor final"} /></td><td className="muted-cell">{sale.order_number ? `Pedido ${sale.order_number}` : sale.origin === "DIRECT" ? "Venta directa" : sale.origin}</td><td><strong>{money(Number(sale.total_cents) / 100)}</strong></td><td><Badge tone={sale.payment_status === "PAID" ? "success" : sale.payment_status === "PARTIAL" ? "warning" : "danger"}>{paymentLabel(sale.payment_status)}</Badge></td><td><Badge tone={sale.status === "CANCELLED" ? "danger" : "success"}>{sale.status === "CANCELLED" ? "Anulada" : "Confirmada"}</Badge></td><td><MoreButton /></td></tr>)}</DataTable>{!sales.loading && !rows.length && <div className="recipe-empty">Todavía no hay ventas registradas.</div>}</Panel></> : <PriceLists />}{showForm && <DirectSaleFormDialog onCancel={() => setShowForm(false)} onSaved={(message, documents) => { setShowForm(false); setNotice(message); setDocumentLinks(documents); sales.refresh(); window.setTimeout(() => setNotice(""), 5000); }} />}</div>;
}

type DirectSaleProduct = { id: number; code: string; name: string; type: string; stock: number; price: number };
type DirectSaleClient = { id: number; name: string };
type DirectSaleLine = { key: string; kind: "product" | "manual"; productId?: number; description: string; quantity: number; unitPriceCents: number };

function DirectSaleFormDialog({ onCancel, onSaved }: { onCancel: () => void; onSaved: (message: string, documents: Array<{ id: number; filename: string }>) => void }) {
  const money = (cents: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);
  const [clients, setClients] = useState<DirectSaleClient[]>([]);
  const [catalog, setCatalog] = useState<DirectSaleProduct[]>([]);
  const [clientId, setClientId] = useState<number | undefined>();
  const [priceList, setPriceList] = useState("Precio estándar");
  const [lines, setLines] = useState<DirectSaleLine[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountPesos, setDiscountPesos] = useState(0);
  const [adjustmentPesos, setAdjustmentPesos] = useState(0);
  const [initialPaymentPesos, setInitialPaymentPesos] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [documentOption, setDocumentOption] = useState("NONE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const subtotal = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPriceCents), 0);
  const total = Math.max(0, subtotal - Math.round(discountPesos * 100) + Math.round(adjustmentPesos * 100));

  useEffect(() => { fetch("/api/khora?entity=lookups").then((response) => response.json()).then((data: { clients?: Array<Record<string, unknown>> }) => setClients((data.clients ?? []).map((row) => ({ id: Number(row.id), name: String(row.name) })))).catch(() => undefined); }, []);
  useEffect(() => { let active = true; fetch(`/api/khora?entity=sale_catalog${clientId ? `&clientId=${clientId}` : ""}`).then((response) => response.json()).then((data: { client?: Record<string, unknown> | null; products?: Array<Record<string, unknown>> }) => { if (!active) return; const next = (data.products ?? []).map((row) => ({ id: Number(row.id), code: String(row.code), name: String(row.name), type: String(row.type), stock: Number(row.current_stock), price: Number(row.resolved_price_cents) })); setCatalog(next); setLines((current) => current.map((line) => { if (line.kind === "manual") return line; const product = next.find((item) => item.id === line.productId); return product ? { ...line, description: product.name, unitPriceCents: product.price } : line; })); setPriceList(String(data.client?.price_list ?? "Precio estándar")); }).catch(() => undefined); return () => { active = false; }; }, [clientId]);

  function addProduct() { const product = catalog.find((item) => !lines.some((line) => line.productId === item.id)); if (!product) { setError("No quedan productos disponibles para agregar."); return; } setLines((current) => [...current, { key: crypto.randomUUID(), kind: "product", productId: product.id, description: product.name, quantity: 1, unitPriceCents: product.price }]); setError(""); }
  function addManual() { setLines((current) => [...current, { key: crypto.randomUUID(), kind: "manual", description: "", quantity: 1, unitPriceCents: 0 }]); setError(""); }
  function updateLine(key: string, changes: Partial<DirectSaleLine>) { setLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line)); }
  function selectProduct(line: DirectSaleLine, productId: number) { if (lines.some((item) => item.key !== line.key && item.productId === productId)) { setError("Ese producto ya está en la venta."); return; } const product = catalog.find((item) => item.id === productId); if (product) updateLine(line.key, { productId, description: product.name, unitPriceCents: product.price }); setError(""); }
  async function save() { if (!lines.length) { setError("Agregá al menos un producto o concepto."); return; } if (lines.some((line) => line.quantity <= 0 || line.unitPriceCents < 0 || (line.kind === "manual" && !line.description.trim()))) { setError("Revisá las líneas de la venta."); return; } if (initialPaymentPesos * 100 > total) { setError("El cobro inicial no puede superar el total."); return; } const shortage = lines.find((line) => line.kind === "product" && line.quantity > (catalog.find((item) => item.id === line.productId)?.stock ?? 0)); if (shortage) { setError(`Stock insuficiente para ${shortage.description}.`); return; } setSaving(true); setError(""); try { const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sale", clientId, date, items: lines.map((line) => ({ productId: line.kind === "product" ? line.productId : undefined, description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents })), discountCents: Math.round(discountPesos * 100), adjustmentCents: Math.round(adjustmentPesos * 100), initialPaymentCents: Math.round(initialPaymentPesos * 100), paymentMethod, documentOption, notes }) }); const result = await response.json() as { error?: string; id?: number; totalCents?: number; profitCents?: number; paymentStatus?: string; documents?: Array<{ id: number; filename: string }>; documentErrors?: string[] }; if (!response.ok) throw new Error(result.error ?? "No se pudo confirmar la venta"); const documentNote = result.documentErrors?.length ? " El documento quedó pendiente y puede regenerarse sin repetir la venta." : result.documents?.length ? " PDF generado y vinculado." : ""; onSaved(`Venta V-${result.id} confirmada por ${money(result.totalCents ?? total)}. Ganancia histórica: ${money(result.profitCents ?? 0)} · ${result.paymentStatus === "PAID" ? "pagada" : result.paymentStatus === "PARTIAL" ? "cobro parcial" : "pendiente"}.${documentNote}`, result.documents ?? []); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo confirmar la venta"); } finally { setSaving(false); } }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onCancel} aria-label="Cancelar venta" /><aside className="inventory-form-drawer direct-sale-drawer" role="dialog" aria-modal="true" aria-labelledby="direct-sale-title"><header><div><p>VENTAS · ENTREGA INMEDIATA</p><h2 id="direct-sale-title">Nueva venta directa</h2><span>El stock y el costo histórico FIFO se registran al confirmar.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header><div className="inventory-form-body"><div className="form-grid"><label><span>Cliente</span><select value={clientId ?? ""} onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : undefined)}><option value="">Consumidor final</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><small>Lista aplicada: {priceList}</small></label><label><span>Fecha *</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div><section className="direct-sale-lines"><header><div><strong>Productos y conceptos</strong><p>Los productos descuentan stock; los conceptos manuales no.</p></div><div><button onClick={addManual}>＋ Concepto manual</button><button onClick={addProduct}>＋ Agregar producto</button></div></header>{lines.map((line) => { const product = catalog.find((item) => item.id === line.productId),available = line.kind === "manual" || line.quantity <= (product?.stock ?? 0); return <article key={line.key} className={available ? "available" : "shortage"}><div className="sale-line-main">{line.kind === "product" ? <label><span>Producto</span><select value={line.productId} onChange={(event) => selectProduct(line, Number(event.target.value))}>{catalog.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select><small>Stock: {product?.stock ?? 0} u. · {available ? "✓ Disponible" : "Stock insuficiente"}</small></label> : <label><span>Concepto personalizado</span><input value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} placeholder="Descripción del concepto" /><small>No modifica inventario</small></label>}</div><label><span>Cantidad</span><input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Math.max(0, Number(event.target.value) || 0) })} /></label><label><span>Precio unitario ($)</span><input type="number" min="0" step="0.01" value={line.unitPriceCents / 100} onChange={(event) => updateLine(line.key, { unitPriceCents: Math.max(0, Math.round((Number(event.target.value) || 0) * 100)) })} /></label><div className="sale-line-subtotal"><span>Subtotal</span><strong>{money(Math.round(line.quantity * line.unitPriceCents))}</strong></div><button className="sale-line-remove" aria-label={`Quitar ${line.description}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>×</button></article>; })}{!lines.length && <div className="recipe-empty">Agregá el primer producto para comenzar.</div>}</section><div className="form-grid"><label><span>Descuento ($)</span><input type="number" min="0" step="0.01" value={discountPesos} onChange={(event) => setDiscountPesos(Math.max(0, Number(event.target.value) || 0))} /></label><label><span>Ajuste ($)</span><input type="number" step="0.01" value={adjustmentPesos} onChange={(event) => setAdjustmentPesos(Number(event.target.value) || 0)} /></label></div><section className="direct-sale-total"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Total</span><strong>{money(total)}</strong></div></section><div className="form-grid"><label><span>Cobro inicial ($)</span><input type="number" min="0" step="0.01" value={initialPaymentPesos} onChange={(event) => setInitialPaymentPesos(Math.max(0, Number(event.target.value) || 0))} /><small>Pendiente: {money(Math.max(0, total - Math.round(initialPaymentPesos * 100)))}</small></label><label><span>Medio de pago</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Otro</option></select></label></div><section className="sale-document-choice"><div><strong>Documento</strong><span>El comprobante es interno y no fiscal.</span></div><label><span>Generar al confirmar</span><select value={documentOption} onChange={(event) => setDocumentOption(event.target.value)}><option value="NONE">No generar documento</option><option value="REMITO">Generar remito</option><option value="RECEIPT">Generar comprobante interno</option><option value="BOTH">Generar ambos</option></select></label></section><label><span>Notas</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="material-zero-rule"><span>i</span><p>La venta se confirma de forma atómica. Si el PDF falla, la venta no se duplica y el documento puede regenerarse por separado.</p></div>{error && <p className="form-error" role="alert">{error}</p>}</div><footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} aria-busy={saving} onClick={save}>{saving ? "Confirmando…" : "Confirmar venta"}</button></footer></aside></div>;
}

function PriceLists() {
  type PriceListRow = { id: number; code: string; name: string; price_modifier: number; is_default: boolean; active: boolean; clients_count: number; custom_prices: number } & Record<string, unknown>;
  const lists = useKhoraRows<PriceListRow>("price_lists");
  const active = lists.rows.filter((list) => list.active);
  return <><div className="summary-row three"><MiniStat label="Listas activas" value={String(active.length)} detail="Configuradas en Supabase" tone="info" /><MiniStat label="Clientes asignados" value={String(lists.rows.reduce((sum, list) => sum + Number(list.clients_count), 0))} detail="Precio automático" tone="success" /><MiniStat label="Precios históricos" value="Protegidos" detail="Cada venta conserva su precio" tone="neutral" /></div>{lists.error && <div className="inline-notice error"><span>!</span>{lists.error}</div>}<div className="price-list-grid">{lists.rows.map((list) => <article key={list.id}><header><div><small>{list.code}</small><h2>{list.name}</h2></div><Badge tone={!list.active ? "neutral" : list.is_default ? "success" : "info"}>{!list.active ? "Inactiva" : list.is_default ? "Predeterminada" : "Activa"}</Badge></header><p>{Number(list.price_modifier) === 1 ? "Usa el precio estándar de cada producto." : `${Math.abs(Math.round((1 - Number(list.price_modifier)) * 100))}% ${Number(list.price_modifier) < 1 ? "de descuento" : "de recargo"} sobre el precio estándar.`}</p><dl><div><dt>Clientes asignados</dt><dd>{Number(list.clients_count)}</dd></div><div><dt>Precios personalizados</dt><dd>{Number(list.custom_prices)}</dd></div><div><dt>Modificador</dt><dd>{Number(list.price_modifier).toFixed(2)}×</dd></div></dl><footer><span>Se aplica al crear el pedido o la venta</span></footer></article>)}</div>{!lists.loading && !lists.rows.length && <div className="recipe-empty">Todavía no hay listas de precios configuradas.</div>}<div className="price-history-note"><span>✓</span><div><strong>Historial protegido</strong><p>Los cambios futuros de una lista no modifican los precios ya guardados en ventas y pedidos.</p></div></div></>;
}

type OrderRecord = { id: number; number: string; client?: string; created_at: string; expected_at?: string; total_cents: number; status: string; payment_status: string; delivery_address?: string; notes?: string } & Record<string, unknown>;
type OrderView = "board" | "list";

const orderStatusLabel = (status: string) => ({ NEW: "Nuevo", PENDING: "Confirmado", PREPARING: "En preparación", MANUFACTURING: "En fabricación", READY: "Listo", SHIPPED: "Enviado", DELIVERED: "Entregado", CANCELLED: "Cancelado" }[status] ?? status);
const orderStatusTone = (status: string): Tone => status === "CANCELLED" ? "danger" : status === "DELIVERED" || status === "READY" ? "success" : status === "MANUFACTURING" ? "info" : status === "PREPARING" || status === "PENDING" ? "warning" : "neutral";
const orderPaymentLabel = (status: string) => status === "PAID" ? "Pagado" : status === "PARTIAL" ? "Parcial" : status === "CANCELLED" ? "Anulado" : "Pendiente";

function Orders({ search }: { search: string }) {
  const ordersData = useKhoraRows<OrderRecord>("orders");
  const [view, setView] = useState<OrderView>("board");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [dateFilter, setDateFilter] = useState("Todas las fechas");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const today = startOfDay(new Date());
  useEffect(() => {
    if (!search) return;
    const requestedOrder = ordersData.rows.find((order) => order.number === search || order.number.replace("#", "") === search.replace("#", "") || String(order.id) === search.replace("#", ""));
    if (!requestedOrder) return;
    const timeout = window.setTimeout(() => setSelectedOrder(requestedOrder), 0);
    return () => window.clearTimeout(timeout);
  }, [search, ordersData.rows]);
  const filtered = ordersData.rows.filter((order) => {
    const matchesText = includesSearch(order, search) && includesSearch(order, query);
    const matchesStatus = statusFilter === "Todos" || orderStatusLabel(order.status) === statusFilter;
    const expected = order.expected_at ? parseDate(String(order.expected_at).slice(0, 10)) : today;
    const daysAway = order.expected_at ? Math.round((expected.getTime() - today.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
    const matchesDate = dateFilter === "Todas las fechas" || (dateFilter === "Próximos 7 días" && daysAway >= 0 && daysAway <= 7) || (dateFilter === "Atrasados" && isOrderOverdue(order, today));
    return matchesText && matchesStatus && matchesDate;
  });
  const columns = [
    { name: "Nuevos", color: "neutral", items: filtered.filter((order) => ["NEW", "PENDING"].includes(order.status)) },
    { name: "En preparación", color: "warning", items: filtered.filter((order) => order.status === "PREPARING") },
    { name: "En fabricación", color: "info", items: filtered.filter((order) => order.status === "MANUFACTURING") },
    { name: "Listos", color: "success", items: filtered.filter((order) => ["READY", "SHIPPED", "DELIVERED"].includes(order.status)) },
  ];

  return <div className="section-stack">
    <div className="orders-toolbar">
      <div className="orders-filters">
        <label className="orders-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido o cliente…" aria-label="Buscar pedidos" /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado"><option>Todos</option><option>Nuevo</option><option>En preparación</option><option>En fabricación</option><option>Listo</option><option>Entregado</option></select>
        <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filtrar por fecha"><option>Todas las fechas</option><option>Próximos 7 días</option><option>Atrasados</option></select>
      </div>
      <div className="view-switch" aria-label="Vista de pedidos">
        <button aria-pressed={view === "board"} className={view === "board" ? "active" : ""} onClick={() => setView("board")}>▦ Tablero</button>
        <button aria-pressed={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}>☷ Lista</button>
      </div>
    </div>

    {ordersData.error && <div className="inline-notice error" role="alert"><span>!</span>{ordersData.error}</div>}

    {view === "board" && <div className="kanban">{columns.map((column) => <section key={column.name}><header><div><i className={`dot ${column.color}`} /><strong>{column.name}</strong></div><span>{column.items.length}</span></header><div className="kanban-cards">{column.items.map((order) => <article className="order-card" key={order.id} role="button" tabIndex={0} onClick={() => setSelectedOrder(order)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedOrder(order); }}><div className="order-card-head"><strong>{order.number}</strong><MoreButton /></div><h3>{order.client || "Sin cliente"}</h3><p>{order.notes || "Sin notas internas"}</p><div className="order-meta"><span>{money(Number(order.total_cents) / 100)}</span><Badge tone={order.payment_status === "PAID" ? "success" : "warning"}>{orderPaymentLabel(order.payment_status)}</Badge></div><footer className={isOrderOverdue(order, today) ? "late" : ""}><span>◷ {order.expected_at ? String(order.expected_at).slice(0, 10) : "Sin fecha"}</span><Avatar text={initials(order.client || "SC")} small /></footer></article>)}{column.items.length === 0 && <div className="empty-column">No hay pedidos</div>}</div></section>)}</div>}

    {view === "list" && <Panel title="Todos los pedidos" subtitle={ordersData.loading ? "Actualizando…" : `${filtered.length} pedidos visibles`}><DataTable headers={["Pedido", "Cliente", "Fecha", "Entrega", "Total", "Estado", "Pago", ""]}>{filtered.map((order) => <tr key={order.id}><td><strong>{order.number}</strong></td><td>{order.client || "Sin cliente"}</td><td>{String(order.created_at).slice(0, 10)}</td><td className={isOrderOverdue(order, today) ? "danger-text" : ""}>{order.expected_at ? String(order.expected_at).slice(0, 10) : "Sin fecha"}</td><td>{money(Number(order.total_cents) / 100)}</td><td><Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge></td><td>{orderPaymentLabel(order.payment_status)}</td><td><button className="table-open-button" onClick={() => setSelectedOrder(order)}>Ver detalle</button></td></tr>)}</DataTable>{!ordersData.loading && !filtered.length && <div className="recipe-empty">Todavía no hay pedidos registrados.</div>}</Panel>}

    {selectedOrder && <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} onChanged={() => { setSelectedOrder(null); ordersData.refresh(); }} />}
  </div>;
}

function CalendarPage({ onNavigate }: { onNavigate: (section: SectionId, query?: string) => void }) {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(() => { const firstDelivery = parseDate(orders[0].expectedAt); return new Date(firstDelivery.getFullYear(), firstDelivery.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<{ label: string; items: BusinessCalendarEvent[] } | null>(null);
  const openRecord = (event: BusinessCalendarEvent) => {
    const reference = event.orderId ?? event.reference;
    if (event.layer === "orders" || event.layer === "deliveries" || event.id.startsWith("manufacturing-order-")) onNavigate("pedidos", reference);
    else if (event.layer === "manufacturing") onNavigate("fabricacion", reference);
    else if (event.layer === "purchases") onNavigate("compras", reference);
    else onNavigate("ventas", reference);
  };
  return <div className="calendar-page section-stack">
    <BusinessCalendar month={month} today={today} onMonthChange={setMonth} onOpenEvent={openRecord} onOpenDay={(label, items) => setSelectedDay({ label, items })} />
    {selectedDay && <DayEventsPanel label={selectedDay.label} events={selectedDay.items} onClose={() => setSelectedDay(null)} onOpen={(event) => { setSelectedDay(null); openRecord(event); }} />}
  </div>;
}

function BusinessCalendar({ month, today, onMonthChange, onOpenEvent, onOpenDay }: { month: Date; today: Date; onMonthChange: (month: Date) => void; onOpenEvent: (event: BusinessCalendarEvent) => void; onOpenDay: (label: string, events: BusinessCalendarEvent[]) => void }) {
  const [enabledLayers, setEnabledLayers] = useState<CalendarLayer[]>(calendarLayers.map((layer) => layer.id));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(gridStart); day.setDate(gridStart.getDate() + index); return day; });
  const monthTitle = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(month);
  const title = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
  const changeMonth = (delta: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  const allEvents = getBusinessCalendarEvents();
  const events = allEvents.filter((event) => enabledLayers.includes(event.layer));
  const counts = countCalendarEvents(allEvents, enabledLayers);
  const toggleLayer = (layer: CalendarLayer) => setEnabledLayers((current) => current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer]);
  return <section className="orders-calendar">
    <header className="calendar-header"><div><p>CALENDARIO DEL NEGOCIO</p><h2>{title}</h2><span>{events.length} eventos visibles · {enabledLayers.length} capas activas</span></div><div className="calendar-nav"><button onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button><button onClick={() => onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))}>Hoy</button><button onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button></div></header>
    <div className="calendar-layers" role="group" aria-label="Capas del calendario">{calendarLayers.map((layer) => { const active = enabledLayers.includes(layer.id); return <button key={layer.id} className={`${layer.id} ${active ? "active" : ""}`} aria-pressed={active} onClick={() => toggleLayer(layer.id)}><i>{active ? "✓" : ""}</i><span><KhoraIcon name={layer.icon} /> {layer.label}</span><b>{counts[layer.id]}</b></button>; })}</div>
    <div className="calendar-weekdays">{["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">{days.map((day) => {
      const key = isoDate(day), dayEvents = events.filter((event) => event.date === key), outside = day.getMonth() !== month.getMonth(), isToday = key === isoDate(today);
      return <div className={`calendar-day ${outside ? "outside" : ""} ${isToday ? "today" : ""}`} key={key}><div className="calendar-day-number"><button className="calendar-date-button" onClick={() => onOpenDay(formatDay(day), dayEvents)} aria-label={`Ver agenda del ${formatDay(day)}`}>{day.getDate()}</button>{dayEvents.length > 2 && <button onClick={() => onOpenDay(formatDay(day), dayEvents)}>{dayEvents.length} eventos</button>}</div><div className="calendar-events">{dayEvents.slice(0, 2).map((event) => <CalendarBusinessEvent key={event.id} event={event} onOpen={onOpenEvent} />)}{dayEvents.length > 2 && <button className="more-day-orders" onClick={() => onOpenDay(formatDay(day), dayEvents)}>+{dayEvents.length - 2} más</button>}{dayEvents.length === 0 && isToday && <span className="calendar-clear-day">Todo al día</span>}</div></div>;
    })}</div>
    <footer className="calendar-legend"><span><i className="orders" />Pedido</span><span><i className="deliveries" />Entrega</span><span><i className="manufacturing" />Fabricación</span><span><i className="purchases" />Compra</span><span><i className="payments" />Cobro</span></footer>
  </section>;
}

function CalendarBusinessEvent({ event, onOpen }: { event: BusinessCalendarEvent; onOpen: (event: BusinessCalendarEvent) => void }) {
  const layer = calendarLayers.find((item) => item.id === event.layer)!;
  return <button className={`calendar-business-event ${event.layer} ${event.tone}`} onClick={() => onOpen(event)} title={`${layer.label} · ${event.title}`}><i><KhoraIcon name={layer.icon} /></i><span><strong>{event.title}</strong><small>{event.time ? `${event.time} · ` : ""}{event.subtitle}</small></span></button>;
}

function OrderDetail({ order, onClose, onChanged }: { order: OrderRecord; onClose: () => void; onChanged: () => void }) {
  const [nextStatus, setNextStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function saveStatus() {
    if (nextStatus === order.status) return onClose();
    setSaving(true); setError("");
    try { const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_order_status", id: order.id, status: nextStatus }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error ?? "No se pudo actualizar el pedido"); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el pedido"); }
    finally { setSaving(false); }
  }
  return <div className="order-detail-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar detalle" /><aside className="order-detail" role="dialog" aria-modal="true" aria-labelledby="order-detail-title"><header><div><p>DETALLE DEL PEDIDO</p><h2 id="order-detail-title">Pedido {order.number}</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div className="order-detail-body"><div className="order-detail-customer"><Avatar text={initials(order.client || "SC")} /><div><strong>{order.client || "Sin cliente"}</strong><span>Registro guardado en Supabase</span></div></div><dl><div><dt>Estado</dt><dd><Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge></dd></div><div><dt>Pago</dt><dd>{orderPaymentLabel(order.payment_status)}</dd></div><div><dt>Fecha del pedido</dt><dd>{String(order.created_at).slice(0, 10)}</dd></div><div><dt>Entrega prevista</dt><dd>{order.expected_at ? String(order.expected_at).slice(0, 10) : "Sin fecha"}</dd></div></dl><section><span>DATOS OPERATIVOS</span><article><div><strong>{order.delivery_address || "Sin dirección de entrega"}</strong><small>{order.notes || "Sin notas internas"}</small></div><strong>{money(Number(order.total_cents) / 100)}</strong></article></section><label><span>Actualizar estado</span><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}><option value="NEW">Nuevo</option><option value="PENDING">Confirmado</option><option value="PREPARING">En preparación</option><option value="MANUFACTURING">En fabricación</option><option value="READY">Listo</option><option value="SHIPPED">Enviado</option><option value="DELIVERED">Entregado</option><option value="CANCELLED">Cancelado</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="order-detail-total"><span>Total</span><strong>{money(Number(order.total_cents) / 100)}</strong></div></div><footer><button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button" disabled={saving} onClick={saveStatus}>{saving ? "Guardando…" : "Guardar estado"}</button></footer></aside></div>;
}

function RequirementRow({ item }: { item: RequirementCheck }) {
  return <article className={item.shortage > 0 ? "has-shortage" : "is-ready"}><span>{item.shortage > 0 ? "!" : "✓"}</span><div><strong>{item.name}</strong><small>{item.kind} · necesarios {formatQuantity(item.required)} {item.unit}</small></div><b>{item.shortage > 0 ? `Faltan ${formatQuantity(item.shortage)} ${item.unit}` : `Disponible ${formatQuantity(item.available)} ${item.unit}`}</b></article>;
}

function DayEventsPanel({ label, events, onClose, onOpen }: { label: string; events: BusinessCalendarEvent[]; onClose: () => void; onOpen: (event: BusinessCalendarEvent) => void }) {
  return <div className="day-orders-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar agenda del día" /><section className="day-orders-panel day-events-panel" role="dialog" aria-modal="true" aria-labelledby="day-orders-title"><header><div><p>AGENDA DEL DÍA</p><h2 id="day-orders-title">{label}</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></header>{events.length ? <div>{events.map((event) => { const layer = calendarLayers.find((item) => item.id === event.layer)!; return <button className="day-order-row day-event-row" key={event.id} onClick={() => onOpen(event)}><span className={`day-event-glyph ${event.layer}`}><KhoraIcon name={layer.icon} /></span><span><strong>{event.title}</strong><small>{layer.label} · {event.subtitle}{event.time ? ` · ${event.time}` : ""}</small></span><Badge tone={event.tone}>{event.status}</Badge></button>; })}</div> : <div className="empty-day-events"><span>✓</span><strong>Todo al día</strong><p>No hay eventos programados para esta fecha.</p></div>}</section></div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CalendarEventDetail({ event, onClose, onOpenOrder }: { event: BusinessCalendarEvent; onClose: () => void; onOpenOrder?: () => void }) {
  const layer = calendarLayers.find((item) => item.id === event.layer)!;
  return <div className="order-detail-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar evento" /><aside className="calendar-event-detail" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title"><header><div><p>{layer.label.toLocaleUpperCase("es")}</p><h2 id="calendar-event-title">{event.title}</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div className="calendar-event-body"><div className={`calendar-event-identity ${event.layer}`}><span><KhoraIcon name={layer.icon} /></span><div><small>{layer.label}</small><strong>{event.subtitle}</strong></div><Badge tone={event.tone}>{event.status}</Badge></div><dl><div><dt>Fecha</dt><dd>{formatDay(parseDate(event.date))}</dd></div><div><dt>Hora</dt><dd>{event.time ?? "Sin horario"}</dd></div><div><dt>Referencia</dt><dd>{event.reference}</dd></div>{event.amount !== undefined && <div><dt>Importe</dt><dd>{money(event.amount)}</dd></div>}</dl><section><span>DETALLE</span>{event.details.map((detail) => <p key={detail}>{detail}</p>)}</section><div className="calendar-source-note"><i>i</i><p>Este evento está vinculado al registro operativo original. El calendario no duplica ni modifica sus datos.</p></div></div><footer><button className="secondary-button" onClick={onClose}>Cerrar</button>{onOpenOrder && <button className="primary-button" onClick={onOpenOrder}>Abrir pedido</button>}</footer></aside></div>;
}

function parseDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function isoDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function formatDay(value: Date) { return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(value); }
function isOrderOverdue(order: OrderRecord, today: Date) { return Boolean(order.expected_at) && !["DELIVERED", "CANCELLED"].includes(order.status) && parseDate(String(order.expected_at).slice(0, 10)).getTime() < today.getTime(); }

function Customers({ search }: { search: string }) {
  type ClientRow = { id: number; name: string; phone?: string; email?: string; address?: string; active: boolean; price_list?: string; sales_count: number; total_spent_cents: number; average_ticket_cents: number; last_purchase?: string; days_without_buying?: number } & Record<string, unknown>;
  const clients = useKhoraRows<ClientRow>("clients");
  const filtered = clients.rows.filter((client) => includesSearch(client, search));
  const recovery = clients.rows.filter((client) => client.last_purchase && Number(client.days_without_buying) >= 30).sort((a, b) => Number(b.days_without_buying) - Number(a.days_without_buying));
  const [tab, setTab] = useState("Clientes");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [whatsappCustomer, setWhatsappCustomer] = useState<ClientRow | null>(null);
  const frequent = clients.rows.filter((client) => Number(client.sales_count) >= 3).length;
  const wholesale = clients.rows.filter((client) => client.price_list && !String(client.price_list).toLowerCase().includes("estándar")).length;
  return <div className="section-stack"><Tabs tabs={["Clientes", `Para recuperar · ${recovery.length}`]} active={tab} onChange={setTab} />{clients.error && <div className="inline-notice error"><span>!</span>{clients.error}</div>}<div className="summary-row three"><MiniStat label="Clientes frecuentes" value={String(frequent)} detail="Tres compras o más" tone="success" /><MiniStat label="Con lista especial" value={String(wholesale)} detail="Precio asignado automáticamente" tone="info" /><MiniStat label="Para recuperar" value={String(recovery.length)} detail="30 días o más sin comprar" tone="danger" /></div>{tab === "Clientes" ? <><Toolbar placeholder="Buscar por nombre, teléfono o localidad…" filters={["Todos los clientes", "Clasificación", "Lista de precios"]} /><Panel title="Clientes" subtitle={clients.loading ? "Actualizando…" : `${filtered.length} clientes visibles`}><DataTable headers={["Cliente", "Contacto", "Última compra", "Ventas", "Ticket promedio", "Total comprado", "Clasificación", ""]}>{filtered.map((client) => { const label = Number(client.sales_count) >= 3 ? "Frecuente" : Number(client.sales_count) > 0 ? "Activo" : "Nuevo"; return <tr key={client.id}><td><CellPerson name={client.name} subtitle={client.address || "Sin dirección"} /></td><td><span>{client.phone || "Sin teléfono"}</span><small className="table-sub">{client.email || "Sin email"}</small></td><td>{client.last_purchase ? String(client.last_purchase).slice(0, 10) : "Sin compras"}</td><td>{Number(client.sales_count)}</td><td><strong>{money(Number(client.average_ticket_cents) / 100)}</strong></td><td>{money(Number(client.total_spent_cents) / 100)}</td><td><Badge tone={label === "Frecuente" ? "success" : label === "Activo" ? "info" : "neutral"}>{label}</Badge><small className="table-sub">{client.price_list || "Sin lista"}</small></td><td><button className="table-open-button" onClick={() => setSelected(client)}>Ver ficha</button></td></tr>; })}</DataTable>{!clients.loading && !filtered.length && <div className="recipe-empty">Todavía no hay clientes registrados.</div>}</Panel></> : recovery.length ? <div className="recovery-grid">{recovery.map((client) => <article key={client.id}><header><Avatar text={initials(client.name)} /><div><h2>{client.name}</h2><p>{client.address || "Sin dirección"}</p></div><Badge tone="danger">Inactivo</Badge></header><div className="recovery-delay"><strong>{Number(client.days_without_buying)} días</strong><span>desde la última compra</span><i><em style={{ width: `${Math.min(100, Number(client.days_without_buying))}%` }} /></i><small>Última compra: {String(client.last_purchase).slice(0, 10)}</small></div><footer><button className="secondary-button" onClick={() => setSelected(client)}>Ver ficha</button><button className="primary-button" disabled={!client.phone} onClick={() => setWhatsappCustomer(client)}>Preparar WhatsApp</button></footer></article>)}</div> : <div className="empty-recovery"><span>✓</span><h2>No hay clientes para recuperar</h2><p>Ningún cliente con compras superó los 30 días de inactividad.</p></div>}{selected && <CustomerDetail customer={selected} onClose={() => setSelected(null)} onWhatsApp={() => setWhatsappCustomer(selected)} />}{whatsappCustomer && <WhatsAppComposer customer={whatsappCustomer} defaultTemplate="recovery" onClose={() => setWhatsappCustomer(null)} />}</div>;
}

function CustomerDetail({ customer, onClose, onWhatsApp }: { customer: { name: string; phone?: string; email?: string; address?: string; price_list?: string; sales_count: number; total_spent_cents: number; average_ticket_cents: number; last_purchase?: string; days_without_buying?: number }; onClose: () => void; onWhatsApp: () => void }) {
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar ficha" /><aside className="customer-detail" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title"><header><div><p>FICHA DEL CLIENTE</p><h2 id="customer-detail-title">{customer.name}</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div className="customer-detail-body"><div className="customer-profile"><Avatar text={initials(customer.name)} /><div><strong>{customer.name}</strong><span>{customer.phone || "Sin teléfono"} · {customer.email || "Sin email"}</span><small>{customer.address || "Sin dirección"}</small></div><Badge tone="info">{customer.price_list || "Precio estándar"}</Badge></div><div className="customer-kpis"><div><span>Ventas</span><strong>{Number(customer.sales_count)}</strong></div><div><span>Total comprado</span><strong>{money(Number(customer.total_spent_cents) / 100)}</strong></div><div><span>Ticket promedio</span><strong>{money(Number(customer.average_ticket_cents) / 100)}</strong></div><div><span>Días sin comprar</span><strong>{customer.days_without_buying ?? "—"}</strong></div></div><section className="customer-activity"><header><h3>Relación comercial</h3><Badge tone="success">Datos reales</Badge></header><dl><div><dt>Última compra</dt><dd>{customer.last_purchase ? String(customer.last_purchase).slice(0, 10) : "Sin compras"}</dd></div><div><dt>Lista aplicada</dt><dd>{customer.price_list || "Sin lista"}</dd></div><div><dt>Estado</dt><dd>Activo</dd></div></dl></section></div><footer><button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button" disabled={!customer.phone} onClick={onWhatsApp}>Preparar WhatsApp</button></footer></aside></div>;
}

function WhatsAppComposer({ customer, order, defaultTemplate = "confirm", onClose }: { customer: { name: string; phone?: string }; order?: (typeof orders)[number]; defaultTemplate?: WhatsAppTemplate; onClose: () => void }) {
  const available: Array<{ value: WhatsAppTemplate; label: string }> = order ? [
    { value: "confirm", label: "Confirmar pedido" },
    { value: "preparing", label: "Avisar que está en preparación" },
    { value: "ready", label: "Avisar que está listo" },
    { value: "delivery", label: "Coordinar entrega" },
    { value: "payment", label: "Recordar pago" },
  ] : [{ value: "recovery", label: "Retomar contacto" }];
  const initialTemplate = available.some((item) => item.value === defaultTemplate) ? defaultTemplate : available[0].value;
  const [template, setTemplate] = useState<WhatsAppTemplate>(initialTemplate);
  const [message, setMessage] = useState(() => buildWhatsAppMessage(initialTemplate, customer.name, order));
  function changeTemplate(value: WhatsAppTemplate) { setTemplate(value); setMessage(buildWhatsAppMessage(value, customer.name, order)); }
  return <div className="whatsapp-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar mensaje" /><section className="whatsapp-composer" role="dialog" aria-modal="true" aria-labelledby="whatsapp-title"><header><div><p>MENSAJE PREPARADO</p><h2 id="whatsapp-title">WhatsApp para {customer.name}</h2><span>{customer.phone || "Sin teléfono"}</span></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div><label><span>Motivo</span><select value={template} onChange={(event) => changeTemplate(event.target.value as WhatsAppTemplate)}>{available.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Revisá el mensaje antes de continuar</span><textarea rows={11} value={message} onChange={(event) => setMessage(event.target.value)} /></label><div className="whatsapp-safe-note"><i>i</i><p>KHORA no envía mensajes automáticamente. Se abrirá WhatsApp con este borrador para que lo revises nuevamente.</p></div></div><footer><button className="secondary-button" onClick={onClose}>Cancelar</button>{customer.phone && <a className="primary-button" href={buildWhatsAppLink(customer.phone, message)} target="_blank" rel="noreferrer">Abrir WhatsApp ↗</a>}</footer></section></div>;
}

function Products({ search, onCreateMaterial }: { search: string; onCreateMaterial: () => void }) {
  const [tab, setTab] = useState("Productos");
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<(typeof products)[number] | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showComboForm, setShowComboForm] = useState(false);
  const [productNotice, setProductNotice] = useState("");
  const filtered = products.filter((product) => includesSearch(product, search));
  function selectPhoto(code: string, file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => setPhotos((current) => ({ ...current, [code]: String(reader.result) })));
    reader.readAsDataURL(file);
  }
  function completed(message: string) { setShowProductForm(false); setShowComboForm(false); setProductNotice(message); window.setTimeout(() => setProductNotice(""), 4200); }
  return <div className="section-stack"><Tabs tabs={["Productos", "Combos", "Recetas", "Categorías"]} active={tab} onChange={setTab} />{productNotice && <div className="inline-notice" role="status"><span>✓</span>{productNotice}</div>}{(tab === "Productos" || tab === "Recetas") && <div className="product-create-row"><div><strong>Producto y receta son definiciones</strong><span>Crearlos no suma stock ni consume materias primas.</span></div><button className="primary-button" onClick={() => setShowProductForm(true)}>＋ Nuevo producto</button></div>}{tab === "Productos" && <><div className="summary-row"><MiniStat label="Productos activos" value="24" detail="5 categorías" tone="info" /><MiniStat label="Valor del stock" value={money(684200)} detail="A costo actual" tone="neutral" /><MiniStat label="Stock bajo" value="3" detail="Requieren fabricación" tone="warning" /><MiniStat label="Margen promedio" value="58,3%" detail="Sobre precio de venta" tone="success" /></div><Toolbar placeholder="Buscar producto o código…" filters={["Todas las categorías", "Todos los estados"]} /><div className="product-grid">{filtered.map((product) => <article className="product-card" key={product.code}><div className={`product-visual ${photos[product.code] ? "has-photo" : ""}`}>{photos[product.code] ? <Image src={photos[product.code]} alt={`Foto de ${product.name}`} fill sizes="(max-width: 650px) 100vw, (max-width: 1200px) 50vw, 33vw" unoptimized /> : <div className="product-photo-empty"><span>{product.category === "Combos" ? "K" : "kh"}</span><small>Foto del producto</small></div>}<div className="product-visual-actions"><Badge tone={product.tone}>{product.stock <= product.minimum ? "Stock bajo" : "Disponible"}</Badge><label className="photo-upload"><span>▣ {photos[product.code] ? "Cambiar foto" : "Agregar foto"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectPhoto(product.code, event.target.files?.[0])} /></label></div></div><div className="product-body"><small>{product.code} · {product.category}</small><div className="product-title-row"><h3>{product.name}</h3><span className={`stock-chip ${product.tone}`}>Stock {product.stock} u.</span></div><div className="product-numbers"><div><span>Precio</span><strong>{money(product.price)}</strong></div><div><span>Costo</span><strong>{money(product.cost)}</strong></div><div><span>Margen</span><strong>{product.margin}%</strong></div></div><footer><span>{product.sold} vendidas este mes</span><button onClick={() => setSelectedProduct(product)}>Ver detalle →</button></footer></div></article>)}</div></>}{tab === "Recetas" && <RecipeList onCreate={() => setShowProductForm(true)} />}{tab === "Combos" && <ComboList onCreate={() => setShowComboForm(true)} />}{tab === "Categorías" && <SimpleCategories />}{selectedProduct && <ProductProfitabilityDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} />}{showProductForm && <ProductFormDialog onCancel={() => setShowProductForm(false)} onSaved={completed} onCreateMaterial={() => { setShowProductForm(false); onCreateMaterial(); }} />}{showComboForm && <ComboFormDialog onCancel={() => setShowComboForm(false)} onSaved={completed} />}</div>;
}

type RecipeDraftItem = { materialId: number; quantity: string };

function ProductFormDialog({ onCancel, onSaved, onCreateMaterial }: { onCancel: () => void; onSaved: (message: string) => void; onCreateMaterial: () => void }) {
  const [catalog, setCatalog] = useState<MaterialRecord[]>(() => demoMaterials.map((material) => ({ ...material, cost: material.cost * 100 })));
  const [code, setCode] = useState(() => nextSequentialCode(products.filter((item) => item.category !== "Combos").map((item) => item.code), "PRODUCT"));
  const [name, setName] = useState("");
  const [pricePesos, setPricePesos] = useState(0);
  const [minimum, setMinimum] = useState(0);
  const [notes, setNotes] = useState("");
  const [hasRecipe, setHasRecipe] = useState(true);
  const [items, setItems] = useState<RecipeDraftItem[]>([]);
  const recipeLinesRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const quantityValue = (value: string) => Number(value.replace(",", ".")) || 0;
  const estimatedCost = hasRecipe ? Math.round(items.reduce((sum, item) => sum + quantityValue(item.quantity) * (catalog.find((material) => material.id === item.materialId)?.cost ?? 0), 0)) : 0;
  const salePriceCents = Math.round(pricePesos * 100);
  const estimatedProfit = salePriceCents - estimatedCost;
  const estimatedMargin = salePriceCents > 0 ? estimatedProfit * 100 / salePriceCents : 0;

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/khora?entity=materials"), fetch("/api/khora?entity=next_code&kind=PRODUCT")]).then(async ([materialResponse, codeResponse]) => {
      if (!materialResponse.ok || !codeResponse.ok) throw new Error();
      return Promise.all([materialResponse.json() as Promise<{ rows?: Array<Record<string, unknown>> }>, codeResponse.json() as Promise<{ code?: string }>]);
    }).then(([materialData, codeData]) => {
      if (!active) return;
      const apiMaterials = (materialData.rows ?? []).filter((row) => Boolean(row.active)).map((row) => { const visibleCode = String(row.code), rawName = String(row.material), repeatedPrefix = `${visibleCode} · `; return { id: Number(row.id), code: visibleCode, name: rawName.startsWith(repeatedPrefix) ? rawName.slice(repeatedPrefix.length) : rawName, category: String(row.category ?? "Sin categoría"), categoryId: Number(row.category_id), prefix: String(row.prefix ?? "MAT"), unit: String(row.unit), stock: Number(row.current_stock), minimum: Number(row.minimum_stock), cost: Number(row.current_cost_cents), supplier: String(row.preferred_supplier ?? "Sin proveedor") }; });
      setCatalog(apiMaterials);
      if (codeData.code) setCode(codeData.code);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!items.length) return;
    const frame = window.requestAnimationFrame(() => {
      const list = recipeLinesRef.current;
      if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items.length]);

  function addItem() {
    setItems((current) => [...current, { materialId: 0, quantity: "" }]); setError("");
  }
  function changeItem(index: number, materialId: number) { if (materialId > 0 && items.some((item, itemIndex) => itemIndex !== index && item.materialId === materialId)) { setError("Esa materia prima ya está en la receta."); return; } setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, materialId } : item)); setError(""); }
  async function save() {
    if (!name.trim()) { setError("Ingresá el nombre del producto."); return; }
    if (pricePesos < 0) { setError("El precio no puede ser negativo."); return; }
    if (hasRecipe && !items.length) { setError("Agregá al menos una materia prima a la receta."); return; }
    if (hasRecipe && items.some((item) => item.materialId <= 0)) { setError("Seleccioná una materia prima en cada fila de la receta."); return; }
    if (hasRecipe && items.some((item) => quantityValue(item.quantity) <= 0)) { setError("Todas las cantidades de la receta deben ser mayores que cero."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_product_with_recipe", name, salePriceCents, minimumStock: minimum, notes, hasRecipe, items: hasRecipe ? items.map((item) => ({ materialId: item.materialId, quantity: quantityValue(item.quantity) })) : [] }) });
      const result = await response.json() as { error?: string; product?: { code?: string; estimated_cost_cents?: number; current_stock?: number } };
      if (!response.ok) throw new Error(result.error ?? "No se pudo crear el producto");
      const savedCode = result.product?.code ?? code;
      onSaved(`Producto ${savedCode} creado correctamente con stock 0${hasRecipe ? ` y costo estimado ${money((result.product?.estimated_cost_cents ?? estimatedCost) / 100)}` : " como producto simple"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear el producto"); } finally { setSaving(false); }
  }

  return <div className="drawer-layer">
    <button className="drawer-backdrop" onClick={onCancel} aria-label="Cancelar producto" />
    <aside className="inventory-form-drawer product-form-drawer" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
      <header><div><p>PRODUCTOS · DEFINICIÓN</p><h2 id="product-form-title">Nuevo producto</h2><span>Definí el producto y, si corresponde, su receta por unidad.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header>
      <div className="inventory-form-body">
        <div className="form-grid"><label className="automatic-code-field"><span>Código</span><input value={code} readOnly aria-describedby="product-code-help" /><small id="product-code-help">Generado automáticamente</small></label><label><span>Nombre del producto *</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Difusor Lavanda 250 ml" /></label></div>
        <div className="form-grid"><label><span>Precio de venta ($)</span><input type="number" min="0" step="0.01" value={pricePesos} onChange={(event) => setPricePesos(Math.max(0, Number(event.target.value) || 0))} /></label><label><span>Stock mínimo</span><input type="number" min="0" step="1" value={minimum} onChange={(event) => setMinimum(Math.max(0, Number(event.target.value) || 0))} /></label></div>
        <label><span>Notas internas <small>OPCIONAL</small></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <label className="recipe-mode"><input type="checkbox" checked={hasRecipe} onChange={(event) => { setHasRecipe(event.target.checked); setError(""); }} /><span><strong>Producto fabricado</strong><small>Incluye una receta de materias primas. Desmarcá para un producto simple o de reventa.</small></span></label>
        <section className={`recipe-editor recipe-editor-visible ${hasRecipe ? "" : "recipe-editor-disabled"}`} aria-labelledby="recipe-title" data-testid="product-recipe-editor">
          <header><div><strong id="recipe-title">Materias primas y cantidades</strong><p>{hasRecipe ? "Seleccioná los insumos guardados y cuánto necesitás para fabricar UNA unidad." : "La receta está desactivada porque el producto se guardará como simple o de reventa."}</p></div>{hasRecipe && catalog.length > 0 && <button type="button" data-testid="recipe-add-material" onClick={addItem}>+ Agregar materia prima</button>}</header>
          {!hasRecipe ? <div className="recipe-disabled-message"><span>○</span><div><strong>Receta desactivada</strong><p>Marcá “Producto fabricado” para agregar materias primas y calcular el costo.</p></div></div> : catalog.length === 0 ? <div className="recipe-no-materials"><strong>Todavía no hay materias primas cargadas</strong><p>Primero creá una materia prima para poder armar la receta.</p><button type="button" onClick={onCreateMaterial}>+ Crear materia prima</button></div> : <>
            <div className="recipe-lines" ref={recipeLinesRef} data-testid="recipe-material-list">{items.map((item, index) => { const selected = catalog.find((material) => material.id === item.materialId); const choices = catalog.filter((material) => material.id === item.materialId || !items.some((line, lineIndex) => lineIndex !== index && line.materialId === material.id)); return <article key={`recipe-${index}-${item.materialId}`} data-testid={`recipe-material-row-${index}`}><span className="recipe-line-icon" aria-hidden="true">⚗</span><label><span>Materia prima guardada</span><select value={item.materialId} onChange={(event) => changeItem(index, Number(event.target.value))}><option value={0}>Seleccionar materia prima…</option>{choices.map((material) => <option key={material.id} value={material.id}>{material.code} · {material.name}</option>)}</select><small>{selected?.category ?? "Elegí un insumo guardado"}</small></label><label><span>Cantidad necesaria por unidad</span><div><input aria-label={`Cantidad de ${selected?.name ?? "materia prima"}`} type="text" inputMode="decimal" placeholder="0" value={item.quantity} onChange={(event) => { const value = event.target.value.replace(/[^0-9.,]/g, ""); setItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: value } : line)); }} /><b>{selected ? (selected.unit === "u." ? "unidad" : selected.unit) : "unidad"}</b></div></label><div className="recipe-line-cost"><span>Costo para esta cantidad</span><strong>{money(Math.round(quantityValue(item.quantity) * (selected?.cost ?? 0)) / 100)}</strong></div><button type="button" aria-label={`Quitar ${selected?.name ?? "materia prima"}`} onClick={() => setItems((current) => current.filter((_, lineIndex) => lineIndex !== index))}>×</button></article>; })}{!items.length && <div className="recipe-empty">Agregá la primera materia prima para comenzar.</div>}</div>
          </>}
        </section>
        <section className="product-estimate" aria-live="polite"><article><span>Costo estimado actual</span><strong>{money(estimatedCost / 100)}</strong><small>Receta × costos promedio actuales</small></article><article><span>Ganancia estimada</span><strong>{money(estimatedProfit / 100)}</strong><small>Precio − costo estimado</small></article><article><span>Margen estimado</span><strong>{estimatedMargin.toFixed(1)}%</strong><small>Actual, no histórico</small></article></section>
        <div className="material-zero-rule"><span>i</span><p>Crear este producto no modifica inventario, no crea un lote y no registra fabricación.</p></div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} aria-busy={saving} onClick={save}>{saving ? "Creando…" : "Crear producto"}</button></footer>
    </aside>
  </div>;
}

function ComboFormDialog({ onCancel, onSaved }: { onCancel: () => void; onSaved: (message: string) => void }) {
  const [code, setCode] = useState(() => nextSequentialCode(products.filter((item) => item.category === "Combos").map((item) => item.code), "COMBO"));
  const [name, setName] = useState("");
  const [pricePesos, setPricePesos] = useState(0);
  const [minimum, setMinimum] = useState(0);
  const [notes, setNotes] = useState("");
  const [comboCatalog, setComboCatalog] = useState<Array<{ id: number; code: string; name: string; costCents: number }>>([]);
  const [comboItems, setComboItems] = useState<Array<{ productId: number; quantity: string }>>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const comboMoney = (cents: number) => money(cents / 100);
  const estimatedCostCents = comboItems.reduce((sum, item) => sum + Math.round(Math.max(0, Number(item.quantity) || 0) * (comboCatalog.find((product) => product.id === item.productId)?.costCents ?? 0)), 0);
  const salePriceCents = Math.round(pricePesos * 100);
  const estimatedProfitCents = salePriceCents - estimatedCostCents;
  const estimatedMargin = salePriceCents > 0 ? (estimatedProfitCents / salePriceCents) * 100 : 0;

  useEffect(() => { let active = true; fetch("/api/khora?entity=next_code&kind=COMBO").then((response) => response.ok ? response.json() as Promise<{ code?: string }> : Promise.reject()).then((data) => { if (active && data.code) setCode(data.code); }).catch(() => undefined); return () => { active = false; }; }, []);
  useEffect(() => { let active = true; fetch("/api/khora?entity=lookups").then((response) => response.ok ? response.json() as Promise<{ products?: Array<Record<string, unknown>> }> : Promise.reject()).then((data) => { if (!active || !data.products?.length) return; setComboCatalog(data.products.filter((row) => String(row.type) !== "COMBO").map((row) => { const lastCost = Number(row.last_batch_unit_cost_cents ?? 0); return { id: Number(row.id), code: String(row.code), name: String(row.name), costCents: lastCost > 0 ? lastCost : Number(row.estimated_cost_cents ?? 0) }; })); }).catch(() => undefined); return () => { active = false; }; }, []);

  function addComboItem() { const available = comboCatalog.find((product) => !comboItems.some((item) => item.productId === product.id)); if (!available) { setError("No quedan productos guardados disponibles para agregar."); return; } setComboItems((current) => [...current, { productId: available.id, quantity: "1" }]); setError(""); }
  function updateComboItem(index: number, changes: Partial<{ productId: number; quantity: string }>) { setComboItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)); }

  async function save() {
    if (!name.trim()) { setError("Ingresá el nombre del combo."); return; }
    if (comboItems.some((item) => !item.productId || Number(item.quantity) <= 0)) { setError("Elegí un producto y una cantidad válida en cada línea."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_combo", name, salePriceCents, minimumStock: minimum, notes }) });
      const result = await response.json() as { error?: string; product?: { code?: string; combo_id?: number } };
      if (!response.ok) throw new Error(result.error ?? "No se pudo crear el combo");
      if (comboItems.length && result.product?.combo_id) {
        const recipeResponse = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_combo_recipe", comboId: result.product.combo_id, items: comboItems.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })) }) });
        const recipeResult = await recipeResponse.json() as { error?: string };
        if (!recipeResponse.ok) throw new Error(recipeResult.error ?? "El combo se creó, pero no se pudo guardar su composición");
      }
      onSaved(`Combo ${result.product?.code ?? code} creado. Costo estimado: ${comboMoney(estimatedCostCents)} · Precio elegido: ${comboMoney(salePriceCents)}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear el combo"); } finally { setSaving(false); }
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onCancel} aria-label="Cancelar combo" /><aside className="inventory-form-drawer combo-form-drawer" role="dialog" aria-modal="true" aria-labelledby="combo-form-title"><header><div><p>COMBOS · DEFINICIÓN</p><h2 id="combo-form-title">Nuevo combo</h2><span>Elegí productos guardados, cantidades y el precio de venta.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header><div className="inventory-form-body"><div className="form-grid"><label className="automatic-code-field"><span>Código</span><input value={code} readOnly aria-describedby="combo-code-help" /><small id="combo-code-help">Generado automáticamente · secuencia independiente</small></label><label><span>Nombre del combo *</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Combo Relax" /></label></div><div className="form-grid"><label><span>Precio de venta ($)</span><input type="number" min="0" step="0.01" value={pricePesos} onChange={(event) => setPricePesos(Math.max(0, Number(event.target.value) || 0))} /></label><label><span>Stock mínimo</span><input type="number" min="0" step="1" value={minimum} onChange={(event) => setMinimum(Math.max(0, Number(event.target.value) || 0))} /></label></div><label><span>Notas internas <small>OPCIONAL</small></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><section className="combo-composition" aria-labelledby="combo-composition-title"><header><div><strong id="combo-composition-title">Productos del combo</strong><p>Seleccioná productos guardados y cuántas unidades incluye cada combo.</p></div><button type="button" onClick={addComboItem}>＋ Agregar producto</button></header><div className="combo-composition-lines">{comboItems.map((item, index) => { const selected = comboCatalog.find((product) => product.id === item.productId); return <article key={`${item.productId}-${index}`}><label><span>Producto guardado</span><select value={item.productId} onChange={(event) => updateComboItem(index, { productId: Number(event.target.value) })}>{comboCatalog.map((product) => <option key={product.id} value={product.id} disabled={comboItems.some((other, otherIndex) => otherIndex !== index && other.productId === product.id)}>{product.code} · {product.name}</option>)}</select></label><label><span>Cantidad por combo</span><div className="combo-quantity-field"><input type="text" inputMode="decimal" value={item.quantity} onChange={(event) => updateComboItem(index, { quantity: event.target.value.replace(/[^0-9.,]/g, "").replace(",", ".") })} /><b>unidad</b></div></label><div className="recipe-line-cost"><span>Costo de esta línea</span><strong>{comboMoney(Math.round((Number(item.quantity) || 0) * (selected?.costCents ?? 0)))}</strong></div><button type="button" aria-label={`Quitar ${selected?.name ?? "producto"}`} onClick={() => setComboItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></article>; })}{!comboItems.length && <div className="recipe-empty">Agregá el primer producto para comenzar.</div>}{!comboCatalog.length && <div className="recipe-empty">Todavía no hay productos guardados para armar un combo.</div>}</div></section><section className="combo-cost-summary"><article><span>Costo estimado de fabricación</span><strong>{comboMoney(estimatedCostCents)}</strong><small>Suma de los costos actuales de los productos</small></article><article><span>Ganancia estimada</span><strong className={estimatedProfitCents < 0 ? "negative" : ""}>{comboMoney(estimatedProfitCents)}</strong><small>Precio elegido − costo estimado</small></article><article><span>Margen estimado</span><strong>{estimatedMargin.toFixed(1)}%</strong><small>Podés modificar el precio cuando quieras</small></article></section><div className="material-zero-rule"><span>i</span><p>Crear el combo no modifica stock. Al armarlo, KHORA descontará los productos incluidos.</p></div>{error && <p className="form-error" role="alert">{error}</p>}</div><footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} aria-busy={saving} onClick={save}>{saving ? "Creando…" : "Crear combo"}</button></footer></aside></div>;
}

function ProductProfitabilityDetail({ product, onClose }: { product: (typeof products)[number]; onClose: () => void }) {
  const profitability = getProductProfitability(product.code)!;
  const materialImpacts = getProductMaterialImpacts(product.code);
  const [desiredMargin, setDesiredMargin] = useState(45);
  const [materialCode, setMaterialCode] = useState(materialImpacts[0]?.material.code ?? "");
  const [increase, setIncrease] = useState(20);
  const materialSimulation = materialCode ? simulateMaterialIncrease(product.code, materialCode, increase) : null;
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar rentabilidad" /><aside className="product-profit-detail" role="dialog" aria-modal="true" aria-labelledby="profit-detail-title"><header><div><p>RENTABILIDAD REAL</p><h2 id="profit-detail-title">{product.name}</h2><span>{product.code} · costo actual del sistema</span></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div className="product-profit-body"><div className="profit-summary"><div><span>Precio de venta</span><strong>{money(product.price)}</strong></div><i>−</i><div><span>Costo actual</span><strong>{money(product.cost)}</strong></div><i>=</i><div className="profit-highlight"><span>Ganancia por unidad</span><strong>{money(profitability.unitProfit)}</strong></div></div><div className="profit-kpis"><div><span>Margen real</span><strong>{profitability.grossMargin.toFixed(1)}%</strong></div><div><span>Unidades vendidas</span><strong>{profitability.unitsSold}</strong><small>Este mes</small></div><div><span>Ventas acumuladas</span><strong>{money(profitability.accumulatedSales)}</strong></div><div><span>Ganancia generada</span><strong>{money(profitability.generatedProfit)}</strong></div></div><section className="price-simulator"><header><div><small>SIMULADOR</small><h3>Simular precio</h3></div><Badge tone="info">No modifica datos</Badge></header><div className="simulator-block"><label><span>Margen deseado</span><div><input type="number" min="1" max="95" value={desiredMargin} onChange={(event) => setDesiredMargin(Math.min(95, Math.max(1, Number(event.target.value) || 1)))} /><b>%</b></div></label><dl><div><dt>Costo actual</dt><dd>{money(product.cost)}</dd></div><div className="recommended-price"><dt>Precio recomendado</dt><dd>{money(recommendedPrice(product.cost, desiredMargin))}</dd></div></dl></div><div className="simulator-block"><div className="simulator-inputs"><label><span>Materia prima</span><select value={materialCode} onChange={(event) => setMaterialCode(event.target.value)}>{materialImpacts.map((item) => <option key={item.material.code} value={item.material.code}>{item.material.name}</option>)}</select></label><label><span>Aumento</span><div><input type="number" min="0" value={increase} onChange={(event) => setIncrease(Math.max(0, Number(event.target.value) || 0))} /><b>%</b></div></label></div>{materialSimulation ? <dl className="material-result"><div><dt>Nuevo costo</dt><dd>{money(materialSimulation.newCost)}</dd></div><div><dt>Nueva ganancia</dt><dd>{money(materialSimulation.newProfit)}</dd></div><div><dt>Nuevo margen</dt><dd>{materialSimulation.newMargin.toFixed(1)}%</dd></div></dl> : <p className="empty-simulation">Este producto no tiene insumos configurados.</p>}</div><footer><i>i</i><p>La simulación usa la receta y los costos actuales. No cambia el producto hasta que se confirme una actualización desde su edición.</p></footer></section></div><footer><button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button">Editar producto</button></footer></aside></div>;
}

function Manufacturing({ search }: { search: string }) {
  const plan = getProductionPlan();
  const actionable = plan.filter((item) => item.suggested > 0);
  const [tab, setTab] = useState("Planificador");
  const [manufactureTarget, setManufactureTarget] = useState<ProductionPlanItem | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<(typeof batches)[number] | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!search) return;
    const requestedBatch = batches.find((batch) => batch.lot === search);
    if (!requestedBatch) return;
    const timeout = window.setTimeout(() => { setTab("Lotes"); setSelectedBatch(requestedBatch); }, 0);
    return () => window.clearTimeout(timeout);
  }, [search]);
  function completed(message: string) { setManufactureTarget(null); setNotice(message); window.setTimeout(() => setNotice(""), 4500); }
  return <div className="section-stack"><Tabs tabs={["Planificador", "Lotes", "Combos"]} active={tab} onChange={setTab} /><div className="manufacture-create-row"><div><strong>Fabricación por lote</strong><span>La vista previa no mueve stock; el impacto ocurre al confirmar.</span></div><button className="primary-button" onClick={() => setManufactureTarget(actionable[0] ?? plan[0])}>＋ Fabricar producto o combo</button></div>{notice && <div className="inline-notice" role="status"><span>✓</span>{notice}</div>}{tab === "Planificador" && <><div className="manufacture-hero"><div><span className="hero-icon">⚗</span><div><p>PLANIFICACIÓN DE PRODUCCIÓN</p><h2>Necesidades de esta semana</h2><span>Demanda agrupada de pedidos, stock terminado y componentes de combos.</span></div></div><div className="hero-plan-total"><small>SUGERIDO</small><strong>{actionable.reduce((sum, item) => sum + item.suggested, 0)} u.</strong></div></div><div className="summary-row"><MiniStat label="Productos con demanda" value={String(plan.length)} detail="Pedidos abiertos agrupados" tone="info" /><MiniStat label="A fabricar" value={`${plan.filter((item) => item.kind === "Fabricar").reduce((sum, item) => sum + item.suggested, 0)} u.`} detail="Productos terminados" tone="warning" /><MiniStat label="Combos a preparar" value={`${plan.filter((item) => item.kind === "Preparar combo").reduce((sum, item) => sum + item.suggested, 0)} u.`} detail="Composición expandida" tone="warning" /><MiniStat label="Sin necesidad" value={String(plan.filter((item) => item.suggested === 0).length)} detail="Stock suficiente" tone="success" /></div><Panel title="Planificador" subtitle="Una necesidad consolidada, aunque participe en varios pedidos"><div className="planner-list">{plan.map((item, index) => <article className={item.suggested > 0 ? "needs-production" : "covered"} key={item.code}><div className="need-number">{index + 1}</div><div className="planner-product"><span>{item.kind}</span><strong>{item.name}</strong><small>{item.code} · pedidos {item.orderIds.join(", ")}</small></div><dl><div><dt>Necesarios</dt><dd>{item.required} u.</dd></div><div><dt>Stock</dt><dd>{item.stock} u.</dd></div><div><dt>Sugerido</dt><dd>{item.suggested} u.</dd></div></dl>{item.suggested > 0 ? <button onClick={() => setManufactureTarget(item)}>Crear fabricación</button> : <Badge tone="success">Cubierto</Badge>}</article>)}</div></Panel></>}{tab === "Lotes" && <><div className="summary-row"><MiniStat label="Lotes completados" value={String(batches.length)} detail="Con costo congelado" tone="success" /><MiniStat label="Unidades fabricadas" value={`${batches.reduce((sum, batch) => sum + batch.quantity, 0)} u.`} detail="Historial visible" tone="info" /><MiniStat label="Costo acumulado" value={money(batches.reduce((sum, batch) => sum + batch.cost, 0))} detail="Trazable por insumo" tone="neutral" /><MiniStat label="Criterio de salida" value="FIFO" detail="Primero los lotes más antiguos" tone="info" /></div><Panel title="Trazabilidad de lotes" subtitle="Cantidad inicial, saldo y costos históricos" action={<button className="secondary-button">↓ Exportar</button>}><DataTable headers={["Lote", "Fecha", "Producto", "Cantidad inicial", "Disponible", "Costo unitario", "Estado", ""]}>{batches.map((batch) => <tr key={batch.lot}><td><strong>{batch.lot}</strong></td><td>{batch.date}</td><td>{batch.product}</td><td>{batch.quantity} u.</td><td>{batch.quantity} u.</td><td>{money(batch.unitCost)}</td><td><Badge tone={batch.tone}>{batch.status}</Badge></td><td><button className="table-open-button" onClick={() => setSelectedBatch(batch)}>Ver trazabilidad</button></td></tr>)}</DataTable></Panel></>}{tab === "Combos" && <ComboPlanner />}{manufactureTarget && <ManufactureFormDialog initialCode={manufactureTarget.code} initialQuantity={Math.max(1, manufactureTarget.suggested)} onCancel={() => setManufactureTarget(null)} onSaved={completed} />}{selectedBatch && <BatchDetail batch={selectedBatch} onClose={() => setSelectedBatch(null)} />}</div>;
}

// Conservado temporalmente como referencia visual durante la migración del planificador.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyManufacturing() {
  const plan = getProductionPlan();
  const actionable = plan.filter((item) => item.suggested > 0);
  const [tab, setTab] = useState("Planificador");
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlanItem | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<(typeof batches)[number] | null>(null);
  const [notice, setNotice] = useState("");
  function confirmProduction(quantity: number) { setSelectedPlan(null); setNotice(`Fabricación preparada por ${quantity} unidades. Revisá y confirmá el lote para impactar stock.`); window.setTimeout(() => setNotice(""), 3600); }
  return <div className="section-stack"><Tabs tabs={["Planificador", "Lotes", "Combos"]} active={tab} onChange={setTab} />{notice && <div className="inline-notice" role="status"><span>✓</span>{notice}</div>}{tab === "Planificador" && <><div className="manufacture-hero"><div><span className="hero-icon">⚗</span><div><p>PLANIFICACIÓN DE PRODUCCIÓN</p><h2>Necesidades de esta semana</h2><span>Demanda agrupada de pedidos, stock terminado y componentes de combos.</span></div></div><div className="hero-plan-total"><small>SUGERIDO</small><strong>{actionable.reduce((sum, item) => sum + item.suggested, 0)} u.</strong></div></div><div className="summary-row"><MiniStat label="Productos con demanda" value={String(plan.length)} detail="Pedidos abiertos agrupados" tone="info" /><MiniStat label="A fabricar" value={`${plan.filter((item) => item.kind === "Fabricar").reduce((sum, item) => sum + item.suggested, 0)} u.`} detail="Productos terminados" tone="warning" /><MiniStat label="Combos a preparar" value={`${plan.filter((item) => item.kind === "Preparar combo").reduce((sum, item) => sum + item.suggested, 0)} u.`} detail="Composición expandida" tone="warning" /><MiniStat label="Sin necesidad" value={String(plan.filter((item) => item.suggested === 0).length)} detail="Stock suficiente" tone="success" /></div><Panel title="Planificador" subtitle="Una necesidad consolidada, aunque participe en varios pedidos"><div className="planner-list">{plan.map((item, index) => <article className={item.suggested > 0 ? "needs-production" : "covered"} key={item.code}><div className="need-number">{index + 1}</div><div className="planner-product"><span>{item.kind}</span><strong>{item.name}</strong><small>{item.code} · pedidos {item.orderIds.join(", ")}</small></div><dl><div><dt>Necesarios</dt><dd>{item.required} u.</dd></div><div><dt>Stock</dt><dd>{item.stock} u.</dd></div><div><dt>Sugerido</dt><dd>{item.suggested} u.</dd></div></dl>{item.suggested > 0 ? <button onClick={() => setSelectedPlan(item)}>Crear fabricación</button> : <Badge tone="success">Cubierto</Badge>}</article>)}</div></Panel></>}{tab === "Lotes" && <><div className="summary-row"><MiniStat label="Lotes completados" value={String(batches.length)} detail="Con costo congelado" tone="success" /><MiniStat label="Unidades fabricadas" value={`${batches.reduce((sum, batch) => sum + batch.quantity, 0)} u.`} detail="Historial visible" tone="info" /><MiniStat label="Costo acumulado" value={money(batches.reduce((sum, batch) => sum + batch.cost, 0))} detail="Trazable por insumo" tone="neutral" /></div><Panel title="Trazabilidad de lotes" subtitle="Producto, cantidades, costos y materiales realmente utilizados" action={<button className="secondary-button">↓ Exportar</button>}><DataTable headers={["Lote", "Fecha", "Producto", "Cantidad", "Costo total", "Costo unitario", "Estado", ""]}>{batches.map((batch) => <tr key={batch.lot}><td><strong>{batch.lot}</strong></td><td>{batch.date}</td><td>{batch.product}</td><td>{batch.quantity} u.</td><td>{money(batch.cost)}</td><td>{money(batch.unitCost)}</td><td><Badge tone={batch.tone}>{batch.status}</Badge></td><td><button className="table-open-button" onClick={() => setSelectedBatch(batch)}>Ver trazabilidad</button></td></tr>)}</DataTable></Panel></>}{tab === "Combos" && <ComboPlanner />}{selectedPlan && <ActionConfirmDialog key={selectedPlan.code} title={selectedPlan.kind === "Preparar combo" ? `Preparar ${selectedPlan.name}` : `Fabricar ${selectedPlan.name}`} subtitle={`Sugerencia calculada desde ${selectedPlan.orderIds.length} pedidos abiertos.`} defaultQuantity={selectedPlan.suggested} confirmLabel={selectedPlan.kind === "Preparar combo" ? "Preparar combo" : "Crear fabricación"} note="Confirmar inicia el flujo existente de lote. El cálculo previo no mueve stock." onCancel={() => setSelectedPlan(null)} onConfirm={confirmProduction} />}{selectedBatch && <BatchDetail batch={selectedBatch} onClose={() => setSelectedBatch(null)} />}</div>;
}

type ManufacturingOption = { id: number; code: string; name: string; type: "MANUFACTURED" | "COMBO"; comboId?: number; price: number };
type ManufacturingPreviewItem = { code: string; name: string; unit: string; perUnit: number; required: number; available: number; minimum: number; unitCost: number; subtotal: number };

function localManufacturingPreview(option: ManufacturingOption, quantity: number): ManufacturingPreviewItem[] {
  if (option.type === "COMBO") {
    const definition = comboDefinitions.find((item) => item.productCode === option.code);
    if (!definition) return [];
    const productItems = definition.productComponents.map((part) => { const product = products.find((item) => item.code === part.productCode)!; return { code: product.code, name: product.name, unit: "unidad", perUnit: part.quantity, required: part.quantity * quantity, available: product.stock, minimum: product.minimum, unitCost: product.cost, subtotal: part.quantity * quantity * product.cost }; });
    const materialItems = definition.materialComponents.map((part) => { const material = materials.find((item) => item.code === part.materialCode)!; return { code: material.code, name: material.name, unit: material.unit, perUnit: part.quantity, required: part.quantity * quantity, available: material.stock, minimum: material.minimum, unitCost: material.cost, subtotal: part.quantity * quantity * material.cost }; });
    return [...productItems, ...materialItems];
  }
  const recipe = recipeDefinitions.find((item) => item.productCode === option.code);
  return (recipe?.components ?? []).map((part) => { const material = materials.find((item) => item.code === part.materialCode)!; return { code: material.code, name: material.name, unit: material.unit, perUnit: part.quantity, required: part.quantity * quantity, available: material.stock, minimum: material.minimum, unitCost: material.cost, subtotal: part.quantity * quantity * material.cost }; });
}

function ManufactureFormDialog({ initialCode, initialQuantity, onCancel, onSaved }: { initialCode: string; initialQuantity: number; onCancel: () => void; onSaved: (message: string) => void }) {
  const fallbackOptions: ManufacturingOption[] = products.map((product, index) => ({ id: index + 1, code: product.code, name: product.name, type: product.code.startsWith("COM-") ? "COMBO" : "MANUFACTURED", comboId: product.code.startsWith("COM-") ? 1 : undefined, price: product.price }));
  const [catalog, setCatalog] = useState(fallbackOptions);
  const initial = fallbackOptions.find((item) => item.code === initialCode) ?? fallbackOptions[0];
  const [optionId, setOptionId] = useState(initial?.id ?? 0);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<ManufacturingPreviewItem[]>(() => initial ? localManufacturingPreview(initial, initialQuantity) : []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const option = catalog.find((item) => item.id === optionId) ?? catalog[0];
  const totalCost = Math.round(preview.reduce((sum, item) => sum + item.subtotal, 0));
  const unitCost = quantity > 0 ? Math.round(totalCost / quantity) : 0;
  const canConfirm = preview.length > 0 && preview.every((item) => item.available >= item.required);
  const estimatedProfit = (option?.price ?? 0) - unitCost;
  const margin = option?.price ? estimatedProfit * 100 / option.price : 0;

  useEffect(() => {
    let active = true;
    fetch("/api/khora?entity=products").then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ rows?: Array<Record<string, unknown>> }>; }).then((data) => {
      if (!active) return;
      const rows = (data.rows ?? []).filter((row) => Boolean(row.active) && (row.type === "MANUFACTURED" || row.type === "COMBO")).map((row) => ({ id: Number(row.id), code: String(row.code), name: String(row.name), type: String(row.type) as "MANUFACTURED" | "COMBO", comboId: row.combo_id ? Number(row.combo_id) : undefined, price: Number(row.sale_price_cents) }));
      if (rows.length) { setCatalog(rows); setOptionId((rows.find((item) => item.code === initialCode) ?? rows[0]).id); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [initialCode]);

  useEffect(() => {
    if (!option || quantity <= 0) return;
    let active = true;
    const entity = option.type === "COMBO" ? "combo_preview" : "manufacture_preview";
    const key = option.type === "COMBO" ? `comboId=${option.comboId ?? 0}` : `productId=${option.id}`;
    fetch(`/api/khora?entity=${entity}&${key}&quantity=${quantity}`).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ items?: Array<Record<string, unknown>>; materials?: Array<Record<string, unknown>> }>; }).then((data) => {
      if (!active) return;
      const rows = [...(data.items ?? []), ...(data.materials ?? [])].map((row) => ({ code: String(row.code), name: String(row.material ?? row.product), unit: String(row.unit ?? "unidad"), perUnit: Number(row.per_unit ?? row.quantity ?? 0), required: Number(row.required), available: Number(row.available), minimum: Number(row.minimum_stock ?? 0), unitCost: Number(row.current_cost_cents ?? row.estimated_cost_cents), subtotal: Number(row.subtotal_cents) }));
      setPreview(rows.length ? rows : localManufacturingPreview(option, quantity));
    }).catch(() => { if (active) setPreview(localManufacturingPreview(option, quantity)); });
    return () => { active = false; };
  }, [option, quantity]);

  async function confirm() {
    if (!option || !canConfirm) { setError("No se puede fabricar: revisá los componentes faltantes."); return; }
    setSaving(true); setError("");
    try { const body = option.type === "COMBO" ? { action: "assemble_combo", comboId: option.comboId, quantity, date, notes } : { action: "manufacture", productId: option.id, quantity, date, notes }; const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as { error?: string; batchNumber?: string; unitCostCents?: number }; if (!response.ok) throw new Error(result.error ?? "No se pudo confirmar la fabricación"); onSaved(`${option.name}: lote ${result.batchNumber ?? "creado"} confirmado con costo unitario ${money(result.unitCostCents ?? unitCost)}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo confirmar la fabricación"); } finally { setSaving(false); }
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onCancel} aria-label="Cancelar fabricación" /><aside className="inventory-form-drawer manufacture-form-drawer" role="dialog" aria-modal="true" aria-labelledby="manufacture-form-title"><header><div><p>FABRICACIÓN · SIMULACIÓN</p><h2 id="manufacture-form-title">Fabricar producto o combo</h2><span>KHORA calcula materiales, disponibilidad y costo antes de confirmar.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header><div className="inventory-form-body"><div className="form-grid"><label><span>Producto o combo *</span><select value={optionId} onChange={(event) => setOptionId(Number(event.target.value))}>{catalog.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label><span>Cantidad *</span><input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label></div><div className="form-grid"><label><span>Fecha *</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label><span>Notas del lote</span><input value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div><section className="manufacture-materials"><header><strong>Materias primas necesarias</strong><Badge tone={canConfirm ? "success" : "danger"}>{canConfirm ? "Stock suficiente" : "Hay faltantes"}</Badge></header><div className="manufacture-material-list">{preview.map((item) => { const shortage = Math.max(0, item.required - item.available); const remaining = item.available - item.required; const tone = shortage > 0 ? "danger" : remaining <= item.minimum ? "warning" : "success"; return <article key={item.code}><div><span>{item.code}</span><strong>{item.name}</strong><small>{formatQuantity(item.perUnit)} {item.unit}/un.</small></div><dl><div><dt>Necesario</dt><dd>{formatQuantity(item.required)} {item.unit}</dd></div><div><dt>Disponible</dt><dd>{formatQuantity(item.available)} {item.unit}</dd></div><div><dt>Costo usado</dt><dd>{money(item.unitCost)}</dd></div><div><dt>Subtotal</dt><dd>{money(item.subtotal)}</dd></div></dl><Badge tone={tone}>{shortage > 0 ? `Faltan ${formatQuantity(shortage)}` : remaining <= item.minimum ? "Quedará bajo" : "Suficiente"}</Badge></article>; })}{!preview.length && <div className="recipe-empty">El producto no tiene una receta o composición activa.</div>}</div></section><section className="manufacture-cost-summary"><article><span>Cantidad</span><strong>{quantity} u.</strong></article><article><span>Costo total</span><strong>{money(totalCost)}</strong></article><article><span>Costo unitario</span><strong>{money(unitCost)}</strong></article><article><span>Precio actual</span><strong>{money(option?.price ?? 0)}</strong></article><article><span>Ganancia estimada/un.</span><strong>{money(estimatedProfit)}</strong></article><article><span>Margen estimado</span><strong>{margin.toFixed(1)}%</strong></article></section><div className="material-zero-rule"><span>i</span><p>Esta vista es una simulación. El stock cambia únicamente cuando confirmás la fabricación.</p></div>{error && <p className="form-error" role="alert">{error}</p>}</div><footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving || !canConfirm} aria-busy={saving} onClick={confirm}>{saving ? "Confirmando…" : canConfirm ? "Confirmar fabricación" : "No se puede fabricar"}</button></footer></aside></div>;
}

function ComboPlanner() {
  const [quantity, setQuantity] = useState(5);
  const breakdown = getComboBreakdown("COM-001", quantity)!;
  const allChecks = [...breakdown.products, ...breakdown.materials];
  const ready = allChecks.every((item) => item.shortage === 0);
  return <><div className="combo-planner-hero"><div><span>K</span><div><small>COMBO INTELIGENTE</small><h2>{breakdown.product.name}</h2><p>KHORA expande productos, caja, tarjeta y packaging automáticamente.</p></div></div><label><span>Cantidad a preparar</span><input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label></div><div className="combo-requirements"><Panel title="Productos incluidos" subtitle="Stock terminado requerido"><div className="requirement-list">{breakdown.products.map((item) => <RequirementRow item={item} key={item.code} />)}</div></Panel><Panel title="Packaging e insumos" subtitle="Materias primas directas del combo"><div className="requirement-list">{breakdown.materials.map((item) => <RequirementRow item={item} key={item.code} />)}</div></Panel></div><div className={`combo-result ${ready ? "success" : "danger"}`}><span>{ready ? "✓" : "!"}</span><div><strong>{ready ? `Podés preparar ${quantity} combos` : "Hay componentes faltantes"}</strong><p>{ready ? "Todos los productos y materiales directos están disponibles." : "Revisá los faltantes antes de confirmar el armado."}</p></div><button disabled={!ready}>Preparar combos</button></div></>;
}

function BatchDetail({ batch, onClose }: { batch: (typeof batches)[number]; onClose: () => void }) {
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar trazabilidad" /><aside className="batch-detail" role="dialog" aria-modal="true" aria-labelledby="batch-detail-title"><header><div><p>TRAZABILIDAD DEL LOTE</p><h2 id="batch-detail-title">{batch.lot}</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div className="batch-detail-body"><div className="batch-product"><span>⚗</span><div><strong>{batch.product}</strong><small>{batch.date} · {batch.quantity} unidades</small></div><Badge tone="success">{batch.status}</Badge></div><dl><div><dt>Costo total</dt><dd>{money(batch.cost)}</dd></div><div><dt>Costo unitario</dt><dd>{money(batch.unitCost)}</dd></div></dl><section><h3>Materiales utilizados</h3>{batch.materialsUsed.map((material) => <article key={material.name}><div><strong>{material.name}</strong><small>{material.quantity}</small></div><b>{money(material.cost)}</b></article>)}</section><div className="trace-note"><i>✓</i><span>Los costos corresponden a este lote y no cambian si los precios actuales se actualizan.</span></div></div></aside></div>;
}

type MaterialRecord = { id: number; code: string; name: string; category: string; categoryId: number; prefix: string; unit: string; stock: number; minimum: number; cost: number; supplier: string; supplierId?: number; notes?: string };
type InventoryCategory = { id: number; name: string; prefix: string; kind: "MATERIAL"; active: boolean };
type InventorySupplier = { id: number; name: string };

const demoCategories: InventoryCategory[] = Array.from(new Set(materials.map((item) => item.category))).map((name, index) => ({ id: index + 1, name, prefix: categoryPrefix(name), kind: "MATERIAL", active: true }));
const demoSuppliers: InventorySupplier[] = suppliers.map((item, index) => ({ id: index + 1, name: item.name }));
const demoMaterials: MaterialRecord[] = materials.map((item, index) => ({ id: index + 1, code: item.code, name: item.name, category: item.category, categoryId: demoCategories.find((category) => category.name === item.category)?.id ?? 0, prefix: demoCategories.find((category) => category.name === item.category)?.prefix ?? "MAT", unit: item.unit, stock: item.stock, minimum: item.minimum, cost: item.cost, supplier: item.supplier, supplierId: demoSuppliers.find((supplier) => supplier.name === item.supplier)?.id }));

function Stock({ search }: { search: string }) {
  const [tab, setTab] = useState("Productos terminados");
  const [materialRows, setMaterialRows] = useState<MaterialRecord[]>(demoMaterials);
  const [categoryRows, setCategoryRows] = useState<InventoryCategory[]>(demoCategories);
  const [supplierRows, setSupplierRows] = useState<InventorySupplier[]>(demoSuppliers);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialRecord | null>(null);
  const [notice, setNotice] = useState("");
  const productRows = products.filter((item) => includesSearch(item, search));
  const visibleMaterials = materialRows.filter((item) => includesSearch(item, search));

  useEffect(() => {
    let active = true;
    Promise.all(["materials", "categories", "suppliers"].map(async (entity) => {
      const response = await fetch(`/api/khora?entity=${entity}`);
      if (!response.ok) throw new Error("No se pudo leer el inventario");
      return response.json() as Promise<{ rows?: Array<Record<string, unknown>> }>;
    })).then(([materialData, categoryData, supplierData]) => {
      if (!active) return;
      const apiCategories = (categoryData.rows ?? []).filter((row) => row.kind === "MATERIAL").map((row) => ({ id: Number(row.id), name: String(row.name), prefix: String(row.prefix ?? categoryPrefix(String(row.name))), kind: "MATERIAL" as const, active: Boolean(row.active) }));
      const apiSuppliers = (supplierData.rows ?? []).filter((row) => Boolean(row.active)).map((row) => ({ id: Number(row.id), name: String(row.name) }));
      const apiMaterials = (materialData.rows ?? []).filter((row) => Boolean(row.active)).map((row) => ({ id: Number(row.id), code: String(row.code), name: String(row.material), category: String(row.category ?? "Sin categoría"), categoryId: Number(row.category_id), prefix: String(row.prefix ?? "MAT"), unit: String(row.unit), stock: Number(row.current_stock), minimum: Number(row.minimum_stock), cost: Number(row.current_cost_cents), supplier: String(row.preferred_supplier ?? "Sin proveedor"), supplierId: row.preferred_supplier_id ? Number(row.preferred_supplier_id) : undefined, notes: String(row.notes ?? "") }));
      if (apiCategories.length) setCategoryRows(apiCategories);
      if (apiSuppliers.length) setSupplierRows(apiSuppliers);
      if (apiMaterials.length) setMaterialRows(apiMaterials);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const critical = materialRows.filter((item) => item.stock < item.minimum).length;
  const normal = materialRows.filter((item) => item.stock > item.minimum * 1.25).length;
  const totalValue = materialRows.reduce((sum, item) => sum + stockValue(item.stock, item.cost), 0);
  function showNotice(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3800); }

  return <div className="section-stack">
    <Tabs tabs={["Productos terminados", "Materias primas", "Categorías", "Movimientos"]} active={tab} onChange={setTab} />
    {notice && <div className="inline-notice" role="status"><span>✓</span>{notice}</div>}
    <div className="summary-row"><MiniStat label="Valor de materias primas" value={money(totalValue)} detail="Stock actual × costo vigente" tone="neutral" /><MiniStat label="En nivel normal" value={String(normal)} detail="Sin acción necesaria" tone="success" /><MiniStat label="Stock bajo" value={String(materialRows.length - normal - critical)} detail="Planificar reposición" tone="warning" /><MiniStat label="Críticos o sin stock" value={String(critical)} detail="Acción inmediata" tone="danger" /></div>
    {tab !== "Categorías" && tab !== "Movimientos" && <Toolbar placeholder="Buscar en el stock…" filters={["Todas las categorías", "Todos los estados"]} />}
    {tab === "Productos terminados" && <Panel title="Productos terminados" subtitle={`${productRows.length} productos visibles`}><DataTable headers={["Producto", "Categoría", "Stock", "Mínimo", "Estado", "Costo unitario", "Valor", ""]}>{productRows.map((product) => <tr key={product.code}><td><strong>{product.name}</strong><small className="table-sub">{product.code}</small></td><td>{product.category}</td><td><StockValue value={product.stock} minimum={product.minimum} unit="u." /></td><td>{product.minimum} u.</td><td><Badge tone={product.tone}>{product.stock <= product.minimum ? "Stock bajo" : "Normal"}</Badge></td><td>{money(product.cost)}</td><td><strong>{money(product.cost * product.stock)}</strong></td><td><MoreButton /></td></tr>)}</DataTable></Panel>}
    {tab === "Materias primas" && <Panel title="Materias primas" subtitle={`${visibleMaterials.length} insumos visibles`} action={<button className="primary-button" onClick={() => setShowMaterialForm(true)}>＋ Nueva materia prima</button>}><DataTable headers={["Materia prima", "Categoría", "Stock", "Mínimo", "Estado", "Costo", "Proveedor", ""]}>{visibleMaterials.map((material) => { const status = materialStockStatus(material.stock, material.minimum); return <tr key={material.code}><td><strong>{material.name}</strong><small className="table-sub">{material.code}</small></td><td>{material.category}</td><td><StockValue value={material.stock} minimum={material.minimum} unit={material.unit} /></td><td>{material.minimum} {material.unit}</td><td><Badge tone={status.tone}>{status.label}</Badge></td><td>{money(material.cost)} / {material.unit}</td><td>{material.supplier}</td><td><button className="table-open-button" onClick={() => setSelectedMaterial(material)}>Ver ficha</button></td></tr>; })}</DataTable></Panel>}
    {tab === "Categorías" && <Panel title="Categorías de materias primas" subtitle="El prefijo organiza y valida los códigos" action={<button className="primary-button" onClick={() => setShowCategoryForm(true)}>＋ Nueva categoría</button>}><div className="inventory-category-grid">{categoryRows.map((category) => <article key={category.id}><span>{category.prefix}</span><div><strong>{category.name}</strong><small>{materialRows.filter((item) => item.categoryId === category.id).length} materias primas</small></div><Badge tone={category.active ? "success" : "neutral"}>{category.active ? "Activa" : "Inactiva"}</Badge></article>)}</div></Panel>}
    {tab === "Movimientos" && <MovementList />}
    {showMaterialForm && <MaterialFormDialog categories={categoryRows.filter((category) => category.active)} suppliers={supplierRows} existingCodes={materialRows.map((item) => item.code)} onCancel={() => setShowMaterialForm(false)} onSaved={(material) => { setMaterialRows((current) => [...current, material]); setShowMaterialForm(false); showNotice(`${material.name} fue creada con stock inicial 0.`); }} />}
    {showCategoryForm && <CategoryFormDialog onCancel={() => setShowCategoryForm(false)} onSaved={(category) => { setCategoryRows((current) => [...current, category]); setShowCategoryForm(false); showNotice(`Categoría ${category.name} creada.`); }} />}
    {selectedMaterial && <MaterialDetail material={selectedMaterial} onClose={() => setSelectedMaterial(null)} />}
  </div>;
}

function MaterialFormDialog({ categories, suppliers, existingCodes, onCancel, onSaved }: { categories: InventoryCategory[]; suppliers: InventorySupplier[]; existingCodes: string[]; onCancel: () => void; onSaved: (material: MaterialRecord) => void }) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [unit, setUnit] = useState("unidad");
  const [minimum, setMinimum] = useState(0);
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const activeCategoryId = category?.id;
  const [serverSuggestion, setServerSuggestion] = useState<{ categoryId: number; code: string } | null>(null);
  const localSuggestion = category ? suggestMaterialCode(category.prefix, existingCodes) : "MAT-001";
  const suggestedCode = serverSuggestion?.categoryId === activeCategoryId ? serverSuggestion.code : localSuggestion;

  useEffect(() => {
    if (!activeCategoryId) return;
    let active = true;
    fetch(`/api/khora?entity=next_material_code&categoryId=${activeCategoryId}`).then((response) => response.ok ? response.json() as Promise<{ code?: string }> : Promise.reject()).then((data) => { if (active && data.code) setServerSuggestion({ categoryId: activeCategoryId, code: data.code }); }).catch(() => undefined);
    return () => { active = false; };
  }, [activeCategoryId]);

  async function save() {
    if (!name.trim()) { setError("Ingresá el nombre de la materia prima."); return; }
    if (!category) { setError("Primero creá una categoría de materia prima."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_material", name, categoryId: category.id, unit, minimumStock: minimum, preferredSupplierId: supplierId, notes }) });
      const result = await response.json() as { error?: string; material?: { id?: number; code?: string; current_stock?: number; minimum_stock?: number; current_cost_cents?: number } };
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la materia prima");
      const supplier = suppliers.find((item) => item.id === supplierId);
      onSaved({ id: result.material?.id ?? Date.now(), code: result.material?.code ?? suggestedCode, name: name.trim(), category: category.name, categoryId: category.id, prefix: category.prefix, unit, stock: result.material?.current_stock ?? 0, minimum: result.material?.minimum_stock ?? minimum, cost: result.material?.current_cost_cents ?? 0, supplier: supplier?.name ?? "Sin proveedor", supplierId, notes });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la materia prima"); } finally { setSaving(false); }
  }
  return <div className="drawer-layer">
    <button className="drawer-backdrop" onClick={onCancel} aria-label="Cancelar alta" />
    <aside className="inventory-form-drawer" role="dialog" aria-modal="true" aria-labelledby="new-material-title">
      <header><div><p>INVENTARIO · MATERIA PRIMA</p><h2 id="new-material-title">Nueva materia prima</h2><span>Crear el insumo no registra una compra ni modifica existencias.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header>
      <div className="inventory-form-body">
        {categories.length ? <>
          <div className="form-grid"><label><span>Categoría *</span><select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.prefix}</option>)}</select></label><label className="automatic-code-field"><span>Código</span><input value={suggestedCode} readOnly aria-describedby="material-code-help" /><small id="material-code-help">Generado automáticamente según la categoría</small></label></div>
          <label><span>Nombre *</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Esencia de coco" /></label>
          <div className="form-grid"><label><span>Unidad base *</span><select value={unit} onChange={(event) => setUnit(event.target.value)}>{baseUnits.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label><span>Stock mínimo</span><input type="number" min="0" step="0.01" value={minimum} onChange={(event) => setMinimum(Math.max(0, Number(event.target.value) || 0))} /></label></div>
          <label><span>Proveedor preferido</span><select value={supplierId ?? ""} onChange={(event) => setSupplierId(event.target.value ? Number(event.target.value) : undefined)}><option value="">Sin proveedor preferido</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Notas <small>OPCIONAL</small></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Presentación, marca o dato útil…" /></label>
          <div className="material-code-rule"><span>{category?.prefix}</span><p>El código queda estable después de crear la materia prima, aunque más adelante cambie su categoría.</p></div>
          <div className="zero-stock-preview"><span>0</span><div><strong>Stock inicial: 0 {unit}</strong><p>El stock ingresará cuando registres una compra, fabricación o ajuste autorizado.</p></div></div>
        </> : <div className="recipe-no-materials"><strong>Todavía no hay categorías de materia prima</strong><p>Creá una categoría con prefijo antes de registrar el primer insumo.</p></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving || !categories.length} aria-busy={saving} onClick={save}>{saving ? "Guardando…" : "Crear materia prima"}</button></footer>
    </aside>
  </div>;
}

function CategoryFormDialog({ onCancel, onSaved }: { onCancel: () => void; onSaved: (category: InventoryCategory) => void }) {
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("MAT");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (name.trim().length < 2 || prefix.length < 2) { setError("Completá un nombre y un prefijo de 2 a 4 caracteres."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_category", name, prefix, kind: "MATERIAL" }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la categoría");
      onSaved({ id: Date.now(), name: name.trim(), prefix, kind: "MATERIAL", active: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la categoría"); } finally { setSaving(false); }
  }
  return <div className="confirm-layer"><button className="drawer-backdrop" onClick={onCancel} aria-label="Cancelar" /><section className="confirm-dialog category-dialog" role="dialog" aria-modal="true" aria-labelledby="category-title"><header><div><p>ORGANIZACIÓN</p><h2 id="category-title">Nueva categoría</h2><span>El prefijo se usará en los códigos de sus materias primas.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header><div className="category-form-body"><label><span>Nombre *</span><input autoFocus value={name} onChange={(event) => { const value = event.target.value; setName(value); setPrefix(categoryPrefix(value)); }} placeholder="Ej. Esencias" /></label><label><span>Prefijo *</span><input maxLength={4} value={prefix} onChange={(event) => setPrefix(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} /></label>{error && <p className="form-error" role="alert">{error}</p>}</div><footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} aria-busy={saving} onClick={save}>{saving ? "Guardando…" : "Crear categoría"}</button></footer></section></div>;
}

function MaterialDetail({ material, onClose }: { material: MaterialRecord; onClose: () => void }) {
  const [tab, setTab] = useState("Resumen");
  const [history, setHistory] = useState<{ purchases: Array<Record<string, unknown>>; movements: Array<Record<string, unknown>>; products: Array<Record<string, unknown>> }>({ purchases: [], movements: [], products: [] });
  const usedBy = productsUsingMaterial(material.code, recipeDefinitions, products);
  const status = materialStockStatus(material.stock, material.minimum);
  useEffect(() => {
    let active = true;
    fetch(`/api/khora?entity=material_detail&id=${material.id}`).then(async (response) => {
      if (!response.ok) throw new Error("Detalle no disponible");
      return response.json() as Promise<{ purchases?: Array<Record<string, unknown>>; movements?: Array<Record<string, unknown>>; products?: Array<Record<string, unknown>> }>;
    }).then((data) => { if (active) setHistory({ purchases: data.purchases ?? [], movements: data.movements ?? [], products: data.products ?? [] }); }).catch(() => undefined);
    return () => { active = false; };
  }, [material.id]);
  const linkedProducts = history.products.length ? history.products : usedBy.map((product) => ({ code: product.code, product: product.name }));
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar ficha" /><aside className="material-detail" role="dialog" aria-modal="true" aria-labelledby="material-detail-title"><header><div><p>{material.code} · {material.category}</p><h2 id="material-detail-title">{material.name}</h2><span>Ficha maestra de inventario</span></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div className="material-detail-body"><section className="material-detail-hero"><div><small>STOCK ACTUAL</small><strong>{formatQuantity(material.stock)} <i>{material.unit}</i></strong><Badge tone={status.tone}>{status.label}</Badge></div><div><small>VALOR EN STOCK</small><strong>{money(stockValue(material.stock, material.cost))}</strong><span>{money(material.cost)} por {material.unit}</span></div></section><Tabs tabs={["Resumen", "Compras", "Movimientos", "Productos que la utilizan"]} active={tab} onChange={setTab} />{tab === "Resumen" && <div className="material-master-data"><dl><div><dt>Categoría</dt><dd>{material.category}</dd></div><div><dt>Unidad base</dt><dd>{material.unit}</dd></div><div><dt>Stock mínimo</dt><dd>{formatQuantity(material.minimum)} {material.unit}</dd></div><div><dt>Proveedor preferido</dt><dd>{material.supplier}</dd></div></dl><div className="material-zero-rule"><span>i</span><p>Crear o editar esta ficha no modifica stock. Las existencias cambian únicamente mediante movimientos auditables.</p></div>{material.notes && <section><small>NOTAS</small><p>{material.notes}</p></section>}</div>}{tab === "Compras" && (history.purchases.length ? <div className="material-usage-list">{history.purchases.map((purchase) => <article key={String(purchase.id)}><span>{String(purchase.purchased_at).slice(0, 10)}</span><div><strong>{String(purchase.supplier ?? "Sin proveedor")}</strong><small>{formatQuantity(Number(purchase.input_quantity))} {String(purchase.input_unit ?? material.unit)} = {formatQuantity(Number(purchase.base_quantity))} {String(purchase.base_unit ?? material.unit)} · {money(Number(purchase.total_cost_cents))}</small></div><Badge tone={purchase.status === "CONFIRMED" ? "success" : "neutral"}>{purchase.status === "CONFIRMED" ? "Confirmada" : "Anulada"}</Badge></article>)}</div> : <div className="empty-material-tab"><span>↓</span><strong>Sin compras registradas</strong><p>Las compras confirmadas aparecerán aquí con proveedor, cantidad, unidad y costo histórico.</p></div>)}{tab === "Movimientos" && (history.movements.length ? <div className="material-usage-list">{history.movements.map((movement) => <article key={String(movement.id)}><span>{Number(movement.quantity_delta) > 0 ? "+" : "−"}{formatQuantity(Math.abs(Number(movement.quantity_delta)))}</span><div><strong>{String(movement.movement_type).replaceAll("_", " ")}</strong><small>{String(movement.created_at).slice(0, 16)} · saldo {formatQuantity(Number(movement.balance_after))} {material.unit}</small></div><Badge tone={Number(movement.quantity_delta) > 0 ? "success" : "info"}>Auditable</Badge></article>)}</div> : <div className="empty-material-tab"><span>↕</span><strong>Sin movimientos todavía</strong><p>Ingresos, consumos, ventas y ajustes conservarán su referencia y saldo resultante.</p></div>)}{tab === "Productos que la utilizan" && <div className="material-usage-list">{linkedProducts.length ? linkedProducts.map((product) => <article key={String(product.code)}><span>{String(product.code)}</span><div><strong>{String(product.product)}</strong><small>Receta de fabricación activa</small></div><button>Ver producto →</button></article>) : <div className="empty-material-tab"><strong>No participa en recetas activas</strong><p>Podés incorporarla cuando armes o edites una receta.</p></div>}</div>}</div></aside></div>;
}

function Purchases({ search, onCreate }: { search: string; onCreate?: (kind: string, section?: SectionId) => void }) {
  const rows = purchases.filter((purchase) => includesSearch(purchase, search));
  const needs = getPurchaseNeeds();
  const [tab, setTab] = useState("Necesidades de compra");
  const [selectedNeed, setSelectedNeed] = useState<PurchaseNeed | null>(null);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!search) return; const timeout = window.setTimeout(() => setTab("Compras registradas"), 0); return () => window.clearTimeout(timeout); }, [search]);
  function confirmPurchase(quantity: number) { const name = selectedNeed?.name ?? "Insumo"; setSelectedNeed(null); setNotice(`Compra preparada: ${name} · ${formatQuantity(quantity)}. Falta confirmar proveedor y precio.`); window.setTimeout(() => setNotice(""), 3600); }
  return <div className="section-stack"><Tabs tabs={["Necesidades de compra", "Compras registradas"]} active={tab} onChange={setTab} />{notice && <div className="inline-notice" role="status"><span>✓</span>{notice}</div>}<div className="purchase-create-row"><div><strong>Compras con conversión automática</strong><span>Seleccioná una materia prima existente; el costo promedio se calcula al confirmar.</span></div><div className="purchase-create-actions"><button className="primary-button" onClick={() => onCreate?.("gasto", "finanzas")}>＋ Nuevo gasto</button><button className="primary-button" onClick={() => setShowPurchaseForm(true)}>＋ Nueva compra</button></div></div>{tab === "Necesidades de compra" && <><div className="summary-row"><MiniStat label="Insumos a comprar" value={String(needs.length)} detail="Stock mínimo + producción" tone="warning" /><MiniStat label="Para producción" value={String(needs.filter((need) => need.requiredForPlan > 0).length)} detail="Afectados por pedidos" tone="danger" /><MiniStat label="Sólo reposición" value={String(needs.filter((need) => need.requiredForPlan === 0).length)} detail="Debajo del mínimo" tone="info" /><MiniStat label="Compras automáticas" value="0" detail="Siempre requieren confirmación" tone="success" /></div><div className="purchase-method"><span>i</span><div><strong>Cómo calcula KHORA</strong><p>Stock mínimo + insumos para la fabricación sugerida − stock disponible. No crea compras automáticamente.</p></div></div><div className="purchase-needs-grid">{needs.map((need) => <article key={need.code}><header><span>{need.code}</span><Badge tone={need.requiredForPlan > 0 ? "danger" : "warning"}>{need.requiredForPlan > 0 ? "Pedido" : "Reposición"}</Badge></header><h3>{need.name}</h3><dl><div><dt>Stock</dt><dd>{formatQuantity(need.stock)} {need.unit}</dd></div><div><dt>Necesario</dt><dd>{formatQuantity(need.requiredForPlan)} {need.unit}</dd></div><div className="purchase-shortage"><dt>Comprar</dt><dd>{formatQuantity(need.shortage)} {need.unit}</dd></div></dl><div className="purchase-supplier"><span>Proveedor habitual</span><strong>{need.supplier}</strong><small>Último precio: {money(need.lastPrice)} / {need.unit}</small></div><button onClick={() => setShowPurchaseForm(true)}>Registrar compra</button></article>)}</div></>}{tab === "Compras registradas" && <><div className="summary-row"><MiniStat label="Compras de agosto" value={money(284900)} detail="3 compras registradas" tone="info" /><MiniStat label="Por pagar" value={money(118400)} detail="1 compra pendiente" tone="warning" /><MiniStat label="Recibidas" value="2" detail="Ingresaron al stock" tone="success" /><MiniStat label="Pendientes" value="1" detail="Recepción parcial" tone="neutral" /></div><Toolbar placeholder="Buscar compra, proveedor o comprobante…" filters={["Este mes", "Todos los estados", "Todos los pagos"]} /><Panel title="Compras a proveedores" subtitle={`${rows.length} compras encontradas`} action={<button className="secondary-button">↓ Exportar</button>}><DataTable headers={["Compra", "Fecha", "Proveedor", "Detalle", "Total", "Pago", "Recepción", ""]}>{rows.map((purchase) => <tr key={purchase.id}><td><strong>{purchase.id}</strong></td><td>{purchase.date}</td><td><CellPerson name={purchase.supplier} /></td><td>{purchase.detail}</td><td><strong>{money(purchase.total)}</strong></td><td><Badge tone={purchase.payment === "Pagado" ? "success" : "warning"}>{purchase.payment}</Badge></td><td><Badge tone={purchase.tone}>{purchase.status}</Badge></td><td><MoreButton /></td></tr>)}</DataTable></Panel></>}{selectedNeed && <ActionConfirmDialog key={selectedNeed.code} title={`Crear compra de ${selectedNeed.name}`} subtitle={`Proveedor habitual: ${selectedNeed.supplier}`} defaultQuantity={selectedNeed.shortage} unit={selectedNeed.unit} confirmLabel="Preparar compra" note="La compra queda lista para revisar. El stock cambia recién al registrar la recepción." onCancel={() => setSelectedNeed(null)} onConfirm={confirmPurchase} />}{showPurchaseForm && <PurchaseFormDialog onCancel={() => setShowPurchaseForm(false)} onSaved={(message) => { setShowPurchaseForm(false); setNotice(message); window.setTimeout(() => setNotice(""), 4200); }} />}</div>;
}

function PurchaseFormDialog({ onCancel, onSaved }: { onCancel: () => void; onSaved: (message: string) => void }) {
  const [catalog, setCatalog] = useState<MaterialRecord[]>(demoMaterials);
  const [supplierCatalog, setSupplierCatalog] = useState<InventorySupplier[]>(demoSuppliers);
  const [materialId, setMaterialId] = useState(demoMaterials[0]?.id ?? 0);
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState(demoMaterials[0]?.unit ?? "unidad");
  const [totalPesos, setTotalPesos] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState("PAID");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const material = catalog.find((item) => item.id === materialId) ?? catalog[0];
  const unitOptions = baseUnits.map((candidate) => { try { convertUnit(1, candidate.id, material?.unit ?? "unidad"); return { ...candidate, compatible: true }; } catch { return { ...candidate, compatible: false }; } });
  let projection: ReturnType<typeof purchaseProjection> | null = null;
  try { if (material && quantity > 0 && totalPesos >= 0) projection = purchaseProjection(material.stock, material.cost, quantity, unit, material.unit, Math.round(totalPesos * 100)); } catch { projection = null; }

  useEffect(() => {
    let active = true;
    Promise.all(["materials", "suppliers"].map(async (entity) => { const response = await fetch(`/api/khora?entity=${entity}`); if (!response.ok) throw new Error(); return response.json() as Promise<{ rows?: Array<Record<string, unknown>> }>; })).then(([materialData, supplierData]) => {
      if (!active) return;
      const apiMaterials = (materialData.rows ?? []).filter((row) => Boolean(row.active)).map((row) => ({ id: Number(row.id), code: String(row.code), name: String(row.material), category: String(row.category ?? "Sin categoría"), categoryId: Number(row.category_id), prefix: String(row.prefix ?? "MAT"), unit: String(row.unit), stock: Number(row.current_stock), minimum: Number(row.minimum_stock), cost: Number(row.current_cost_cents), supplier: String(row.preferred_supplier ?? "Sin proveedor"), supplierId: row.preferred_supplier_id ? Number(row.preferred_supplier_id) : undefined, notes: String(row.notes ?? "") }));
      const apiSuppliers = (supplierData.rows ?? []).filter((row) => Boolean(row.active)).map((row) => ({ id: Number(row.id), name: String(row.name) }));
      if (apiMaterials.length) { setCatalog(apiMaterials); setMaterialId(apiMaterials[0].id); setUnit(apiMaterials[0].unit); }
      if (apiSuppliers.length) setSupplierCatalog(apiSuppliers);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function changeMaterial(id: number) { const next = catalog.find((item) => item.id === id); setMaterialId(id); if (next) { setUnit(next.unit); setSupplierId(next.supplierId); } }
  async function save() {
    if (!material || !projection) { setError("Revisá la materia prima, la cantidad y la unidad."); return; }
    if (totalPesos <= 0) { setError("Ingresá el costo total de la compra."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "purchase", materialId: material.id, supplierId, quantity, unit, totalCostCents: Math.round(totalPesos * 100), date, paymentStatus, invoiceNumber, notes }) });
      const result = await response.json() as { error?: string; baseQuantity?: number; baseUnit?: string; weightedAverageCostCents?: number };
      if (!response.ok) throw new Error(result.error ?? "No se pudo confirmar la compra");
      onSaved(`Compra confirmada: ingresaron ${formatQuantity(result.baseQuantity ?? projection.baseQuantity)} ${result.baseUnit ?? material.unit}. Nuevo costo promedio: ${money(result.weightedAverageCostCents ?? projection.unitCost)}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo confirmar la compra"); } finally { setSaving(false); }
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onCancel} aria-label="Cancelar compra" /><aside className="inventory-form-drawer purchase-form-drawer" role="dialog" aria-modal="true" aria-labelledby="purchase-form-title"><header><div><p>COMPRAS · COSTO PROMEDIO</p><h2 id="purchase-form-title">Nueva compra</h2><span>La confirmación actualiza stock, movimiento y costo en una sola operación.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header><div className="inventory-form-body"><label><span>Materia prima existente *</span><select value={materialId} onChange={(event) => changeMaterial(Number(event.target.value))}>{catalog.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label><span>Proveedor</span><select value={supplierId ?? ""} onChange={(event) => setSupplierId(event.target.value ? Number(event.target.value) : undefined)}><option value="">Sin proveedor</option>{supplierCatalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="form-grid"><label><span>Cantidad comprada *</span><input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))} /></label><label><span>Unidad de compra *</span><select value={unit} onChange={(event) => setUnit(event.target.value)}>{unitOptions.map((item) => <option key={item.id} value={item.id} disabled={!item.compatible}>{item.label}{item.compatible ? "" : " · incompatible"}</option>)}</select><small>Mostramos todas las unidades; las incompatibles quedan deshabilitadas para evitar conversiones incorrectas.</small></label></div><div className="form-grid"><label><span>Costo total ($) *</span><input type="number" min="0" step="0.01" value={totalPesos} onChange={(event) => setTotalPesos(Math.max(0, Number(event.target.value) || 0))} /></label><label><span>Fecha *</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div><div className="form-grid"><label><span>Estado de pago</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="PAID">Pagado</option><option value="UNPAID">Pendiente</option></select></label><label><span>Comprobante</span><input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Ej. FC A 0001-1234" /></label></div><label><span>Notas</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{material && projection && <section className="purchase-projection"><header><strong>Conversión y costo</strong><Badge tone="info">Vista previa</Badge></header><dl><div><dt>Ingresará al stock</dt><dd>{formatQuantity(projection.baseQuantity)} {material.unit}</dd></div><div><dt>Stock resultante</dt><dd>{formatQuantity(projection.newStock)} {material.unit}</dd></div><div><dt>Costo de esta compra</dt><dd>{projection.baseQuantity ? money(Math.round(totalPesos * 100 / projection.baseQuantity)) : money(0)} / {material.unit}</dd></div><div><dt>Nuevo promedio</dt><dd>{money(projection.unitCost)} / {material.unit}</dd></div></dl></section>}{error && <p className="form-error" role="alert">{error}</p>}</div><footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} aria-busy={saving} onClick={save}>{saving ? "Confirmando…" : "Confirmar compra"}</button></footer></aside></div>;
}

function ActionConfirmDialog({ title, subtitle, defaultQuantity, unit = "u.", confirmLabel, note, onCancel, onConfirm }: { title: string; subtitle: string; defaultQuantity: number; unit?: string; confirmLabel: string; note: string; onCancel: () => void; onConfirm: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState(defaultQuantity);
  return <div className="confirm-layer"><button className="drawer-backdrop" onClick={onCancel} aria-label="Cancelar" /><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><header><div><p>CONFIRMACIÓN</p><h2 id="confirm-title">{title}</h2><span>{subtitle}</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header><div><label><span>Cantidad</span><div><input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(Math.max(0.01, Number(event.target.value) || 0.01))} /><b>{unit}</b></div></label><div className="confirm-note"><i>i</i><p>{note}</p></div></div><footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" onClick={() => onConfirm(quantity)}>{confirmLabel}</button></footer></section></div>;
}

function Suppliers({ search }: { search: string }) {
  type SupplierRow = { id: number; name: string; phone?: string; email?: string; address?: string; active: boolean } & Record<string, unknown>;
  type PurchaseRow = { supplier?: string; purchased_at: string; total_cost_cents: number; payment_status: string } & Record<string, unknown>;
  const supplierData = useKhoraRows<SupplierRow>("suppliers"), purchaseData = useKhoraRows<PurchaseRow>("purchases");
  const rows = supplierData.rows.filter((supplier) => includesSearch(supplier, search));
  const purchaseTotal = purchaseData.rows.reduce((sum, purchase) => sum + Number(purchase.total_cost_cents), 0), pending = purchaseData.rows.filter((purchase) => purchase.payment_status !== "PAID"), pendingTotal = pending.reduce((sum, purchase) => sum + Number(purchase.total_cost_cents), 0);
  return <div className="section-stack">{supplierData.error && <div className="inline-notice error"><span>!</span>{supplierData.error}</div>}<div className="summary-row three"><MiniStat label="Proveedores activos" value={String(supplierData.rows.filter((supplier) => supplier.active).length)} detail={`${supplierData.rows.length} registrados`} tone="info" /><MiniStat label="Comprado" value={money(purchaseTotal / 100)} detail={`${purchaseData.rows.length} compras reales`} tone="neutral" /><MiniStat label="Saldo pendiente" value={money(pendingTotal / 100)} detail={`${pending.length} compras`} tone="warning" /></div><Toolbar placeholder="Buscar proveedor, contacto o localidad…" filters={["Todos los proveedores", "Activos"]} /><div className="supplier-grid">{rows.map((supplier) => { const ownPurchases = purchaseData.rows.filter((purchase) => purchase.supplier === supplier.name), total = ownPurchases.reduce((sum, purchase) => sum + Number(purchase.total_cost_cents), 0), lastPurchase = ownPurchases.map((purchase) => String(purchase.purchased_at).slice(0, 10)).sort().reverse()[0]; return <article className="supplier-card" key={supplier.id}><header><Avatar text={initials(supplier.name)} /><div><h3>{supplier.name}</h3><p>{supplier.address || "Sin dirección"}</p></div><Badge tone={supplier.active ? "success" : "neutral"}>{supplier.active ? "Activo" : "Inactivo"}</Badge></header><dl><div><dt>Email</dt><dd>{supplier.email || "Sin email"}</dd></div><div><dt>WhatsApp</dt><dd>{supplier.phone || "Sin teléfono"}</dd></div><div><dt>Última compra</dt><dd>{lastPurchase || "Sin compras"}</dd></div><div><dt>Total comprado</dt><dd>{money(total / 100)}</dd></div></dl><footer><span>{ownPurchases.length} compras registradas</span>{supplier.phone && <a className="whatsapp-link" href={buildWhatsAppLink(supplier.phone, `Hola ${supplier.name}, te escribimos desde KHORA.`)} target="_blank" rel="noreferrer">Contactar ◉</a>}</footer></article>; })}</div>{!supplierData.loading && !rows.length && <div className="recipe-empty">Todavía no hay proveedores registrados.</div>}</div>;
}

function Finance() {
  const [tab, setTab] = useState("Resumen");
  return <div className="section-stack"><Tabs tabs={["Resumen", "Caja", "Cierre mensual", "Gastos", "Ganancias", "Cuentas", "Reportes"]} active={tab} onChange={setTab} />{tab === "Resumen" && <><div className="finance-hero"><div><p>GANANCIA NETA · AGOSTO</p><strong>{money(655000)}</strong><span><b>↑ 15,9%</b> frente al mes anterior</span></div><div className="profit-equation"><div><span>Ventas</span><strong>{money(1450000)}</strong></div><i>−</i><div><span>Costos vendidos</span><strong>{money(588000)}</strong></div><i>−</i><div><span>Gastos</span><strong>{money(207000)}</strong></div><i>=</i><div className="result"><span>Ganancia</span><strong>{money(655000)}</strong></div></div></div><div className="dashboard-grid dashboard-main"><Panel title="Evolución del negocio" subtitle="Ventas, costos y gastos"><MonthlyChart showCosts /></Panel><Panel title="Salud financiera" subtitle="Agosto 2026"><div className="health-list"><Health label="Margen bruto" value="59,4%" level={88} tone="success" /><Health label="Margen neto" value="45,2%" level={72} tone="success" /><Health label="Cobranza" value="90,5%" level={91} tone="info" /><Health label="Gastos / ventas" value="14,3%" level={29} tone="warning" /></div></Panel></div></>}{tab === "Caja" && <CashView />}{tab === "Cierre mensual" && <MonthlyCloseView />}{tab === "Gastos" && <Panel title="Gastos de agosto" subtitle={`Total: ${money(207000)}`}><DataTable headers={["Fecha", "Categoría", "Descripción", "Importe", "Estado", ""]}>{expenses.map((expense) => <tr key={expense.description}><td>{expense.date}</td><td><Badge tone="neutral">{expense.category}</Badge></td><td>{expense.description}</td><td><strong>{money(expense.amount)}</strong></td><td><Badge tone="success">Pagado</Badge></td><td><MoreButton /></td></tr>)}</DataTable></Panel>}{tab === "Ganancias" && <ProfitHistory />}{tab === "Cuentas" && <Accounts />}{tab === "Reportes" && <Reports />}</div>;
}

function CashView() {
  const [period, setPeriod] = useState<CashPeriod>("today");
  const cash = getCashPanel(period);
  return <><div className="finance-period"><div><small>PANEL DE CAJA</small><h2>{cash.label}</h2><p>Movimientos confirmados según su fecha efectiva.</p></div><div role="group" aria-label="Período de caja">{([['today','Hoy'],['week','Semana'],['month','Mes']] as Array<[CashPeriod,string]>).map(([value,label]) => <button key={value} className={period === value ? "active" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div></div><section className="cash-hero"><div className="cash-net"><small>SALDO NETO</small><strong className={cash.net >= 0 ? "positive" : "negative"}>{money(cash.net)}</strong><span>{cash.movements.length} movimientos confirmados</span></div><div className="cash-flow"><article><span className="cash-arrow in">↓</span><div><small>Entró</small><strong>{money(cash.incoming)}</strong></div></article><article><span className="cash-arrow out">↑</span><div><small>Salió</small><strong>{money(cash.outgoing)}</strong></div></article></div></section><div className="cash-pending"><article><span>$</span><div><small>PENDIENTE DE COBRAR</small><strong>{money(cash.pendingIncome)}</strong><p>Pedidos con saldo abierto</p></div><button>Ver cuentas →</button></article><article><span>↓</span><div><small>PENDIENTE DE PAGAR</small><strong>{money(cash.pendingOutgoing)}</strong><p>Compras y gastos pendientes</p></div><button>Ver cuentas →</button></article></div><Panel title="Movimientos de caja" subtitle={`${cash.movements.length} movimientos en ${cash.label.toLocaleLowerCase("es")}`} action={<button className="secondary-button">↓ Exportar</button>}>{cash.movements.length ? <div className="cash-movements">{cash.movements.map((movement) => <article key={movement.id}><span className={`cash-movement-icon ${movement.direction === "IN" ? "in" : "out"}`}>{movement.direction === "IN" ? "↓" : "↑"}</span><div><strong>{movement.description}</strong><small>{movement.counterpart} · {movement.category}</small></div><time dateTime={movement.occurredAt}>{new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(movement.occurredAt))}</time><b className={movement.direction === "IN" ? "success-text" : "danger-text"}>{movement.direction === "IN" ? "+" : "−"}{money(movement.amount)}</b></article>)}</div> : <div className="empty-cash"><span>✓</span><strong>No hay movimientos en este período</strong><p>Probá con Semana o Mes para ampliar la consulta.</p></div>}</Panel><div className="cash-method-note"><i>i</i><p>Caja usa la fecha del cobro o pago. Una venta pendiente no aparece como entrada hasta que se registra el pago.</p></div></>;
}

function MonthlyCloseView() {
  const closures = getAvailableClosures();
  const [monthKey, setMonthKey] = useState(closures[0]?.key ?? "2026-08");
  const [baselineKey, setBaselineKey] = useState(closures[1]?.key ?? closures[0]?.key ?? "2026-07");
  const close = getMonthlyClose(monthKey)!;
  const comparison = compareMonthlyClosures(monthKey, baselineKey);
  useEffect(() => { if (baselineKey !== monthKey) return; const timeout = window.setTimeout(() => setBaselineKey(closures.find((item) => item.key !== monthKey)?.key ?? baselineKey), 0); return () => window.clearTimeout(timeout); }, [baselineKey, monthKey, closures]);
  const displayMetric = (label: string, value: number) => label === "Pedidos" || label === "Unidades" ? String(value) : label === "Margen neto" ? `${value.toFixed(1)}%` : money(value);
  return <><div className="monthly-close-head"><div><small>CIERRE MENSUAL · HISTORIAL</small><h2>{close.name}</h2><p>Los cierres quedan guardados para comparar cualquier mes disponible.</p></div><div className="monthly-close-selectors"><label><span>Período</span><select value={monthKey} onChange={(event) => setMonthKey(event.target.value)}>{closures.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label><span>Comparar con</span><select value={baselineKey} onChange={(event) => setBaselineKey(event.target.value)}>{closures.filter((item) => item.key !== monthKey).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div></div><section className="close-hero"><div><small>GANANCIA NETA</small><strong>{money(close.netProfit)}</strong><span className="comparison-value up">Histórico guardado</span></div><dl><div><dt>Ventas</dt><dd>{money(close.sales)}</dd></div><div><dt>Costos vendidos</dt><dd>− {money(close.costs)}</dd></div><div><dt>Gastos</dt><dd>− {money(close.expenses)}</dd></div><div className="close-result"><dt>Margen neto</dt><dd>{close.netMargin.toFixed(1)}%</dd></div></dl></section><div className="summary-row"><MiniStat label="Ventas" value={money(close.sales)} detail={`${close.grossMargin.toFixed(1)}% margen bruto`} tone="success" /><MiniStat label="Gastos" value={money(close.expenses)} detail="Egresos del período" tone="warning" /><MiniStat label="Pedidos" value={String(close.orders)} detail="Pedidos registrados" tone="info" /><MiniStat label="Productos vendidos" value={`${close.productsSold} u.`} detail="Unidades entregadas" tone="neutral" /></div>{comparison ? <Panel title={`Comparación: ${comparison.current.name} vs. ${comparison.baseline.name}`} subtitle="Variación porcentual sobre el cierre histórico seleccionado"><div className="close-comparison">{comparison.metrics.map((metric) => { const favorable = metric.inverse ? metric.change <= 0 : metric.change >= 0; return <article className={favorable ? "positive" : "negative"} key={metric.label}><span>{metric.label}</span><strong>{metric.change >= 0 ? "↑" : "↓"} {Math.abs(metric.change).toFixed(1)}{metric.points ? " puntos" : "%"}</strong><small>{displayMetric(metric.label, metric.current)} vs. {displayMetric(metric.label, metric.baseline)} · {favorable ? "Evolución favorable" : "Revisar variación"}</small></article>; })}</div></Panel> : <div className="close-no-comparison"><span>i</span><p>Elegí dos meses distintos para ver la comparación.</p></div>}<Panel title="Resumen del cierre guardado" subtitle="El historial conserva los valores del período seleccionado"><div className="close-highlights"><CloseHighlight icon={moduleIcons.productos} title="Producto más vendido" value={close.highlights.topProduct.label} detail={close.highlights.topProduct.detail} /><CloseHighlight icon={moduleIcons.finanzas} title="Producto más rentable" value={close.highlights.profitableProduct.label} detail={close.highlights.profitableProduct.detail} /><CloseHighlight icon={moduleIcons.clientes} title="Mejor cliente" value={close.highlights.bestCustomer.label} detail={close.highlights.bestCustomer.detail} /><CloseHighlight icon={moduleIcons.finanzas} title="Mayor gasto" value={close.highlights.largestExpense.label} detail={money(close.highlights.largestExpense.detail)} /><CloseHighlight icon={moduleIcons.stock} title="Materia prima más comprada" value={close.highlights.mostPurchasedMaterial.label} detail={close.highlights.mostPurchasedMaterial.detail} /></div></Panel><div className="close-history-note"><span>✓</span><div><strong>Historial mensual protegido</strong><p>Podés volver a cualquier mes y compararlo con otro sin modificar los datos históricos.</p></div></div></>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyMonthlyCloseView() {
  const closures = getAvailableClosures();
  const [monthKey, setMonthKey] = useState("2026-08");
  const close = getMonthlyClose(monthKey)!;
  return <><div className="monthly-close-head"><div><small>CIERRE MENSUAL</small><h2>{close.name}</h2><p>Resultado del negocio con costos históricos de cada venta.</p></div><label><span>Período</span><select value={monthKey} onChange={(event) => setMonthKey(event.target.value)}>{closures.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div><section className="close-hero"><div><small>GANANCIA NETA</small><strong>{money(close.netProfit)}</strong><ComparisonValue value={close.comparison?.netProfit ?? 0} suffix={` vs. ${close.comparison?.month ?? "mes anterior"}`} /></div><dl><div><dt>Ventas</dt><dd>{money(close.sales)}</dd></div><div><dt>Costos vendidos</dt><dd>− {money(close.costs)}</dd></div><div><dt>Gastos</dt><dd>− {money(close.expenses)}</dd></div><div className="close-result"><dt>Margen neto</dt><dd>{close.netMargin.toFixed(1)}%</dd></div></dl></section><div className="summary-row"><MiniStat label="Ventas" value={money(close.sales)} detail={`${close.grossMargin.toFixed(1)}% margen bruto`} tone="success" /><MiniStat label="Gastos" value={money(close.expenses)} detail="Egresos del período" tone="warning" /><MiniStat label="Pedidos" value={String(close.orders)} detail="Pedidos registrados" tone="info" /><MiniStat label="Productos vendidos" value={`${close.productsSold} u.`} detail="Unidades entregadas" tone="neutral" /></div><Panel title="Lo más importante del mes" subtitle="Productos, clientes, gastos y abastecimiento"><div className="close-highlights"><CloseHighlight icon={moduleIcons.productos} title="Producto más vendido" value={close.highlights.topProduct.label} detail={close.highlights.topProduct.detail} /><CloseHighlight icon={moduleIcons.finanzas} title="Producto más rentable" value={close.highlights.profitableProduct.label} detail={close.highlights.profitableProduct.detail} /><CloseHighlight icon={moduleIcons.clientes} title="Mejor cliente" value={close.highlights.bestCustomer.label} detail={close.highlights.bestCustomer.detail} /><CloseHighlight icon={moduleIcons.finanzas} title="Mayor gasto" value={close.highlights.largestExpense.label} detail={money(close.highlights.largestExpense.detail)} /><CloseHighlight icon={moduleIcons.stock} title="Materia prima más comprada" value={close.highlights.mostPurchasedMaterial.label} detail={close.highlights.mostPurchasedMaterial.detail} /></div></Panel>{close.comparison ? <Panel title={`Comparación con ${close.comparison.month}`} subtitle="Variación respecto del mes anterior"><div className="close-comparison"><ComparisonCard label="Ventas" value={close.comparison.sales} /><ComparisonCard label="Ganancia" value={close.comparison.netProfit} /><ComparisonCard label="Gastos" value={close.comparison.expenses} inverse /><ComparisonCard label="Pedidos" value={close.comparison.orders} /><ComparisonCard label="Unidades" value={close.comparison.productsSold} /></div></Panel> : <div className="close-no-comparison"><span>i</span><p>Este es el primer mes disponible; todavía no hay un período anterior para comparar.</p></div>}<div className="close-history-note"><span>✓</span><div><strong>Resultado histórico protegido</strong><p>Se utilizan los precios y costos guardados al momento de cada venta. Los cambios actuales no reescriben este cierre.</p></div></div></>;
}

function CloseHighlight({ icon, title, value, detail }: { icon: KhoraIconName; title: string; value: string; detail: string }) { return <article><span><KhoraIcon name={icon} /></span><div><small>{title}</small><strong>{value}</strong><p>{detail}</p></div></article>; }
function ComparisonValue({ value, suffix = "" }: { value: number; suffix?: string }) { const direction = value >= 0 ? "up" : "down"; return <span className={`comparison-value ${direction}`}>{value >= 0 ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%{suffix}</span>; }
function ComparisonCard({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) { const positive = inverse ? value <= 0 : value >= 0; return <article className={positive ? "positive" : "negative"}><span>{label}</span><strong>{value >= 0 ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%</strong><small>{positive ? "Evolución favorable" : "Revisar variación"}</small></article>; }

function Metric({ label, value, detail, tone, icon, onClick }: { label: string; value: string; detail: string; tone: Tone; icon: KhoraIconName; onClick?: () => void }) { return <button className={`metric-card ${tone}`} onClick={onClick}><div className="metric-icon"><KhoraIcon name={icon} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small>{onClick && <i className="metric-arrow">→</i>}</button>; }
function MiniStat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: Tone }) { return <article className={`mini-stat ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) { return <section className={`panel ${className}`}><header className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header><div className="panel-body">{children}</div></section>; }
function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) { return <span className={`badge ${tone}`}><i />{children}</span>; }
function Avatar({ text, small = false }: { text: string; small?: boolean }) { return <span className={`avatar ${small ? "small" : ""}`}>{text}</span>; }
function MoreButton() { return <button className="more-button" aria-label="Más acciones">•••</button>; }
function CellPerson({ name, subtitle, initialsText }: { name: string; subtitle?: string; initialsText?: string }) { return <div className="cell-person"><Avatar text={initialsText ?? initials(name)} small /><div><strong>{name}</strong>{subtitle && <small>{subtitle}</small>}</div></div>; }
function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) { return <div className="tabs" role="tablist">{tabs.map((tab) => <button key={tab} role="tab" aria-selected={tab === active} className={tab === active ? "active" : ""} onClick={() => onChange(tab)}>{tab}</button>)}</div>; }
function Toolbar({ placeholder, filters, compact = false }: { placeholder: string; filters: string[]; compact?: boolean }) { return <div className={`toolbar ${compact ? "compact" : ""}`}><label><span>⌕</span><input placeholder={placeholder} /></label><div>{filters.map((filter) => <button key={filter}>{filter}<span>⌄</span></button>)}</div></div>; }
function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="data-table-wrap"><table className="data-table"><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function StockValue({ value, minimum, unit }: { value: number; minimum: number; unit: string }) { const percent = Math.min(100, Math.round((value / minimum) * 75)); return <div className="stock-value"><strong>{value} {unit}</strong><i><em className={value < minimum ? "danger" : value <= minimum * 1.25 ? "warning" : "success"} style={{ width: `${percent}%` }} /></i></div>; }
function MonthlyChart({ showCosts = false }: { showCosts?: boolean }) { const max = Math.max(...months.map((month) => month.sales)); return <div className="chart"><div className="chart-y"><span>$1,5 M</span><span>$1,0 M</span><span>$500 k</span><span>$0</span></div><div className="chart-area">{months.map((month) => { const profit = month.sales - month.costs - month.expenses; return <div className="chart-month" key={month.month}><div className="bar-group"><i className="sales-bar" style={{ height: `${(month.sales / max) * 100}%` }} title={`Ventas ${money(month.sales)}`} /><i className="profit-bar" style={{ height: `${(profit / max) * 100}%` }} title={`Ganancia ${money(profit)}`} />{showCosts && <i className="cost-bar" style={{ height: `${(month.costs / max) * 100}%` }} />}</div><span>{month.month}</span></div>; })}</div><div className="chart-legend"><span><i className="sales" />Ventas</span><span><i className="profit" />Ganancia</span>{showCosts && <span><i className="cost" />Costos</span>}</div></div>; }
function Health({ label, value, level, tone }: { label: string; value: string; level: number; tone: Tone }) { return <div className="health"><div><span>{label}</span><strong>{value}</strong></div><i><em className={tone} style={{ width: `${level}%` }} /></i></div>; }

function RecipeList({ onCreate }: { onCreate: () => void }) { return <Panel title="Recetas de fabricación" subtitle="El costo se actualiza con cada materia prima" action={<button className="primary-button" onClick={onCreate}>＋ Nueva receta</button>}><DataTable headers={["Producto", "Rendimiento", "Ingredientes", "Costo receta", "Costo unitario", "Actualizada", ""]}>{products.slice(0, 4).map((product, index) => <tr key={product.code}><td><strong>{product.name}</strong><small className="table-sub">{product.code}</small></td><td>{index % 2 ? 12 : 24} u.</td><td>{4 + index} componentes</td><td>{money(product.cost * (index % 2 ? 12 : 24))}</td><td><strong>{money(product.cost)}</strong></td><td>{12 - index} ago</td><td><MoreButton /></td></tr>)}</DataTable></Panel>; }
function ComboList({ onCreate }: { onCreate: () => void }) { return <Panel title="Combos" subtitle="Productos agrupados con costo automático" action={<button className="primary-button" onClick={onCreate}>＋ Nuevo combo</button>}><div className="combo-grid">{["Combo Relax", "Set Bienvenida", "Regalo Esencial"].map((name, index) => <article key={name}><div className="combo-icon">K</div><div><small>COM-00{index + 1}</small><h3>{name}</h3><p>{2 + index} productos + packaging</p><dl><div><dt>Costo</dt><dd>{money(10980 + index * 2100)}</dd></div><div><dt>Precio</dt><dd>{money(24800 + index * 4500)}</dd></div></dl><button>Editar composición →</button></div></article>)}</div></Panel>; }
function SimpleCategories() { return <Panel title="Categorías" subtitle="Organización de productos"><div className="category-list">{["Difusores", "Aromatizadores", "Combos", "Decoración", "Ediciones especiales"].map((category, index) => <article key={category}><span>{category.slice(0, 1)}</span><strong>{category}</strong><small>{index + 3} productos</small><MoreButton /></article>)}</div></Panel>; }
function MovementList() { const rows = [{ date: "13 ago · 10:42", type: "Compra", item: "Esencia Lavanda", change: "+3 L", balance: "1,8 L", ref: "C-0214" }, { date: "12 ago · 16:18", type: "Fabricación", item: "Alcohol de cereal", change: "−4,3 L", balance: "12,4 L", ref: "L-0087" }, { date: "12 ago · 16:18", type: "Fabricación", item: "Difusor Lavanda", change: "+24 u.", balance: "18 u.", ref: "L-0087" }, { date: "12 ago · 11:05", type: "Venta", item: "Combo Relax", change: "−4 u.", balance: "5 u.", ref: "V-1058" }]; return <Panel title="Movimientos de stock" subtitle="Historial completo y auditable"><DataTable headers={["Fecha", "Tipo", "Producto o insumo", "Movimiento", "Saldo", "Referencia", ""]}>{rows.map((row) => <tr key={`${row.date}-${row.item}`}><td>{row.date}</td><td><Badge tone={row.change.startsWith("+") ? "success" : "info"}>{row.type}</Badge></td><td><strong>{row.item}</strong></td><td className={row.change.startsWith("+") ? "success-text" : "danger-text"}>{row.change}</td><td>{row.balance}</td><td>{row.ref}</td><td><MoreButton /></td></tr>)}</DataTable></Panel>; }
function ProfitHistory() { return <Panel title="Ganancia por mes" subtitle="El costo corresponde a los productos efectivamente vendidos" action={<button className="secondary-button">↓ Exportar</button>}><DataTable headers={["Mes", "Ventas", "Costos vendidos", "Ganancia bruta", "Gastos", "Ganancia neta", "Margen"]}>{months.slice().reverse().map((month) => { const gross = month.sales - month.costs, net = gross - month.expenses; return <tr key={month.month}><td><strong>{month.month} 2026</strong></td><td>{money(month.sales)}</td><td>{money(month.costs)}</td><td>{money(gross)}</td><td>{money(month.expenses)}</td><td><strong className="success-text">{money(net)}</strong></td><td>{((net / month.sales) * 100).toFixed(1)}%</td></tr>; })}</DataTable></Panel>; }
function Accounts() { return <div className="account-grid"><Panel title="Cuentas por cobrar" subtitle="3 pagos pendientes"><div className="account-list">{orders.filter((o) => o.payment !== "Pagado").map((order) => <article key={order.id}><CellPerson name={order.customer} /><div><strong>{money(order.total)}</strong><small>{order.id} · {order.payment}</small></div><button>Registrar pago</button></article>)}</div></Panel><Panel title="Cuentas por pagar" subtitle="1 compra pendiente"><div className="account-list">{purchases.filter((p) => p.payment !== "Pagado").map((purchase) => <article key={purchase.id}><CellPerson name={purchase.supplier} /><div><strong>{money(purchase.total)}</strong><small>{purchase.id} · {purchase.payment}</small></div><button>Registrar pago</button></article>)}</div></Panel></div>; }
function Reports() { const reports: Array<{ title: string; detail: string; icon: KhoraIconName }> = [{ title: "Ventas", detail: "Detalle, productos y medios de pago", icon: moduleIcons.ventas }, { title: "Stock", detail: "Productos y materias primas", icon: moduleIcons.stock }, { title: "Ganancias", detail: "Ventas, costos, gastos y margen", icon: moduleIcons.finanzas }, { title: "Clientes", detail: "Actividad e historial de compras", icon: moduleIcons.clientes }, { title: "Fabricación", detail: "Lotes, consumos y costos", icon: moduleIcons.fabricacion }, { title: "Compras y gastos", detail: "Proveedores y movimientos", icon: moduleIcons.compras }]; return <div className="report-grid">{reports.map((report) => <article key={report.title}><span><KhoraIcon name={report.icon} /></span><div><h3>{report.title}</h3><p>{report.detail}</p></div><select aria-label={`Formato para ${report.title}`}><option>Excel</option><option>PDF</option></select><button>Generar</button></article>)}</div>; }

function initials(name: string) { return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function includesSearch(value: unknown, search: string) { return !search.trim() || JSON.stringify(value).toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")); }
function formatQuantity(value: number) { return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value); }
