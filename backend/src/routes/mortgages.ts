import { Router } from "express";
import { requireAuth } from "../auth.js";
import { todayIso } from "../dates.js";
import { ensureMortgageSchedule, refreshMortgagePaymentStatuses } from "../domain.js";
import { Mortgage, MortgagePayment, Property } from "../models.js";
import { lookupProperties, mapMortgage, mapMortgagePayment } from "../serialize.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

router.get("/payments/views", async (req: AuthedRequest, res) => {
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const yearRaw = req.query.year ? String(req.query.year) : "";
  const year = /^\d{4}$/.test(yearRaw) ? yearRaw : undefined;
  const mortgageFilter: Record<string, unknown> = { userId: req.user!.id };
  if (propertyId) {
    mortgageFilter.propertyId = propertyId;
  }

  const mortgages = await Mortgage.find(mortgageFilter).lean();
  for (const m of mortgages) {
    await ensureMortgageSchedule(String(m._id), req.user!.id);
  }
  await refreshMortgagePaymentStatuses(req.user!.id);

  const today = todayIso();
  const monthStart = `${today.slice(0, 8)}01`;
  const monthEndDate = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0));
  const monthEnd = monthEndDate.toISOString().slice(0, 10);

  const mortgageIds = mortgages.map((m) => m._id);
  const payments = await MortgagePayment.find({
    userId: req.user!.id,
    mortgageId: { $in: mortgageIds }
  }).lean();

  const propertyIds = [...new Set(mortgages.map((m) => String(m.propertyId)))];
  const properties = await Property.find({ _id: { $in: propertyIds } }).lean();
  const propertyById = lookupProperties(properties);
  const mortgageById = new Map(mortgages.map((m) => [String(m._id), m]));

  const enriched = payments.map((p) => {
    const mortgage = mortgageById.get(String(p.mortgageId));
    const property = mortgage ? propertyById.get(String(mortgage.propertyId)) : undefined;
    return mapMortgagePayment(p, {
      lender: mortgage?.lender,
      property_id: mortgage ? String(mortgage.propertyId) : "",
      property_name: property?.name,
      hasImage: property?.hasImage
    });
  });

  const years = [
    ...new Set(
      enriched
        .map((p) => Number(String(p.due_date || "").slice(0, 4)))
        .filter((value) => Number.isInteger(value) && value >= 2000 && value <= 2100)
    )
  ].sort((a, b) => b - a);

  const scoped = year ? enriched.filter((p) => String(p.due_date).startsWith(year)) : enriched;

  const upcoming = scoped
    .filter(
      (p) =>
        String(p.due_date) >= today && ["upcoming", "overdue", "partial"].includes(String(p.status))
    )
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  const current = scoped
    .filter((p) => String(p.due_date) >= monthStart && String(p.due_date) <= monthEnd)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  const past = scoped
    .filter((p) => String(p.due_date) < monthStart || p.status === "paid")
    .sort((a, b) => String(b.due_date).localeCompare(String(a.due_date)));

  const activeMortgages = mortgages
    .filter((m) => m.status === "active")
    .map((m) => mapMortgage(m, propertyById.get(String(m.propertyId))));

  return res.json({ upcoming, current, past, activeMortgages, years });
});

