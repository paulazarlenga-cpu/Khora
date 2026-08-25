import { moduleIcons, type KhoraIconName } from "./khora-icons";

export type SectionId =
  | "inicio"
  | "ventas"
  | "pedidos"
  | "clientes"
  | "productos"
  | "fabricacion"
  | "stock"
  | "compras"
  | "proveedores"
  | "finanzas"
  | "calendario";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export type OrderHistoryStatus =
  | "Pedido recibido"
  | "Confirmado"
  | "En preparación"
  | "En fabricación"
  | "Listo"
  | "Entregado";

export type OrderHistoryEvent = { status: OrderHistoryStatus; at: string };
export type OrderLine = { productCode: string; name: string; quantity: number };
export type CustomerPurchase = { id: string; customerId: number; date: string; productCode: string; quantity: number; total: number; status: "Pagado" | "Pendiente" | "Parcial" };
export type CashTransaction = { id: string; occurredAt: string; direction: "IN" | "OUT"; category: "Venta" | "Cobro" | "Compra" | "Gasto"; description: string; counterpart: string; amount: number; status: "CONFIRMED" | "PENDING" };

export const navigation: Array<{ id: SectionId; label: string; icon: KhoraIconName }> = [
  { id: "inicio", label: "Inicio", icon: moduleIcons.inicio },
  { id: "ventas", label: "Ventas", icon: moduleIcons.ventas },
  { id: "clientes", label: "Clientes", icon: moduleIcons.clientes },
  { id: "productos", label: "Productos", icon: moduleIcons.productos },
  { id: "fabricacion", label: "Fabricación", icon: moduleIcons.fabricacion },
  { id: "stock", label: "Stock", icon: moduleIcons.stock },
  { id: "compras", label: "Compras", icon: moduleIcons.compras },
  { id: "proveedores", label: "Proveedores", icon: moduleIcons.proveedores },
  { id: "finanzas", label: "Finanzas", icon: moduleIcons.finanzas },
  { id: "calendario", label: "Calendario", icon: moduleIcons.calendario },
];

export type PrimaryNavigationItem =
  | { type: "link"; id: SectionId; label: string; icon: KhoraIconName }
  | { type: "group"; id: "contactos" | "produccion"; label: string; icon: KhoraIconName; children: Array<{ id: SectionId; label: string; icon: KhoraIconName }> };

export const primaryNavigation: PrimaryNavigationItem[] = [
  { type: "link", id: "inicio", label: "Inicio", icon: moduleIcons.inicio },
  { type: "link", id: "ventas", label: "Ventas", icon: moduleIcons.ventas },
  { type: "link", id: "productos", label: "Productos", icon: moduleIcons.productos },
  { type: "link", id: "compras", label: "Compras", icon: moduleIcons.compras },
  { type: "group", id: "contactos", label: "Contactos", icon: moduleIcons.clientes, children: [{ id: "clientes", label: "Clientes", icon: moduleIcons.clientes }, { id: "proveedores", label: "Proveedores", icon: moduleIcons.proveedores }] },
  { type: "group", id: "produccion", label: "Producción", icon: moduleIcons.fabricacion, children: [{ id: "fabricacion", label: "Fabricación", icon: moduleIcons.fabricacion }, { id: "stock", label: "Stock", icon: moduleIcons.stock }] },
  { type: "link", id: "finanzas", label: "Finanzas", icon: moduleIcons.finanzas },
  { type: "link", id: "calendario", label: "Calendario", icon: moduleIcons.calendario },
];

export const months = [
  { key: "2026-03", month: "Mar", sales: 720000, costs: 315000, expenses: 148000 },
  { key: "2026-04", month: "Abr", sales: 890000, costs: 382000, expenses: 161000 },
  { key: "2026-05", month: "May", sales: 1040000, costs: 438000, expenses: 175000 },
  { key: "2026-06", month: "Jun", sales: 965000, costs: 402000, expenses: 169000 },
  { key: "2026-07", month: "Jul", sales: 1280000, costs: 521000, expenses: 194000 },
  { key: "2026-08", month: "Ago", sales: 1450000, costs: 588000, expenses: 207000 },
];

