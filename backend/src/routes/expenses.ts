import { Router } from "express";
import { requireAuth } from "../auth.js";
import { parseDateRange, sum } from "../dates.js";
import { Expense, Property } from "../models.js";
import { mapExpense } from "../serialize.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const scope = String(req.query.scope || "all");
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const range = parseDateRange({
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    month: req.query.month as string | undefined,
    year: req.query.year as string | undefined
  });

  const filter: Record<string, unknown> = {
    userId: req.user!.id,
    expenseDate: { $gte: range.from, $lte: range.to }
  };
  if (scope === "property" || scope === "general") {
    filter.scope = scope;
  }
  if (propertyId) {
    filter.propertyId = propertyId;
  }

  const rows = await Expense.find(filter).sort({ expenseDate: -1 }).lean();
  const propertyIds = rows.filter((r) => r.propertyId).map((r) => String(r.propertyId));
  const properties = await Property.find({ _id: { $in: propertyIds } }).lean();
  const nameById = new Map(properties.map((p) => [String(p._id), p.name]));

  const expenses = rows.map((r) =>
    mapExpense(r, r.propertyId ? nameById.get(String(r.propertyId)) : null)
  );

  return res.json({
    expenses,
    totals: { amount: sum(expenses.map((e) => Number(e.amount))) },
    from: range.from,
    to: range.to
  });
});

router.post("/", async (req: AuthedRequest, res) => {
  const scope = String(req.body?.scope || "property");
  const propertyId = req.body?.propertyId ? String(req.body.propertyId) : null;
  const category = String(req.body?.category || "").trim();
  const amount = Number(req.body?.amount);
  const expenseDate = String(req.body?.expenseDate || "");

  if (!category || Number.isNaN(amount) || !expenseDate) {
    return res.status(400).json({ message: "category, amount, and expenseDate are required." });
  }

  let propertyName: string | null = null;
  if (scope === "property") {
    const property = propertyId
      ? await Property.findOne({ _id: propertyId, userId: req.user!.id })
      : null;
    if (!property) {
      return res.status(400).json({ message: "Valid propertyId is required for property expenses." });
    }
    propertyName = property.name;
  }

  const created = await Expense.create({
    userId: req.user!.id,
    propertyId: scope === "property" ? propertyId : null,
    scope: scope === "general" ? "general" : "property",
    category,
    description: String(req.body?.description || ""),
    amount,
    expenseDate,
    paymentStatus: String(req.body?.paymentStatus || "paid"),
    frequency: String(req.body?.frequency || "one_off"),
    notes: String(req.body?.notes || "")
  });

  return res.status(201).json({
    expense: mapExpense(created.toObject(), propertyName),
    message: "Expense recorded."
  });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await Expense.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Expense not found." });
  }

  const scope = String(req.body?.scope ?? existing.scope);
  const propertyId =
    req.body?.propertyId !== undefined
      ? req.body.propertyId
        ? String(req.body.propertyId)
        : null
      : existing.propertyId
        ? String(existing.propertyId)
        : null;

  if (scope === "property" && propertyId) {
    const property = await Property.findOne({ _id: propertyId, userId: req.user!.id });
    if (!property) {
      return res.status(400).json({ message: "Valid propertyId is required." });
    }
  }

  existing.scope = scope;
  if (scope === "general") {
    existing.set("propertyId", null);
  } else {
    existing.set("propertyId", propertyId);
  }
  existing.category = String(req.body?.category ?? existing.category);
  existing.description = String(req.body?.description ?? existing.description ?? "");
  existing.amount = Number(req.body?.amount ?? existing.amount);
  existing.expenseDate = String(req.body?.expenseDate ?? existing.expenseDate);
  existing.paymentStatus = String(req.body?.paymentStatus ?? existing.paymentStatus);
  existing.frequency = String(req.body?.frequency ?? existing.frequency);
  existing.notes = String(req.body?.notes ?? existing.notes ?? "");
  await existing.save();

  const property = existing.propertyId ? await Property.findById(existing.propertyId).lean() : null;
  return res.json({
    expense: mapExpense(existing.toObject(), property?.name ?? null),
    message: "Expense updated."
  });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const result = await Expense.deleteOne({ _id: req.params.id, userId: req.user!.id });
  if (!result.deletedCount) {
    return res.status(404).json({ message: "Expense not found." });
  }
  return res.json({ message: "Expense deleted." });
});

export default router;
