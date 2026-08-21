import assert from "node:assert/strict";
import test from "node:test";
import { calculateFinanceTotals } from "../app/khora-finance-core.ts";

test("el ejemplo financiero completo separa caja, rentabilidad y reinversión", () => {
  const result = calculateFinanceTotals({
    salesGeneratedCents: 120_000_000,
    collectedCents: 105_000_000,
    purchasesCents: 35_000_000,
    purchasesPaidCents: 28_000_000,
    expensesCents: 20_000_000,
    expensesPaidCents: 18_000_000,
    cashIncomeCents: 105_000_000,
    cashOutgoingCents: 46_000_000,
    soldCostCents: 30_000_000,
    reinvestmentReservedCents: 21_000_000,
    reinvestedCents: 14_000_000,
  });
  assert.equal(result.receivableCents, 15_000_000);
  assert.equal(result.purchasesPendingCents, 7_000_000);
  assert.equal(result.expensesPendingCents, 2_000_000);
  assert.equal(result.grossProfitCents, 90_000_000);
  assert.equal(result.netProfitCents, 70_000_000);
  assert.equal(result.cashResultCents, 59_000_000);
  assert.equal(result.availableProfitCents, 49_000_000);
  assert.equal(result.reinvestmentAvailableCents, 7_000_000);
});

test("una pérdida no permite reservar reinversión de ganancias", () => {
  const result = calculateFinanceTotals({
    salesGeneratedCents: 10_000,
    collectedCents: 5_000,
    purchasesCents: 0,
    purchasesPaidCents: 0,
    expensesCents: 12_000,
    expensesPaidCents: 12_000,
    cashIncomeCents: 5_000,
    cashOutgoingCents: 12_000,
    soldCostCents: 2_000,
    reinvestmentReservedCents: 3_000,
  });
  assert.equal(result.netProfitCents, -4_000);
  assert.equal(result.reinvestmentReservedCents, 0);
  assert.equal(result.availableProfitCents, -4_000);
});