export const monthlyBusinessDetails = [
  { key: "2026-03", orders: 24, productsSold: 82, topProduct: "Difusor Vainilla 250 ml", profitableProduct: "Combo Relax", bestCustomer: "Casa Calma", largestExpense: "Publicidad", largestExpenseAmount: 38000, mostPurchasedMaterial: "Alcohol de cereal" },
  { key: "2026-04", orders: 29, productsSold: 97, topProduct: "Difusor Lavanda 250 ml", profitableProduct: "Combo Relax", bestCustomer: "Estudio Nativa", largestExpense: "Publicidad", largestExpenseAmount: 41000, mostPurchasedMaterial: "Envase vidrio 250 ml" },
  { key: "2026-05", orders: 33, productsSold: 112, topProduct: "Difusor Lavanda 250 ml", profitableProduct: "Combo Relax", bestCustomer: "Casa Calma", largestExpense: "Publicidad", largestExpenseAmount: 42500, mostPurchasedMaterial: "Varillas negras" },
  { key: "2026-06", orders: 31, productsSold: 106, topProduct: "Difusor Vainilla 250 ml", profitableProduct: "Difusor Lavanda 250 ml", bestCustomer: "Casa Calma", largestExpense: "Servicios", largestExpenseAmount: 39600, mostPurchasedMaterial: "Alcohol de cereal" },
  { key: "2026-07", orders: 38, productsSold: 139, topProduct: "Difusor Lavanda 250 ml", profitableProduct: "Combo Relax", bestCustomer: "Estudio Nativa", largestExpense: "Publicidad", largestExpenseAmount: 44000, mostPurchasedMaterial: "Envase vidrio 250 ml" },
  { key: "2026-08", orders: 42, productsSold: 149, topProduct: "Difusor Lavanda 250 ml", profitableProduct: "Combo Relax", bestCustomer: "Casa Calma", largestExpense: "Publicidad", largestExpenseAmount: 45000, mostPurchasedMaterial: "Envase vidrio 250 ml" },
];

export const orders = [
  { id: "#1058", customer: "Mariana López", date: "13 ago", expectedAt: "2026-08-14", due: "Hoy, 17:00", total: 64800, status: "En preparación", payment: "Pagado", items: "Combo Relax × 4", lines: [{ productCode: "COM-001", name: "Combo Relax", quantity: 4 }] satisfies OrderLine[], tone: "warning" as Tone, history: [{ status: "Pedido recibido", at: "2026-08-13T09:42:00" }, { status: "Confirmado", at: "2026-08-13T10:10:00" }, { status: "En preparación", at: "2026-08-14T08:35:00" }] satisfies OrderHistoryEvent[] },
  { id: "#1057", customer: "Estudio Nativa", date: "12 ago", expectedAt: "2026-08-14", due: "Hoy, 18:30", total: 128500, status: "En fabricación", payment: "Parcial", items: "Difusor Lavanda × 12", lines: [{ productCode: "PRO-001", name: "Difusor Lavanda 250 ml", quantity: 12 }] satisfies OrderLine[], tone: "info" as Tone, history: [{ status: "Pedido recibido", at: "2026-08-12T11:18:00" }, { status: "Confirmado", at: "2026-08-12T11:45:00" }, { status: "En preparación", at: "2026-08-13T09:10:00" }, { status: "En fabricación", at: "2026-08-14T10:20:00" }] satisfies OrderHistoryEvent[] },
  { id: "#1056", customer: "Lucía Fernández", date: "12 ago", expectedAt: "2026-08-15", due: "15 ago", total: 38900, status: "Nuevo", payment: "Pendiente", items: "Home Spray Jazmín × 2", lines: [{ productCode: "PRO-003", name: "Home Spray Jazmín", quantity: 2 }] satisfies OrderLine[], tone: "neutral" as Tone, history: [{ status: "Pedido recibido", at: "2026-08-12T16:05:00" }] satisfies OrderHistoryEvent[] },
  { id: "#1055", customer: "Casa Calma", date: "11 ago", expectedAt: "2026-08-13", due: "Demorado 1 día", total: 91700, status: "Listo", payment: "Pagado", items: "Combo personalizado × 5", lines: [{ productCode: "COM-001", name: "Combo Relax", quantity: 5 }] satisfies OrderLine[], tone: "danger" as Tone, history: [{ status: "Pedido recibido", at: "2026-08-11T08:55:00" }, { status: "Confirmado", at: "2026-08-11T09:20:00" }, { status: "En preparación", at: "2026-08-11T13:30:00" }, { status: "En fabricación", at: "2026-08-12T09:15:00" }, { status: "Listo", at: "2026-08-13T17:40:00" }] satisfies OrderHistoryEvent[] },
  { id: "#1054", customer: "Sofía Márquez", date: "10 ago", expectedAt: "2026-08-10", due: "Entregado", total: 27500, status: "Entregado", payment: "Pagado", items: "Aromatizador Textil × 2", lines: [{ productCode: "PRO-004", name: "Aromatizador Textil", quantity: 2 }] satisfies OrderLine[], tone: "success" as Tone, history: [{ status: "Pedido recibido", at: "2026-08-09T10:12:00" }, { status: "Confirmado", at: "2026-08-09T10:30:00" }, { status: "En preparación", at: "2026-08-09T15:10:00" }, { status: "Listo", at: "2026-08-10T09:05:00" }, { status: "Entregado", at: "2026-08-10T16:25:00" }] satisfies OrderHistoryEvent[] },
];

