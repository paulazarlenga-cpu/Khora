import { comboDefinitions, materials, orders, products, recipeDefinitions } from "./khora-data";

type OrderRecord = (typeof orders)[number];

export type RequirementCheck = {
  code: string;
  name: string;
  required: number;
  available: number;
  shortage: number;
  unit: string;
  kind: "Producto" | "Componente" | "Materia prima";
};

export type ProductionPlanItem = {
  code: string;
  name: string;
  kind: "Fabricar" | "Preparar combo";
  required: number;
  stock: number;
  suggested: number;
  minimum: number;
  orderIds: string[];
};

export type PurchaseNeed = {
  code: string;
  name: string;
  unit: string;
  stock: number;
  minimum: number;
  requiredForPlan: number;
  shortage: number;
  supplier: string;
  lastPrice: number;
};

export function getProductionPlan(): ProductionPlanItem[] {
  const demand = new Map<string, number>();
  const sources = new Map<string, Set<string>>();
  const activeOrders = orders.filter((order) => !["Entregado", "Cancelado"].includes(order.status));

  for (const order of activeOrders) {
    for (const line of order.lines) addDemand(demand, sources, line.productCode, line.quantity, order.id);
  }

  for (const combo of comboDefinitions) {
    const comboProduct = findProduct(combo.productCode);
    const comboDemand = demand.get(combo.productCode) ?? 0;
    const toAssemble = Math.max(comboDemand - (comboProduct?.stock ?? 0), 0);
    if (!toAssemble) continue;
    for (const component of combo.productComponents) {
      const comboSources = sources.get(combo.productCode) ?? new Set<string>();
      addNumber(demand, component.productCode, component.quantity * toAssemble);
      const componentSources = sources.get(component.productCode) ?? new Set<string>();
      for (const orderId of comboSources) componentSources.add(orderId);
      sources.set(component.productCode, componentSources);
    }
  }

  return [...demand.entries()].map(([code, required]) => {
    const product = findProduct(code)!;
    return {
      code,
      name: product.name,
      kind: product.category === "Combos" ? "Preparar combo" as const : "Fabricar" as const,
      required,
      stock: product.stock,
      suggested: Math.max(required - product.stock, 0),
      minimum: product.minimum,
      orderIds: [...(sources.get(code) ?? [])],
    };
  }).sort((a, b) => b.suggested - a.suggested || b.required - a.required);
}

export function getPurchaseNeeds(plan = getProductionPlan()): PurchaseNeed[] {
  const requirements = new Map<string, number>();
  for (const item of plan.filter((entry) => entry.suggested > 0)) {
    const recipe = recipeDefinitions.find((entry) => entry.productCode === item.code);
    for (const component of recipe?.components ?? []) addNumber(requirements, component.materialCode, component.quantity * item.suggested);
    const combo = comboDefinitions.find((entry) => entry.productCode === item.code);
    for (const component of combo?.materialComponents ?? []) addNumber(requirements, component.materialCode, component.quantity * item.suggested);
  }

  return materials.map((material) => {
    const requiredForPlan = round(requirements.get(material.code) ?? 0);
    return {
      code: material.code,
      name: material.name,
      unit: material.unit,
      stock: material.stock,
      minimum: material.minimum,
      requiredForPlan,
      shortage: round(Math.max(material.minimum + requiredForPlan - material.stock, 0)),
      supplier: material.supplier,
      lastPrice: material.cost,
    };
  }).filter((item) => item.shortage > 0).sort((a, b) => b.shortage - a.shortage);
}

