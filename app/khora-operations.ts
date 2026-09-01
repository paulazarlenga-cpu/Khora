import { SectionId, Tone } from "./khora-data";
import { moduleIcons, type KhoraIconName } from "./khora-icons";

export type NavigationIntent = { section: SectionId; query?: string };
export type OperationalPriority = "critical" | "attention" | "information";
export type AgendaItem = { id: string; label: string; detail: string; count: number; icon: KhoraIconName; tone: Tone; destination: NavigationIntent };
export type OperationalAlert = { id: string; priority: OperationalPriority; title: string; detail: string; action: string; tone: Tone; destination: NavigationIntent };
export type SearchCategory = "Clientes" | "Productos" | "Materias primas" | "Lotes" | "Proveedores" | "Mezclas";
export type GlobalSearchResult = { id: string; category: SearchCategory; title: string; subtitle: string; icon: KhoraIconName; destination: NavigationIntent };

type RealRow = Record<string, unknown>;
export type OperationalData = { clients: RealRow[]; products: RealRow[]; materials: RealRow[]; batches: RealRow[]; suppliers: RealRow[]; purchases: RealRow[]; mixtures: RealRow[] };
export const emptyOperationalData: OperationalData = { clients: [], products: [], materials: [], batches: [], suppliers: [], purchases: [], mixtures: [] };

const text = (value: unknown) => String(value ?? "");
const numeric = (value: unknown) => Number(value ?? 0);

export function getOperationalOverview(data: OperationalData) {
  const criticalMaterials = data.materials.filter((material) => Boolean(material.active) && numeric(material.minimum_stock) > 0 && numeric(material.current_stock) < numeric(material.minimum_stock));
  const pendingPurchases = data.purchases.filter((purchase) => text(purchase.payment_status).toUpperCase() !== "PAID" && text(purchase.status) !== "Anulada");
  const agenda: AgendaItem[] = [
    { id: "manufacture", label: "planificador de fabricación", detail: "Revisar necesidades de producción", count: 0, icon: moduleIcons.fabricacion, tone: "info", destination: { section: "fabricacion" } },
    { id: "buy", label: "materias primas por comprar", detail: "Stock por debajo del mínimo", count: criticalMaterials.length, icon: moduleIcons.stock, tone: "danger", destination: { section: "stock" } },
    { id: "pay", label: "compras con pago pendiente", detail: "Seguimiento de pagos", count: pendingPurchases.length, icon: moduleIcons.ventas, tone: "warning", destination: { section: "finanzas" } },
  ];
  const alerts: OperationalAlert[] = [
    ...criticalMaterials.map((material) => ({ id: `material-${text(material.id)}`, priority: "critical" as const, title: `${text(material.material)} por debajo del mínimo`, detail: `Quedan ${numeric(material.current_stock)} ${text(material.unit)} · mínimo ${numeric(material.minimum_stock)}`, action: "Ver materia prima", tone: "danger" as Tone, destination: { section: "stock" as SectionId, query: text(material.material) } })),
    ...pendingPurchases.map((purchase) => ({ id: `purchase-${text(purchase.id)}`, priority: "attention" as const, title: `Compra C-${text(purchase.id)} pendiente`, detail: `${text(purchase.supplier) || "Sin proveedor"} · ${text(purchase.material)}`, action: "Abrir compra", tone: "warning" as Tone, destination: { section: "compras" as SectionId, query: `C-${text(purchase.id)}` } })),
  ];
  return { agenda, alerts };
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
