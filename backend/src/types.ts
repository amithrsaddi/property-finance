import type { Request } from "express";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  preferredCurrency: string;
  decimalPrecision: number;
};

export type AuthedRequest = Request & {
  user?: AuthUser;
};

export type PropertyType =
  | "residential"
  | "buy_to_let"
  | "commercial"
  | "hmo"
  | "land"
  | "other";

export type RentStatus = "upcoming" | "paid" | "unpaid" | "late" | "partially_paid" | "missed";

export type MortgageType = "repayment" | "interest_only" | "offset" | "other";

export type ExpenseFrequency = "one_off" | "monthly" | "quarterly" | "annually" | "other";

export type ExpenseStatus = "upcoming" | "paid" | "overdue";

export type PaymentStatus = "upcoming" | "paid" | "overdue" | "partial";
