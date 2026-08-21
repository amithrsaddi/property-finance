import { Router } from "express";
import { requireAuth } from "../auth.js";
import { clampDay, parseDateRange, sum } from "../dates.js";
import { refreshRentStatuses } from "../domain.js";
import { Property, RentPayment } from "../models.js";
import { lookupProperties, mapRentPayment } from "../serialize.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

const MAX_RECURRING_MONTHS = 120;

function deriveStatus(input: {
  expectedAmount: number;
  amountReceived: number;
  expectedPaymentDate: string;
  explicit?: string;
}): string {
  const explicit = String(input.explicit || "").toLowerCase();
  if (explicit === "paid" || explicit === "upcoming" || explicit === "unpaid") {
    return explicit;
  }
  if (input.amountReceived >= input.expectedAmount && input.expectedAmount > 0) {
    return "paid";
  }
  if (input.expectedPaymentDate < new Date().toISOString().slice(0, 10)) {
    return "unpaid";
  }
  return "upcoming";
}

function parseBoundaryDate(value: string): { year: number; monthIndex: number; day: number } | null {
  const trimmed = String(value || "").trim();
  const monthOnly = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (monthOnly) {
    return {
      year: Number(monthOnly[1]),
      monthIndex: Number(monthOnly[2]) - 1,
      day: 1
    };
  }
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!full) {
    return null;
  }
  return {
    year: Number(full[1]),
    monthIndex: Number(full[2]) - 1,
    day: Number(full[3])
  };
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

router.get("/", async (req: AuthedRequest, res) => {
  await refreshRentStatuses(req.user!.id);
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const range = parseDateRange({
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    month: req.query.month as string | undefined,
    year: req.query.year as string | undefined
  });

  const filter: Record<string, unknown> = {
    userId: req.user!.id,
    expectedPaymentDate: { $gte: range.from, $lte: range.to }
  };
  if (propertyId) {
    filter.propertyId = propertyId;
  }

  const rows = await RentPayment.find(filter).sort({ expectedPaymentDate: -1 }).lean();
  const propertyIds = [...new Set(rows.map((r) => String(r.propertyId)))];
  const properties = await Property.find({ _id: { $in: propertyIds } }).lean();
  const propertyById = lookupProperties(properties);

  const rentPayments = rows.map((r) => mapRentPayment(r, propertyById.get(String(r.propertyId))));
  return res.json({
    rentPayments,
    totals: {
      expected: sum(rentPayments.map((r) => Number(r.expected_amount))),
      received: sum(rentPayments.map((r) => Number(r.amount_received)))
    },
    from: range.from,
    to: range.to
  });
});

router.post("/recurring", async (req: AuthedRequest, res) => {
  const propertyId = String(req.body?.propertyId || "");
  const property = await Property.findOne({ _id: propertyId, userId: req.user!.id });
  if (!property) {
    return res.status(400).json({ message: "Valid propertyId is required." });
  }

  const expectedAmount = Number(req.body?.expectedAmount);
  const from = parseBoundaryDate(String(req.body?.from || ""));
  const to = parseBoundaryDate(String(req.body?.to || ""));
  const status = "upcoming";
  const notes = String(req.body?.notes || "");

  if (!from || !to || Number.isNaN(expectedAmount) || expectedAmount < 0) {
    return res.status(400).json({
      message: "from, to, and a valid expectedAmount are required."
    });
  }

  const startKey = monthKey(from.year, from.monthIndex);
  const endKey = monthKey(to.year, to.monthIndex);
  if (startKey > endKey) {
    return res.status(400).json({ message: "from must be on or before to." });
  }

  const paymentDay = Number(req.body?.paymentDay ?? from.day) || from.day;
  const periods: Array<{ rentalPeriod: string; expectedPaymentDate: string }> = [];
  let year = from.year;
  let monthIndex = from.monthIndex;

  for (let i = 0; i < MAX_RECURRING_MONTHS; i += 1) {
    const rentalPeriod = monthKey(year, monthIndex);
    if (rentalPeriod > endKey) {
      break;
    }
    periods.push({
      rentalPeriod,
      expectedPaymentDate: clampDay(year, monthIndex, paymentDay)
    });
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }

  if (!periods.length) {
    return res.status(400).json({ message: "No rental periods found in the selected range." });
  }
  if (periods.length >= MAX_RECURRING_MONTHS && monthKey(year, monthIndex) <= endKey) {
    return res.status(400).json({
      message: `Recurring rent is limited to ${MAX_RECURRING_MONTHS} months.`
    });
  }

  const existing = await RentPayment.find({
    userId: req.user!.id,
    propertyId,
    rentalPeriod: { $in: periods.map((p) => p.rentalPeriod) }
  })
    .select("rentalPeriod")
    .lean();
  const existingPeriods = new Set(existing.map((row) => String(row.rentalPeriod)));

  const toCreate = periods.filter((period) => !existingPeriods.has(period.rentalPeriod));
  const created =
    toCreate.length === 0
      ? []
      : await RentPayment.insertMany(
          toCreate.map((period) => ({
            propertyId,
            userId: req.user!.id,
            rentalPeriod: period.rentalPeriod,
            expectedAmount,
            amountReceived: 0,
            expectedPaymentDate: period.expectedPaymentDate,
            actualPaymentDate: null,
            status,
            notes
          }))
        );

  return res.status(201).json({
    created: created.length,
    skipped: periods.length - created.length,
    rentPayments: created.map((row) => mapRentPayment(row.toObject?.() ?? row, property)),
    message:
      created.length === 0
        ? "No new rent records created; all periods already exist."
        : `Created ${created.length} upcoming rent record${created.length === 1 ? "" : "s"}.`
  });
});

