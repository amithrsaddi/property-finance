import { Router } from "express";
import { requireAuth } from "../auth.js";
import { ensureMortgageSchedule, refreshMortgagePaymentStatuses, refreshRentStatuses } from "../domain.js";
import { Expense, Mortgage, MortgagePayment, Property, RentPayment } from "../models.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PENDING_RENT = new Set(["upcoming", "late", "unpaid", "partially_paid", "missed"]);
const PENDING_MORTGAGE = new Set(["upcoming", "overdue", "partial"]);

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

router.get("/", async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const parsedYear = Number(req.query.year);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
    ? parsedYear
    : new Date().getUTCFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  await refreshRentStatuses(userId);
  const mortgages = await Mortgage.find({ userId }).lean();
  for (const m of mortgages) {
    await ensureMortgageSchedule(String(m._id), userId);
  }
  await refreshMortgagePaymentStatuses(userId);

  const [activeProperties, rents, mortgagePayments, expenses] = await Promise.all([
    Property.countDocuments({ userId, status: "active" }),
    RentPayment.find({ userId, expectedPaymentDate: { $gte: from, $lte: to } }).lean(),
    MortgagePayment.find({ userId, dueDate: { $gte: from, $lte: to } }).lean(),
    Expense.find({ userId, expenseDate: { $gte: from, $lte: to } }).lean()
  ]);

  const monthlyRent = emptyMonths();
  const monthlyExpenses = emptyMonths();
  const monthlyPendingIncome = emptyMonths();
  const monthlyPendingExpenses = emptyMonths();

  let rentReceived = 0;
  let rentExpected = 0;
  let pendingIncome = 0;
  let pendingIncomeCount = 0;

  for (const rent of rents) {
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

  for (const expense of expenses) {
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

  for (const payment of mortgagePayments) {
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
    const rent = slice.reduce((s, m) => s + m.rent, 0);
    const exp = slice.reduce((s, m) => s + m.expenses, 0);
    return {
      label: `Q${q + 1}`,
      rent: round2(rent),
      expenses: round2(exp),
      netProfit: round2(rent - exp),
      pending: round2(slice.reduce((s, m) => s + m.pending, 0))
    };
  });

  return res.json({
    year,
    from,
    to,
    properties: activeProperties,
    cards: {
      rent: {
        amount: round2(rentReceived),
        expected: round2(rentExpected),
        outstanding: round2(pendingIncome),
        count: rents.length
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
  });
});

export default router;
