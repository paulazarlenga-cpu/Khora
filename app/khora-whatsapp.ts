export type WhatsAppOrderItem = {
  name: string;
  quantity: number;
  priceCents: number;
  lineTotalCents: number;
};

export type WhatsAppOrderSnapshot = {
  number: string;
  totalCents: number;
  customer: { name: string };
  items: WhatsAppOrderItem[];
};

/** Normalize a phone for wa.me without changing the country code supplied by the user. */
export function normalizeWhatsAppNumber(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

export function buildWhatsAppLink(phone: unknown, message: string) {
  const normalized = normalizeWhatsAppNumber(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : "";
}

export function buildStoreOrderWhatsAppMessage(order: WhatsAppOrderSnapshot) {
  const lines = order.items
    .map((item) => `${item.quantity} × ${item.name} — ${formatARS(item.lineTotalCents)}`)
    .join("\n");
  return `Hola, soy ${order.customer.name}.\n\nQuiero continuar con mi pedido *${order.number}*.\n\n*Productos:*\n${lines}\n\n*Total: ${formatARS(order.totalCents)}*\n\nQuisiera coordinar el pago y la entrega.`;
}

function formatARS(cents: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(cents || 0) / 100);
}
