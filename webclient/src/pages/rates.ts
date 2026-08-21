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

type MortgageRow = {
  id: string;
  property_id?: string;
  property_name: string;
  lender: string;
  original_loan_amount: number;
  outstanding_balance: number;
  interest_rate: number;
  mortgage_type: string;
  monthly_repayment: number;
  payment_day: number;
  start_date: string;
  end_date: string | null;
  fixed_rate_expiry: string | null;
  notes: string;
  status: string;
};

const VIEW_KEY = "pf-rates-view";
const root = mountShell(
  "/rates.html",
  "Rates",
  "Interest rates and fixed-rate expiry for your mortgages.",
  `<button class="btn" id="add-mortgage-btn" type="button">+ Add Mortgage</button>`
);
const user = getUser()!;
const presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
let cache: MortgageRow[] = [];
let search = "";
let sortBy = "name";
let view: ListViewMode = sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
let editingId: string | null = null;
let openMenuId: string | null = null;

root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="table-toolbar-start">
        <div class="table-filters">
          <div class="field"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        </div>
      </div>
      <div class="table-toolbar-end">
        ${sortFieldHtml([
          { value: "name", label: "Name" },
          { value: "rate", label: "Rate" },
          { value: "expiry", label: "Expiry" }
        ])}
        ${searchFieldHtml()}
        ${viewToggleHtml(view)}
      </div>
    </div>
    <div class="status" id="status" hidden></div>
    <div id="content"></div>
  </section>

  <div class="modal-backdrop" id="mortgage-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mortgage-form-title">
      <div class="modal-header">
        <h2 id="mortgage-form-title">Add mortgage</h2>
        <button class="modal-close" id="close-mortgage-modal" type="button" aria-label="Close">×</button>
      </div>
      <form id="mortgage-form" class="stack">
        <div class="form-grid">
          <div class="field"><label>Property</label><select name="propertyId" id="mortgagePropertyId" required></select></div>
          <div class="field"><label>Lender</label><input name="lender" required /></div>
          <div class="field"><label>Original loan</label><input name="originalLoanAmount" type="number" step="0.01" required /></div>
          <div class="field"><label>Outstanding balance</label><input name="outstandingBalance" type="number" step="0.01" required /></div>
          <div class="field"><label>Interest rate %</label><input name="interestRate" type="number" step="0.01" required /></div>
          <div class="field"><label>Type</label>
            <select name="mortgageType">
              <option value="repayment">Repayment</option>
              <option value="interest_only">Interest only</option>
              <option value="offset">Offset</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field"><label>Monthly repayment</label><input name="monthlyRepayment" type="number" step="0.01" required /></div>
          <div class="field"><label>Payment day</label><input name="paymentDay" type="number" min="1" max="28" value="1" required /></div>
          <div class="field"><label>Start date</label><input name="startDate" type="date" required /></div>
          <div class="field"><label>End date</label><input name="endDate" type="date" /></div>
          <div class="field"><label>Fixed-rate expiry</label><input name="fixedRateExpiry" type="date" /></div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes"></textarea></div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-mortgage-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save mortgage</button>
        </div>
      </form>
    </div>
  </div>
