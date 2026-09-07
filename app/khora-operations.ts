import { SectionId, Tone } from "./khora-data";
import { moduleIcons, type KhoraIconName } from "./khora-icons";
import { getStockAlertSummary, getStockStatus, type StockAlertSummary } from "./khora-inventory";

export type NavigationIntent = { section: SectionId; query?: string };
export type OperationalPriority = "critical" | "attention" | "information";
export type AgendaItem = { id: string; label: string; detail: string; count: number; icon: KhoraIconName; tone: Tone; destination: NavigationIntent };
export type OperationalAlert = { id: string; priority: OperationalPriority; title: string; detail: string; action: string; tone: Tone; destination: NavigationIntent; dismissible?: boolean };
export type SearchCategory = "Clientes" | "Productos" | "Materias primas" | "Lotes" | "Proveedores" | "Mezclas";
export type GlobalSearchResult = { id: string; category: SearchCategory; title: string; subtitle: string; icon: KhoraIconName; destination: NavigationIntent };

type RealRow = Record<string, unknown>;
export type OperationalData = { clients: RealRow[]; products: RealRow[]; materials: RealRow[]; batches: RealRow[]; suppliers: RealRow[]; purchases: RealRow[]; mixtures: RealRow[]; orders: RealRow[] };
export const emptyOperationalData: OperationalData = { clients: [], products: [], materials: [], batches: [], suppliers: [], purchases: [], mixtures: [], orders: [] };
export type OperationalStockAlerts = { products: StockAlertSummary; materials: StockAlertSummary; mixtures: StockAlertSummary; summary: StockAlertSummary };

const text = (value: unknown) => String(value ?? "");
const numeric = (value: unknown) => Number(value ?? 0);
export function getOrderOperationalState(order: RealRow) {
  const explicit = text(order.store_status).toUpperCase();
  if (["PENDING_PAYMENT", "PAID", "PENDING_DELIVERY", "DELIVERED", "CANCELLED", "EXPIRED"].includes(explicit)) return explicit;
  if (text(order.status).toUpperCase() === "DELIVERED") return "DELIVERED";
  if (text(order.status).toUpperCase() === "CANCELLED") return "CANCELLED";
  if (text(order.payment_status).toUpperCase() === "PAID") return "PENDING_DELIVERY";
  return "PENDING_PAYMENT";
}

