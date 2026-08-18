import { Router } from "express";
import { requireAuth } from "../auth.js";
import { parseDateRange, sum } from "../dates.js";
import { decodeFileData, safeFilename, validateFile } from "../files.js";
import { Expense, Property, PropertyDocument } from "../models.js";
import { mapExpense } from "../serialize.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

async function documentNamesById(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) {
    return new Map();
  }
  const rows = await PropertyDocument.find({ _id: { $in: unique } }).lean();
  return new Map(rows.map((row) => [String(row._id), String(row.name || row.originalFilename || "Document")]));
}

async function attachExpenseDocument(
  userId: string,
  body: Record<string, unknown>,
  opts: { scope: "property" | "general"; propertyId: string | null; category: string; description: string }
): Promise<{ documentId: string | null; documentName: string | null; error?: string }> {
  const fileData = decodeFileData(body?.fileData);
  if (!fileData) {
    return { documentId: null, documentName: null };
  }

  const originalFilename = String(body?.originalFilename || body?.fileName || "document");
  const mimeType = String(body?.mimeType || "application/octet-stream");
  const fileError = validateFile(originalFilename, mimeType, fileData.length);
  if (fileError) {
    return { documentId: null, documentName: null, error: fileError };
  }

  const fallbackName = [opts.category, opts.description].filter(Boolean).join(" — ");
  const name =
    String(body?.documentName || "").trim() ||
    fallbackName ||
    originalFilename.replace(/\.[^.]+$/, "") ||
    "Expense receipt";

  const created = await PropertyDocument.create({
    userId,
    propertyId: opts.propertyId,
    scope: opts.scope,
    name,
    validUntil: null,
    originalFilename: safeFilename(originalFilename),
    mimeType,
    fileSize: fileData.length,
    fileData
  });

  return { documentId: String(created._id), documentName: created.name };
}

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
  const docNames = await documentNamesById(rows.map((r) => (r.documentId ? String(r.documentId) : null)));

  const expenses = rows.map((r) =>
    mapExpense(r, r.propertyId ? nameById.get(String(r.propertyId)) : null, {
      documentName: r.documentId ? docNames.get(String(r.documentId)) ?? null : null
    })
  );

  return res.json({
    expenses,
    totals: { amount: sum(expenses.map((e) => Number(e.amount))) },
    from: range.from,
    to: range.to
  });
});

router.post("/", async (req: AuthedRequest, res) => {
  const scope = String(req.body?.scope || "property") === "general" ? "general" : "property";
  const propertyId = req.body?.propertyId ? String(req.body.propertyId) : null;
  const category = String(req.body?.category || "").trim();
  const amount = Number(req.body?.amount);
  const expenseDate = String(req.body?.expenseDate || "");
  const description = String(req.body?.description || "");

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

  const attached = await attachExpenseDocument(req.user!.id, req.body || {}, {
    scope,
    propertyId: scope === "property" ? propertyId : null,
    category,
    description
  });
  if (attached.error) {
    return res.status(400).json({ message: attached.error });
  }

  const created = await Expense.create({
    userId: req.user!.id,
    propertyId: scope === "property" ? propertyId : null,
    scope,
    category,
    description,
    amount,
    expenseDate,
    paymentStatus: String(req.body?.paymentStatus || "paid"),
    frequency: String(req.body?.frequency || "one_off"),
    notes: String(req.body?.notes || ""),
    documentId: attached.documentId
  });

  return res.status(201).json({
    expense: mapExpense(created.toObject(), propertyName, { documentName: attached.documentName }),
    message: "Expense recorded."
  });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await Expense.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Expense not found." });
  }

  const scope = String(req.body?.scope ?? existing.scope) === "general" ? "general" : "property";
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

  const attached = await attachExpenseDocument(req.user!.id, req.body || {}, {
    scope,
    propertyId: scope === "property" ? propertyId : null,
    category: existing.category,
    description: existing.description
  });
  if (attached.error) {
    return res.status(400).json({ message: attached.error });
  }
  if (attached.documentId) {
    existing.set("documentId", attached.documentId);
  }

  await existing.save();

  const property = existing.propertyId ? await Property.findById(existing.propertyId).lean() : null;
  const docNames = await documentNamesById([existing.documentId ? String(existing.documentId) : null]);
  return res.json({
    expense: mapExpense(existing.toObject(), property?.name ?? null, {
      documentName: existing.documentId ? docNames.get(String(existing.documentId)) ?? attached.documentName : null
    }),
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