`;

const mortgageModal = document.getElementById("mortgage-modal") as HTMLDivElement;
const mortgageForm = document.getElementById("mortgage-form") as HTMLFormElement;

function isoDate(value: unknown): string {
  const raw = String(value || "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : "";
}

function openBackdrop(title = "Add mortgage"): void {
  document.getElementById("mortgage-form-title")!.textContent = title;
  mortgageModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeBackdrop(): void {
  mortgageModal.hidden = true;
  document.body.classList.remove("modal-open");
  editingId = null;
}

function fillForm(row: MortgageRow): void {
  editingId = String(row.id);
  (document.getElementById("mortgagePropertyId") as HTMLSelectElement).value = String(row.property_id || "");
  (mortgageForm.elements.namedItem("lender") as HTMLInputElement).value = String(row.lender || "");
  (mortgageForm.elements.namedItem("originalLoanAmount") as HTMLInputElement).value = String(
    row.original_loan_amount ?? ""
  );
  (mortgageForm.elements.namedItem("outstandingBalance") as HTMLInputElement).value = String(
    row.outstanding_balance ?? ""
  );
  (mortgageForm.elements.namedItem("interestRate") as HTMLInputElement).value = String(row.interest_rate ?? "");
  (mortgageForm.elements.namedItem("mortgageType") as HTMLSelectElement).value = String(
    row.mortgage_type || "repayment"
  );
  (mortgageForm.elements.namedItem("monthlyRepayment") as HTMLInputElement).value = String(
    row.monthly_repayment ?? ""
  );
  (mortgageForm.elements.namedItem("paymentDay") as HTMLInputElement).value = String(row.payment_day || 1);
  (mortgageForm.elements.namedItem("startDate") as HTMLInputElement).value = isoDate(row.start_date);
  (mortgageForm.elements.namedItem("endDate") as HTMLInputElement).value = isoDate(row.end_date);
  (mortgageForm.elements.namedItem("fixedRateExpiry") as HTMLInputElement).value = isoDate(row.fixed_rate_expiry);
  (mortgageForm.elements.namedItem("notes") as HTMLTextAreaElement).value = String(row.notes || "");
}

async function loadProperties(): Promise<void> {
  const data = await api<{ properties: Array<{ id: string; name: string }> }>(
    `/properties${qs({ status: "active" })}`
  );
  const filter = document.getElementById("filterProperty") as HTMLSelectElement;
  const formSelect = document.getElementById("mortgagePropertyId") as HTMLSelectElement;
  formSelect.innerHTML = "";
  for (const property of data.properties) {
    const option = document.createElement("option");
    option.value = String(property.id);
    option.textContent = property.name;
    filter.appendChild(option.cloneNode(true) as HTMLOptionElement);
    formSelect.appendChild(option);
  }
  if (presetPropertyId) {
    filter.value = presetPropertyId;
    formSelect.value = presetPropertyId;
  }
}

function expiryHint(value: string | null): string | undefined {
  if (!value) {
    return "No fixed expiry";
  }
  const expiry = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  const days = Math.round(
    (expiry.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000
  );
  if (days < 0) {
    return "Expired";
  }
  if (days === 0) {
    return "Expires today";
  }
  if (days <= 90) {
    return `Expires in ${days} days`;
  }
  return undefined;
}

function visibleRows(): MortgageRow[] {
  const rows = cache.filter((row) =>
    matchesQuery(row as unknown as Record<string, unknown>, search, [
      "property_name",
      "lender",
      "mortgage_type",
      "status"
    ])
  );
  rows.sort((a, b) => {
    if (sortBy === "rate") {
      return Number(b.interest_rate || 0) - Number(a.interest_rate || 0);
    }
    if (sortBy === "expiry") {
      return String(a.fixed_rate_expiry || "9999").localeCompare(String(b.fixed_rate_expiry || "9999"));
    }
    return String(a.property_name || "").localeCompare(String(b.property_name || ""), "en-GB");
  });
  return rows;
}

function renderRates(): void {
  const content = document.getElementById("content")!;
  const rows = visibleRows();
  content.innerHTML = renderDataList(
    rows.map((m) => ({
      id: String(m.id),
      title: String(m.property_name || "Property"),
      subtitle: String(m.lender || "Lender"),
      href: m.property_id ? `/property.html?id=${m.property_id}` : undefined,
      status: m.status === "archived" ? "archived" : String(m.mortgage_type || "repayment"),
      statusLabel: labelize(String(m.mortgage_type || "repayment")),
      summaryTitle: money(Number(m.outstanding_balance), user.preferredCurrency),
      summarySub: "Outstanding",
      extras: [
        {
          header: "Interest",
          title: `${Number(m.interest_rate)}%`
        },
        {
          header: "Monthly Payment",
          title: money(Number(m.monthly_repayment), user.preferredCurrency)
        },
        {
          header: "Fixed Until",
          title: m.fixed_rate_expiry ? formatDateDmY(m.fixed_rate_expiry) : "—",
          subtitle: expiryHint(m.fixed_rate_expiry)
        }
      ],
      actions: `<button type="button" data-edit="${m.id}">Edit</button><button type="button" data-delete="${m.id}">Delete</button>`
    })),
    view,
    "No mortgage rates yet. Use Add Mortgage to create one.",
    openMenuId
  );
  bindRowMenus(
    content,
    openMenuId,
    (id) => {
      openMenuId = id;
    },
    renderRates
  );
  content.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((item) => String(item.id) === String(button.dataset.edit));
      if (!row) {
        return;
      }
      openMenuId = null;
      fillForm(row);
      openBackdrop("Edit mortgage");
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/mortgages/${button.dataset.delete}`, { method: "DELETE" });
      setStatus(document.getElementById("status"), "Mortgage deleted.", "success");
      openMenuId = null;
      await loadRates();
    });
  });
}

