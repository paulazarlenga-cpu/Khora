export type BaseUnit = "ml" | "litro" | "g" | "kg" | "unidad" | "sin_unidad";
export type UnitFamily = "volume" | "mass" | "count" | "none";

export const baseUnits: Array<{ id: BaseUnit; label: string; family: UnitFamily }> = [
  { id: "ml", label: "Mililitro (ml)", family: "volume" },
  { id: "litro", label: "Litro (L)", family: "volume" },
  { id: "g", label: "Gramo (g)", family: "mass" },
  { id: "kg", label: "Kilogramo (kg)", family: "mass" },
  { id: "unidad", label: "Unidad", family: "count" },
  { id: "sin_unidad", label: "Sin unidad", family: "none" },
];

const unitAliases: Record<string, BaseUnit> = {
  ml: "ml", mililitro: "ml", mililitros: "ml",
  l: "litro", lt: "litro", litro: "litro", litros: "litro",
  g: "g", gr: "g", gramo: "g", gramos: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
  u: "unidad", "u.": "unidad", unidad: "unidad", unidades: "unidad",
  "sin unidad": "sin_unidad", "sin_unidad": "sin_unidad", ninguno: "sin_unidad",
};

const unitScale: Record<BaseUnit, { family: UnitFamily; toCanonical: number }> = {
  ml: { family: "volume", toCanonical: 1 },
  litro: { family: "volume", toCanonical: 1000 },
  g: { family: "mass", toCanonical: 1 },
  kg: { family: "mass", toCanonical: 1000 },
  unidad: { family: "count", toCanonical: 1 },
  sin_unidad: { family: "none", toCanonical: 1 },
};

export function normalizeUnit(value: string): BaseUnit {
  const normalized = unitAliases[value.trim().toLocaleLowerCase("es")];
  if (!normalized) throw new Error("Elegí una unidad compatible: ml, litro, g, kg, unidad o sin unidad");
  return normalized;
}

export function convertUnit(quantity: number, from: string, to: string) {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("La cantidad debe ser un número igual o mayor que cero");
  const source = normalizeUnit(from), target = normalizeUnit(to);
  if (unitScale[source].family !== unitScale[target].family) throw new Error(`No se puede convertir ${source} a ${target}`);
  return quantity * unitScale[source].toCanonical / unitScale[target].toCanonical;
}

export function normalizePrefix(value: string) {
  const prefix = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  if (prefix.length < 2) throw new Error("El prefijo debe tener entre 2 y 4 caracteres");
  return prefix;
}

export function categoryPrefix(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const known: Array<[RegExp, string]> = [[/envase/, "ENV"], [/esencia/, "ESE"], [/alcohol|liquido/, "ALC"], [/varilla/, "VAR"], [/tapa/, "TAP"], [/etiqueta/, "ETI"], [/packaging|caja/, "PAC"], [/accesorio/, "ACC"]];
  const knownPrefix = known.find(([pattern]) => pattern.test(normalized))?.[1];
  if (knownPrefix) return knownPrefix;
  const candidate = normalized.replace(/[^a-z0-9]/g, "").slice(0, 3).toUpperCase();
  return candidate.length >= 2 ? candidate : "MAT";
}

export function suggestMaterialCode(prefix: string, existingCodes: string[]) {
  const safePrefix = normalizePrefix(prefix);
  const sequence = existingCodes.reduce((highest, code) => {
    const match = code.toUpperCase().match(new RegExp(`^${safePrefix}-(\\d+)$`));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  return `${safePrefix}-${String(sequence).padStart(3, "0")}`;
}

export function materialStockStatus(stock: number, minimum: number) {
  if (stock <= 0) return { label: "Agotado", tone: "danger" as const };
  if (minimum > 0 && stock <= minimum * 1.25) return { label: "Poco stock", tone: "warning" as const };
  return { label: "Disponible", tone: "success" as const };
}

export function stockValue(stock: number, unitCost: number) {
  return Math.round(stock * unitCost);
}

export function weightedAverageCost(previousStock: number, previousUnitCost: number, incomingStock: number, incomingTotalCost: number) {
  if (previousStock < 0 || previousUnitCost < 0 || incomingStock <= 0 || incomingTotalCost < 0) throw new Error("Los valores de compra no son válidos");
  const newStock = previousStock + incomingStock;
  if (previousStock === 0) return Math.round(incomingTotalCost / incomingStock);
  return Math.round(((previousStock * previousUnitCost) + incomingTotalCost) / newStock);
}

export function purchaseProjection(previousStock: number, previousUnitCost: number, inputQuantity: number, inputUnit: string, baseUnit: string, totalCost: number) {
  const baseQuantity = convertUnit(inputQuantity, inputUnit, baseUnit);
  return { baseQuantity, newStock: previousStock + baseQuantity, unitCost: weightedAverageCost(previousStock, previousUnitCost, baseQuantity, totalCost) };
}

export function productsUsingMaterial(materialCode: string, recipes: Array<{ productCode: string; components: Array<{ materialCode: string }> }>, products: Array<{ code: string; name: string }>) {
  const productCodes = new Set(recipes.filter((recipe) => recipe.components.some((component) => component.materialCode === materialCode)).map((recipe) => recipe.productCode));
  return products.filter((product) => productCodes.has(product.code));
}
