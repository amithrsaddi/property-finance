import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    preferredCurrency: { type: String, required: true, default: "GBP" },
    decimalPrecision: { type: Number, default: 2, min: 0, max: 4 }
  },
  { timestamps: true }
);

const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const propertySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    propertyType: { type: String, default: "residential" },
    purchasePrice: { type: Number, default: null },
    purchaseDate: { type: String, default: null },
    currentValue: { type: Number, default: null },
    ownershipPercentage: { type: Number, default: 100 },
    expectedMonthlyRent: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    status: { type: String, default: "active", index: true },
    hasImage: { type: Boolean, default: false },
    imageMimeType: { type: String, default: "" },
    imageData: { type: Buffer, select: false }
  },
  { timestamps: true }
);

const rentPaymentSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rentalPeriod: { type: String, required: true },
    expectedAmount: { type: Number, required: true },
    amountReceived: { type: Number, default: 0 },
    expectedPaymentDate: { type: String, required: true, index: true },
    actualPaymentDate: { type: String, default: null },
    status: { type: String, default: "upcoming", index: true },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

const mortgageSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lender: { type: String, required: true },
    originalLoanAmount: { type: Number, required: true },
    outstandingBalance: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    mortgageType: { type: String, default: "repayment" },
    monthlyRepayment: { type: Number, required: true },
    paymentDay: { type: Number, default: 1 },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    fixedRateExpiry: { type: String, default: null },
    notes: { type: String, default: "" },
    status: { type: String, default: "active", index: true }
  },
  { timestamps: true }
);

const mortgagePaymentSchema = new Schema(
  {
    mortgageId: { type: Schema.Types.ObjectId, ref: "Mortgage", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dueDate: { type: String, required: true, index: true },
    expectedAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: null },
    paidDate: { type: String, default: null },
    status: { type: String, default: "upcoming", index: true },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

mortgagePaymentSchema.index({ mortgageId: 1, dueDate: 1 }, { unique: true });

const documentFolderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "DocumentFolder", default: null, index: true },
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

const expenseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", default: null, index: true },
    scope: { type: String, default: "property", index: true },
    category: { type: String, required: true },
    description: { type: String, default: "" },
    amount: { type: Number, required: true },
    expenseDate: { type: String, required: true, index: true },
    paymentStatus: { type: String, default: "paid" },
    frequency: { type: String, default: "one_off" },
    notes: { type: String, default: "" },
    documentId: { type: Schema.Types.ObjectId, ref: "PropertyDocument", default: null }
  },
  { timestamps: true }
);

const documentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", default: null, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: "DocumentFolder", default: null, index: true },
    scope: { type: String, default: "general", index: true },
    name: { type: String, required: true, trim: true },
    validFrom: { type: String, default: null },
    validUntil: { type: String, default: null },
    important: { type: Boolean, default: false, index: true },
    originalFilename: { type: String, default: "" },
    mimeType: { type: String, default: "application/octet-stream" },
    fileSize: { type: Number, default: 0 },
    fileData: { type: Buffer, select: false }
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export type PropertyDoc = InferSchemaType<typeof propertySchema> & { _id: mongoose.Types.ObjectId };
export type RentPaymentDoc = InferSchemaType<typeof rentPaymentSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type MortgageDoc = InferSchemaType<typeof mortgageSchema> & { _id: mongoose.Types.ObjectId };
export type MortgagePaymentDoc = InferSchemaType<typeof mortgagePaymentSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & { _id: mongoose.Types.ObjectId };
export type DocumentFolderDoc = InferSchemaType<typeof documentFolderSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type DocumentDoc = InferSchemaType<typeof documentSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  mongoose.models.User || mongoose.model<UserDoc>("User", userSchema);
export const PasswordResetToken =
  mongoose.models.PasswordResetToken ||
  mongoose.model("PasswordResetToken", passwordResetSchema);
export const Property: Model<PropertyDoc> =
  mongoose.models.Property || mongoose.model<PropertyDoc>("Property", propertySchema);
export const RentPayment: Model<RentPaymentDoc> =
  mongoose.models.RentPayment || mongoose.model<RentPaymentDoc>("RentPayment", rentPaymentSchema);
export const Mortgage: Model<MortgageDoc> =
  mongoose.models.Mortgage || mongoose.model<MortgageDoc>("Mortgage", mortgageSchema);
export const MortgagePayment: Model<MortgagePaymentDoc> =
  mongoose.models.MortgagePayment ||
  mongoose.model<MortgagePaymentDoc>("MortgagePayment", mortgagePaymentSchema);
export const Expense: Model<ExpenseDoc> =
  mongoose.models.Expense || mongoose.model<ExpenseDoc>("Expense", expenseSchema);
export const DocumentFolder: Model<DocumentFolderDoc> =
  mongoose.models.DocumentFolder ||
  mongoose.model<DocumentFolderDoc>("DocumentFolder", documentFolderSchema);
export const PropertyDocument: Model<DocumentDoc> =
  mongoose.models.PropertyDocument ||
  mongoose.model<DocumentDoc>("PropertyDocument", documentSchema);