export function getOperationalOverview(data: OperationalData) {
  const isActive = (row: RealRow) => row.active === true || numeric(row.active) === 1;
  const activeProducts = data.products.filter(isActive);
  const activeMaterials = data.materials.filter(isActive);
  const activeMixtures = data.mixtures.filter(isActive);
  const stockAlerts: OperationalStockAlerts = {
    products: getStockAlertSummary(activeProducts, (row) => ({ stock: numeric(row.current_stock), minimum: numeric(row.minimum_stock) })),
    materials: getStockAlertSummary(activeMaterials, (row) => ({ stock: numeric(row.current_stock), minimum: numeric(row.minimum_stock) })),
    mixtures: getStockAlertSummary(activeMixtures, (row) => ({ stock: numeric(row.current_stock), minimum: numeric(row.minimum_stock) })),
    summary: { lowCount: 0, outCount: 0, problemCount: 0, severity: "normal" },
  };
  const lowCount = stockAlerts.products.lowCount + stockAlerts.materials.lowCount + stockAlerts.mixtures.lowCount;
  const outCount = stockAlerts.products.outCount + stockAlerts.materials.outCount + stockAlerts.mixtures.outCount;
  stockAlerts.summary = { lowCount, outCount, problemCount: lowCount + outCount, severity: outCount > 0 ? "out" : lowCount > 0 ? "low" : "normal" };
  const stockTone: Tone = stockAlerts.summary.severity === "out" ? "danger" : stockAlerts.summary.severity === "low" ? "warning" : "info";
  const pendingPurchases = data.purchases.filter((purchase) => text(purchase.payment_status).toUpperCase() !== "PAID" && text(purchase.status) !== "Anulada");
  const activeOrders = data.orders.filter((order) => ["PENDING_PAYMENT", "PAID", "PENDING_DELIVERY"].includes(getOrderOperationalState(order)));
  const agenda: AgendaItem[] = [
    { id: "manufacture", label: "planificador de fabricación", detail: "Revisar necesidades de producción", count: 0, icon: moduleIcons.fabricacion, tone: "info", destination: { section: "fabricacion" } },
    { id: "buy", label: "materias primas por comprar", detail: "Stock en poco o sin stock", count: stockAlerts.materials.problemCount, icon: moduleIcons.stock, tone: stockAlerts.materials.severity === "out" ? "danger" : stockAlerts.materials.severity === "low" ? "warning" : "info", destination: { section: "stock" } },
    { id: "pay", label: "compras con pago pendiente", detail: "Seguimiento de pagos", count: pendingPurchases.length, icon: moduleIcons.ventas, tone: "warning", destination: { section: "finanzas" } },
    { id: "orders", label: "pedidos por atender", detail: "Pendientes de pago o entrega", count: activeOrders.length, icon: moduleIcons.pedidos, tone: activeOrders.length ? "warning" : "info", destination: { section: "pedidos" } },
    { id: "mixtures", label: "mezclas por revisar", detail: "Stock bajo o sin stock", count: stockAlerts.mixtures.problemCount, icon: moduleIcons.fabricacion, tone: stockAlerts.mixtures.severity === "out" ? "danger" : stockAlerts.mixtures.severity === "low" ? "warning" : "info", destination: { section: "stock" } },
  ];
  const alerts: OperationalAlert[] = [
    ...activeProducts.flatMap((product) => {
      const status = getStockStatus(numeric(product.current_stock), numeric(product.minimum_stock));
      if (status === "normal") return [];
      return [{ id: `product-${text(product.id)}`, priority: status === "out" ? "critical" as const : "attention" as const, title: status === "out" ? `${text(product.name)} sin stock` : `${text(product.name)} con poco stock`, detail: `Quedan ${numeric(product.current_stock)} u. · mínimo ${numeric(product.minimum_stock)}`, action: "Ver producto", tone: status === "out" ? "danger" as Tone : "warning" as Tone, destination: { section: "stock" as SectionId, query: text(product.name) }, dismissible: false }];
    }),
    ...activeMaterials.flatMap((material) => {
      const status = getStockStatus(numeric(material.current_stock), numeric(material.minimum_stock));
      if (status === "normal") return [];
      return [{ id: `material-${text(material.id)}`, priority: status === "out" ? "critical" as const : "attention" as const, title: status === "out" ? `${text(material.material)} sin stock` : `${text(material.material)} con poco stock`, detail: `Quedan ${numeric(material.current_stock)} ${text(material.unit)} · mínimo ${numeric(material.minimum_stock)}`, action: "Ver materia prima", tone: status === "out" ? "danger" as Tone : "warning" as Tone, destination: { section: "stock" as SectionId, query: text(material.material) }, dismissible: false }];
    }),
    ...activeMixtures.flatMap((mixture) => {
      const status = getStockStatus(numeric(mixture.current_stock), numeric(mixture.minimum_stock));
      if (status === "normal") return [];
      return [{ id: `mixture-${text(mixture.id)}`, priority: status === "out" ? "critical" as const : "attention" as const, title: status === "out" ? `${text(mixture.name)} sin stock` : `${text(mixture.name)} con poco stock`, detail: `Quedan ${numeric(mixture.current_stock)} ${text(mixture.unit)} · mínimo ${numeric(mixture.minimum_stock)}`, action: "Ver mezcla", tone: status === "out" ? "danger" as Tone : "warning" as Tone, destination: { section: "stock" as SectionId, query: text(mixture.name) }, dismissible: false }];
    }),
    ...pendingPurchases.map((purchase) => ({ id: "purchase-" + text(purchase.id), priority: "attention" as const, title: "Compra C-" + text(purchase.id) + " pendiente", detail: (text(purchase.supplier) || "Sin proveedor") + " · " + text(purchase.material), action: "Abrir compra", tone: "warning" as Tone, destination: { section: "compras" as SectionId, query: "C-" + text(purchase.id) } })),
    ...activeOrders.map((order) => {
      const state = getOrderOperationalState(order);
      const pendingPayment = state === "PENDING_PAYMENT";
      const number = text(order.number) || ("KH-" + text(order.id).padStart(6, "0"));
      return { id: "order-" + text(order.id), priority: "attention" as const, title: pendingPayment ? "Pedido " + number + " pendiente de pago" : "Pedido " + number + " pendiente de entrega", detail: (text(order.client) || "Cliente sin vincular") + " · " + (pendingPayment ? "Revisar cobro" : "Coordinar entrega"), action: "Abrir pedido", tone: pendingPayment ? "warning" as Tone : "info" as Tone, destination: { section: "pedidos" as SectionId, query: number }, dismissible: false };
    }),
  ];
  return { agenda, alerts, stockAlerts, stockSeverity: stockAlerts.summary.severity, stockTone };
}