export function analyzeOrder(order: OrderRecord) {
  const earlierOrders = orders
    .filter((candidate) => candidate.id !== order.id && !["Entregado", "Cancelado"].includes(candidate.status))
    .filter((candidate) => candidate.expectedAt < order.expectedAt || (candidate.expectedAt === order.expectedAt && candidate.id < order.id));
  const reserved = new Map<string, number>();
  for (const candidate of earlierOrders) for (const line of candidate.lines) addNumber(reserved, line.productCode, line.quantity);

  const productChecks: RequirementCheck[] = [];
  const componentChecks: RequirementCheck[] = [];
  const materialRequirements = new Map<string, number>();
  let unresolvable = false;

  for (const line of order.lines) {
    const product = findProduct(line.productCode);
    if (!product) { unresolvable = true; continue; }
    const available = Math.max(product.stock - (reserved.get(line.productCode) ?? 0), 0);
    const shortage = Math.max(line.quantity - available, 0);
    productChecks.push(check(product.code, product.name, line.quantity, available, "u.", "Producto"));
    if (!shortage) continue;

    const combo = comboDefinitions.find((entry) => entry.productCode === product.code);
    if (combo) {
      for (const part of combo.productComponents) {
        const component = findProduct(part.productCode);
        if (!component) { unresolvable = true; continue; }
        const required = part.quantity * shortage;
        componentChecks.push(check(component.code, component.name, required, component.stock, "u.", "Componente"));
        const componentShortage = Math.max(required - component.stock, 0);
        if (componentShortage > 0) addRecipeMaterials(part.productCode, componentShortage, materialRequirements);
      }
      for (const part of combo.materialComponents) addNumber(materialRequirements, part.materialCode, part.quantity * shortage);
    } else if (!addRecipeMaterials(product.code, shortage, materialRequirements)) {
      unresolvable = true;
    }
  }

  const materialChecks = [...materialRequirements.entries()].map(([code, required]) => {
    const material = materials.find((entry) => entry.code === code)!;
    return check(material.code, material.name, round(required), material.stock, material.unit, "Materia prima");
  });
  const readyFromStock = productChecks.every((item) => item.shortage === 0);
  const canPrepare = !unresolvable && materialChecks.every((item) => item.shortage === 0);

  return {
    productChecks,
    componentChecks,
    materialChecks,
    readyFromStock,
    canPrepare,
    summary: readyFromStock ? "Todo disponible" : canPrepare ? "Disponible con preparación" : "Faltantes",
  } as const;
}

export function getComboBreakdown(productCode = "COM-001", quantity = 1) {
  const combo = comboDefinitions.find((entry) => entry.productCode === productCode);
  const product = findProduct(productCode);
  if (!combo || !product) return null;
  return {
    product,
    quantity,
    products: combo.productComponents.map((part) => {
      const component = findProduct(part.productCode)!;
      return check(component.code, component.name, part.quantity * quantity, component.stock, "u.", "Componente");
    }),
    materials: combo.materialComponents.map((part) => {
      const material = materials.find((entry) => entry.code === part.materialCode)!;
      return check(material.code, material.name, part.quantity * quantity, material.stock, material.unit, "Materia prima");
    }),
  };
}

function addRecipeMaterials(productCode: string, quantity: number, target: Map<string, number>) {
  const recipe = recipeDefinitions.find((entry) => entry.productCode === productCode);
  if (!recipe) return false;
  for (const part of recipe.components) addNumber(target, part.materialCode, part.quantity * quantity);
  return true;
}

function addDemand(target: Map<string, number>, sources: Map<string, Set<string>>, code: string, quantity: number, orderId: string) {
  addNumber(target, code, quantity);
  const bucket = sources.get(code) ?? new Set<string>();
  bucket.add(orderId);
  sources.set(code, bucket);
}

function addNumber(target: Map<string, number>, code: string, quantity: number) {
  target.set(code, (target.get(code) ?? 0) + quantity);
}

function findProduct(code: string) {
  return products.find((product) => product.code === code);
}

function check(code: string, name: string, required: number, available: number, unit: string, kind: RequirementCheck["kind"]): RequirementCheck {
  return { code, name, required: round(required), available: round(available), shortage: round(Math.max(required - available, 0)), unit, kind };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
