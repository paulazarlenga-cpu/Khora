export type FinanceInputs = {
  salesGeneratedCents: number;
  collectedCents: number;
  purchasesCents: number;
  purchasesPaidCents: number;
  expensesCents: number;
  expensesPaidCents: number;
  cashIncomeCents: number;
  cashOutgoingCents: number;
  soldCostCents: number;
  reinvestmentReservedCents?: number;
  reinvestedCents?: number;
};

export function calculateFinanceTotals(input: FinanceInputs) {
  const grossProfitCents = input.salesGeneratedCents - input.soldCostCents;
  const netProfitCents = grossProfitCents - input.expensesCents;
  const reinvestmentReservedCents = Math.min(
    Math.max(0, input.reinvestmentReservedCents ?? 0),
    Math.max(0, netProfitCents),
  );
  const reinvestedCents = Math.max(0, input.reinvestedCents ?? 0);
  return {
    ...input,
    receivableCents: Math.max(0, input.salesGeneratedCents - input.collectedCents),
    purchasesPendingCents: Math.max(0, input.purchasesCents - input.purchasesPaidCents),
    expensesPendingCents: Math.max(0, input.expensesCents - input.expensesPaidCents),
    totalOutgoingsRegisteredCents: input.purchasesCents + input.expensesCents,
    cashResultCents: input.cashIncomeCents - input.cashOutgoingCents,
    grossProfitCents,
    netProfitCents,
    reinvestmentReservedCents,
    reinvestedCents,
    reinvestmentAvailableCents: Math.max(0, reinvestmentReservedCents - reinvestedCents),
    availableProfitCents: netProfitCents - reinvestmentReservedCents,
  };
}
