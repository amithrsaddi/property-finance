import mongoose from "mongoose";
import { normalizeDecimalPrecision } from "./auth.js";
import { decodeFileData, fileBuffer } from "./files.js";
import {
  Expense,
  Mortgage,
  MortgagePayment,
  Property,
  PropertyDocument,
  DocumentFolder,
  RentPayment,
  User
} from "./models.js";

export const BACKUP_APP = "property-finance";
export const BACKUP_VERSION = 1;

type IdMap = Map<string, mongoose.Types.ObjectId>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<
    string,
    unknown
  >[];
}

function idOf(row: Record<string, unknown>): string {
  return String(row.id || row._id || "").trim();
}

function isoDate(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toBase64(value: unknown): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  if (typeof value === "string") {
    return value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  }
  try {
    const buffer = fileBuffer(value);
    return buffer.length ? buffer.toString("base64") : undefined;
  } catch {
    return undefined;
  }
}

function seedIds(rows: Record<string, unknown>[], map: IdMap): void {
  for (const row of rows) {
    const oldId = idOf(row);
    if (oldId && !map.has(oldId)) {
      map.set(oldId, new mongoose.Types.ObjectId());
    }
  }
}

function mappedId(oldId: string, map: IdMap): mongoose.Types.ObjectId {
  const existing = map.get(oldId);
  if (existing) {
    return existing;
  }
  const created = new mongoose.Types.ObjectId();
  if (oldId) {
    map.set(oldId, created);
  }
  return created;
}

function mappedRef(raw: unknown, map: IdMap): mongoose.Types.ObjectId | null {
  const oldId = String(raw || "").trim();
  if (!oldId) {
    return null;
  }
  return map.get(oldId) || null;
}

