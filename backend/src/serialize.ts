export function idOf(doc: { _id?: { toString(): string } | string; id?: string } | null | undefined): string {
  if (!doc) {
    return "";
  }
  if (doc.id) {
    return String(doc.id);
  }
  if (doc._id) {
    return String(doc._id);
  }
  return "";
}

export function mapProperty(doc: Record<string, unknown> & { _id?: { toString(): string } }) {
  return {
    id: idOf(doc),
    userId: String(doc.userId ?? ""),
    name: doc.name,
    address: doc.address ?? "",
    propertyType: doc.propertyType ?? "residential",
    purchasePrice: doc.purchasePrice ?? null,
    purchaseDate: doc.purchaseDate ?? null,
    currentValue: doc.currentValue ?? null,
    ownershipPercentage: doc.ownershipPercentage ?? 100,
    expectedMonthlyRent: doc.expectedMonthlyRent ?? 0,
    notes: doc.notes ?? "",
    status: doc.status ?? "active",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

export function mapRentPayment(
  doc: Record<string, unknown> & { _id?: { toString(): string } },
  propertyName?: string
) {
  return {
    id: idOf(doc),
    property_id: String(doc.propertyId ?? ""),
    property_name: propertyName ?? doc.property_name ?? "",
    user_id: String(doc.userId ?? ""),
    rental_period: doc.rentalPeriod,
    expected_amount: doc.expectedAmount,
    amount_received: doc.amountReceived ?? 0,
    expected_payment_date: doc.expectedPaymentDate,
    actual_payment_date: doc.actualPaymentDate ?? null,
    status: doc.status,
    notes: doc.notes ?? ""
  };
}

export function mapMortgage(
  doc: Record<string, unknown> & { _id?: { toString(): string } },
  propertyName?: string
) {
  return {
    id: idOf(doc),
    property_id: String(doc.propertyId ?? ""),
    property_name: propertyName ?? "",
    user_id: String(doc.userId ?? ""),
    lender: doc.lender,
    original_loan_amount: doc.originalLoanAmount,
    outstanding_balance: doc.outstandingBalance,
    interest_rate: doc.interestRate,
    mortgage_type: doc.mortgageType,
    monthly_repayment: doc.monthlyRepayment,
    payment_day: doc.paymentDay,
    start_date: doc.startDate,
    end_date: doc.endDate ?? null,
    fixed_rate_expiry: doc.fixedRateExpiry ?? null,
    notes: doc.notes ?? "",
    status: doc.status
  };
}

export function mapMortgagePayment(
  doc: Record<string, unknown> & { _id?: { toString(): string } },
  extras: { lender?: string; property_id?: string; property_name?: string } = {}
) {
  return {
    id: idOf(doc),
    mortgage_id: String(doc.mortgageId ?? ""),
    user_id: String(doc.userId ?? ""),
    due_date: doc.dueDate,
    expected_amount: doc.expectedAmount,
    amount_paid: doc.amountPaid ?? null,
    paid_date: doc.paidDate ?? null,
    status: doc.status,
    notes: doc.notes ?? "",
    lender: extras.lender ?? doc.lender ?? "",
    property_id: extras.property_id ?? String(doc.propertyId ?? ""),
    property_name: extras.property_name ?? doc.property_name ?? ""
  };
}

export function mapExpense(
  doc: Record<string, unknown> & { _id?: { toString(): string } },
  propertyName?: string | null,
  extras: { documentName?: string | null } = {}
) {
  return {
    id: idOf(doc),
    user_id: String(doc.userId ?? ""),
    property_id: doc.propertyId ? String(doc.propertyId) : null,
    property_name: propertyName ?? null,
    scope: doc.scope,
    category: doc.category,
    description: doc.description ?? "",
    amount: doc.amount,
    expense_date: doc.expenseDate,
    payment_status: doc.paymentStatus,
    frequency: doc.frequency,
    notes: doc.notes ?? "",
    document_id: doc.documentId ? String(doc.documentId) : null,
    has_document: Boolean(doc.documentId),
    document_name: extras.documentName ?? null
  };
}

export function mapDocument(
  doc: Record<string, unknown> & { _id?: { toString(): string } },
  propertyName?: string | null
) {
  return {
    id: idOf(doc),
    user_id: String(doc.userId ?? ""),
    property_id: doc.propertyId ? String(doc.propertyId) : null,
    property_name: propertyName ?? null,
    scope: doc.scope === "property" ? "property" : "general",
    name: doc.name,
    valid_until: doc.validUntil ?? null,
    original_filename: doc.originalFilename ?? "",
    mime_type: doc.mimeType ?? "application/octet-stream",
    file_size: Number(doc.fileSize || 0),
    created_at: doc.createdAt ?? null,
    updated_at: doc.updatedAt ?? null
  };
}
