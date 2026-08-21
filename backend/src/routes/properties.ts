import { Router } from "express";
import { requireAuth } from "../auth.js";
import { parseDateRange } from "../dates.js";
import { decodeFileData, fileBuffer, guessMime, safeFilename, validateImage } from "../files.js";
import { Expense, Mortgage, MortgagePayment, Property, RentPayment } from "../models.js";
import { mapProperty } from "../serialize.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

function applyPropertyImage(
  property: InstanceType<typeof Property>,
  body: Record<string, unknown> | undefined
): string | null {
  if (!body) {
    return null;
  }
  if (body.removeImage) {
    property.set("imageData", undefined);
    property.imageMimeType = "";
    property.hasImage = false;
    property.markModified("imageData");
    return null;
  }
  const fileData = decodeFileData(body.imageData);
  if (!fileData) {
    return null;
  }
  const filename = String(body.imageFilename || body.originalFilename || "photo.jpg");
  const mimeType = guessMime(filename, String(body.imageMimeType || body.mimeType || ""));
  const error = validateImage(filename, mimeType, fileData.length);
  if (error) {
    return error;
  }
  property.imageData = fileData;
  property.imageMimeType = mimeType;
  property.hasImage = true;
  property.markModified("imageData");
  return null;
}

router.get("/", async (req: AuthedRequest, res) => {
  const status = String(req.query.status || "active");
  const filter: Record<string, unknown> = { userId: req.user!.id };
  if (status !== "all") {
    filter.status = status;
  }

  const rows = await Property.find(filter).sort({ name: 1 }).lean();
  return res.json({ properties: rows.map((row) => mapProperty(row)) });
});

router.get("/:id/image", async (req: AuthedRequest, res) => {
  const property = await Property.findOne({ _id: req.params.id, userId: req.user!.id }).select(
    "+imageData imageMimeType name hasImage"
  );
  if (!property?.imageData) {
    return res.status(404).json({ message: "Property photo not found." });
  }

  const filename = safeFilename(`${property.name || "property"}.jpg`);
  const payload = fileBuffer(property.imageData);
  const mime = guessMime(filename, property.imageMimeType);
  res.setHeader("Content-Type", mime.startsWith("image/") ? mime : "image/jpeg");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  return res.send(payload);
});

