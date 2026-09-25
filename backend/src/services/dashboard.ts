import { ensureActiveMortgageSchedules, refreshMortgagePaymentStatuses, refreshRentStatuses } from "../domain.js";
import { Expense, Mortgage, MortgagePayment, Property, RentPayment } from "../models.js";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PENDING_RENT = new Set(["upcoming", "late", "unpaid", "partially_paid", "missed"]);
const PENDING_MORTGAGE = new Set(["upcoming", "overdue", "partial"]);

export type PortfolioScope = "all" | "rental" | "personal";

export type DashboardPeriod = {
  month?: string;
  label: string;
  rent: number;
  expenses: number;
  netProfit: number;
  pending: number;
};

export type DashboardOverview = {
  year: number;
  from: string;
  to: string;
  properties: number;
  cards: {
    rent: { amount: number; expected: number; outstanding: number; count: number };
    expenses: { amount: number; mortgage: number; property: number; additional: number; count: number };
    netProfit: { amount: number };
    pendingExpenses: { amount: number; expenses: number; mortgages: number; count: number };
    pendingIncome: { amount: number; count: number };
  };
  monthly: DashboardPeriod[];
  breakdowns: {
    year: DashboardPeriod;
    quarters: DashboardPeriod[];
    months: DashboardPeriod[];
  };
};

