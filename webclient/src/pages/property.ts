import { api, currentMonthValue, getUser, money, qs, statusClass, labelize } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const params = new URLSearchParams(window.location.search);
const propertyId = String(params.get("id") || "");
const user = getUser()!;

if (!propertyId || propertyId === "null") {
  window.location.href = "/properties.html";
}

const root = mountShell("/properties.html", "Property", "Loading…");

root.innerHTML = `
  <section class="panel">
    <div class="filters">
      <div class="field"><label>Month</label><input id="month" type="month" value="${currentMonthValue()}" /></div>
      <div class="actions" style="align-self:end"><button class="btn" id="apply" type="button">Apply</button></div>
    </div>
    <div class="tabs" id="tabs">
      <button class="tab active" data-tab="overview" type="button">Overview</button>
      <button class="tab" data-tab="rent" type="button">Rent</button>
      <button class="tab" data-tab="mortgage" type="button">Mortgage</button>
      <button class="tab" data-tab="expenses" type="button">Expenses</button>
      <button class="tab" data-tab="documents" type="button">Documents</button>
    </div>
    <div class="status" id="status">Loading property…</div>
  </section>
  <section id="content"></section>
`;

let cache: {
  property: Record<string, unknown>;
  summary: Record<string, number | string>;
  upcoming: {
    rent: Array<Record<string, unknown>>;
    mortgage: Array<Record<string, unknown>>;
    expenses: Array<Record<string, unknown>>;
  };
} | null = null;