export const customers = [
  { id: 1, name: "Mariana López", initials: "ML", phone: "+54 9 11 5821-4403", email: "mariana@ejemplo.com", location: "Palermo, CABA", address: "Guatemala 4821, CABA", last: "Hoy", lastPurchaseAt: "2026-08-14", usualFrequencyDays: 18, orders: 14, spent: 438600, debt: 0, activity: "Activo", priceListCode: "RETAIL", tone: "success" as Tone },
  { id: 2, name: "Estudio Nativa", initials: "EN", phone: "+54 9 11 3014-8890", email: "compras@nativa.com.ar", location: "San Isidro, Buenos Aires", address: "Av. del Libertador 16740, San Isidro", last: "Hace 8 días", lastPurchaseAt: "2026-08-06", usualFrequencyDays: 14, orders: 9, spent: 621400, debt: 64250, activity: "Activo", priceListCode: "WHOLESALE", tone: "success" as Tone },
  { id: 3, name: "Lucía Fernández", initials: "LF", phone: "+54 9 11 4432-1187", email: "lucia@ejemplo.com", location: "Caballito, CABA", address: "Valle 744, CABA", last: "Hace 34 días", lastPurchaseAt: "2026-07-11", usualFrequencyDays: 24, orders: 6, spent: 172800, debt: 38900, activity: "Atención", priceListCode: "SPECIAL", tone: "warning" as Tone },
  { id: 4, name: "Casa Calma", initials: "CC", phone: "+54 9 11 6708-2011", email: "hola@casacalma.com.ar", location: "Tigre, Buenos Aires", address: "Italia 1140, Tigre", last: "Hace 72 días", lastPurchaseAt: "2026-06-03", usualFrequencyDays: 30, orders: 21, spent: 984300, debt: 0, activity: "Recuperar", priceListCode: "WHOLESALE", tone: "danger" as Tone },
  { id: 5, name: "Sofía Márquez", initials: "SM", phone: "+54 9 11 2480-3391", email: "sofia@ejemplo.com", location: "Belgrano, CABA", address: "Mendoza 2148, CABA", last: "Hace 15 días", lastPurchaseAt: "2026-07-30", usualFrequencyDays: 35, orders: 4, spent: 109500, debt: 0, activity: "Activo", priceListCode: "RETAIL", tone: "success" as Tone },
];

export const priceLists = [
  { code: "RETAIL", name: "Minorista", modifier: 1, description: "Precio general de venta", clients: 31, tone: "success" as Tone },
  { code: "WHOLESALE", name: "Mayorista", modifier: 0.8, description: "20% sobre la lista minorista", clients: 12, tone: "info" as Tone },
  { code: "SPECIAL", name: "Especial", modifier: 0.9, description: "Condición personalizada del 10%", clients: 6, tone: "warning" as Tone },
];