function monthIndex(iso: string | null | undefined): number {
  const month = Number(String(iso || "").slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : -1;
}

function emptyMonths(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

function round2(value: number): number {
  return Math.round((value || 0) * 100) / 100;
}

export function parsePortfolioScope(value: unknown): PortfolioScope {
  const scope = String(value || "rental").toLowerCase();
  return scope === "all" || scope === "rental" || scope === "personal" ? scope : "rental";
}

export function parseDashboardYear(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : new Date().getUTCFullYear();
}

function matchesPortfolio(propertyType: unknown, scope: PortfolioScope): boolean {
  if (scope === "all") {
    return true;
  }
  const type = String(propertyType || "residential");
  if (scope === "rental") {
    return type === "buy_to_let" || type === "hmo";
  }
  return type === "residential";
}

export async function loadDashboardOverview(
  userId: string,
  yearValue?: unknown,
  scopeValue?: unknown
): Promise<DashboardOverview> {
  const year = parseDashboardYear(yearValue);
  const scope = parsePortfolioScope(scopeValue);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  await Promise.all([refreshRentStatuses(userId), ensureActiveMortgageSchedules(userId)]);
  await refreshMortgagePaymentStatuses(userId);

  const [properties, mortgages, rents, mortgagePayments, expenses] = await Promise.all([
    Property.find({ userId }).select("_id propertyType status").lean(),
    Mortgage.find({ userId }).select("_id propertyId").lean(),
    RentPayment.find({ userId, expectedPaymentDate: { $gte: from, $lte: to } })
      .select("propertyId expectedPaymentDate amountReceived expectedAmount status")
      .lean(),
    MortgagePayment.find({ userId, dueDate: { $gte: from, $lte: to } })
      .select("mortgageId dueDate expectedAmount amountPaid status")
      .lean(),
    Expense.find({ userId, expenseDate: { $gte: from, $lte: to } })
      .select("propertyId scope expenseDate amount paymentStatus")
      .lean()
  ]);

  const scopedPropertyIds = new Set(
    properties.filter((property) => matchesPortfolio(property.propertyType, scope)).map((property) => String(property._id))
  );
  const activeProperties = properties.filter(
    (property) => property.status === "active" && scopedPropertyIds.has(String(property._id))
  ).length;
  const scopedMortgageIds = new Set(
    mortgages.filter((mortgage) => scopedPropertyIds.has(String(mortgage.propertyId))).map((mortgage) => String(mortgage._id))
  );
  const scopedRents = rents.filter((rent) => scopedPropertyIds.has(String(rent.propertyId)));
  const scopedMortgagePayments = mortgagePayments.filter((payment) => scopedMortgageIds.has(String(payment.mortgageId)));
  const scopedExpenses = expenses.filter((expense) => {
    if (!expense.propertyId || expense.scope === "general") {
      return scope === "all";
    }
    return scopedPropertyIds.has(String(expense.propertyId));
  });

  const monthlyRent = emptyMonths();
  const monthlyExpenses = emptyMonths();
  const monthlyPendingIncome = emptyMonths();
  const monthlyPendingExpenses = emptyMonths();

  let rentReceived = 0;
  let rentExpected = 0;
  let pendingIncome = 0;
  let pendingIncomeCount = 0;

  for (const rent of scopedRents) {
    const idx = monthIndex(rent.expectedPaymentDate);
    const received = Number(rent.amountReceived) || 0;
    const expected = Number(rent.expectedAmount) || 0;
    rentReceived += received;
    rentExpected += expected;
    if (idx >= 0) {
      monthlyRent[idx] += received;
    }
    if (PENDING_RENT.has(String(rent.status))) {
      const outstanding = Math.max(expected - received, 0);
      pendingIncome += outstanding;
      pendingIncomeCount += 1;
      if (idx >= 0) {
        monthlyPendingIncome[idx] += outstanding;
      }
    }
  }

  let paidPropertyExpenses = 0;
  let paidAdditionalExpenses = 0;
  let pendingExpenseAmount = 0;
  let pendingExpenseCount = 0;
  let paidExpenseCount = 0;

  for (const expense of scopedExpenses) {
    const idx = monthIndex(expense.expenseDate);
    const amount = Number(expense.amount) || 0;
    const paid = String(expense.paymentStatus || "paid") === "paid";
    if (paid) {
      paidExpenseCount += 1;
      if (expense.scope === "general") {
        paidAdditionalExpenses += amount;
      } else {
        paidPropertyExpenses += amount;
      }
      if (idx >= 0) {
        monthlyExpenses[idx] += amount;
      }
    } else {
      pendingExpenseAmount += amount;
      pendingExpenseCount += 1;
      if (idx >= 0) {
        monthlyPendingExpenses[idx] += amount;
      }
    }
  }

  let paidMortgage = 0;
  let pendingMortgage = 0;
  let pendingMortgageCount = 0;
  let paidMortgageCount = 0;

  for (const payment of scopedMortgagePayments) {
    const idx = monthIndex(payment.dueDate);
    const expected = Number(payment.expectedAmount) || 0;
    const paidAmount = payment.amountPaid != null ? Number(payment.amountPaid) || 0 : 0;
    const status = String(payment.status);
    if (status === "paid") {
      const spend = paidAmount || expected;
      paidMortgage += spend;
      paidMortgageCount += 1;
      if (idx >= 0) {
        monthlyExpenses[idx] += spend;
      }
    } else if (status === "partial") {
      paidMortgage += paidAmount;
      paidMortgageCount += 1;
      const remaining = Math.max(expected - paidAmount, 0);
      pendingMortgage += remaining;
      pendingMortgageCount += 1;
      if (idx >= 0) {
        monthlyExpenses[idx] += paidAmount;
        monthlyPendingExpenses[idx] += remaining;
      }
    } else if (PENDING_MORTGAGE.has(status)) {
      pendingMortgage += expected;
      pendingMortgageCount += 1;
      if (idx >= 0) {
        monthlyPendingExpenses[idx] += expected;
      }
    }
  }

  const expensesTotal = paidPropertyExpenses + paidAdditionalExpenses + paidMortgage;
  const pendingExpensesTotal = pendingExpenseAmount + pendingMortgage;
  const netProfit = rentReceived - expensesTotal;

  const monthly = MONTH_LABELS.map((label, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    label,
    rent: round2(monthlyRent[index]),
    expenses: round2(monthlyExpenses[index]),
    netProfit: round2(monthlyRent[index] - monthlyExpenses[index]),
    pending: round2(monthlyPendingIncome[index] + monthlyPendingExpenses[index])
  }));

  const quarters = [0, 1, 2, 3].map((q) => {
    const slice = monthly.slice(q * 3, q * 3 + 3);
    const rent = slice.reduce((sum, item) => sum + item.rent, 0);
    const exp = slice.reduce((sum, item) => sum + item.expenses, 0);
    return {
      label: `Q${q + 1}`,
      rent: round2(rent),
      expenses: round2(exp),
      netProfit: round2(rent - exp),
      pending: round2(slice.reduce((sum, item) => sum + item.pending, 0))
    };
  });

  return {
    year,
    from,
    to,
    properties: activeProperties,
    cards: {
      rent: {
        amount: round2(rentReceived),
        expected: round2(rentExpected),
        outstanding: round2(pendingIncome),
        count: scopedRents.length
      },
      expenses: {
        amount: round2(expensesTotal),
        mortgage: round2(paidMortgage),
        property: round2(paidPropertyExpenses),
        additional: round2(paidAdditionalExpenses),
        count: paidExpenseCount + paidMortgageCount
      },
      netProfit: {
        amount: round2(netProfit)
      },
      pendingExpenses: {
        amount: round2(pendingExpensesTotal),
        expenses: round2(pendingExpenseAmount),
        mortgages: round2(pendingMortgage),
        count: pendingExpenseCount + pendingMortgageCount
      },
      pendingIncome: {
        amount: round2(pendingIncome),
        count: pendingIncomeCount
      }
    },
    monthly,
    breakdowns: {
      year: {
        label: "Full year",
        rent: round2(rentReceived),
        expenses: round2(expensesTotal),
        netProfit: round2(netProfit),
        pending: round2(pendingIncome + pendingExpensesTotal)
      },
      quarters,
      months: monthly
    }
  };
}