async function load(): Promise<void> {
  const month = (document.getElementById("month") as HTMLInputElement).value;
  try {
    cache = await api(`/properties/${propertyId}${qs({ month })}`);
    const property = cache!.property;
    document.querySelector(".topbar h1")!.textContent = String(property.name);
    document.querySelector(".topbar p")!.textContent = String(property.address || "Property detail");
    renderTab("overview");
    setStatus(document.getElementById("status"), "Property loaded.", "success");
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
}

function renderTab(tab: string): void {
  if (!cache) {
    return;
  }
  document.querySelectorAll(".tab").forEach((el) => {
    el.classList.toggle("active", (el as HTMLElement).dataset.tab === tab);
  });
  const content = document.getElementById("content")!;
  const s = cache.summary;
  const currency = user.preferredCurrency;

  if (tab === "overview") {
    content.innerHTML = `
      <section class="metrics">
        <div class="metric"><div class="label">Monthly rent</div><div class="value">${money(Number(s.monthlyRent), currency)}</div></div>
        <div class="metric"><div class="label">Rent received</div><div class="value">${money(Number(s.rentReceived), currency)}</div></div>
        <div class="metric"><div class="label">Mortgage</div><div class="value">${money(Number(s.mortgageCosts), currency)}</div></div>
        <div class="metric"><div class="label">Other expenses</div><div class="value">${money(Number(s.expenses), currency)}</div></div>
        <div class="metric ${Number(s.netCashFlow) >= 0 ? "positive" : "negative"}"><div class="label">Net cash flow</div><div class="value">${money(Number(s.netCashFlow), currency)}</div></div>
      </section>
      <section class="two-col">
        <div class="panel"><h2>Upcoming payments</h2>${table(cache.upcoming.rent.concat(cache.upcoming.mortgage), true)}</div>
        <div class="panel"><h2>Recent expenses</h2>${table(cache.upcoming.expenses, false)}</div>
      </section>
      <section class="panel">
        <h2>Property details</h2>
        <p><strong>Type:</strong> ${labelize(String(cache.property.propertyType))}</p>
        <p><strong>Ownership:</strong> ${cache.property.ownershipPercentage}%</p>
        <p><strong>Purchase:</strong> ${money(Number(cache.property.purchasePrice || 0), currency)} on ${cache.property.purchaseDate || "-"}</p>
        <p><strong>Current value:</strong> ${money(Number(cache.property.currentValue || 0), currency)}</p>
        <p class="muted">${cache.property.notes || ""}</p>
      </section>
    `;
    return;
  }

  if (tab === "rent") {
    content.innerHTML = `<div class="panel"><h2>Rent activity</h2>${rentTable(cache.upcoming.rent)}
      <p class="muted">Manage full rent history on the <a href="/rent.html?propertyId=${propertyId}">Rent</a> page.</p></div>`;
    return;
  }

  if (tab === "mortgage") {
    content.innerHTML = `<div class="panel"><h2>Mortgage activity</h2>${mortgageTable(cache.upcoming.mortgage)}
      <p class="muted">Manage payments on the <a href="/payments.html?propertyId=${propertyId}">Payments</a> page.</p></div>`;
    return;
  }

  if (tab === "expenses") {
    content.innerHTML = `<div class="panel"><h2>Expenses</h2>${expenseTable(cache.upcoming.expenses)}
      <p class="muted">Manage expenses on the <a href="/expenses.html?propertyId=${propertyId}">Expenses</a> page.</p></div>`;
    return;
  }

  content.innerHTML = `<div class="panel"><h2>Documents</h2>
    <p class="muted">Store tenancy agreements, EPCs, and other files for this property on the <a href="/documents.html?propertyId=${propertyId}">Documents</a> page.</p></div>`;
}

function table(rows: Array<Record<string, unknown>>, upcoming: boolean): string {
  if (!rows.length) {
    return `<p class="empty">No ${upcoming ? "upcoming items" : "recent activity"}.</p>`;
  }
  return `<ul>${rows
    .slice(0, 6)
    .map((row) => {
      const label = row.property_name || row.lender || row.category || row.rental_period || "Item";
      const amount = row.expected_amount ?? row.amount ?? 0;
      const date = row.expected_payment_date || row.due_date || row.expense_date || "";
      return `<li><strong>${label}</strong> · ${money(Number(amount), user.preferredCurrency)} · ${date}</li>`;
    })
    .join("")}</ul>`;
}

function rentTable(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return `<p class="empty">No rent records in view.</p>`;
  }
  return `<table><thead><tr><th>Period</th><th>Due</th><th>Expected</th><th>Received</th><th>Status</th></tr></thead><tbody>
    ${rows
      .map(
        (r) => `<tr>
        <td>${r.rental_period}</td><td>${r.expected_payment_date}</td>
        <td>${money(Number(r.expected_amount), user.preferredCurrency)}</td>
        <td>${money(Number(r.amount_received), user.preferredCurrency)}</td>
        <td><span class="badge ${statusClass(String(r.status))}">${labelize(String(r.status))}</span></td>
      </tr>`
      )
      .join("")}
  </tbody></table>`;
}

function mortgageTable(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return `<p class="empty">No mortgage payments in view.</p>`;
  }
  return `<table><thead><tr><th>Lender</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead><tbody>
    ${rows
      .map(
        (r) => `<tr>
        <td>${r.lender}</td><td>${r.due_date}</td>
        <td>${money(Number(r.expected_amount), user.preferredCurrency)}</td>
        <td><span class="badge ${statusClass(String(r.status))}">${labelize(String(r.status))}</span></td>
      </tr>`
      )
      .join("")}
  </tbody></table>`;
}

function expenseTable(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return `<p class="empty">No expenses yet.</p>`;
  }
  return `<table><thead><tr><th>Category</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
    ${rows
      .map(
        (r) => `<tr>
        <td>${r.category}<div class="muted">${r.description || ""}</div></td>
        <td>${r.expense_date}</td>
        <td>${money(Number(r.amount), user.preferredCurrency)}</td>
        <td><span class="badge ${statusClass(String(r.payment_status))}">${labelize(String(r.payment_status))}</span></td>
      </tr>`
      )
      .join("")}
  </tbody></table>`;
}

document.getElementById("tabs")?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.dataset.tab) {
    renderTab(target.dataset.tab);
  }
});
document.getElementById("apply")?.addEventListener("click", () => {
  void load();
});

void load();