export const customerPurchases: CustomerPurchase[] = [
  { id: "V-1058", customerId: 1, date: "2026-08-14", productCode: "COM-001", quantity: 4, total: 64800, status: "Pagado" },
  { id: "V-1046", customerId: 1, date: "2026-07-25", productCode: "PRO-001", quantity: 3, total: 37500, status: "Pagado" },
  { id: "V-1031", customerId: 1, date: "2026-07-05", productCode: "PRO-003", quantity: 4, total: 39200, status: "Pagado" },
  { id: "V-1057", customerId: 2, date: "2026-08-06", productCode: "PRO-001", quantity: 12, total: 120000, status: "Parcial" },
  { id: "V-1038", customerId: 2, date: "2026-07-20", productCode: "PRO-002", quantity: 10, total: 100000, status: "Pagado" },
  { id: "V-1019", customerId: 2, date: "2026-06-30", productCode: "COM-001", quantity: 6, total: 119040, status: "Pagado" },
  { id: "V-1056", customerId: 3, date: "2026-07-11", productCode: "PRO-003", quantity: 2, total: 17640, status: "Pendiente" },
  { id: "V-1024", customerId: 3, date: "2026-06-13", productCode: "PRO-004", quantity: 3, total: 24030, status: "Pagado" },
  { id: "V-0996", customerId: 3, date: "2026-05-18", productCode: "PRO-003", quantity: 3, total: 26460, status: "Pagado" },
  { id: "V-0984", customerId: 4, date: "2026-06-03", productCode: "COM-001", quantity: 8, total: 158720, status: "Pagado" },
  { id: "V-0951", customerId: 4, date: "2026-05-01", productCode: "PRO-001", quantity: 15, total: 150000, status: "Pagado" },
  { id: "V-0928", customerId: 4, date: "2026-03-29", productCode: "PRO-002", quantity: 12, total: 120000, status: "Pagado" },
  { id: "V-1054", customerId: 5, date: "2026-07-30", productCode: "PRO-004", quantity: 2, total: 17800, status: "Pagado" },
  { id: "V-1029", customerId: 5, date: "2026-06-25", productCode: "PRO-001", quantity: 2, total: 25000, status: "Pagado" },
];

export const products = [
  { code: "PRO-001", name: "Difusor Lavanda 250 ml", category: "Difusores", price: 12500, cost: 5180, stock: 18, minimum: 8, sold: 47, margin: 58.6, tone: "success" as Tone },
  { code: "PRO-002", name: "Difusor Vainilla 250 ml", category: "Difusores", price: 12500, cost: 5320, stock: 6, minimum: 8, sold: 39, margin: 57.4, tone: "warning" as Tone },
  { code: "PRO-003", name: "Home Spray Jazmín", category: "Aromatizadores", price: 9800, cost: 3960, stock: 3, minimum: 6, sold: 34, margin: 59.6, tone: "danger" as Tone },
  { code: "PRO-004", name: "Aromatizador Textil", category: "Aromatizadores", price: 8900, cost: 3540, stock: 22, minimum: 8, sold: 29, margin: 60.2, tone: "success" as Tone },
  { code: "COM-001", name: "Combo Relax", category: "Combos", price: 24800, cost: 10980, stock: 5, minimum: 4, sold: 26, margin: 55.7, tone: "warning" as Tone },
];

export const materials = [
  { code: "MP-001", name: "Alcohol de cereal", category: "Líquidos", unit: "litro", stock: 12.4, minimum: 10, cost: 6400, supplier: "Química Sur", tone: "warning" as Tone },
  { code: "MP-002", name: "Esencia Lavanda", category: "Esencias", unit: "litro", stock: 1.8, minimum: 2, cost: 26500, supplier: "Aromas del Plata", tone: "danger" as Tone },
  { code: "MP-003", name: "Esencia Vainilla", category: "Esencias", unit: "litro", stock: 3.2, minimum: 2, cost: 24100, supplier: "Aromas del Plata", tone: "success" as Tone },
  { code: "MP-004", name: "Envase vidrio 250 ml", category: "Envases", unit: "unidad", stock: 48, minimum: 30, cost: 1280, supplier: "Envases Norte", tone: "success" as Tone },
  { code: "MP-005", name: "Varillas negras", category: "Accesorios", unit: "unidad", stock: 54, minimum: 80, cost: 95, supplier: "Envases Norte", tone: "danger" as Tone },
  { code: "MP-006", name: "Caja kraft mediana", category: "Packaging", unit: "unidad", stock: 19, minimum: 20, cost: 870, supplier: "Papelera Centro", tone: "warning" as Tone },
  { code: "MP-007", name: "Esencia Jazmín", category: "Esencias", unit: "litro", stock: 0.3, minimum: 1, cost: 27800, supplier: "Aromas del Plata", tone: "danger" as Tone },
  { code: "MP-008", name: "Tarjeta KHORA", category: "Packaging", unit: "unidad", stock: 40, minimum: 20, cost: 150, supplier: "Papelera Centro", tone: "success" as Tone },
];

