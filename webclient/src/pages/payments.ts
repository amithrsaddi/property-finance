import { api, getUser, money, qs, statusClass, labelize } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const root = mountShell(
  "/payments.html",
  "Payments",
  "Upcoming, current, and past mortgage payments."
);
const user = getUser()!;
const presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";

root.innerHTML = `
  <section class="panel">
    <div class="list-toolbar">
      <div class="filters" style="margin:0;flex:1">
        <div class="field"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        <div class="actions" style="align-self:end"><button class="btn secondary" id="refresh" type="button">Refresh</button></div>
      </div>
      <div class="status" id="status" style="margin:0;min-width:12rem" hidden></div>
    </div>
    <div class="tabs" id="view-tabs">
      <button class="tab active" data-view="upcoming" type="button">Upcoming</button>
      <button class="tab" data-view="current" type="button">Current</button>
      <button class="tab" data-view="past" type="button">Past</button>
      <button class="tab" data-view="mortgages" type="button">Mortgages</button>
    </div>
    <div class="property-list" id="content"></div>
  </section>

  <div class="modal-backdrop" id="payment-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="payment-form-title">
      <div class="modal-header">
        <h2 id="payment-form-title">Edit payment</h2>
        <button class="modal-close" id="close-payment-modal" type="button" aria-label="Close">×</button>
      </div>
      <form id="payment-form" class="stack">
        <input type="hidden" name="id" />
        <div class="form-grid">
          <div class="field"><label>Property</label><input name="propertyName" disabled /></div>
          <div class="field"><label>Lender</label><input name="lender" disabled /></div>
          <div class="field"><label>Due date</label><input name="dueDate" type="date" disabled /></div>
          <div class="field"><label>Expected amount</label><input name="expectedAmount" type="number" step="0.01" required /></div>
          <div class="field"><label>Amount paid</label><input name="amountPaid" type="number" step="0.01" /></div>
          <div class="field"><label>Paid date</label><input name="paidDate" type="date" /></div>
          <div class="field"><label>Status</label>
            <select name="status">
              <option value="upcoming">Upcoming</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes"></textarea></div>
        </div>
        <div class="status" id="payment-form-status" hidden></div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-payment-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save payment</button>
        </div>
      </form>
    </div>
  </div>
`;

type Views = {
  upcoming: Array<Record<string, unknown>>;
  current: Array<Record<string, unknown>>;
  past: Array<Record<string, unknown>>;
  activeMortgages: Array<Record<string, unknown>>;
};

let views: Views | null = null;
let activeView: "upcoming" | "current" | "past" | "mortgages" = "upcoming";

const paymentModal = document.getElementById("payment-modal") as HTMLDivElement;
const paymentForm = document.getElementById("payment-form") as HTMLFormElement;

function openBackdrop(el: HTMLDivElement): void {
  el.hidden = false;
  document.body.classList.add("modal-open");
}

function closeBackdrop(el: HTMLDivElement): void {
  el.hidden = true;
  if (paymentModal.hidden) {
    document.body.classList.remove("modal-open");
  }
}

function field<T extends HTMLElement>(form: HTMLFormElement, name: string): T {
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) {
    throw new Error(`Missing form field: ${name}`);
  }
  return el as T;
}

async function loadProperties(): Promise<void> {
  const data = await api<{ properties: Array<{ id: string; name: string }> }>(
    `/properties${qs({ status: "active" })}`
  );
  const filter = document.getElementById("filterProperty") as HTMLSelectElement;
  for (const property of data.properties) {
    const option = document.createElement("option");
    option.value = String(property.id);
    option.textContent = property.name;
    filter.appendChild(option);
  }
  if (presetPropertyId) {
    filter.value = presetPropertyId;
  }
}

async function loadViews(): Promise<void> {
  const propertyId = (document.getElementById("filterProperty") as HTMLSelectElement).value;
  views = await api(`/mortgages/payments/views${qs({ propertyId })}`);
  render();
}

function render(): void {
  if (!views) {
    return;
  }
  document.querySelectorAll("#view-tabs .tab").forEach((el) => {
    el.classList.toggle("active", (el as HTMLElement).dataset.view === activeView);
  });
  const content = document.getElementById("content")!;

  if (activeView === "mortgages") {
    content.innerHTML = mortgageList(views.activeMortgages);
    return;
  }

  const rows = views[activeView];
  content.innerHTML = paymentList(rows);
  content.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((r) => String(r.id || r._id) === String(button.dataset.edit));
      if (row) {
        openPaymentEditor(row, button.dataset.mode === "pay");
      }
    });
  });
}

function paymentList(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return `<p class="empty">No payments in this view.</p>`;
  }
  return rows
    .map(
      (r) => `<article class="property-row">
        <div class="property-row-main">
          <div class="property-row-title">
            <strong>${r.property_name}</strong>
            <span class="badge ${statusClass(String(r.status))}">${labelize(String(r.status))}</span>
          </div>
          <div class="muted">${r.lender} · Due ${r.due_date}</div>
          <div class="property-row-meta">
            <span>Expected ${money(Number(r.expected_amount), user.preferredCurrency)}</span>
            <span>Paid ${r.amount_paid != null ? money(Number(r.amount_paid), user.preferredCurrency) : "-"}</span>
            <span>Paid date ${r.paid_date || "-"}</span>
          </div>
        </div>
        <div class="property-row-actions actions">
          <button class="btn ghost" data-edit="${r.id || r._id}" data-mode="edit" type="button">Edit</button>
          ${
            r.status === "paid"
              ? ""
              : `<button class="btn secondary" data-edit="${r.id || r._id}" data-mode="pay" type="button">Mark paid</button>`
          }
        </div>
      </article>`
    )
    .join("");
}