export async function exportUserBackup(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new Error("User not found.");
  }

  const [properties, folders, documents, mortgages, mortgagePayments, rentPayments, expenses] =
    await Promise.all([
      Property.find({ userId }).select("+imageData").lean(),
      DocumentFolder.find({ userId }).lean(),
      PropertyDocument.find({ userId }).select("+fileData").lean(),
      Mortgage.find({ userId }).lean(),
      MortgagePayment.find({ userId }).lean(),
      RentPayment.find({ userId }).lean(),
      Expense.find({ userId }).lean()
    ]);

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      name: user.name,
      preferredCurrency: user.preferredCurrency,
      decimalPrecision: normalizeDecimalPrecision(user.decimalPrecision)
    },
    properties: properties.map((row) => ({
      id: String(row._id),
      name: row.name,
      address: row.address ?? "",
      propertyType: row.propertyType ?? "residential",
      purchasePrice: row.purchasePrice ?? null,
      purchaseDate: row.purchaseDate ?? null,
      currentValue: row.currentValue ?? null,
      ownershipPercentage: row.ownershipPercentage ?? 100,
      expectedMonthlyRent: row.expectedMonthlyRent ?? 0,
      notes: row.notes ?? "",
      status: row.status ?? "active",
      hasImage: Boolean(row.hasImage),
      imageMimeType: row.imageMimeType ?? "",
      imageData: toBase64(row.imageData),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    folders: folders.map((row) => ({
      id: String(row._id),
      parentId: row.parentId ? String(row.parentId) : null,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    documents: documents.map((row) => ({
      id: String(row._id),
      propertyId: row.propertyId ? String(row.propertyId) : null,
      folderId: row.folderId ? String(row.folderId) : null,
      scope: row.scope ?? "general",
      name: row.name,
      validFrom: row.validFrom ?? null,
      validUntil: row.validUntil ?? null,
      important: Boolean(row.important),
      originalFilename: row.originalFilename ?? "",
      mimeType: row.mimeType ?? "application/octet-stream",
      fileSize: row.fileSize ?? 0,
      fileData: toBase64(row.fileData),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    mortgages: mortgages.map((row) => ({
      id: String(row._id),
      propertyId: String(row.propertyId),
      lender: row.lender,
      originalLoanAmount: row.originalLoanAmount,
      outstandingBalance: row.outstandingBalance,
      interestRate: row.interestRate,
      mortgageType: row.mortgageType ?? "repayment",
      monthlyRepayment: row.monthlyRepayment,
      paymentDay: row.paymentDay ?? 1,
      startDate: row.startDate,
      endDate: row.endDate ?? null,
      fixedRateExpiry: row.fixedRateExpiry ?? null,
      notes: row.notes ?? "",
      status: row.status ?? "active",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    mortgagePayments: mortgagePayments.map((row) => ({
      id: String(row._id),
      mortgageId: String(row.mortgageId),
      dueDate: row.dueDate,
      expectedAmount: row.expectedAmount,
      amountPaid: row.amountPaid ?? null,
      paidDate: row.paidDate ?? null,
      status: row.status ?? "upcoming",
      notes: row.notes ?? "",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    rentPayments: rentPayments.map((row) => ({
      id: String(row._id),
      propertyId: String(row.propertyId),
      rentalPeriod: row.rentalPeriod,
      expectedAmount: row.expectedAmount,
      amountReceived: row.amountReceived ?? 0,
      expectedPaymentDate: row.expectedPaymentDate,
      actualPaymentDate: row.actualPaymentDate ?? null,
      status: row.status ?? "upcoming",
      notes: row.notes ?? "",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    expenses: expenses.map((row) => ({
      id: String(row._id),
      propertyId: row.propertyId ? String(row.propertyId) : null,
      documentId: row.documentId ? String(row.documentId) : null,
      scope: row.scope ?? "property",
      category: row.category,
      description: row.description ?? "",
      amount: row.amount,
      expenseDate: row.expenseDate,
      paymentStatus: row.paymentStatus ?? "paid",
      frequency: row.frequency ?? "one_off",
      notes: row.notes ?? "",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
  };
}

export function parseBackupPayload(body: unknown): Record<string, unknown> {
  const root = asRecord(body);
  const nested = asRecord(root.backup);
  const payload = root.app === BACKUP_APP ? root : nested.app === BACKUP_APP ? nested : root;
  if (payload.app !== BACKUP_APP) {
    throw new Error("This file is not a Property Finance backup.");
  }
  const version = Number(payload.version);
  if (version !== BACKUP_VERSION) {
    throw new Error("This backup version is not supported.");
  }
  return payload;
}

export async function restoreUserBackup(userId: string, payload: Record<string, unknown>) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const properties = asList(payload.properties);
  const folders = asList(payload.folders);
  const documents = asList(payload.documents);
  const mortgages = asList(payload.mortgages);
  const mortgagePayments = asList(payload.mortgagePayments);
  const rentPayments = asList(payload.rentPayments);
  const expenses = asList(payload.expenses);
  const settings = asRecord(payload.settings);

  const propertyIds: IdMap = new Map();
  const folderIds: IdMap = new Map();
  const documentIds: IdMap = new Map();
  const mortgageIds: IdMap = new Map();
  const owner = new mongoose.Types.ObjectId(userId);

  seedIds(properties, propertyIds);
  seedIds(folders, folderIds);
  seedIds(documents, documentIds);
  seedIds(mortgages, mortgageIds);

  const propertyDocs = properties
    .filter((row) => String(row.name || "").trim())
    .map((row) => {
      const imageData = decodeFileData(row.imageData);
      return {
        _id: mappedId(idOf(row), propertyIds),
        userId: owner,
        name: String(row.name).trim(),
        address: String(row.address || ""),
        propertyType: String(row.propertyType || "residential"),
        purchasePrice: row.purchasePrice ?? null,
        purchaseDate: row.purchaseDate || null,
        currentValue: row.currentValue ?? null,
        ownershipPercentage: Number(row.ownershipPercentage ?? 100),
        expectedMonthlyRent: Number(row.expectedMonthlyRent ?? 0),
        notes: String(row.notes || ""),
        status: String(row.status || "active"),
        hasImage: Boolean(imageData),
        imageMimeType: imageData ? String(row.imageMimeType || "image/jpeg") : "",
        imageData,
        createdAt: isoDate(row.createdAt),
        updatedAt: isoDate(row.updatedAt)
      };
    });

  const folderDocs = folders
    .filter((row) => String(row.name || "").trim())
    .map((row) => ({
      _id: mappedId(idOf(row), folderIds),
      userId: owner,
      parentId: mappedRef(row.parentId, folderIds),
      name: String(row.name).trim(),
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt)
    }));

  const documentDocs = documents
    .filter((row) => String(row.name || "").trim())
    .map((row) => {
      const fileData = decodeFileData(row.fileData);
      return {
        _id: mappedId(idOf(row), documentIds),
        userId: owner,
        propertyId: mappedRef(row.propertyId, propertyIds),
        folderId: mappedRef(row.folderId, folderIds),
        scope: String(row.scope || "general"),
        name: String(row.name).trim(),
        validFrom: row.validFrom || null,
        validUntil: row.validUntil || null,
        important: Boolean(row.important),
        originalFilename: String(row.originalFilename || ""),
        mimeType: String(row.mimeType || "application/octet-stream"),
        fileSize: fileData?.length || Number(row.fileSize || 0),
        fileData,
        createdAt: isoDate(row.createdAt),
        updatedAt: isoDate(row.updatedAt)
      };
    });

  const mortgageDocs = mortgages
    .filter((row) => mappedRef(row.propertyId, propertyIds) && String(row.lender || "").trim())
    .map((row) => ({
      _id: mappedId(idOf(row), mortgageIds),
      userId: owner,
      propertyId: mappedRef(row.propertyId, propertyIds),
      lender: String(row.lender).trim(),
      originalLoanAmount: Number(row.originalLoanAmount || 0),
      outstandingBalance: Number(row.outstandingBalance || 0),
      interestRate: Number(row.interestRate || 0),
      mortgageType: String(row.mortgageType || "repayment"),
      monthlyRepayment: Number(row.monthlyRepayment || 0),
      paymentDay: Number(row.paymentDay || 1),
      startDate: String(row.startDate || ""),
      endDate: row.endDate || null,
      fixedRateExpiry: row.fixedRateExpiry || null,
      notes: String(row.notes || ""),
      status: String(row.status || "active"),
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt)
    }));

  const mortgagePaymentDocs = mortgagePayments
    .filter((row) => mappedRef(row.mortgageId, mortgageIds) && String(row.dueDate || "").trim())
    .map((row) => ({
      _id: new mongoose.Types.ObjectId(),
      userId: owner,
      mortgageId: mappedRef(row.mortgageId, mortgageIds),
      dueDate: String(row.dueDate),
      expectedAmount: Number(row.expectedAmount || 0),
      amountPaid: row.amountPaid ?? null,
      paidDate: row.paidDate || null,
      status: String(row.status || "upcoming"),
      notes: String(row.notes || ""),
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt)
    }));

  const rentDocs = rentPayments
    .filter((row) => mappedRef(row.propertyId, propertyIds) && String(row.rentalPeriod || "").trim())
    .map((row) => ({
      _id: new mongoose.Types.ObjectId(),
      userId: owner,
      propertyId: mappedRef(row.propertyId, propertyIds),
      rentalPeriod: String(row.rentalPeriod),
      expectedAmount: Number(row.expectedAmount || 0),
      amountReceived: Number(row.amountReceived || 0),
      expectedPaymentDate: String(row.expectedPaymentDate || ""),
      actualPaymentDate: row.actualPaymentDate || null,
      status: String(row.status || "upcoming"),
      notes: String(row.notes || ""),
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt)
    }));

  const expenseDocs = expenses
    .filter((row) => String(row.category || "").trim() && Number.isFinite(Number(row.amount)))
    .map((row) => ({
      _id: new mongoose.Types.ObjectId(),
      userId: owner,
      propertyId: mappedRef(row.propertyId, propertyIds),
      documentId: mappedRef(row.documentId, documentIds),
      scope: String(row.scope || "property"),
      category: String(row.category).trim(),
      description: String(row.description || ""),
      amount: Number(row.amount),
      expenseDate: String(row.expenseDate || ""),
      paymentStatus: String(row.paymentStatus || "paid"),
      frequency: String(row.frequency || "one_off"),
      notes: String(row.notes || ""),
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt)
    }));

  await Promise.all([
    Property.deleteMany({ userId }),
    DocumentFolder.deleteMany({ userId }),
    PropertyDocument.deleteMany({ userId }),
    Mortgage.deleteMany({ userId }),
    MortgagePayment.deleteMany({ userId }),
    RentPayment.deleteMany({ userId }),
    Expense.deleteMany({ userId })
  ]);

  if (propertyDocs.length) {
    await Property.insertMany(propertyDocs, { ordered: false });
  }
  if (folderDocs.length) {
    await DocumentFolder.insertMany(folderDocs, { ordered: false });
  }
  if (documentDocs.length) {
    await PropertyDocument.insertMany(documentDocs, { ordered: false });
  }
  if (mortgageDocs.length) {
    await Mortgage.insertMany(mortgageDocs, { ordered: false });
  }
  if (mortgagePaymentDocs.length) {
    await MortgagePayment.insertMany(mortgagePaymentDocs, { ordered: false });
  }
  if (rentDocs.length) {
    await RentPayment.insertMany(rentDocs, { ordered: false });
  }
  if (expenseDocs.length) {
    await Expense.insertMany(expenseDocs, { ordered: false });
  }

  if (settings.name !== undefined) {
    const name = String(settings.name || "").trim();
    if (name) {
      user.name = name;
    }
  }
  if (settings.preferredCurrency !== undefined) {
    const currency = String(settings.preferredCurrency || "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(currency)) {
      user.preferredCurrency = currency;
    }
  }
  if (settings.decimalPrecision !== undefined) {
    user.decimalPrecision = normalizeDecimalPrecision(settings.decimalPrecision);
  }
  await user.save();

  return {
    properties: propertyDocs.length,
    folders: folderDocs.length,
    documents: documentDocs.length,
    mortgages: mortgageDocs.length,
    mortgagePayments: mortgagePaymentDocs.length,
    rentPayments: rentDocs.length,
    expenses: expenseDocs.length
  };
}