router.post("/", async (req: AuthedRequest, res) => {
  const propertyId = String(req.body?.propertyId || "");
  const property = await Property.findOne({ _id: propertyId, userId: req.user!.id });
  if (!property) {
    return res.status(400).json({ message: "Valid propertyId is required." });
  }

  const expectedAmount = Number(req.body?.expectedAmount);
  const amountReceived = Number(req.body?.amountReceived ?? 0);
  const expectedPaymentDate = String(req.body?.expectedPaymentDate || "");
  const rentalPeriod = String(req.body?.rentalPeriod || "").trim();

  if (!rentalPeriod || !expectedPaymentDate || Number.isNaN(expectedAmount)) {
    return res.status(400).json({
      message: "rentalPeriod, expectedAmount, and expectedPaymentDate are required."
    });
  }

  const created = await RentPayment.create({
    propertyId,
    userId: req.user!.id,
    rentalPeriod,
    expectedAmount,
    amountReceived,
    expectedPaymentDate,
    actualPaymentDate: req.body?.actualPaymentDate || null,
    status: deriveStatus({
      expectedAmount,
      amountReceived,
      expectedPaymentDate,
      explicit: req.body?.status
    }),
    notes: String(req.body?.notes || "")
  });

  return res.status(201).json({
    rentPayment: mapRentPayment(created.toObject(), property),
    message: "Rent payment recorded."
  });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await RentPayment.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Rent payment not found." });
  }

  const expectedAmount = Number(req.body?.expectedAmount ?? existing.expectedAmount);
  const amountReceived = Number(req.body?.amountReceived ?? existing.amountReceived);
  const expectedPaymentDate = String(
    req.body?.expectedPaymentDate ?? existing.expectedPaymentDate
  );

  existing.rentalPeriod = String(req.body?.rentalPeriod ?? existing.rentalPeriod);
  if (req.body?.propertyId) {
    const propertyId = String(req.body.propertyId);
    const property = await Property.findOne({ _id: propertyId, userId: req.user!.id });
    if (!property) {
      return res.status(400).json({ message: "Valid propertyId is required." });
    }
    existing.propertyId = property._id;
  }
  existing.expectedAmount = expectedAmount;
  existing.amountReceived = amountReceived;
  existing.expectedPaymentDate = expectedPaymentDate;
  existing.actualPaymentDate =
    req.body?.actualPaymentDate !== undefined
      ? req.body.actualPaymentDate || null
      : existing.actualPaymentDate;
  existing.status = deriveStatus({
    expectedAmount,
    amountReceived,
    expectedPaymentDate,
    explicit: req.body?.status
  });
  existing.notes = String(req.body?.notes ?? existing.notes ?? "");
  await existing.save();

  const property = await Property.findById(existing.propertyId).lean();
  return res.json({
    rentPayment: mapRentPayment(existing.toObject(), property),
    message: "Rent payment updated."
  });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const result = await RentPayment.deleteOne({ _id: req.params.id, userId: req.user!.id });
  if (!result.deletedCount) {
    return res.status(404).json({ message: "Rent payment not found." });
  }
  return res.json({ message: "Rent payment deleted." });
});

export default router;
