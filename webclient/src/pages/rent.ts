import { api, currentMonthValue, formatDateDmY, formatMonthYear, getUser, money, qs, labelize } from "../lib.js";
import {
  bindListChrome,
  bindRowMenus,
  matchesQuery,
  renderDataList,
  searchFieldHtml,
  sortFieldHtml,
  viewToggleHtml,
  storedListView,
  type ListViewMode
} from "../list-view.js";
import { mountShell, setStatus } from "../shell.js";

const VIEW_KEY = "pf-rent-view-v2";
const root = mountShell(
  "/rent.html",
  "Rent",
  "Track expected and received rental payments.",
  `<div class="actions">
    <button class="btn secondary" id="recurring-rent-btn" type="button">Recurring rent</button>
    <button class="btn" id="add-rent-btn" type="button">+ Add Rent</button>
  </div>`
);
const user = getUser()!;
const presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
let propertyOptions: Array<{ id: string; name: string; expectedMonthlyRent: number }> = [];
let editingId: string | null = null;
let cache: Array<Record<string, unknown>> = [];
let search = "";
let sortBy = "due";
let view: ListViewMode = storedListView(VIEW_KEY, "list");
let openMenuId: string | null = null;

root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="table-toolbar-start">
        <div class="table-filters">
          <div class="field">
            <label>Period</label>
            <select id="periodType">
              <option value="month" selected>Month</option>
              <option value="year">Year</option>
            </select>
          </div>
          <div class="field" id="month-filter-wrap">
            <label>Month</label>
            <input id="month" type="month" value="${currentMonthValue()}" />
          </div>
          <div class="field" id="year-filter-wrap" hidden>
            <label>Year</label>
            <input id="year" type="number" min="2000" max="2100" value="${new Date().getFullYear()}" />
          </div>
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
        ${viewToggleHtml(view)}
      </div>
    </div>
    <div class="status" id="status" hidden></div>
    <div id="totals" class="metrics table-metrics"></div>
    <div id="list"></div>
  </section>

  <div class="modal-backdrop" id="rent-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rent-form-title">
      <div class="modal-header">
        <h2 id="rent-form-title">Add rent</h2>
        <button class="modal-close" id="close-rent-modal" type="button" aria-label="Close">×</button>
      </div>
      <form id="rent-form" class="stack">
        <div class="form-grid">
          <div class="field"><label>Property</label><select name="propertyId" id="propertyId" required></select></div>
          <div class="field"><label>Rental period</label><input name="rentalPeriod" type="month" required /></div>
          <div class="field"><label>Expected amount</label><input name="expectedAmount" type="number" step="0.01" required /></div>
          <div class="field"><label>Amount received</label><input name="amountReceived" type="number" step="0.01" value="0" /></div>
          <div class="field"><label>Expected payment date</label><input name="expectedPaymentDate" type="date" required /></div>
          <div class="field"><label>Actual payment date</label><input name="actualPaymentDate" type="date" /></div>
          <div class="field"><label>Status</label>
            <select name="status">
              <option value="upcoming">Upcoming</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes"></textarea></div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-rent-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save rent record</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal-backdrop" id="recurring-rent-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="recurring-rent-title">
      <div class="modal-header">
        <h2 id="recurring-rent-title">Recurring rent</h2>
        <button class="modal-close" id="close-recurring-rent-modal" type="button" aria-label="Close">×</button>
      </div>
      <form id="recurring-rent-form" class="stack">
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1">
            <label>Property</label>
            <select name="propertyId" id="recurringPropertyId" required></select>
          </div>
          <div class="field"><label>From</label><input name="from" type="date" required /></div>
          <div class="field"><label>To</label><input name="to" type="date" required /></div>
          <div class="field"><label>Rent amount</label><input name="expectedAmount" type="number" step="0.01" min="0" required /></div>
          <div class="field">
            <label>Status</label>
            <input value="Upcoming" disabled />
            <input type="hidden" name="status" value="upcoming" />
          </div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" placeholder="Optional"></textarea></div>
        </div>
        <p class="muted" style="margin:0">
          Creates one Upcoming rent record for each month from From through To. Existing months for the property are skipped.
        </p>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-recurring-rent-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Create recurring rent</button>
        </div>
      </form>
    </div>
  </div>