export function searchKhora(rawQuery: string, data: OperationalData): GlobalSearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];
  const candidates: GlobalSearchResult[] = [
    ...data.clients.map((client) => ({ id: `client-${text(client.id)}`, category: "Clientes" as const, title: text(client.name), subtitle: [text(client.phone), text(client.address)].filter(Boolean).join(" · ") || "Sin datos de contacto", icon: moduleIcons.clientes, destination: { section: "clientes" as SectionId, query: text(client.name) } })),
    ...data.products.map((product) => ({ id: `product-${text(product.id)}`, category: "Productos" as const, title: text(product.name), subtitle: `${text(product.code)} · ${text(product.type)} · stock ${numeric(product.current_stock)}`, icon: moduleIcons.productos, destination: { section: "productos" as SectionId, query: text(product.name) } })),
    ...data.materials.map((material) => ({ id: `material-${text(material.id)}`, category: "Materias primas" as const, title: text(material.material), subtitle: `${text(material.code)} · ${text(material.category)} · stock ${numeric(material.current_stock)} ${text(material.unit)}`, icon: moduleIcons.stock, destination: { section: "stock" as SectionId, query: text(material.material) } })),
    ...data.batches.map((batch) => ({ id: `batch-${text(batch.id)}`, category: "Lotes" as const, title: `Lote ${text(batch.batch_number)}`, subtitle: `${text(batch.product)} · ${numeric(batch.quantity)} unidades`, icon: moduleIcons.fabricacion, destination: { section: "fabricacion" as SectionId, query: text(batch.batch_number) } })),
    ...data.suppliers.map((supplier) => ({ id: `supplier-${text(supplier.id)}`, category: "Proveedores" as const, title: text(supplier.name), subtitle: [text(supplier.phone), text(supplier.address)].filter(Boolean).join(" · ") || "Sin datos de contacto", icon: moduleIcons.proveedores, destination: { section: "proveedores" as SectionId, query: text(supplier.name) } })),
    ...data.mixtures.filter((mixture) => Number(mixture.active) === 1 || mixture.active === true).map((mixture) => ({ id: "mixture-" + text(mixture.id), category: "Mezclas" as const, title: text(mixture.name), subtitle: text(mixture.code) + " · " + text(mixture.unit) + " · stock " + numeric(mixture.current_stock), icon: moduleIcons.fabricacion, destination: { section: "stock" as SectionId, query: text(mixture.name) } })),
  ];
  return candidates.filter((result) => normalize(`${result.title} ${result.subtitle}`).includes(query)).sort((a, b) => searchScore(b, query) - searchScore(a, query)).slice(0, 18);
}

export function groupSearchResults(results: GlobalSearchResult[]) {
  return results.reduce<Partial<Record<SearchCategory, GlobalSearchResult[]>>>((groups, result) => { (groups[result.category] ??= []).push(result); return groups; }, {});
}

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function searchScore(result: GlobalSearchResult, query: string) { const title = normalize(result.title); if (title === query) return 4; if (title.startsWith(query)) return 3; if (title.includes(query)) return 2; return 1; }