export const recipeDefinitions = [
  { productCode: "PRO-001", components: [{ materialCode: "MP-001", quantity: 0.2 }, { materialCode: "MP-002", quantity: 0.05 }, { materialCode: "MP-004", quantity: 1 }, { materialCode: "MP-005", quantity: 6 }] },
  { productCode: "PRO-002", components: [{ materialCode: "MP-001", quantity: 0.2 }, { materialCode: "MP-003", quantity: 0.05 }, { materialCode: "MP-004", quantity: 1 }, { materialCode: "MP-005", quantity: 6 }] },
  { productCode: "PRO-003", components: [{ materialCode: "MP-001", quantity: 0.18 }, { materialCode: "MP-007", quantity: 0.05 }, { materialCode: "MP-004", quantity: 1 }] },
  { productCode: "PRO-004", components: [{ materialCode: "MP-001", quantity: 0.15 }, { materialCode: "MP-002", quantity: 0.03 }, { materialCode: "MP-004", quantity: 1 }] },
];

export const comboDefinitions = [
  { productCode: "COM-001", productComponents: [{ productCode: "PRO-001", quantity: 1 }, { productCode: "PRO-003", quantity: 1 }], materialComponents: [{ materialCode: "MP-006", quantity: 1 }, { materialCode: "MP-008", quantity: 1 }] },
];

export const batches = [
  { lot: "L-0087", date: "12 ago 2026", manufacturedAt: "2026-08-12", product: "Difusor Lavanda 250 ml", quantity: 24, cost: 124320, unitCost: 5180, status: "Completado", tone: "success" as Tone, materialsUsed: [{ name: "Alcohol de cereal", quantity: "4,8 L", cost: 30720 }, { name: "Esencia Lavanda", quantity: "1,2 L", cost: 31800 }, { name: "Envase vidrio 250 ml", quantity: "24 u.", cost: 30720 }, { name: "Varillas negras", quantity: "144 u.", cost: 13680 }] },
  { lot: "L-0086", date: "9 ago 2026", manufacturedAt: "2026-08-09", product: "Home Spray Jazmín", quantity: 18, cost: 71280, unitCost: 3960, status: "Completado", tone: "success" as Tone, materialsUsed: [{ name: "Alcohol de cereal", quantity: "3,24 L", cost: 20736 }, { name: "Esencia Jazmín", quantity: "0,9 L", cost: 25020 }, { name: "Envase vidrio 250 ml", quantity: "18 u.", cost: 23040 }] },
  { lot: "L-0085", date: "6 ago 2026", manufacturedAt: "2026-08-06", product: "Combo Relax", quantity: 10, cost: 109800, unitCost: 10980, status: "Completado", tone: "success" as Tone, materialsUsed: [{ name: "Difusor Lavanda 250 ml", quantity: "10 u.", cost: 51800 }, { name: "Home Spray Jazmín", quantity: "10 u.", cost: 39600 }, { name: "Caja kraft mediana", quantity: "10 u.", cost: 8700 }, { name: "Tarjeta KHORA", quantity: "10 u.", cost: 1500 }] },
];

export const purchases = [
  { id: "C-0214", date: "11 ago", purchasedAt: "2026-08-11", supplier: "Aromas del Plata", detail: "Esencias × 3", total: 79500, payment: "Pagado", status: "Recibida", tone: "success" as Tone },
  { id: "C-0213", date: "8 ago", purchasedAt: "2026-08-08", supplier: "Envases Norte", detail: "Envases y varillas", total: 118400, payment: "Pendiente", status: "Parcial", tone: "warning" as Tone },
  { id: "C-0212", date: "4 ago", purchasedAt: "2026-08-04", supplier: "Papelera Centro", detail: "Packaging × 100", total: 87000, payment: "Pagado", status: "Recibida", tone: "success" as Tone },
];

export const suppliers = [
  { name: "Aromas del Plata", initials: "AP", contact: "Carolina Méndez", phone: "+54 9 11 3380-2215", supplies: "Esencias y fragancias", lastPurchase: "11 ago", total: 486200 },
  { name: "Envases Norte", initials: "EN", contact: "Martín Salvatierra", phone: "+54 9 11 6190-8842", supplies: "Envases, tapas y varillas", lastPurchase: "8 ago", total: 721800 },
  { name: "Papelera Centro", initials: "PC", contact: "Victoria Paz", phone: "+54 9 11 4072-5183", supplies: "Cajas, etiquetas y packaging", lastPurchase: "4 ago", total: 293400 },
  { name: "Química Sur", initials: "QS", contact: "Diego Rinaldi", phone: "+54 9 11 5228-1104", supplies: "Alcohol y bases", lastPurchase: "29 jul", total: 358900 },
];

