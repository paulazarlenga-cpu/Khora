import { comboDefinitions, customerPurchases, customers, materials, orders, priceLists, products, recipeDefinitions, type Tone } from "./khora-data";

const DAY_MS = 86_400_000;
const DEMO_TODAY = new Date("2026-08-14T12:00:00-03:00");

export type CustomerLabel = "Nuevo" | "Frecuente" | "Mayorista" | "Inactivo" | "Activo";
export type CustomerInsight = ReturnType<typeof getCustomerInsight>;
export type ProductProfitability = ReturnType<typeof getProductProfitability>;
export type WhatsAppTemplate = "confirm" | "preparing" | "ready" | "delivery" | "payment" | "recovery";

function daysBetween(from: string, to = DEMO_TODAY) {
  return Math.max(0, Math.floor((to.getTime() - new Date(`${from}T12:00:00-03:00`).getTime()) / DAY_MS));
}

function customerLabel(customer: (typeof customers)[number], daysWithoutBuying: number): CustomerLabel {
  if (daysWithoutBuying > Math.max(45, customer.usualFrequencyDays * 1.5)) return "Inactivo";
  if (customer.priceListCode === "WHOLESALE") return "Mayorista";
  if (customer.orders <= 2) return "Nuevo";
  if (customer.orders >= 6) return "Frecuente";
  return "Activo";
}

function labelTone(label: CustomerLabel): Tone {
  if (label === "Inactivo") return "danger";
  if (label === "Mayorista") return "info";
  if (label === "Frecuente") return "success";
  if (label === "Nuevo") return "warning";
  return "neutral";
}

export function getPriceList(code: string) {
  return priceLists.find((list) => list.code === code) ?? priceLists[0];
}

export function priceForList(productCode: string, listCode: string) {
  const product = products.find((item) => item.code === productCode);
  const list = getPriceList(listCode);
  return product ? Math.round(product.price * list.modifier) : 0;
}

export function getCustomerInsight(customerId: number) {
  const customer = customers.find((item) => item.id === customerId);
  if (!customer) return null;
  const purchases = customerPurchases
    .filter((purchase) => purchase.customerId === customerId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const productTotals = new Map<string, number>();
  for (const purchase of purchases) productTotals.set(purchase.productCode, (productTotals.get(purchase.productCode) ?? 0) + purchase.quantity);
  const favoriteProducts = [...productTotals.entries()]
    .map(([code, quantity]) => ({ product: products.find((item) => item.code === code)!, quantity }))
    .filter((item) => item.product)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);
  const daysWithoutBuying = daysBetween(customer.lastPurchaseAt);
  const label = customerLabel(customer, daysWithoutBuying);
  const pendingOrders = orders.filter((order) => order.customer === customer.name && order.payment !== "Pagado");
  return {
    customer,
    label,
    tone: labelTone(label),
    priceList: getPriceList(customer.priceListCode),
    averageTicket: customer.orders ? Math.round(customer.spent / customer.orders) : 0,
    daysWithoutBuying,
    favoriteProducts,
    recentPurchases: purchases.slice(0, 4),
    recentOrders: orders.filter((order) => order.customer === customer.name).slice(0, 4),
    pendingDebt: customer.debt || pendingOrders.reduce((sum, order) => sum + order.total, 0),
    recoveryThresholdDays: Math.max(45, Math.round(customer.usualFrequencyDays * 1.5)),
    isRecoveryCandidate: label === "Inactivo",
  };
}

