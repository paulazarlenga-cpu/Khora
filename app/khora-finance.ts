import { cashTransactions, customers, materials, monthlyBusinessDetails, months, topProducts, type CashTransaction } from "./khora-data";
import { getProductProfitability } from "./khora-sales";

export type CashPeriod = "today" | "week" | "month";
export type CashPanel = ReturnType<typeof getCashPanel>;
export type MonthlyClose = NonNullable<ReturnType<typeof getMonthlyClose>>;

const DEMO_TODAY = new Date("2026-08-14T12:00:00-03:00");

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function periodStart(period: CashPeriod) {
  const today = startOfDay(DEMO_TODAY);
  if (period === "today") return today;
  if (period === "month") return new Date(today.getFullYear(), today.getMonth(), 1);
  const weekday = today.getDay() || 7;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday + 1);
}

function occurred(transaction: CashTransaction) {
  return new Date(transaction.occurredAt);
}

export function getCashPanel(period: CashPeriod) {
  const start = periodStart(period);
  const end = new Date(DEMO_TODAY);
  end.setHours(23, 59, 59, 999);
  const movements = cashTransactions
    .filter((transaction) => transaction.status === "CONFIRMED" && occurred(transaction) >= start && occurred(transaction) <= end)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const incoming = movements.filter((item) => item.direction === "IN").reduce((sum, item) => sum + item.amount, 0);
  const outgoing = movements.filter((item) => item.direction === "OUT").reduce((sum, item) => sum + item.amount, 0);
  const pendingIncome = cashTransactions.filter((item) => item.status === "PENDING" && item.direction === "IN").reduce((sum, item) => sum + item.amount, 0);
  const pendingOutgoing = cashTransactions.filter((item) => item.status === "PENDING" && item.direction === "OUT").reduce((sum, item) => sum + item.amount, 0);
  return {
    period,
    label: period === "today" ? "Hoy" : period === "week" ? "Esta semana" : "Agosto 2026",
    start,
    end,
    incoming,
    outgoing,
    net: incoming - outgoing,
    pendingIncome,
    pendingOutgoing,
    movements,
  };
}

function percentageChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function monthLabel(monthKey: string) {
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(`${monthKey}-01T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getMonthlyClose(monthKey: string) {
  const index = months.findIndex((month) => month.key === monthKey);
  if (index < 0) return null;
  const month = months[index];
  const previous = months[index - 1] ?? null;
  const details = monthlyBusinessDetails.find((item) => item.key === monthKey)!;
  const previousDetails = previous ? monthlyBusinessDetails.find((item) => item.key === previous.key) ?? null : null;
  const grossProfit = month.sales - month.costs;
  const netProfit = grossProfit - month.expenses;
  const previousNetProfit = previous ? previous.sales - previous.costs - previous.expenses : 0;
  const profitable = getProductProfitability("COM-001")!;
  const bestCustomer = customers.find((customer) => customer.name === details.bestCustomer);
  const purchasedMaterial = materials.find((material) => material.name === details.mostPurchasedMaterial);
  const bestSeller = topProducts.find((product) => product.name === details.topProduct);
  return {
    key: month.key,
    name: monthLabel(month.key),
    sales: month.sales,
    costs: month.costs,
    expenses: month.expenses,
    grossProfit,
    netProfit,
    grossMargin: month.sales ? grossProfit / month.sales * 100 : 0,
    netMargin: month.sales ? netProfit / month.sales * 100 : 0,
    orders: details.orders,
    productsSold: details.productsSold,
    highlights: {
      topProduct: { label: details.topProduct, detail: `${bestSeller?.units ?? 0} unidades vendidas` },
      profitableProduct: { label: details.profitableProduct, detail: `${Math.round(profitable.grossMargin)}% de margen actual` },
      bestCustomer: { label: details.bestCustomer, detail: bestCustomer ? `${bestCustomer.orders} pedidos · ${bestCustomer.priceListCode === "WHOLESALE" ? "Mayorista" : "Minorista"}` : "Cliente destacado" },
      largestExpense: { label: details.largestExpense, detail: details.largestExpenseAmount },
      mostPurchasedMaterial: { label: details.mostPurchasedMaterial, detail: purchasedMaterial ? `${purchasedMaterial.supplier} · ${purchasedMaterial.unit}` : "Materia prima" },
    },
    comparison: previous ? {
      month: previous.month,
      sales: percentageChange(month.sales, previous.sales),
      netProfit: percentageChange(netProfit, previousNetProfit),
      expenses: percentageChange(month.expenses, previous.expenses),
      orders: percentageChange(details.orders, previousDetails?.orders ?? 0),
      productsSold: percentageChange(details.productsSold, previousDetails?.productsSold ?? 0),
    } : null,
  };
}

export function getAvailableClosures() {
  return months.slice().reverse().map((month) => ({ key: month.key, label: monthLabel(month.key) }));
}

export function compareMonthlyClosures(currentKey: string, baselineKey: string) {
  const current = getMonthlyClose(currentKey), baseline = getMonthlyClose(baselineKey);
  if (!current || !baseline || current.key === baseline.key) return null;
  return {
    current,
    baseline,
    metrics: [
      { label: "Ventas", current: current.sales, baseline: baseline.sales, change: percentageChange(current.sales, baseline.sales) },
      { label: "Ganancia neta", current: current.netProfit, baseline: baseline.netProfit, change: percentageChange(current.netProfit, baseline.netProfit) },
      { label: "Gastos", current: current.expenses, baseline: baseline.expenses, change: percentageChange(current.expenses, baseline.expenses), inverse: true },
      { label: "Pedidos", current: current.orders, baseline: baseline.orders, change: percentageChange(current.orders, baseline.orders) },
      { label: "Unidades", current: current.productsSold, baseline: baseline.productsSold, change: percentageChange(current.productsSold, baseline.productsSold) },
      { label: "Margen neto", current: current.netMargin, baseline: baseline.netMargin, change: current.netMargin - baseline.netMargin, points: true },
    ],
  };
}
