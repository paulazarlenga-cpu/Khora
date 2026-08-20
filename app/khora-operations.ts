import {
  batches,
  customers,
  materials,
  orders,
  products,
  purchases,
  SectionId,
  suppliers,
  Tone,
  type OrderHistoryStatus,
} from "./khora-data";
import { moduleIcons, type KhoraIconName } from "./khora-icons";

export type NavigationIntent = { section: SectionId; query?: string };
export type OperationalPriority = "critical" | "attention" | "information";

export type AgendaItem = {
  id: string;
  label: string;
  detail: string;
  count: number;
  icon: KhoraIconName;
  tone: Tone;
  destination: NavigationIntent;
};

export type OperationalAlert = {
  id: string;
  priority: OperationalPriority;
  title: string;
  detail: string;
  action: string;
  tone: Tone;
  destination: NavigationIntent;
};

export type SearchCategory = "Pedidos" | "Clientes" | "Productos" | "Materias primas" | "Lotes" | "Proveedores";

export type GlobalSearchResult = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  icon: KhoraIconName;
  destination: NavigationIntent;
};

const timelineSteps: OrderHistoryStatus[] = [
  "Pedido recibido",
  "Confirmado",
  "En preparación",
  "En fabricación",
  "Listo",
  "Entregado",
];

export function getOperationalOverview(today = new Date("2026-08-14T12:00:00")) {
  const todayKey = toDateKey(today);
  const pendingOrders = orders.filter((order) => order.status !== "Entregado");
  const todayDeliveries = pendingOrders.filter((order) => order.expectedAt === todayKey);
  const productionOrders = pendingOrders.filter((order) => order.status === "En fabricación");
  const criticalMaterials = materials.filter((material) => material.stock < material.minimum);
  const customersWithDebt = customers.filter((customer) => customer.debt > 0);
  const overdueOrders = pendingOrders.filter((order) => order.expectedAt < todayKey);
  const pendingPurchases = purchases.filter((purchase) => purchase.payment !== "Pagado");
  const readyOrders = orders.filter((order) => order.status === "Listo");

  const agenda: AgendaItem[] = [
    { id: "prepare", label: "pedidos para preparar", detail: "Revisar tablero de trabajo", count: pendingOrders.filter((order) => ["Nuevo", "En preparación"].includes(order.status)).length, icon: moduleIcons.pedidos, tone: "warning", destination: { section: "pedidos" } },
    { id: "deliver", label: "entregas programadas", detail: "Coordinar horarios de hoy", count: todayDeliveries.length, icon: moduleIcons.entregas, tone: "info", destination: { section: "pedidos", query: "Hoy" } },
    { id: "manufacture", label: "fabricación pendiente", detail: "Pedido en producción", count: productionOrders.length, icon: moduleIcons.fabricacion, tone: "warning", destination: { section: "fabricacion" } },
    { id: "buy", label: "materias primas por comprar", detail: "Stock por debajo del mínimo", count: criticalMaterials.length, icon: moduleIcons.stock, tone: "danger", destination: { section: "stock" } },
    { id: "collect", label: "clientes con pago pendiente", detail: "Seguimiento de cobranza", count: customersWithDebt.length, icon: moduleIcons.ventas, tone: "warning", destination: { section: "finanzas" } },
  ];

  const alerts: OperationalAlert[] = [
    ...overdueOrders.map((order) => ({ id: `overdue-${order.id}`, priority: "critical" as const, title: `Pedido ${order.id} atrasado`, detail: `${order.customer} · entrega prevista ${order.due}`, action: "Abrir pedido", tone: "danger" as Tone, destination: { section: "pedidos" as SectionId, query: order.id } })),
    ...criticalMaterials.map((material) => ({ id: `material-${material.code}`, priority: "critical" as const, title: `${material.name} por debajo del mínimo`, detail: `Quedan ${material.stock} ${material.unit} · mínimo ${material.minimum}`, action: "Ver materia prima", tone: "danger" as Tone, destination: { section: "stock" as SectionId, query: material.name } })),
    ...todayDeliveries.filter((order) => order.payment !== "Pagado").map((order) => ({ id: `payment-${order.id}`, priority: "attention" as const, title: `Pago pendiente en ${order.id}`, detail: `${order.customer} · entrega prevista para hoy`, action: "Revisar pedido", tone: "warning" as Tone, destination: { section: "pedidos" as SectionId, query: order.id } })),
    ...pendingPurchases.map((purchase) => ({ id: `purchase-${purchase.id}`, priority: "attention" as const, title: `Compra ${purchase.id} pendiente`, detail: `${purchase.supplier} · ${purchase.detail}`, action: "Abrir compra", tone: "warning" as Tone, destination: { section: "compras" as SectionId, query: purchase.id } })),
    ...readyOrders.filter((order) => !overdueOrders.some((overdue) => overdue.id === order.id)).map((order) => ({ id: `ready-${order.id}`, priority: "information" as const, title: `Pedido ${order.id} listo`, detail: `${order.customer} · listo para coordinar entrega`, action: "Coordinar entrega", tone: "success" as Tone, destination: { section: "pedidos" as SectionId, query: order.id } })),
  ];

  return { agenda, alerts };
}