`;

const modal = document.getElementById("rent-modal") as HTMLDivElement;
const form = document.getElementById("rent-form") as HTMLFormElement;
const recurringModal = document.getElementById("recurring-rent-modal") as HTMLDivElement;
const recurringForm = document.getElementById("recurring-rent-form") as HTMLFormElement;

function normalizeStatus(status: string): "upcoming" | "paid" | "unpaid" {
  if (status === "paid") {
    return "paid";
  }
  if (status === "upcoming") {
    return "upcoming";
  }
  return "unpaid";
}

function displayStatus(status: string): string {
  return labelize(normalizeStatus(status));
}

function openModal(title: string): void {
  document.getElementById("rent-form-title")!.textContent = title;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(): void {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  editingId = null;
  delete form.dataset.editingId;
  form.reset();
  (form.elements.namedItem("amountReceived") as HTMLInputElement).value = "0";
  (form.elements.namedItem("status") as HTMLSelectElement).value = "upcoming";
  if (presetPropertyId) {
    (document.getElementById("propertyId") as HTMLSelectElement).value = presetPropertyId;
  }
}

function openRecurringModal(): void {
  recurringModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeRecurringModal(): void {
  recurringModal.hidden = true;
  document.body.classList.remove("modal-open");
  recurringForm.reset();
  fillRecurringDefaults();
}

function fillExpectedFromProperty(): void {
  const selected = propertyOptions.find(
    (p) => String(p.id) === (document.getElementById("propertyId") as HTMLSelectElement).value
  );
  if (selected) {
    (form.elements.namedItem("expectedAmount") as HTMLInputElement).value = String(
      selected.expectedMonthlyRent || ""
    );
  }
}

function fillRecurringExpectedFromProperty(): void {
  const selected = propertyOptions.find(
    (p) =>
      String(p.id) === (document.getElementById("recurringPropertyId") as HTMLSelectElement).value
  );
  if (selected) {
    (recurringForm.elements.namedItem("expectedAmount") as HTMLInputElement).value = String(
      selected.expectedMonthlyRent || ""
    );
  }
}

function fillRecurringDefaults(): void {
  const fromInput = recurringForm.elements.namedItem("from") as HTMLInputElement;
  const toInput = recurringForm.elements.namedItem("to") as HTMLInputElement;
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 11, 1);
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  fromInput.value = toLocalDate(from);
  toInput.value = toLocalDate(to);
  if (presetPropertyId) {
    (document.getElementById("recurringPropertyId") as HTMLSelectElement).value = presetPropertyId;
  }
  fillRecurringExpectedFromProperty();
}

function fillForm(row: Record<string, unknown>): void {
  editingId = String(row.id);
  form.dataset.editingId = editingId;
  (document.getElementById("propertyId") as HTMLSelectElement).value = String(row.property_id || "");
  // type=month requires YYYY-MM; older values may include a day suffix
  (form.elements.namedItem("rentalPeriod") as HTMLInputElement).value = String(row.rental_period || "").slice(
    0,
    7
  );
  (form.elements.namedItem("expectedAmount") as HTMLInputElement).value = String(row.expected_amount ?? "");
  (form.elements.namedItem("amountReceived") as HTMLInputElement).value = String(row.amount_received ?? 0);
  (form.elements.namedItem("expectedPaymentDate") as HTMLInputElement).value = String(
    row.expected_payment_date || ""
  ).slice(0, 10);
  (form.elements.namedItem("actualPaymentDate") as HTMLInputElement).value = String(
    row.actual_payment_date || ""
  ).slice(0, 10);
  (form.elements.namedItem("status") as HTMLSelectElement).value = normalizeStatus(String(row.status || "upcoming"));
  (form.elements.namedItem("notes") as HTMLTextAreaElement).value = String(row.notes || "");
}

async function loadProperties(): Promise<void> {
  const data = await api<{ properties: Array<{ id: string; name: string; expectedMonthlyRent: number }> }>(
    `/properties${qs({ status: "active" })}`
  );
  propertyOptions = data.properties;
  const formSelect = document.getElementById("propertyId") as HTMLSelectElement;
  const recurringSelect = document.getElementById("recurringPropertyId") as HTMLSelectElement;
  const filterSelect = document.getElementById("filterProperty") as HTMLSelectElement;
  formSelect.innerHTML = "";
  recurringSelect.innerHTML = "";
  for (const property of data.properties) {
    const option = document.createElement("option");
    option.value = String(property.id);
    option.textContent = property.name;
    formSelect.appendChild(option);
    recurringSelect.appendChild(option.cloneNode(true) as HTMLOptionElement);
    filterSelect.appendChild(option.cloneNode(true) as HTMLOptionElement);
  }
  if (presetPropertyId) {
    formSelect.value = presetPropertyId;
    recurringSelect.value = presetPropertyId;
    filterSelect.value = presetPropertyId;
  }
  fillRecurringDefaults();
}

function visibleRows(): Array<Record<string, unknown>> {
  const rows = cache.filter((row) =>
    matchesQuery(row, search, ["property_name", "rental_period", "status", "notes"])
  );
  rows.sort((a, b) => {
    if (sortBy === "name") {
      return String(a.property_name || "").localeCompare(String(b.property_name || ""), "en-GB");
    }
    if (sortBy === "amount") {
      return Number(b.expected_amount || 0) - Number(a.expected_amount || 0);
    }
    return String(a.expected_payment_date || "").localeCompare(String(b.expected_payment_date || ""));
  });
  return rows;
}

function renderList(): void {
  const list = document.getElementById("list")!;
  const rows = visibleRows();
  list.innerHTML = renderDataList(
    rows.map((row) => {
      const status = normalizeStatus(String(row.status));
      const id = String(row.id);
      return {
        id,
        title: String(row.property_name || "Property"),
        subtitle: `Period ${formatMonthYear(String(row.rental_period || ""))} · Due ${formatDateDmY(String(row.expected_payment_date || ""))}`,
        href: row.property_id ? `/property.html?id=${row.property_id}` : undefined,
        propertyId: row.property_id ? String(row.property_id) : undefined,
        hasImage: Boolean(row.hasImage),
        status,
        statusLabel: displayStatus(status),
        summaryTitle: `Expected ${money(Number(row.expected_amount), user.preferredCurrency)}`,
        summarySub: `Received ${money(Number(row.amount_received), user.preferredCurrency)}`,
        actions: `<button type="button" data-edit="${id}">Edit</button>${
          status === "paid" ? "" : `<button type="button" data-mark-paid="${id}">Mark paid</button>`
        }<button type="button" data-delete="${id}">Delete</button>`
      };
    }),
    view,
    "No rent records for this period.",
    openMenuId
  );
  bindRowMenus(
    list,
    openMenuId,
    (id) => {
      openMenuId = id;
    },
    renderList
  );
  list.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((item) => String(item.id) === String(button.dataset.edit));
      if (!row) {
        return;
      }
      openMenuId = null;
      fillForm(row);
      openModal("Edit rent");
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-mark-paid]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = rows.find((item) => String(item.id) === String(button.dataset.markPaid));
      if (!row) {
        return;
      }
      await api(`/rent/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amountReceived: row.expected_amount,
          actualPaymentDate: new Date().toISOString().slice(0, 10),
          status: "paid"
        })
      });
      setStatus(document.getElementById("status"), "Rent marked as paid.", "success");
      openMenuId = null;
      await loadRent();
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/rent/${button.dataset.delete}`, { method: "DELETE" });
      setStatus(document.getElementById("status"), "Rent record deleted.", "success");
      openMenuId = null;
      await loadRent();
    });
  });
}

async function loadRent(): Promise<void> {
  const periodType = (document.getElementById("periodType") as HTMLSelectElement).value;
  const propertyId = (document.getElementById("filterProperty") as HTMLSelectElement).value;
  const query =
    periodType === "year"
      ? qs({ year: (document.getElementById("year") as HTMLInputElement).value, propertyId })
      : qs({ month: (document.getElementById("month") as HTMLInputElement).value, propertyId });
  const data = await api<{
    rentPayments: Array<Record<string, unknown>>;
    totals: { expected: number; received: number };
  }>(`/rent${query}`);

  document.getElementById("totals")!.innerHTML = `
    <div class="metric"><div class="label">Expected</div><div class="value">${money(data.totals.expected, user.preferredCurrency)}</div></div>
    <div class="metric"><div class="label">Received</div><div class="value">${money(data.totals.received, user.preferredCurrency)}</div></div>
  `;
  cache = data.rentPayments;
  renderList();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const status = normalizeStatus(String(formData.get("status") || "upcoming"));
  let amountReceived = Number(formData.get("amountReceived") || 0);
  let actualPaymentDate = String(formData.get("actualPaymentDate") || "") || null;
  const expectedAmount = Number(formData.get("expectedAmount"));
  const rentId = editingId || form.dataset.editingId || null;

  if (status === "paid") {
    if (!amountReceived) {
      amountReceived = expectedAmount;
    }
    if (!actualPaymentDate) {
      actualPaymentDate = new Date().toISOString().slice(0, 10);
    }
  }

  const payload = {
    propertyId: String(formData.get("propertyId") || ""),
    rentalPeriod: String(formData.get("rentalPeriod")).slice(0, 7),
    expectedAmount,
    amountReceived,
    expectedPaymentDate: String(formData.get("expectedPaymentDate")).slice(0, 10),
    actualPaymentDate,
    status,
    notes: String(formData.get("notes") || "")
  };

  try {
    if (rentId) {
      await api(`/rent/${rentId}`, { method: "PUT", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Rent record updated.", "success");
    } else {
      await api("/rent", { method: "POST", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Rent record saved.", "success");
    }
    closeModal();
    await loadRent();
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

recurringForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recurringForm.checkValidity()) {
    recurringForm.reportValidity();
    return;
  }

  const formData = new FormData(recurringForm);
  const from = String(formData.get("from") || "");
  const to = String(formData.get("to") || "");
  if (from > to) {
    setStatus(document.getElementById("status"), "From date must be on or before To date.", "error");
    return;
  }

  const payload = {
    propertyId: String(formData.get("propertyId") || ""),
    from,
    to,
    expectedAmount: Number(formData.get("expectedAmount")),
    status: "upcoming",
    notes: String(formData.get("notes") || "")
  };

  try {
    const result = await api<{ created: number; skipped: number; message: string }>(
      "/rent/recurring",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
    closeRecurringModal();
    setStatus(document.getElementById("status"), result.message, "success");
    await loadRent();
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

document.getElementById("propertyId")?.addEventListener("change", fillExpectedFromProperty);
document
  .getElementById("recurringPropertyId")
  ?.addEventListener("change", fillRecurringExpectedFromProperty);

document.getElementById("add-rent-btn")?.addEventListener("click", () => {
  editingId = null;
  delete form.dataset.editingId;
  form.reset();
  (form.elements.namedItem("amountReceived") as HTMLInputElement).value = "0";
  (form.elements.namedItem("status") as HTMLSelectElement).value = "upcoming";
  if (presetPropertyId) {
    (document.getElementById("propertyId") as HTMLSelectElement).value = presetPropertyId;
  }
  fillExpectedFromProperty();
  openModal("Add rent");
});

document.getElementById("recurring-rent-btn")?.addEventListener("click", () => {
  fillRecurringDefaults();
  openRecurringModal();
});

document.getElementById("close-rent-modal")?.addEventListener("click", closeModal);
document.getElementById("cancel-rent-modal")?.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

document.getElementById("close-recurring-rent-modal")?.addEventListener("click", closeRecurringModal);
document.getElementById("cancel-recurring-rent-modal")?.addEventListener("click", closeRecurringModal);
recurringModal.addEventListener("click", (event) => {
  if (event.target === recurringModal) {
    closeRecurringModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (!modal.hidden) {
    closeModal();
  } else if (!recurringModal.hidden) {
    closeRecurringModal();
  } else if (openMenuId) {
    openMenuId = null;
    renderList();
  }
});
document.addEventListener("click", () => {
  if (!openMenuId) {
    return;
  }
  openMenuId = null;
  renderList();
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadRent();
});

function syncPeriodFilterUi(): void {
  const periodType = (document.getElementById("periodType") as HTMLSelectElement).value;
  const monthWrap = document.getElementById("month-filter-wrap") as HTMLElement;
  const yearWrap = document.getElementById("year-filter-wrap") as HTMLElement;
  const showYear = periodType === "year";
  monthWrap.hidden = showYear;
  yearWrap.hidden = !showYear;
}

document.getElementById("periodType")?.addEventListener("change", () => {
  syncPeriodFilterUi();
  void loadRent();
});
document.getElementById("month")?.addEventListener("change", () => {
  void loadRent();
});
document.getElementById("year")?.addEventListener("change", () => {
  void loadRent();
});

bindListChrome({
  view,
  onView: (next) => {
    view = next;
    sessionStorage.setItem(VIEW_KEY, view);
    renderList();
  },
  onSearch: (value) => {
    search = value;
    renderList();
  },
  onSort: (value) => {
    sortBy = value;
    renderList();
  }
});

void (async () => {
  syncPeriodFilterUi();
  await loadProperties();
  await loadRent();
})();
