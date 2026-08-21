import { api, apiFile, currentMonthValue, formatDateDmY, getUser, money, qs, labelize } from "../lib.js";
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

const VIEW_KEY = "pf-expenses-view-v2";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,image/*";
const root = mountShell(
  "/expenses.html",
  "Expenses",
  "Property expenses and portfolio-level additional costs.",
  `<button class="btn" id="add-expense-btn" type="button">+ Add Expense</button>`
);
const user = getUser()!;
const presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
let cache: Array<Record<string, unknown>> = [];
let search = "";
let sortBy = "date";
let view: ListViewMode = storedListView(VIEW_KEY, "list");
let openMenuId: string | null = null;
let scope: "property" | "general" = "property";
let selectedFile: File | null = null;

root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="table-toolbar-start">
        <div class="seg-tabs" id="scope-tabs">
          <button class="seg-tab active" data-scope="property" type="button">Property expenses</button>
          <button class="seg-tab" data-scope="general" type="button">Additional expenses</button>
        </div>
        <div class="table-filters">
          <div class="field"><label>Month</label><input id="month" type="month" value="${currentMonthValue()}" /></div>
          <div class="field" id="filter-property-wrap"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        </div>
      </div>
      <div class="table-toolbar-end">
        ${sortFieldHtml([
          { value: "date", label: "Date" },
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
          <div class="field" style="grid-column:1/-1">
            <label>Receipt or document <span class="muted">(optional)</span></label>
            <label class="file-drop">
              <input id="expense-file" type="file" accept="${ACCEPT}" />
              <span class="file-drop-title">Choose file</span>
              <span class="file-drop-sub" id="expense-file-sub">PDF, image, Word, or Excel · up to 4 MB</span>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-expense-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save expense</button>
        </div>
      </form>
    </div>
  </div>
`;

const modal = document.getElementById("expense-modal") as HTMLDivElement;
const form = document.getElementById("expense-form") as HTMLFormElement;
const fileInput = document.getElementById("expense-file") as HTMLInputElement;

function formatBytes(bytes: number): string {
  if (!bytes) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setFileHint(text: string): void {
  document.getElementById("expense-file-sub")!.textContent = text;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

async function openOrDownload(documentId: string, download: boolean): Promise<void> {
  const file = await apiFile(`/documents/${documentId}/file`);
  const url = URL.createObjectURL(file.blob);
  if (download) {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.click();
  } else {
    window.open(url, "_blank", "noopener");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openModal(): void {
  syncScopeUi();
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(): void {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel · up to 4 MB");
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
  document.querySelectorAll("#scope-tabs .seg-tab").forEach((el) => {
    el.classList.toggle("active", (el as HTMLElement).dataset.scope === scope);
  });
  document.getElementById("expense-form-title")!.textContent =
    scope === "property" ? "Add property expense" : "Add additional expense";
  (document.getElementById("property-field") as HTMLElement).style.display =
    scope === "property" ? "block" : "none";
  (document.getElementById("filter-property-wrap") as HTMLElement).style.display =
    scope === "property" ? "block" : "none";
}

function visibleRows(): Array<Record<string, unknown>> {
  const rows = cache.filter((row) =>
    matchesQuery(row, search, [
      "category",
      "property_name",
      "description",
      "payment_status",
      "notes",
      "document_name"
    ])
  );
  rows.sort((a, b) => {
    if (sortBy === "name") {
      return String(a.category || "").localeCompare(String(b.category || ""), "en-GB");
    }
    if (sortBy === "amount") {
      return Number(b.amount || 0) - Number(a.amount || 0);
    }
    return String(a.expense_date || "").localeCompare(String(b.expense_date || ""));
  });
  return rows;
}

function renderList(): void {
  const list = document.getElementById("list")!;
  const rows = visibleRows();
  list.innerHTML = renderDataList(
    rows.map((e) => {
      const id = String(e.id);
      const documentId = String(e.document_id || "");
      const hasDocument = Boolean(e.has_document && documentId);
      const status = String(e.payment_status || "upcoming");
      const place = scope === "property" ? String(e.property_name || "Property") : "General / Portfolio";
      const receipt = hasDocument ? ` · ${e.document_name || "Receipt"}` : "";
      return {
        id,
        title: String(e.category || "Expense"),
        subtitle: e.description ? `${place} · ${e.description}` : place,
        href: scope === "property" && e.property_id ? `/property.html?id=${e.property_id}` : undefined,
        propertyId: e.property_id ? String(e.property_id) : undefined,
        hasImage: Boolean(e.hasImage),
        status,
        statusLabel: labelize(status),
        summaryTitle: money(Number(e.amount), user.preferredCurrency),
        summarySub: `${formatDateDmY(String(e.expense_date || ""))} · ${labelize(String(e.frequency || ""))}${receipt}`,
        actions: `${
          hasDocument
            ? `<button type="button" data-open="${documentId}">Open receipt</button><button type="button" data-download="${documentId}">Download receipt</button>`
            : ""
        }<button type="button" data-delete="${id}">Delete</button>`
      };
    }),
    view,
    "No expenses for this period.",
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
  list.querySelectorAll<HTMLButtonElement>("[data-open]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await openOrDownload(String(button.dataset.open), false);
      } catch (error) {
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-download]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await openOrDownload(String(button.dataset.download), true);
      } catch (error) {
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/expenses/${button.dataset.delete}`, { method: "DELETE" });
      setStatus(document.getElementById("status"), "Expense deleted.", "success");
      openMenuId = null;
      await loadExpenses();
    });
  });
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
  cache = data.expenses;
  renderList();
}

document.getElementById("scope-tabs")?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.dataset.scope === "property" || target.dataset.scope === "general") {
    scope = target.dataset.scope;
    openMenuId = null;
    syncScopeUi();
    void loadExpenses();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (fileInput.files?.[0] && fileInput.files[0].size > MAX_FILE_BYTES) {
    setStatus(document.getElementById("status"), "Files must be 4 MB or smaller.", "error");
    return;
  }
  const formData = new FormData(form);
  const payload: Record<string, unknown> = {
    scope,
    propertyId: scope === "property" ? String(formData.get("propertyId") || "") : null,
    category: String(formData.get("category")),
    description: String(formData.get("description") || ""),
    amount: Number(formData.get("amount")),
    expenseDate: String(formData.get("expenseDate")),
    frequency: String(formData.get("frequency")),
    paymentStatus: String(formData.get("paymentStatus")),
    notes: String(formData.get("notes") || "")
  };
  try {
    if (selectedFile) {
      payload.originalFilename = selectedFile.name;
      payload.mimeType = selectedFile.type || "application/octet-stream";
      payload.fileData = await readFileAsBase64(selectedFile);
    }
    await api("/expenses", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setStatus(document.getElementById("status"), "Expense saved.", "success");
    closeModal();
    await loadExpenses();
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0] || null;
  selectedFile = file;
  if (!file) {
    setFileHint("PDF, image, Word, or Excel · up to 4 MB");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    selectedFile = null;
    fileInput.value = "";
    setFileHint("That file is larger than 4 MB. Choose a smaller file.");
    return;
  }
  setFileHint(`${file.name} · ${formatBytes(file.size)}`);
});

document.getElementById("add-expense-btn")?.addEventListener("click", () => {
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel · up to 4 MB");
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
  } else if (event.key === "Escape" && openMenuId) {
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
  void loadExpenses();
});
document.getElementById("month")?.addEventListener("change", () => {
  void loadExpenses();
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

syncScopeUi();
void (async () => {
  await loadProperties();
  await loadExpenses();
})();
