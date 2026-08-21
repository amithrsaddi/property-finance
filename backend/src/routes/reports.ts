import { Router } from "express";
import { requireAuth } from "../auth.js";
import { parseDateRange } from "../dates.js";
import { ensureMortgageSchedule, refreshMortgagePaymentStatuses, refreshRentStatuses } from "../domain.js";
import { Expense, Mortgage, MortgagePayment, Property, RentPayment } from "../models.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

type PropertyScope = "all" | "rental" | "residential";

function parseScope(value: unknown): PropertyScope {
  const scope = String(value || "all").toLowerCase();
  return scope === "rental" || scope === "residential" ? scope : "all";
}

function matchesScope(propertyType: unknown, scope: PropertyScope): boolean {
  if (scope === "all") {
    return true;
  }
  const type = String(propertyType || "residential");
  if (scope === "rental") {
    return type === "buy_to_let" || type === "hmo";
  }
  return type === "residential";
}

router.get("/", async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const scope = parseScope(req.query.scope);
  const range = parseDateRange({
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    month: req.query.month as string | undefined,
    year: req.query.year as string | undefined
  });

  await refreshRentStatuses(userId);
  const mortgages = await Mortgage.find({ userId }).lean();
  for (const m of mortgages) {
    await ensureMortgageSchedule(String(m._id), userId);
  }
  await refreshMortgagePaymentStatuses(userId);

  const properties = (await Property.find({ userId }).sort({ name: 1 }).lean()).filter((p) =>
    matchesScope(p.propertyType, scope)
  );
  const rents = await RentPayment.find({
    userId,
    expectedPaymentDate: { $gte: range.from, $lte: range.to }
  }).lean();
  const mortgagePayments = await MortgagePayment.find({
    userId,
    dueDate: { $gte: range.from, $lte: range.to }
  }).lean();
  const expenses = await Expense.find({
    userId,
    expenseDate: { $gte: range.from, $lte: range.to }
  }).lean();

  const byProperty = properties.map((p) => {
    const pid = String(p._id);
    const propertyRents = rents.filter((r) => String(r.propertyId) === pid);
    const propertyMortgageIds = new Set(
      mortgages.filter((m) => String(m.propertyId) === pid).map((m) => String(m._id))
    );
    const propertyMortgagePayments = mortgagePayments.filter((mp) =>
      propertyMortgageIds.has(String(mp.mortgageId))
    );
    const propertyExpenses = expenses.filter(
      (e) => e.scope === "property" && String(e.propertyId) === pid
    );

    const rentReceived = propertyRents.reduce((s, r) => s + (r.amountReceived || 0), 0);
    const rentExpected = propertyRents.reduce((s, r) => s + (r.expectedAmount || 0), 0);
    const mortgageSpend = propertyMortgagePayments.reduce(
      (s, mp) => s + (mp.amountPaid != null ? mp.amountPaid : mp.expectedAmount),
      0
    );
    const propertyExpenseTotal = propertyExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netCashFlow = rentReceived - mortgageSpend - propertyExpenseTotal;

    return {
      id: pid,
      name: p.name,
      status: p.status,
      rentReceived,
      rentExpected,
      mortgageSpend,
      propertyExpenses: propertyExpenseTotal,
      netCashFlow,
      profitability: netCashFlow
    };
  });

  const totals = byProperty.reduce(
    (acc, p) => {
      acc.rentReceived += p.rentReceived;
      acc.rentExpected += p.rentExpected;
      acc.mortgageSpend += p.mortgageSpend;
      acc.propertyExpenses += p.propertyExpenses;
      return acc;
    },
    { rentReceived: 0, rentExpected: 0, mortgageSpend: 0, propertyExpenses: 0 }
  );

  const additional =
    scope === "all"
      ? expenses.filter((e) => e.scope === "general").reduce((s, e) => s + (e.amount || 0), 0)
      : 0;

  return res.json({
    from: range.from,
    to: range.to,
    scope,
    totals: {
      ...totals,
      additionalExpenses: additional,
      netCashFlow: totals.rentReceived - totals.mortgageSpend - totals.propertyExpenses - additional
    },
    properties: byProperty
  });
});

export default router;