function mortgageList(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return `<p class="empty">No active mortgages. Add one from <a href="/rates.html">Rates</a>.</p>`;
  }
  return rows
    .map(
      (m) => `<article class="property-row">
        <div class="property-row-main">
          <div class="property-row-title">
            <strong>${m.property_name}</strong>
            <span class="badge ok">Active</span>
          </div>
          <div class="muted">${m.lender}</div>
          <div class="property-row-meta">
            <span>Balance ${money(Number(m.outstanding_balance), user.preferredCurrency)}</span>
            <span>Rate ${m.interest_rate}%</span>
            <span>Monthly ${money(Number(m.monthly_repayment), user.preferredCurrency)}</span>
            <span>Fixed expiry ${m.fixed_rate_expiry || "-"}</span>
          </div>
        </div>
      </article>`
    )
    .join("");
}

function formStatusEl(): HTMLElement | null {
  return document.getElementById("payment-form-status");
}

function isoDate(value: unknown): string {
  const raw = String(value || "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : "";
}

function openPaymentEditor(row: Record<string, unknown>, markPaid: boolean): void {
  document.getElementById("payment-form-title")!.textContent = markPaid
    ? "Mark payment as paid"
    : "Edit payment";
  field<HTMLInputElement>(paymentForm, "id").value = String(row.id || row._id || "");
  field<HTMLInputElement>(paymentForm, "propertyName").value = String(row.property_name || "");
  field<HTMLInputElement>(paymentForm, "lender").value = String(row.lender || "");
  field<HTMLInputElement>(paymentForm, "dueDate").value = isoDate(row.due_date);
  field<HTMLInputElement>(paymentForm, "expectedAmount").value = String(row.expected_amount ?? "");
  field<HTMLInputElement>(paymentForm, "amountPaid").value = markPaid
    ? String(row.expected_amount ?? "")
    : row.amount_paid != null
      ? String(row.amount_paid)
      : "";
  field<HTMLInputElement>(paymentForm, "paidDate").value = markPaid
    ? new Date().toISOString().slice(0, 10)
    : isoDate(row.paid_date);
  field<HTMLSelectElement>(paymentForm, "status").value = markPaid
    ? "paid"
    : String(row.status || "upcoming");
  field<HTMLTextAreaElement>(paymentForm, "notes").value = String(row.notes || "");
  setStatus(formStatusEl(), "", "info");
  openBackdrop(paymentModal);
}

function syncPaidFields(): void {
  const status = field<HTMLSelectElement>(paymentForm, "status").value;
  const amountPaid = field<HTMLInputElement>(paymentForm, "amountPaid");
  const paidDate = field<HTMLInputElement>(paymentForm, "paidDate");
  const expectedAmount = field<HTMLInputElement>(paymentForm, "expectedAmount").value;
  if (status === "paid" || status === "partial") {
    if (!amountPaid.value && expectedAmount) {
      amountPaid.value = expectedAmount;
    }
    if (!paidDate.value) {
      paidDate.value = new Date().toISOString().slice(0, 10);
    }
  }
}

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const paymentId = String(field<HTMLInputElement>(paymentForm, "id").value || "").trim();
  if (!paymentId || paymentId === "undefined") {
    setStatus(formStatusEl(), "Missing payment id. Re-open Edit and try again.", "error");
    return;
  }
  syncPaidFields();
  const expectedAmount = Number(field<HTMLInputElement>(paymentForm, "expectedAmount").value);
  const amountPaidRaw = field<HTMLInputElement>(paymentForm, "amountPaid").value.trim();
  const status = field<HTMLSelectElement>(paymentForm, "status").value || "upcoming";
  const amountPaid = amountPaidRaw === "" ? null : Number(amountPaidRaw);
  try {
    await api(`/mortgages/payments/${paymentId}`, {
      method: "PUT",
      body: JSON.stringify({
        expectedAmount,
        amountPaid,
        paidDate: field<HTMLInputElement>(paymentForm, "paidDate").value || null,
        status,
        notes: field<HTMLTextAreaElement>(paymentForm, "notes").value
      })
    });
    setStatus(document.getElementById("status"), "Payment updated.", "success");
    closeBackdrop(paymentModal);
    if (status === "paid" && activeView === "upcoming") {
      activeView = "past";
    }
    await loadViews();
  } catch (error) {
    setStatus(formStatusEl(), (error as Error).message, "error");
  }
});

field<HTMLSelectElement>(paymentForm, "status").addEventListener("change", syncPaidFields);

document.getElementById("close-payment-modal")?.addEventListener("click", () => closeBackdrop(paymentModal));
document.getElementById("cancel-payment-modal")?.addEventListener("click", () => closeBackdrop(paymentModal));
paymentModal.addEventListener("click", (event) => {
  if (event.target === paymentModal) {
    closeBackdrop(paymentModal);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !paymentModal.hidden) {
    closeBackdrop(paymentModal);
  }
});
document.getElementById("view-tabs")?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (
    target.dataset.view === "upcoming" ||
    target.dataset.view === "current" ||
    target.dataset.view === "past" ||
    target.dataset.view === "mortgages"
  ) {
    activeView = target.dataset.view;
    render();
  }
});
document.getElementById("refresh")?.addEventListener("click", () => {
  void loadViews();
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadViews();
});

void (async () => {
  await loadProperties();
  await loadViews();
})();
