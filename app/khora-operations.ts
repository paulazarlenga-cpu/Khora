import { SectionId, Tone, type OrderHistoryStatus } from "./khora-data";
import { moduleIcons, type KhoraIconName } from "./khora-icons";

export type NavigationIntent = { section: SectionId; query?: string };
export type OperationalPriority = "critical" | "attention" | "information";
export type AgendaItem = { id: string; label: string; detail: string; count: number; icon: KhoraIconName; tone: Tone; destination: NavigationIntent };
export type OperationalAlert = { id: string; priority: OperationalPriority; title: string; detail: string; action: string; tone: Tone; destination: NavigationIntent };
export type SearchCategory = "Pedidos" | "Clientes" | "Productos" | "Materias primas" | "Lotes" | "Proveedores";
export type GlobalSearchResult = { id: string; category: SearchCategory; title: string; subtitle: string; icon: KhoraIconName; destination: NavigationIntent };

type RealRow = Record<string, unknown>;
export type OperationalData = { orders: RealRow[]; clients: RealRow[]; products: RealRow[]; materials: RealRow[]; batches: RealRow[]; suppliers: RealRow[]; purchases: RealRow[] };
export const emptyOperationalData: OperationalData = { orders: [], clients: [], products: [], materials: [], batches: [], suppliers: [], purchases: [] };

const timelineSteps: OrderHistoryStatus[] = ["Pedido recibido", "Confirmado", "En preparación", "En fabricación", "Listo", "Entregado"];
const finishedOrderStatuses = new Set(["DELIVERED", "CANCELLED", "ARCHIVED", "ENTREGADO", "CANCELADO"]);
const productionOrderStatuses = new Set(["IN_PRODUCTION", "MANUFACTURING", "EN FABRICACIÓN", "EN FABRICACION"]);
const text = (value: unknown) => String(value ?? "");
const numeric = (value: unknown) => Number(value ?? 0);