router.post("/", async (req: AuthedRequest, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ message: "Property name is required." });
  }

  const created = new Property({
    userId: req.user!.id,
    name,
    address: String(req.body?.address || "").trim(),
    propertyType: String(req.body?.propertyType || "residential"),
    purchasePrice: req.body?.purchasePrice ?? null,
    purchaseDate: req.body?.purchaseDate || null,
    currentValue: req.body?.currentValue ?? null,
    ownershipPercentage: Number(req.body?.ownershipPercentage ?? 100),
    expectedMonthlyRent: Number(req.body?.expectedMonthlyRent ?? 0),
    notes: String(req.body?.notes || ""),
    status: String(req.body?.status || "active")
  });
  const imageError = applyPropertyImage(created, req.body);
  if (imageError) {
    return res.status(400).json({ message: imageError });
  }
  await created.save();

  return res.status(201).json({ property: mapProperty(created.toObject()), message: "Property created." });
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const property = await Property.findOne({ _id: req.params.id, userId: req.user!.id }).lean();
  if (!property) {
    return res.status(404).json({ message: "Property not found." });
  }

  const range = parseDateRange({
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    month: req.query.month as string | undefined,
    year: req.query.year as string | undefined
  });

  const rents = await RentPayment.find({
    propertyId: property._id,
    userId: req.user!.id,
    expectedPaymentDate: { $gte: range.from, $lte: range.to }
  }).lean();

  const mortgages = await Mortgage.find({ propertyId: property._id, userId: req.user!.id }).lean();
  const mortgageIds = mortgages.map((m) => m._id);
  const mortgagePayments = await MortgagePayment.find({
    mortgageId: { $in: mortgageIds },
    userId: req.user!.id,
    dueDate: { $gte: range.from, $lte: range.to }
  }).lean();

  const expenses = await Expense.find({
    propertyId: property._id,
    userId: req.user!.id,
    expenseDate: { $gte: range.from, $lte: range.to }
  }).lean();

  const rentReceived = rents.reduce((s, r) => s + (r.amountReceived || 0), 0);
  const rentExpected = rents.reduce((s, r) => s + (r.expectedAmount || 0), 0);
  const mortgageCosts = mortgagePayments.reduce(
    (s, p) => s + (p.amountPaid != null ? p.amountPaid : p.expectedAmount),
    0
  );
  const expenseTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const upcomingRent = await RentPayment.find({
    propertyId: property._id,
    userId: req.user!.id,
    status: { $in: ["upcoming", "late", "partially_paid", "unpaid"] }
  })
    .sort({ expectedPaymentDate: 1 })
    .limit(5)
    .lean();

  const upcomingMortgage = await MortgagePayment.find({
    mortgageId: { $in: mortgageIds },
    userId: req.user!.id,
    status: { $in: ["upcoming", "overdue", "partial"] }
  })
    .sort({ dueDate: 1 })
    .limit(5)
    .lean();

  const lenderById = new Map(mortgages.map((m) => [String(m._id), m.lender]));
  const recentExpenses = await Expense.find({
    propertyId: property._id,
    userId: req.user!.id
  })
    .sort({ expenseDate: -1 })
    .limit(5)
    .lean();

  return res.json({
    property: mapProperty(property),
    summary: {
      from: range.from,
      to: range.to,
      rentExpected,
      rentReceived,
      mortgageCosts,
      expenses: expenseTotal,
      netCashFlow: rentReceived - mortgageCosts - expenseTotal,
      monthlyRent: Number(property.expectedMonthlyRent || 0)
    },
    upcoming: {
      rent: upcomingRent.map((r) => ({
        ...r,
        id: String(r._id),
        rental_period: r.rentalPeriod,
        expected_payment_date: r.expectedPaymentDate,
        expected_amount: r.expectedAmount,
        amount_received: r.amountReceived
      })),
      mortgage: upcomingMortgage.map((p) => ({
        ...p,
        id: String(p._id),
        lender: lenderById.get(String(p.mortgageId)) || "",
        due_date: p.dueDate,
        expected_amount: p.expectedAmount
      })),
      expenses: recentExpenses.map((e) => ({
        ...e,
        id: String(e._id),
        expense_date: e.expenseDate,
        payment_status: e.paymentStatus
      }))
    }
  });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const property = await Property.findOne({ _id: req.params.id, userId: req.user!.id }).select("+imageData");
  if (!property) {
    return res.status(404).json({ message: "Property not found." });
  }

  const name = String(req.body?.name ?? property.name).trim();
  if (!name) {
    return res.status(400).json({ message: "Property name is required." });
  }

  property.name = name;
  property.address = String(req.body?.address ?? property.address ?? "");
  property.propertyType = String(req.body?.propertyType ?? property.propertyType ?? "residential");
  property.purchasePrice =
    req.body?.purchasePrice !== undefined ? req.body.purchasePrice : property.purchasePrice;
  property.purchaseDate =
    req.body?.purchaseDate !== undefined ? req.body.purchaseDate || null : property.purchaseDate;
  property.currentValue =
    req.body?.currentValue !== undefined ? req.body.currentValue : property.currentValue;
  property.ownershipPercentage = Number(
    req.body?.ownershipPercentage ?? property.ownershipPercentage ?? 100
  );
  property.expectedMonthlyRent = Number(
    req.body?.expectedMonthlyRent ?? property.expectedMonthlyRent ?? 0
  );
  property.notes = String(req.body?.notes ?? property.notes ?? "");
  property.status = String(req.body?.status ?? property.status ?? "active");
  const imageError = applyPropertyImage(property, req.body);
  if (imageError) {
    return res.status(400).json({ message: imageError });
  }
  await property.save();

  return res.json({ property: mapProperty(property.toObject()), message: "Property updated." });
});

router.post("/:id/archive", async (req: AuthedRequest, res) => {
  const property = await Property.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!property) {
    return res.status(404).json({ message: "Property not found." });
  }
  property.status = "archived";
  await property.save();
  return res.json({ property: mapProperty(property.toObject()), message: "Property archived." });
});

export default router;