export function searchKhora(rawQuery: string): GlobalSearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];

  const candidates: GlobalSearchResult[] = [
    ...orders.map((order) => ({ id: `order-${order.id}`, category: "Pedidos" as const, title: `Pedido ${order.id}`, subtitle: `${order.customer} · ${order.items} · ${order.status}`, icon: moduleIcons.pedidos, destination: { section: "pedidos" as SectionId, query: order.id } })),
    ...customers.map((customer) => ({ id: `customer-${customer.id}`, category: "Clientes" as const, title: customer.name, subtitle: `${customer.phone} · ${customer.location}`, icon: moduleIcons.clientes, destination: { section: "clientes" as SectionId, query: customer.name } })),
    ...products.map((product) => ({ id: `product-${product.code}`, category: "Productos" as const, title: product.name, subtitle: `${product.code} · ${product.category} · stock ${product.stock}`, icon: moduleIcons.productos, destination: { section: "productos" as SectionId, query: product.name } })),
    ...materials.map((material) => ({ id: `material-${material.code}`, category: "Materias primas" as const, title: material.name, subtitle: `${material.code} · ${material.category} · stock ${material.stock} ${material.unit}`, icon: moduleIcons.stock, destination: { section: "stock" as SectionId, query: material.name } })),
    ...batches.map((batch) => ({ id: `batch-${batch.lot}`, category: "Lotes" as const, title: `Lote ${batch.lot}`, subtitle: `${batch.product} · ${batch.quantity} unidades`, icon: moduleIcons.fabricacion, destination: { section: "fabricacion" as SectionId, query: batch.lot } })),
    ...suppliers.map((supplier) => ({ id: `supplier-${supplier.name}`, category: "Proveedores" as const, title: supplier.name, subtitle: `${supplier.contact} · ${supplier.supplies}`, icon: moduleIcons.proveedores, destination: { section: "proveedores" as SectionId, query: supplier.name } })),
  ];

  return candidates
    .filter((result) => normalize(`${result.title} ${result.subtitle}`).includes(query))
    .sort((a, b) => searchScore(b, query) - searchScore(a, query))
    .slice(0, 18);
}

export function getOrderTimeline(order: (typeof orders)[number]) {
  return timelineSteps.map((label) => {
    const event = order.history.find((item) => item.status === label);
    const completedCount = order.history.length;
    const index = timelineSteps.indexOf(label);
    return {
      label,
      at: event?.at ?? null,
      state: event ? (index === completedCount - 1 && order.status !== "Entregado" ? "current" : "done") : "pending",
    } as const;
  });
}

export function groupSearchResults(results: GlobalSearchResult[]) {
  return results.reduce<Partial<Record<SearchCategory, GlobalSearchResult[]>>>((groups, result) => {
    (groups[result.category] ??= []).push(result);
    return groups;
  }, {});
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function searchScore(result: GlobalSearchResult, query: string) {
  const title = normalize(result.title);
  if (title === query) return 4;
  if (title.startsWith(query)) return 3;
  if (title.includes(query)) return 2;
  return 1;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
