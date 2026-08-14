import { api, currentMonthValue, getUser, money, qs, statusClass, labelize } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const root = mountShell(
  "/expenses.html",
  "Expenses",
  "Property expenses and portfolio-level additional costs.",
  `<button class="btn" id="add-expense-btn" type="button">Add Expense</button>`
);
const user = getUser()!;
const presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";

root.innerHTML = `
  <section class="panel">
    <div class="tabs" id="scope-tabs">
      <button class="tab active" data-scope="property" type="button">Property expenses</button>
      <button class="tab" data-scope="general" type="button">Additional expenses</button>
    </div>
    <div class="list-toolbar">
      <div class="filters" style="margin:0;flex:1">
        <div class="field"><label>Month</label><input id="month" type="month" value="${currentMonthValue()}" /></div>
        <div class="field" id="filter-property-wrap"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        <div class="actions" style="align-self:end"><button class="btn secondary" id="refresh" type="button">Refresh</button></div>
      </div>
      <div class="status" id="status" style="margin:0;min-width:12rem" hidden></div>
    </div>
    <div id="totals" class="metrics"></div>
    <div class="property-list" id="list"></div>
  </section>

  <div class="modal-backdrop" id="expense-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
      <div class="modal-header">
        <h2 id="expense-form-title">Add property expense</h2>
        <button class="modal-close" id="close-expense-modal" type="button" aria-label="Close">×</button>
      </div>
      <form id="expense-form" class="stack">
        <div class="form-grid">
          <div class="field" id="property-field"><label>Property</label><select name="propertyId" id="propertyId"></select></div>
          <div class="field"><label>Category</label>
            <select name="category">
              <option>Repairs</option><option>Maintenance</option><option>Insurance</option>
              <option>Service charges</option><option>Ground rent</option><option>Council tax</option>
              <option>Utilities</option><option>Management fees</option><option>Furniture</option>
              <option>Legal fees</option><option>Accountant fees</option><option>Software</option>
              <option>Admin</option><option>Other</option>
            </select>
          </div>
          <div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" required /></div>
          <div class="field"><label>Expense date</label><input name="expenseDate" type="date" required /></div>
          <div class="field"><label>Frequency</label>
            <select name="frequency">
              <option value="one_off">One-off</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field"><label>Payment status</label>
            <select name="paymentStatus">
              <option value="paid">Paid</option>
              <option value="upcoming">Upcoming</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Description</label><input name="description" /></div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes"></textarea></div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-expense-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save expense</button>
        </div>
      </form>
    </div>
  </div>
`;

let scope: "property" | "general" = "property";
const modal = document.getElementById("expense-modal") as HTMLDivElement;
const form = document.getElementById("expense-form") as HTMLFormElement;

function openModal(): void {
  syncScopeUi();
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(): void {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  form.reset();
}

async function loadProperties(): Promise<void> {
  const data = await api<{ properties: Array<{ id: string; name: string }> }>(
    `/properties${qs({ status: "active" })}`
  );
  const selects = [
    document.getElementById("propertyId") as HTMLSelectElement,
    document.getElementById("filterProperty") as HTMLSelectElement
  ];
  for (const select of selects) {
    if (select.id === "propertyId") {
      select.innerHTML = "";
    }
    for (const property of data.properties) {
      const option = document.createElement("option");
      option.value = String(property.id);
      option.textContent = property.name;
      select.appendChild(option);
    }
  }
  if (presetPropertyId) {
    (document.getElementById("propertyId") as HTMLSelectElement).value = presetPropertyId;
    (document.getElementById("filterProperty") as HTMLSelectElement).value = presetPropertyId;
  }
}

function syncScopeUi(): void {
  document.querySelectorAll("#scope-tabs .tab").forEach((el) => {
    el.classList.toggle("active", (el as HTMLElement).dataset.scope === scope);
  });
  document.getElementById("expense-form-title")!.textContent =
    scope === "property" ? "Add property expense" : "Add additional expense";
  (document.getElementById("property-field") as HTMLElement).style.display =
    scope === "property" ? "block" : "none";
  (document.getElementById("filter-property-wrap") as HTMLElement).style.display =
    scope === "property" ? "block" : "none";
}

async function loadExpenses(): Promise<void> {
  const month = (document.getElementById("month") as HTMLInputElement).value;
  const propertyId =
    scope === "property"
      ? (document.getElementById("filterProperty") as HTMLSelectElement).value
      : "";
  const data = await api<{
    expenses: Array<Record<string, unknown>>;
    totals: { amount: number };
  }>(`/expenses${qs({ month, scope, propertyId })}`);

  document.getElementById("totals")!.innerHTML = `
    <div class="metric"><div class="label">Total</div><div class="value">${money(data.totals.amount, user.preferredCurrency)}</div></div>
  `;

  const list = document.getElementById("list")!;
  if (!data.expenses.length) {
    list.innerHTML = `<p class="empty">No expenses for this period.</p>`;
    return;
  }

  list.innerHTML = data.expenses
    .map(
      (e) => `<article class="property-row">
        <div class="property-row-main">
          <div class="property-row-title">
            <strong>${e.category}</strong>
            <span class="badge ${statusClass(String(e.payment_status))}">${labelize(String(e.payment_status))}</span>
          </div>
          <div class="muted">${scope === "property" ? e.property_name : "General / Portfolio"}${e.description ? ` · ${e.description}` : ""}</div>
          <div class="property-row-meta">
            <span>${e.expense_date}</span>
            <span>${money(Number(e.amount), user.preferredCurrency)}</span>
            <span>${labelize(String(e.frequency))}</span>
          </div>
        </div>
        <div class="property-row-actions actions">
          <button class="btn danger" data-delete="${e.id}" type="button">Delete</button>
        </div>
      </article>`
    )
    .join("");

  list.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/expenses/${button.dataset.delete}`, { method: "DELETE" });
      setStatus(document.getElementById("status"), "Expense deleted.", "success");
      await loadExpenses();
    });
  });
}

document.getElementById("scope-tabs")?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.dataset.scope === "property" || target.dataset.scope === "general") {
    scope = target.dataset.scope;
    syncScopeUi();
    void loadExpenses();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  try {
    await api("/expenses", {
      method: "POST",
      body: JSON.stringify({
        scope,
        propertyId: scope === "property" ? String(formData.get("propertyId") || "") : null,
        category: String(formData.get("category")),
        description: String(formData.get("description") || ""),
        amount: Number(formData.get("amount")),
        expenseDate: String(formData.get("expenseDate")),
        frequency: String(formData.get("frequency")),
        paymentStatus: String(formData.get("paymentStatus")),
        notes: String(formData.get("notes") || "")
      })
    });
    setStatus(document.getElementById("status"), "Expense saved.", "success");
    closeModal();
    await loadExpenses();
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

document.getElementById("add-expense-btn")?.addEventListener("click", () => {
  form.reset();
  if (presetPropertyId) {
    (document.getElementById("propertyId") as HTMLSelectElement).value = presetPropertyId;
  }
  openModal();
});
document.getElementById("close-expense-modal")?.addEventListener("click", closeModal);
document.getElementById("cancel-expense-modal")?.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    closeModal();
  }
});
document.getElementById("refresh")?.addEventListener("click", () => {
  void loadExpenses();
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadExpenses();
});
document.getElementById("month")?.addEventListener("change", () => {
  void loadExpenses();
});

syncScopeUi();
void (async () => {
  await loadProperties();
  await loadExpenses();
})();