async function loadRates(): Promise<void> {
  const propertyId = (document.getElementById("filterProperty") as HTMLSelectElement).value;
  try {
    const data = await api<{ mortgages: MortgageRow[] }>(`/mortgages${qs({ propertyId })}`);
    cache = data.mortgages.filter((m) => m.status === "active");
    renderRates();
    setStatus(document.getElementById("status"), "", "info");
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
}

mortgageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(mortgageForm);
  const payload = {
    propertyId: String(formData.get("propertyId") || ""),
    lender: String(formData.get("lender")),
    originalLoanAmount: Number(formData.get("originalLoanAmount")),
    outstandingBalance: Number(formData.get("outstandingBalance")),
    interestRate: Number(formData.get("interestRate")),
    mortgageType: String(formData.get("mortgageType")),
    monthlyRepayment: Number(formData.get("monthlyRepayment")),
    paymentDay: Number(formData.get("paymentDay")),
    startDate: String(formData.get("startDate")),
    endDate: String(formData.get("endDate") || "") || null,
    fixedRateExpiry: String(formData.get("fixedRateExpiry") || "") || null,
    notes: String(formData.get("notes") || "")
  };
  try {
    if (editingId) {
      await api(`/mortgages/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Mortgage updated.", "success");
    } else {
      await api("/mortgages", { method: "POST", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Mortgage created.", "success");
    }
    closeBackdrop();
    mortgageForm.reset();
    (mortgageForm.elements.namedItem("paymentDay") as HTMLInputElement).value = "1";
    await loadRates();
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

document.getElementById("add-mortgage-btn")?.addEventListener("click", () => {
  editingId = null;
  mortgageForm.reset();
  (mortgageForm.elements.namedItem("paymentDay") as HTMLInputElement).value = "1";
  if (presetPropertyId) {
    (document.getElementById("mortgagePropertyId") as HTMLSelectElement).value = presetPropertyId;
  }
  openBackdrop("Add mortgage");
});
document.getElementById("close-mortgage-modal")?.addEventListener("click", () => closeBackdrop());
document.getElementById("cancel-mortgage-modal")?.addEventListener("click", () => closeBackdrop());
mortgageModal.addEventListener("click", (event) => {
  if (event.target === mortgageModal) {
    closeBackdrop();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !mortgageModal.hidden) {
    closeBackdrop();
  } else if (event.key === "Escape" && openMenuId) {
    openMenuId = null;
    renderRates();
  }
});
document.addEventListener("click", () => {
  if (!openMenuId) {
    return;
  }
  openMenuId = null;
  renderRates();
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadRates();
});

bindListChrome({
  view,
  onView: (next) => {
    view = next;
    sessionStorage.setItem(VIEW_KEY, view);
    renderRates();
  },
  onSearch: (value) => {
    search = value;
    renderRates();
  },
  onSort: (value) => {
    sortBy = value;
    renderRates();
  }
});

void (async () => {
  await loadProperties();
  await loadRates();
})();