router.post("/payments", async (req: AuthedRequest, res) => {
  const mortgageId = String(req.body?.mortgageId || "");
  const mortgage = await Mortgage.findOne({ _id: mortgageId, userId: req.user!.id });
  if (!mortgage) {
    return res.status(400).json({ message: "Valid mortgageId is required." });
  }

  const dueDate = String(req.body?.dueDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return res.status(400).json({ message: "A valid due date is required." });
  }

  const expectedAmount = Number(req.body?.expectedAmount ?? mortgage.monthlyRepayment);
  if (!Number.isFinite(expectedAmount) || expectedAmount < 0) {
    return res.status(400).json({ message: "A valid expected amount is required." });
  }

  const existing = await MortgagePayment.findOne({
    mortgageId: mortgage._id,
    dueDate,
    userId: req.user!.id
  });
  if (existing) {
    return res.status(409).json({
      message: "A payment for this mortgage and due date already exists. Edit that payment instead."
    });
  }

  const amountPaidRaw = req.body?.amountPaid;
  const amountPaid =
    amountPaidRaw === null || amountPaidRaw === "" || amountPaidRaw === undefined
      ? null
      : Number(amountPaidRaw);
  const paidDate = req.body?.paidDate ? String(req.body.paidDate) : null;
  const notes = String(req.body?.notes || "");
  let status = String(req.body?.status || "upcoming");
  if (req.body?.status === undefined) {
    if (amountPaid != null && amountPaid >= expectedAmount && expectedAmount > 0) {
      status = "paid";
    } else if (amountPaid != null && amountPaid > 0) {
      status = "partial";
    } else if (dueDate < todayIso()) {
      status = "overdue";
    } else {
      status = "upcoming";
    }
  }

  if (status === "paid" && (amountPaid == null || amountPaid <= 0)) {
    return res.status(400).json({ message: "Paid payments need an amount paid greater than zero." });
  }

  const nextAmountPaid: number | null =
    status === "paid" || status === "partial"
      ? Number(amountPaid ?? expectedAmount)
      : amountPaid;
  const nextPaidDate: string | null =
    status === "paid" || status === "partial" ? String(paidDate || todayIso()) : paidDate;

  try {
    const created = await MortgagePayment.create({
      mortgageId: mortgage._id,
      userId: req.user!.id,
      dueDate,
      expectedAmount,
      amountPaid: null,
      paidDate: null,
      status: "upcoming",
      notes
    });
    await applyPaymentUpdate(created, {
      expectedAmount,
      amountPaid: nextAmountPaid,
      paidDate: nextPaidDate,
      status,
      notes
    });
    await refreshMortgagePaymentStatuses(req.user!.id);

    const property = await Property.findById(mortgage.propertyId).lean();
    return res.status(201).json({
      payment: mapMortgagePayment(created.toObject(), {
        lender: mortgage.lender,
        property_id: String(mortgage.propertyId),
        property_name: property?.name,
        hasImage: Boolean(property?.hasImage)
      }),
      message: "Mortgage payment added."
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000) {
      return res.status(409).json({
        message: "A payment for this mortgage and due date already exists. Edit that payment instead."
      });
    }
    throw error;
  }
});

router.post("/payments/bulk", async (req: AuthedRequest, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter(Boolean))];
  const action = String(req.body?.status || "").toLowerCase();
  if (!ids.length) {
    return res.status(400).json({ message: "Select at least one payment." });
  }
  if (ids.length > 100) {
    return res.status(400).json({ message: "You can update up to 100 payments at a time." });
  }
  if (action !== "paid" && action !== "unpaid") {
    return res.status(400).json({ message: "Status must be paid or unpaid." });
  }

  const validIds = ids.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
  const payments = await MortgagePayment.find({ _id: { $in: validIds }, userId: req.user!.id });
  const today = todayIso();
  for (const existing of payments) {
    if (action === "paid") {
      await applyPaymentUpdate(existing, {
        amountPaid: existing.expectedAmount,
        paidDate: today,
        status: "paid",
        notes: String(existing.notes || "")
      });
    } else {
      await applyPaymentUpdate(existing, {
        amountPaid: null,
        paidDate: null,
        status: String(existing.dueDate) < today ? "overdue" : "upcoming",
        notes: String(existing.notes || "")
      });
    }
  }

  return res.json({
    updated: payments.length,
    message: `Updated ${payments.length} payment${payments.length === 1 ? "" : "s"}.`
  });
});

router.post("/payments/:id/pay", async (req: AuthedRequest, res) => {
  const existing = await MortgagePayment.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Mortgage payment not found." });
  }

  const amountPaid = Number(req.body?.amountPaid ?? existing.expectedAmount);
  const paidDate = String(req.body?.paidDate || todayIso());
  const nextStatus =
    amountPaid >= existing.expectedAmount ? "paid" : amountPaid > 0 ? "partial" : "upcoming";

  await applyPaymentUpdate(existing, {
    amountPaid,
    paidDate,
    status: nextStatus,
    notes: String(req.body?.notes ?? existing.notes ?? "")
  });

  return res.json({
    payment: mapMortgagePayment(existing.toObject()),
    message: "Payment recorded."
  });
});

