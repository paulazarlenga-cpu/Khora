export type FinishedLot = { id: number; source: "MANUFACTURED" | "COMBO"; batchNumber: string; occurredAt: string; availableQuantity: number; unitCostCents: number };
export type FifoAllocation = FinishedLot & { quantity: number; totalCostCents: number };

export function allocateFinishedStockFIFO(requestedQuantity: number, lots: FinishedLot[]) {
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) throw new Error("La cantidad solicitada debe ser mayor que cero");
  const ordered = [...lots].filter((lot) => lot.availableQuantity > 0).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id - b.id);
  const available = ordered.reduce((sum, lot) => sum + lot.availableQuantity, 0);
  if (available < requestedQuantity) throw new Error(`Stock por lote insuficiente: faltan ${(requestedQuantity - available).toFixed(2)} unidades`);
  let remaining = requestedQuantity;
  const allocations: FifoAllocation[] = [];
  for (const lot of ordered) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, lot.availableQuantity);
    allocations.push({ ...lot, quantity, totalCostCents: Math.round(quantity * lot.unitCostCents) });
    remaining -= quantity;
  }
  return { allocations, totalCostCents: allocations.reduce((sum, allocation) => sum + allocation.totalCostCents, 0), availableBefore: available, availableAfter: available - requestedQuantity };
}