export function getOperationalOverview(data: OperationalData, today = new Date()) {
  const todayKey = toDateKey(today);
  const pendingOrders = data.orders.filter((order) => !finishedOrderStatuses.has(text(order.status).toUpperCase()));
  const todayDeliveries = pendingOrders.filter((order) => text(order.expected_at).slice(0, 10) === todayKey);
  const productionOrders = pendingOrders.filter((order) => productionOrderStatuses.has(text(order.status).toUpperCase()));
  const criticalMaterials = data.materials.filter((material) => Boolean(material.active) && numeric(material.minimum_stock) > 0 && numeric(material.current_stock) < numeric(material.minimum_stock));
  const overdueOrders = pendingOrders.filter((order) => text(order.expected_at) && text(order.expected_at).slice(0, 10) < todayKey);
  const pendingPurchases = data.purchases.filter((purchase) => text(purchase.payment_status).toUpperCase() !== "PAID" && text(purchase.status) !== "Anulada");
  const readyOrders = pendingOrders.filter((order) => ["READY", "LISTO"].includes(text(order.status).toUpperCase()));
  const agenda: AgendaItem[] = [
    { id: "prepare", label: "pedidos para preparar", detail: "Revisar tablero de trabajo", count: pendingOrders.length, icon: moduleIcons.pedidos, tone: "warning", destination: { section: "pedidos" } },
    { id: "deliver", label: "entregas programadas", detail: "Coordinar horarios de hoy", count: todayDeliveries.length, icon: moduleIcons.entregas, tone: "info", destination: { section: "pedidos", query: "Hoy" } },
    { id: "manufacture", label: "fabricación pendiente", detail: "Pedidos en producción", count: productionOrders.length, icon: moduleIcons.fabricacion, tone: "warning", destination: { section: "fabricacion" } },
    { id: "buy", label: "materias primas por comprar", detail: "Stock por debajo del mínimo", count: criticalMaterials.length, icon: moduleIcons.stock, tone: "danger", destination: { section: "stock" } },
    { id: "pay", label: "compras con pago pendiente", detail: "Seguimiento de pagos", count: pendingPurchases.length, icon: moduleIcons.ventas, tone: "warning", destination: { section: "finanzas" } },
  ];
  const alerts: OperationalAlert[] = [
    ...overdueOrders.map((order) => ({ id: `overdue-${text(order.id)}`, priority: "critical" as const, title: `Pedido ${text(order.number) || `#${text(order.id)}`} atrasado`, detail: `${text(order.client) || "Sin cliente"} · entrega prevista ${text(order.expected_at).slice(0, 10)}`, action: "Abrir pedido", tone: "danger" as Tone, destination: { section: "pedidos" as SectionId, query: text(order.number) } })),
    ...criticalMaterials.map((material) => ({ id: `material-${text(material.id)}`, priority: "critical" as const, title: `${text(material.material)} por debajo del mínimo`, detail: `Quedan ${numeric(material.current_stock)} ${text(material.unit)} · mínimo ${numeric(material.minimum_stock)}`, action: "Ver materia prima", tone: "danger" as Tone, destination: { section: "stock" as SectionId, query: text(material.material) } })),
    ...todayDeliveries.filter((order) => text(order.payment_status).toUpperCase() !== "PAID").map((order) => ({ id: `payment-${text(order.id)}`, priority: "attention" as const, title: `Pago pendiente en ${text(order.number) || `#${text(order.id)}`}`, detail: `${text(order.client) || "Sin cliente"} · entrega prevista para hoy`, action: "Revisar pedido", tone: "warning" as Tone, destination: { section: "pedidos" as SectionId, query: text(order.number) } })),
    ...pendingPurchases.map((purchase) => ({ id: `purchase-${text(purchase.id)}`, priority: "attention" as const, title: `Compra C-${text(purchase.id)} pendiente`, detail: `${text(purchase.supplier) || "Sin proveedor"} · ${text(purchase.material)}`, action: "Abrir compra", tone: "warning" as Tone, destination: { section: "compras" as SectionId, query: `C-${text(purchase.id)}` } })),
    ...readyOrders.filter((order) => !overdueOrders.some((overdue) => overdue.id === order.id)).map((order) => ({ id: `ready-${text(order.id)}`, priority: "information" as const, title: `Pedido ${text(order.number) || `#${text(order.id)}`} listo`, detail: `${text(order.client) || "Sin cliente"} · listo para coordinar entrega`, action: "Coordinar entrega", tone: "success" as Tone, destination: { section: "pedidos" as SectionId, query: text(order.number) } })),
  ];
  return { agenda, alerts };
}

export function searchKhora(rawQuery: string, data: OperationalData): GlobalSearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];
  const candidates: GlobalSearchResult[] = [
    ...data.orders.map((order) => ({ id: `order-${text(order.id)}`, category: "Pedidos" as const, title: `Pedido ${text(order.number) || `#${text(order.id)}`}`, subtitle: `${text(order.client) || "Sin cliente"} · ${text(order.status)}`, icon: moduleIcons.pedidos, destination: { section: "pedidos" as SectionId, query: text(order.number) } })),
    ...data.clients.map((client) => ({ id: `client-${text(client.id)}`, category: "Clientes" as const, title: text(client.name), subtitle: [text(client.phone), text(client.address)].filter(Boolean).join(" · ") || "Sin datos de contacto", icon: moduleIcons.clientes, destination: { section: "clientes" as SectionId, query: text(client.name) } })),
    ...data.products.map((product) => ({ id: `product-${text(product.id)}`, category: "Productos" as const, title: text(product.name), subtitle: `${text(product.code)} · ${text(product.type)} · stock ${numeric(product.current_stock)}`, icon: moduleIcons.productos, destination: { section: "productos" as SectionId, query: text(product.name) } })),
    ...data.materials.map((material) => ({ id: `material-${text(material.id)}`, category: "Materias primas" as const, title: text(material.material), subtitle: `${text(material.code)} · ${text(material.category)} · stock ${numeric(material.current_stock)} ${text(material.unit)}`, icon: moduleIcons.stock, destination: { section: "stock" as SectionId, query: text(material.material) } })),
    ...data.batches.map((batch) => ({ id: `batch-${text(batch.id)}`, category: "Lotes" as const, title: `Lote ${text(batch.batch_number)}`, subtitle: `${text(batch.product)} · ${numeric(batch.quantity)} unidades`, icon: moduleIcons.fabricacion, destination: { section: "fabricacion" as SectionId, query: text(batch.batch_number) } })),
    ...data.suppliers.map((supplier) => ({ id: `supplier-${text(supplier.id)}`, category: "Proveedores" as const, title: text(supplier.name), subtitle: [text(supplier.phone), text(supplier.address)].filter(Boolean).join(" · ") || "Sin datos de contacto", icon: moduleIcons.proveedores, destination: { section: "proveedores" as SectionId, query: text(supplier.name) } })),
  ];
  return candidates.filter((result) => normalize(`${result.title} ${result.subtitle}`).includes(query)).sort((a, b) => searchScore(b, query) - searchScore(a, query)).slice(0, 18);
}

export function getOrderTimeline(order: { status: string; history: Array<{ status: OrderHistoryStatus; at: string }> }) {
  return timelineSteps.map((label) => {
    const event = order.history.find((item) => item.status === label);
    const index = timelineSteps.indexOf(label);
    return { label, at: event?.at ?? null, state: event ? (index === order.history.length - 1 && order.status !== "Entregado" ? "current" : "done") : "pending" } as const;
  });
}

export function groupSearchResults(results: GlobalSearchResult[]) {
  return results.reduce<Partial<Record<SearchCategory, GlobalSearchResult[]>>>((groups, result) => { (groups[result.category] ??= []).push(result); return groups; }, {});
}

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function searchScore(result: GlobalSearchResult, query: string) { const title = normalize(result.title); if (title === query) return 4; if (title.startsWith(query)) return 3; if (title.includes(query)) return 2; return 1; }
function toDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