router.put("/payments/:id", async (req: AuthedRequest, res) => {
  const existing = await MortgagePayment.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Mortgage payment not found." });
  }

  const expectedAmount = Number(req.body?.expectedAmount ?? existing.expectedAmount);
  const amountPaidRaw = req.body?.amountPaid;
  const amountPaid =
    amountPaidRaw === null || amountPaidRaw === ""
      ? null
      : amountPaidRaw !== undefined
        ? Number(amountPaidRaw)
        : existing.amountPaid;
  const paidDate =
    req.body?.paidDate !== undefined
      ? req.body.paidDate
        ? String(req.body.paidDate)
        : null
      : existing.paidDate;
  const notes = String(req.body?.notes ?? existing.notes ?? "");

  let status = String(req.body?.status ?? existing.status);
  if (req.body?.status === undefined) {
    if (amountPaid != null && amountPaid >= expectedAmount && expectedAmount > 0) {
      status = "paid";
    } else if (amountPaid != null && amountPaid > 0) {
      status = "partial";
    } else if (existing.dueDate < todayIso()) {
      status = "overdue";
    } else {
      status = "upcoming";
    }
  }

  if (status === "paid" && (amountPaid == null || amountPaid <= 0)) {
    return res.status(400).json({ message: "Paid payments need an amount paid greater than zero." });
  }

  const nextAmountPaid: number | null =
    status === "paid" || status === "partial"
      ? Number(amountPaid ?? expectedAmount)
      : amountPaid == null
        ? null
        : Number(amountPaid);
  const nextPaidDate: string | null =
    status === "paid" || status === "partial"
      ? String(paidDate || todayIso())
      : paidDate
        ? String(paidDate)
        : null;
  await applyPaymentUpdate(existing, {
    expectedAmount,
    amountPaid: nextAmountPaid,
    paidDate: nextPaidDate,
    status,
    notes
  });

  return res.json({
    payment: mapMortgagePayment(existing.toObject()),
    message: "Payment updated."
  });
});

router.get("/", async (req: AuthedRequest, res) => {
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const filter: Record<string, unknown> = { userId: req.user!.id };
  if (propertyId) {
    filter.propertyId = propertyId;
  }

  const rows = await Mortgage.find(filter).sort({ status: 1, lender: 1 }).lean();
  for (const row of rows) {
    await ensureMortgageSchedule(String(row._id), req.user!.id);
  }
  await refreshMortgagePaymentStatuses(req.user!.id);

  const propertyIds = [...new Set(rows.map((r) => String(r.propertyId)))];
  const properties = await Property.find({ _id: { $in: propertyIds } }).lean();
  const propertyById = lookupProperties(properties);

  return res.json({
    mortgages: rows.map((r) => mapMortgage(r, propertyById.get(String(r.propertyId))))
  });
});

