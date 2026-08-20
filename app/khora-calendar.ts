import { batches, cashTransactions, money, orders, purchases, type Tone } from "./khora-data";
import { moduleIcons, type KhoraIconName } from "./khora-icons";

export type CalendarLayer = "orders" | "deliveries" | "manufacturing" | "purchases" | "payments";

export type BusinessCalendarEvent = {
  id: string;
  layer: CalendarLayer;
  date: string;
  time?: string;
  title: string;
  subtitle: string;
  reference: string;
  status: string;
  tone: Tone;
  orderId?: string;
  amount?: number;
  details: string[];
};

export const calendarLayers: Array<{ id: CalendarLayer; label: string; icon: KhoraIconName }> = [
  { id: "orders", label: "Pedidos", icon: moduleIcons.pedidos },
  { id: "deliveries", label: "Entregas", icon: moduleIcons.entregas },
  { id: "manufacturing", label: "Fabricación", icon: moduleIcons.fabricacion },
  { id: "purchases", label: "Compras", icon: moduleIcons.compras },
  { id: "payments", label: "Cobros", icon: moduleIcons.ventas },
];

function datePart(value: string) {
  return value.slice(0, 10);
}

function timePart(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function orderTone(order: (typeof orders)[number]): Tone {
  if (order.status === "Entregado") return "success";
  if (order.status === "Listo") return "info";
  if (order.payment !== "Pagado") return "warning";
  return order.tone;
}

export function getBusinessCalendarEvents(): BusinessCalendarEvent[] {
  const orderEvents: BusinessCalendarEvent[] = orders.map((order) => ({
    id: `order-${order.id}`,
    layer: "orders",
    date: datePart(order.history[0]?.at ?? order.expectedAt),
    time: order.history[0]?.at ? timePart(order.history[0].at) : undefined,
    title: `Pedido ${order.id}`,
    subtitle: order.customer,
    reference: order.id,
    status: order.status,
    tone: orderTone(order),
    orderId: order.id,
    amount: order.total,
    details: [order.items, `Pago: ${order.payment}`, `Entrega: ${order.due}`],
  }));

  const deliveryEvents: BusinessCalendarEvent[] = orders.map((order) => ({
    id: `delivery-${order.id}`,
    layer: "deliveries",
    date: order.expectedAt,
    title: order.status === "Entregado" ? `Entrega completada ${order.id}` : `Entregar ${order.id}`,
    subtitle: order.customer,
    reference: order.id,
    status: order.status === "Entregado" ? "Entregada" : order.due,
    tone: order.status === "Entregado" ? "success" : order.tone,
    orderId: order.id,
    details: [order.items, order.customer, order.due],
  }));

  const orderManufacturingEvents: BusinessCalendarEvent[] = orders.flatMap((order) => {
    const event = order.history.find((item) => item.status === "En fabricación");
    if (!event) return [];
    return [{
      id: `manufacturing-order-${order.id}`,
      layer: "manufacturing" as const,
      date: datePart(event.at),
      time: timePart(event.at),
      title: `Fabricación para ${order.id}`,
      subtitle: order.items,
      reference: order.id,
      status: order.status === "En fabricación" ? "En curso" : "Completada",
      tone: order.status === "En fabricación" ? "info" as const : "success" as const,
      orderId: order.id,
      details: [`Cliente: ${order.customer}`, order.items, `Iniciada ${timePart(event.at) ?? ""}`.trim()],
    }];
  });

  const batchEvents: BusinessCalendarEvent[] = batches.map((batch) => ({
    id: `batch-${batch.lot}`,
    layer: "manufacturing",
    date: batch.manufacturedAt,
    title: `Lote ${batch.lot}`,
    subtitle: batch.product,
    reference: batch.lot,
    status: batch.status,
    tone: batch.tone,
    details: [`${batch.quantity} unidades`, `Costo: ${money(batch.cost)}`, `${batch.materialsUsed.length} insumos utilizados`],
  }));

  const purchaseEvents: BusinessCalendarEvent[] = purchases.map((purchase) => ({
    id: `purchase-${purchase.id}`,
    layer: "purchases",
    date: purchase.purchasedAt,
    title: `Compra ${purchase.id}`,
    subtitle: purchase.supplier,
    reference: purchase.id,
    status: purchase.status,
    tone: purchase.tone,
    amount: purchase.total,
    details: [purchase.detail, `Pago: ${purchase.payment}`, `Total: ${money(purchase.total)}`],
  }));

  const paymentEvents: BusinessCalendarEvent[] = cashTransactions
    .filter((transaction) => transaction.direction === "IN" && transaction.category === "Cobro")
    .map((transaction) => ({
      id: `payment-${transaction.id}`,
      layer: "payments",
      date: datePart(transaction.occurredAt),
      time: timePart(transaction.occurredAt),
      title: transaction.description,
      subtitle: transaction.counterpart,
      reference: transaction.id,
      status: transaction.status === "CONFIRMED" ? "Cobrado" : "Pendiente",
      tone: transaction.status === "CONFIRMED" ? "success" : "warning",
      amount: transaction.amount,
      orderId: transaction.description.match(/#\d+/)?.[0],
      details: [`Importe: ${money(transaction.amount)}`, transaction.status === "CONFIRMED" ? "Movimiento confirmado" : "Cobro todavía pendiente"],
    }));

  return [...orderEvents, ...deliveryEvents, ...orderManufacturingEvents, ...batchEvents, ...purchaseEvents, ...paymentEvents]
    .sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`));
}

export function countCalendarEvents(events: BusinessCalendarEvent[], enabledLayers: CalendarLayer[]) {
  return calendarLayers.reduce<Record<CalendarLayer, number>>((totals, layer) => {
    totals[layer.id] = events.filter((event) => event.layer === layer.id && enabledLayers.includes(event.layer)).length;
    return totals;
  }, { orders: 0, deliveries: 0, manufacturing: 0, purchases: 0, payments: 0 });
}
