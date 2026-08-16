import { api, formatDateDmY, getUser, money, qs, labelize } from "../lib.js";
import {
  bindListChrome,
  bindRowMenus,
  matchesQuery,
  renderDataList,
  searchFieldHtml,
  sortFieldHtml,
  viewToggleHtml,
  type ListViewMode
} from "../list-view.js";
import { mountShell, setStatus } from "../shell.js";

const VIEW_KEY = "pf-payments-view";
const root = mountShell(
  "/payments.html",
  "Payments",
  "Upcoming, current, and past mortgage payments."
);
const user = getUser()!;
const presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";

root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="table-toolbar-start">
        <div class="seg-tabs" id="view-tabs">
          <button class="seg-tab active" data-view="upcoming" type="button">Upcoming</button>
          <button class="seg-tab" data-view="current" type="button">Current</button>
          <button class="seg-tab" data-view="past" type="button">Past</button>
          <button class="seg-tab" data-view="mortgages" type="button">Mortgages</button>
        </div>
        <div class="table-filters">
          <div class="field"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        </div>
      </div>
      <div class="table-toolbar-end">
        ${sortFieldHtml([
          { value: "due", label: "Due date" },
          { value: "name", label: "Name" },
          { value: "amount", label: "Amount" }
        ])}
        ${searchFieldHtml()}
        ${viewToggleHtml(sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list")}
      </div>
    </div>
    <div class="status" id="status" hidden></div>
    <div id="content"></div>
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
let search = "";
let sortBy = "due";
let view: ListViewMode = sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
let openMenuId: string | null = null;

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

function sortRows(rows: Array<Record<string, unknown>>, keys: string[]): Array<Record<string, unknown>> {
  const filtered = rows.filter((row) => matchesQuery(row, search, keys));
  filtered.sort((a, b) => {
    if (sortBy === "name") {
      return String(a.property_name || "").localeCompare(String(b.property_name || ""), "en-GB");
    }
    if (sortBy === "amount") {
      const aAmount = Number(a.expected_amount ?? a.outstanding_balance ?? 0);
      const bAmount = Number(b.expected_amount ?? b.outstanding_balance ?? 0);
      return bAmount - aAmount;
    }
    return String(a.due_date || a.fixed_rate_expiry || "").localeCompare(
      String(b.due_date || b.fixed_rate_expiry || "")
    );
  });
  return filtered;
}

function render(): void {
  if (!views) {
    return;
  }
  document.querySelectorAll("#view-tabs .seg-tab").forEach((el) => {
    el.classList.toggle("active", (el as HTMLElement).dataset.view === activeView);
  });
  const content = document.getElementById("content")!;

  if (activeView === "mortgages") {
    const rows = sortRows(views.activeMortgages, ["property_name", "lender", "status"]);
    content.innerHTML = renderDataList(
      rows.map((m) => ({
        id: String(m.id || m._id || m.property_name),
        title: String(m.property_name || "Property"),
        subtitle: String(m.lender || "Lender"),
        href: m.property_id ? `/property.html?id=${m.property_id}` : undefined,
        status: "active",
        statusLabel: "Active",
        summaryTitle: `Balance ${money(Number(m.outstanding_balance), user.preferredCurrency)}`,
        summarySub: `Rate ${m.interest_rate}% · Monthly ${money(Number(m.monthly_repayment), user.preferredCurrency)}`
      })),
      view,
      `No active mortgages. Add one from <a href="/rates.html">Rates</a>.`,
      null
    );
    return;
  }

  const source = views[activeView];
  const rows = sortRows(source, ["property_name", "lender", "status", "notes"]);
  content.innerHTML = renderDataList(
    rows.map((r) => {
      const id = String(r.id || r._id);
      const status = String(r.status || "upcoming");
      return {
        id,
        title: String(r.property_name || "Property"),
        subtitle: `${r.lender || "Lender"} · Due ${formatDateDmY(String(r.due_date || ""))}`,
        href: r.property_id ? `/property.html?id=${r.property_id}` : undefined,
        status,
        statusLabel: labelize(status),
        summaryTitle: `Expected ${money(Number(r.expected_amount), user.preferredCurrency)}`,
        summarySub: `Paid ${
          r.amount_paid != null ? money(Number(r.amount_paid), user.preferredCurrency) : "-"
        }${r.paid_date ? ` · ${formatDateDmY(String(r.paid_date))}` : ""}`,
        actions: `<button type="button" data-edit="${id}" data-mode="edit">Edit</button>${
          status === "paid" ? "" : `<button type="button" data-edit="${id}" data-mode="pay">Mark paid</button>`
        }`
      };
    }),
    view,
    "No payments in this view.",
    openMenuId
  );
  bindRowMenus(
    content,
    openMenuId,
    (id) => {
      openMenuId = id;
    },
    render
  );
  content.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((r) => String(r.id || r._id) === String(button.dataset.edit));
      if (row) {
        openMenuId = null;
        openPaymentEditor(row, button.dataset.mode === "pay");
      }
    });
  });
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
  } else if (event.key === "Escape" && openMenuId) {
    openMenuId = null;
    render();
  }
});
document.addEventListener("click", () => {
  if (!openMenuId) {
    return;
  }
  openMenuId = null;
  render();
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
    openMenuId = null;
    render();
  }
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadViews();
});

bindListChrome({
  view,
  onView: (next) => {
    view = next;
    sessionStorage.setItem(VIEW_KEY, view);
    render();
  },
  onSearch: (value) => {
    search = value;
    render();
  },
  onSort: (value) => {
    sortBy = value;
    render();
  }
});

void (async () => {
  await loadProperties();
  await loadViews();
})();