export const expenses = [
  { date: "12 ago", category: "Envíos", description: "Mensajería pedidos zona norte", amount: 18400 },
  { date: "10 ago", category: "Publicidad", description: "Campaña Instagram agosto", amount: 45000 },
  { date: "5 ago", category: "Servicios", description: "Internet y telefonía", amount: 28600 },
  { date: "2 ago", category: "Impuestos", description: "Monotributo", amount: 41800 },
];

export const cashTransactions: CashTransaction[] = [
  { id: "MOV-0814-01", occurredAt: "2026-08-14T09:10:00-03:00", direction: "IN", category: "Cobro", description: "Pago pedido #1058", counterpart: "Mariana López", amount: 64800, status: "CONFIRMED" },
  { id: "MOV-0814-02", occurredAt: "2026-08-14T11:35:00-03:00", direction: "IN", category: "Cobro", description: "Pago parcial pedido #1057", counterpart: "Estudio Nativa", amount: 64250, status: "CONFIRMED" },
  { id: "MOV-0814-03", occurredAt: "2026-08-14T12:20:00-03:00", direction: "OUT", category: "Gasto", description: "Mensajería entregas del día", counterpart: "Envíos Norte", amount: 18400, status: "CONFIRMED" },
  { id: "MOV-0813-01", occurredAt: "2026-08-13T16:40:00-03:00", direction: "IN", category: "Venta", description: "Pedido #1055", counterpart: "Casa Calma", amount: 91700, status: "CONFIRMED" },
  { id: "MOV-0812-01", occurredAt: "2026-08-12T10:25:00-03:00", direction: "IN", category: "Venta", description: "Pedido #1054", counterpart: "Sofía Márquez", amount: 27500, status: "CONFIRMED" },
  { id: "MOV-0812-02", occurredAt: "2026-08-12T14:15:00-03:00", direction: "OUT", category: "Gasto", description: "Campaña Instagram agosto", counterpart: "Meta", amount: 45000, status: "CONFIRMED" },
  { id: "MOV-0811-01", occurredAt: "2026-08-11T09:50:00-03:00", direction: "OUT", category: "Compra", description: "Compra C-0214", counterpart: "Aromas del Plata", amount: 79500, status: "CONFIRMED" },
  { id: "MOV-0805-01", occurredAt: "2026-08-05T17:20:00-03:00", direction: "IN", category: "Venta", description: "Venta mostrador V-1047", counterpart: "Cliente minorista", amount: 56000, status: "CONFIRMED" },
  { id: "MOV-0804-01", occurredAt: "2026-08-04T10:05:00-03:00", direction: "OUT", category: "Compra", description: "Compra C-0212", counterpart: "Papelera Centro", amount: 87000, status: "CONFIRMED" },
  { id: "MOV-0808-01", occurredAt: "2026-08-08T15:30:00-03:00", direction: "OUT", category: "Compra", description: "Compra C-0213", counterpart: "Envases Norte", amount: 118400, status: "PENDING" },
  { id: "MOV-1057-PENDING", occurredAt: "2026-08-18T18:00:00-03:00", direction: "IN", category: "Cobro", description: "Saldo pendiente pedido #1057", counterpart: "Estudio Nativa", amount: 64250, status: "PENDING" },
  { id: "MOV-0815-01", occurredAt: "2026-08-15T18:00:00-03:00", direction: "IN", category: "Cobro", description: "Saldo pedido #1056", counterpart: "Lucía Fernández", amount: 38900, status: "PENDING" },
];

export const alerts = [
  { title: "Esencia Lavanda por debajo del mínimo", detail: "Quedan 1,8 L · mínimo 2 L", action: "Ver materia prima", tone: "danger" as Tone },
  { title: "Pedido #1055 demorado", detail: "Casa Calma · debía estar listo ayer", action: "Abrir pedido", tone: "danger" as Tone },
  { title: "Varillas negras en nivel crítico", detail: "Quedan 54 unidades · mínimo 80", action: "Preparar compra", tone: "warning" as Tone },
];

export const topProducts = [
  { name: "Difusor Lavanda 250 ml", units: 47, revenue: 587500, share: 100 },
  { name: "Difusor Vainilla 250 ml", units: 39, revenue: 487500, share: 83 },
  { name: "Home Spray Jazmín", units: 34, revenue: 333200, share: 72 },
  { name: "Aromatizador Textil", units: 29, revenue: 258100, share: 62 },
  { name: "Combo Relax", units: 26, revenue: 644800, share: 55 },
];

export const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
