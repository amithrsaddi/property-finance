import { api, getUser, money, qs, labelize } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const root = mountShell(
  "/rates.html",
  "Rates",
  "Interest rates and fixed-rate expiry for your mortgages.",
  `<button class="btn" id="add-mortgage-btn" type="button">Add Mortgage</button>`
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
    <div class="property-list" id="content"></div>
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

type MortgageRow = {
  id: string;
  property_name: string;
  lender: string;
  interest_rate: number;
  mortgage_type: string;
  monthly_repayment: number;
  outstanding_balance: number;
  fixed_rate_expiry: string | null;
  status: string;
};

const mortgageModal = document.getElementById("mortgage-modal") as HTMLDivElement;
const mortgageForm = document.getElementById("mortgage-form") as HTMLFormElement;

function openBackdrop(): void {
  mortgageModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeBackdrop(): void {
  mortgageModal.hidden = true;
  document.body.classList.remove("modal-open");
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

function expiryLabel(value: string | null): string {
  if (!value) {
    return "No fixed expiry";
  }
  const expiry = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  const days = Math.round((expiry.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000);
  if (days < 0) {
    return `Expired ${value}`;
  }
  if (days === 0) {
    return `Expires today (${value})`;
  }
  if (days <= 90) {
    return `Expires in ${days} days (${value})`;
  }
  return `Fixed until ${value}`;
}

function renderRates(rows: MortgageRow[]): void {
  const content = document.getElementById("content")!;
  if (!rows.length) {
    content.innerHTML = `<p class="empty">No mortgage rates yet. Use Add Mortgage to create one.</p>`;
    return;
  }
  content.innerHTML = rows
    .map(
      (m) => `<article class="property-row">
        <div class="property-row-main">
          <div class="property-row-title">
            <strong>${m.property_name}</strong>
            <span class="badge ok">${labelize(String(m.mortgage_type || "repayment"))}</span>
          </div>
          <div class="muted">${m.lender}</div>
          <div class="property-row-meta">
            <span>Rate ${m.interest_rate}%</span>
            <span>Monthly ${money(Number(m.monthly_repayment), user.preferredCurrency)}</span>
            <span>Balance ${money(Number(m.outstanding_balance), user.preferredCurrency)}</span>
            <span>${expiryLabel(m.fixed_rate_expiry)}</span>
          </div>
        </div>
      </article>`
    )
    .join("");
}

async function loadRates(): Promise<void> {
  const propertyId = (document.getElementById("filterProperty") as HTMLSelectElement).value;
  try {
    const data = await api<{ mortgages: MortgageRow[] }>(`/mortgages${qs({ propertyId })}`);
    renderRates(data.mortgages.filter((m) => m.status === "active"));
    setStatus(document.getElementById("status"), "", "info");
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
}

mortgageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(mortgageForm);
  try {
    await api("/mortgages", {
      method: "POST",
      body: JSON.stringify({
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
      })
    });
    setStatus(document.getElementById("status"), "Mortgage created.", "success");
    closeBackdrop();
    mortgageForm.reset();
    (mortgageForm.elements.namedItem("paymentDay") as HTMLInputElement).value = "1";
    await loadRates();
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

document.getElementById("add-mortgage-btn")?.addEventListener("click", () => {
  mortgageForm.reset();
  (mortgageForm.elements.namedItem("paymentDay") as HTMLInputElement).value = "1";
  if (presetPropertyId) {
    (document.getElementById("mortgagePropertyId") as HTMLSelectElement).value = presetPropertyId;
  }
  openBackdrop();
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
  }
});
document.getElementById("refresh")?.addEventListener("click", () => {
  void loadRates();
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadRates();
});

void (async () => {
  await loadProperties();
  await loadRates();
})();