router.post("/", async (req: AuthedRequest, res) => {
  const propertyId = String(req.body?.propertyId || "");
  const property = await Property.findOne({ _id: propertyId, userId: req.user!.id });
  if (!property) {
    return res.status(400).json({ message: "Valid propertyId is required." });
  }

  const lender = String(req.body?.lender || "").trim();
  const originalLoanAmount = Number(req.body?.originalLoanAmount);
  const outstandingBalance = Number(req.body?.outstandingBalance ?? originalLoanAmount);
  const interestRate = Number(req.body?.interestRate);
  const monthlyRepayment = Number(req.body?.monthlyRepayment);
  const startDate = String(req.body?.startDate || "");
  const paymentDay = Number(req.body?.paymentDay ?? 1);

  if (!lender || !startDate || [originalLoanAmount, interestRate, monthlyRepayment].some(Number.isNaN)) {
    return res.status(400).json({
      message: "lender, originalLoanAmount, interestRate, monthlyRepayment, and startDate are required."
    });
  }

  const created = await Mortgage.create({
    propertyId,
    userId: req.user!.id,
    lender,
    originalLoanAmount,
    outstandingBalance,
    interestRate,
    mortgageType: String(req.body?.mortgageType || "repayment"),
    monthlyRepayment,
    paymentDay,
    startDate,
    endDate: req.body?.endDate || null,
    fixedRateExpiry: req.body?.fixedRateExpiry || null,
    notes: String(req.body?.notes || ""),
    status: "active"
  });

  await ensureMortgageSchedule(String(created._id), req.user!.id);
  await refreshMortgagePaymentStatuses(req.user!.id);

  return res.status(201).json({
    mortgage: mapMortgage(created.toObject(), property),
    message: "Mortgage created."
  });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await Mortgage.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Mortgage not found." });
  }

  if (req.body?.propertyId) {
    const propertyId = String(req.body.propertyId);
    const property = await Property.findOne({ _id: propertyId, userId: req.user!.id });
    if (!property) {
      return res.status(400).json({ message: "Valid propertyId is required." });
    }
    existing.propertyId = property._id;
  }

  existing.lender = String(req.body?.lender ?? existing.lender);
  existing.originalLoanAmount = Number(req.body?.originalLoanAmount ?? existing.originalLoanAmount);
  existing.outstandingBalance = Number(req.body?.outstandingBalance ?? existing.outstandingBalance);
  existing.interestRate = Number(req.body?.interestRate ?? existing.interestRate);
  existing.mortgageType = String(req.body?.mortgageType ?? existing.mortgageType);
  existing.monthlyRepayment = Number(req.body?.monthlyRepayment ?? existing.monthlyRepayment);
  existing.paymentDay = Number(req.body?.paymentDay ?? existing.paymentDay);
  existing.startDate = String(req.body?.startDate ?? existing.startDate);
  existing.endDate =
    req.body?.endDate !== undefined ? req.body.endDate || null : existing.endDate;
  existing.fixedRateExpiry =
    req.body?.fixedRateExpiry !== undefined
      ? req.body.fixedRateExpiry || null
      : existing.fixedRateExpiry;
  existing.notes = String(req.body?.notes ?? existing.notes ?? "");
  existing.status = String(req.body?.status ?? existing.status);
  await existing.save();

  await ensureMortgageSchedule(String(existing._id), req.user!.id);
  await refreshMortgagePaymentStatuses(req.user!.id);

  const property = await Property.findById(existing.propertyId).lean();
  return res.json({
    mortgage: mapMortgage(existing.toObject(), property),
    message: "Mortgage updated."
  });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await Mortgage.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Mortgage not found." });
  }

  await MortgagePayment.deleteMany({ mortgageId: existing._id, userId: req.user!.id });
  await existing.deleteOne();

  return res.json({ message: "Mortgage deleted." });
});

async function applyPaymentUpdate(
  existing: InstanceType<typeof MortgagePayment>,
  input: {
    expectedAmount?: number;
    amountPaid: number | null;
    paidDate: string | null;
    status: string;
    notes: string;
  }
): Promise<void> {
  const previousStatus = existing.status;
  const previousPaid = Number(existing.amountPaid || 0);
  const nextPaid = Number(input.amountPaid || 0);
  const wasPaid = previousStatus === "paid";
  const isPaid = input.status === "paid";

  if (input.expectedAmount != null && Number.isFinite(input.expectedAmount)) {
    existing.expectedAmount = input.expectedAmount;
  }
  existing.amountPaid = input.amountPaid;
  existing.paidDate = input.paidDate;
  existing.status = input.status;
  existing.notes = input.notes;
  await existing.save();

  let balanceDelta = 0;
  if (!wasPaid && isPaid) {
    balanceDelta = -nextPaid;
  } else if (wasPaid && !isPaid) {
    balanceDelta = previousPaid;
  } else if (wasPaid && isPaid) {
    balanceDelta = previousPaid - nextPaid;
  }

  if (balanceDelta !== 0) {
    const mortgage = await Mortgage.findOne({ _id: existing.mortgageId, userId: existing.userId });
    if (mortgage) {
      mortgage.outstandingBalance = Math.max(0, mortgage.outstandingBalance + balanceDelta);
      await mortgage.save();
    }
  }
}

export default router;