export function getCustomerInsights() {
  return customers.map((customer) => getCustomerInsight(customer.id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function getRecoveryCustomers() {
  return getCustomerInsights()
    .filter((item) => item.isRecoveryCandidate)
    .sort((a, b) => b.daysWithoutBuying / b.customer.usualFrequencyDays - a.daysWithoutBuying / a.customer.usualFrequencyDays);
}

export function getProductProfitability(productCode: string) {
  const product = products.find((item) => item.code === productCode);
  if (!product) return null;
  const unitProfit = product.price - product.cost;
  const grossMargin = product.price > 0 ? (unitProfit / product.price) * 100 : 0;
  return {
    product,
    unitProfit,
    grossMargin,
    unitsSold: product.sold,
    accumulatedSales: product.sold * product.price,
    generatedProfit: product.sold * unitProfit,
  };
}

export function recommendedPrice(cost: number, desiredMargin: number) {
  const safeMargin = Math.min(95, Math.max(1, desiredMargin));
  return Math.ceil(cost / (1 - safeMargin / 100));
}

type MaterialUse = { materialCode: string; quantity: number };

function materialUses(productCode: string, multiplier = 1, stack = new Set<string>()): MaterialUse[] {
  if (stack.has(productCode)) return [];
  const nextStack = new Set(stack).add(productCode);
  const recipe = recipeDefinitions.find((item) => item.productCode === productCode);
  if (recipe) return recipe.components.map((item) => ({ materialCode: item.materialCode, quantity: item.quantity * multiplier }));
  const combo = comboDefinitions.find((item) => item.productCode === productCode);
  if (!combo) return [];
  return [
    ...combo.materialComponents.map((item) => ({ materialCode: item.materialCode, quantity: item.quantity * multiplier })),
    ...combo.productComponents.flatMap((item) => materialUses(item.productCode, item.quantity * multiplier, nextStack)),
  ];
}

export function getProductMaterialImpacts(productCode: string) {
  const aggregate = new Map<string, number>();
  for (const use of materialUses(productCode)) aggregate.set(use.materialCode, (aggregate.get(use.materialCode) ?? 0) + use.quantity);
  return [...aggregate.entries()].map(([materialCode, quantity]) => {
    const material = materials.find((item) => item.code === materialCode)!;
    return { material, quantity, contribution: material ? material.cost * quantity : 0 };
  }).filter((item) => item.material);
}

export function simulateMaterialIncrease(productCode: string, materialCode: string, percentage: number) {
  const profitability = getProductProfitability(productCode);
  const impact = getProductMaterialImpacts(productCode).find((item) => item.material.code === materialCode);
  if (!profitability || !impact) return null;
  const safePercentage = Math.max(0, percentage);
  const extraCost = impact.contribution * (safePercentage / 100);
  const newCost = Math.round(profitability.product.cost + extraCost);
  const newProfit = profitability.product.price - newCost;
  const newMargin = profitability.product.price > 0 ? (newProfit / profitability.product.price) * 100 : 0;
  return { newCost, newProfit, newMargin, extraCost: Math.round(extraCost) };
}

export function buildWhatsAppMessage(template: WhatsAppTemplate, customerName: string, order?: (typeof orders)[number]) {
  const firstName = customerName.split(" ")[0];
  const orderNumber = order?.id ?? "";
  const messages: Record<WhatsAppTemplate, string> = {
    confirm: `Hola ${firstName} 👋\nConfirmamos tu pedido ${orderNumber} por ${order ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(order.total) : "el importe acordado"}.\n\nTe avisamos cuando avance la preparación.\n\nGracias,\nKHORA`,
    preparing: `Hola ${firstName} 👋\nTu pedido ${orderNumber} ya está en preparación.\n\nTe mantenemos al tanto apenas esté listo.\n\nGracias,\nKHORA`,
    ready: `Hola ${firstName} 👋\nTu pedido ${orderNumber} ya está listo.\n\nPodemos coordinar la entrega cuando quieras.\n\nGracias,\nKHORA`,
    delivery: `Hola ${firstName} 👋\nQueríamos coordinar la entrega de tu pedido ${orderNumber}${order ? `, prevista para el ${order.due}` : ""}.\n\n¿Qué horario te resulta más cómodo?\n\nKHORA`,
    payment: `Hola ${firstName} 👋\nTe recordamos que queda un pago pendiente del pedido ${orderNumber}${order ? ` por ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(order.total)}` : ""}.\n\nSi ya lo realizaste, podés ignorar este mensaje.\n\nGracias,\nKHORA`,
    recovery: `Hola ${firstName} 👋\nHace un tiempo que no sabemos de vos y queríamos saludarte.\n\nCuando necesites renovar tus aromas o preparar un regalo, estamos para ayudarte.\n\nKHORA`,
  };
  return messages[template];
}

export function buildWhatsAppLink(phone: string, message: string) {
  const normalized = phone.replace(/\D/g, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
