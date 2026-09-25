import { buildSchema } from "graphql";
import { loadDashboardOverview } from "../services/dashboard.js";

export const graphqlSchema = buildSchema(`
  type DashboardRentCard {
    amount: Float!
    expected: Float!
    outstanding: Float!
    count: Int!
  }

  type DashboardExpenseCard {
    amount: Float!
    mortgage: Float!
    property: Float!
    additional: Float!
    count: Int!
  }

  type DashboardAmountCard {
    amount: Float!
  }

  type DashboardPendingExpenseCard {
    amount: Float!
    expenses: Float!
    mortgages: Float!
    count: Int!
  }

  type DashboardPendingIncomeCard {
    amount: Float!
    count: Int!
  }

  type DashboardCards {
    rent: DashboardRentCard!
    expenses: DashboardExpenseCard!
    netProfit: DashboardAmountCard!
    pendingExpenses: DashboardPendingExpenseCard!
    pendingIncome: DashboardPendingIncomeCard!
  }

  type DashboardPeriod {
    month: String
    label: String!
    rent: Float!
    expenses: Float!
    netProfit: Float!
    pending: Float!
  }

  type DashboardBreakdowns {
    year: DashboardPeriod!
    quarters: [DashboardPeriod!]!
    months: [DashboardPeriod!]!
  }

  type DashboardOverview {
    year: Int!
    from: String!
    to: String!
    properties: Int!
    cards: DashboardCards!
    monthly: [DashboardPeriod!]!
    breakdowns: DashboardBreakdowns!
  }

  type Query {
    dashboard(year: Int, scope: String): DashboardOverview!
  }
`);

export const graphqlRoot = {
  dashboard: (
    args: { year?: number | null; scope?: string | null },
    context: { userId: string }
  ) => loadDashboardOverview(context.userId, args.year, args.scope)
};
