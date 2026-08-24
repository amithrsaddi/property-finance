import { api, currentMonthValue, formatDateDmY, getUser, money, qs } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const PERIOD_KEY = "pf-reports-period-v2";
const SCOPE_KEY = "pf-reports-property-scope";
type PeriodType = "month" | "year" | "range";
type PropertyScope = "all" | "rental" | "residential";

function readPeriod(): PeriodType {
  const value = sessionStorage.getItem(PERIOD_KEY);
  return value === "month" || value === "range" ? value : "year";
}

function readScope(): PropertyScope {
  const value = sessionStorage.getItem(SCOPE_KEY);
  return value === "rental" || value === "residential" ? value : "all";
}

function monthBounds(monthValue: string): { from: string; to: string } {
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return { from, to: `${from.slice(0, 8)}${String(last).padStart(2, "0")}` };
  }
  const last = new Date(year, month, 0).getDate();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  return { from, to: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

const root = mountShell(
  "/reports",
  "Reports",
  "Income, costs, cash flow, and profitability by property."
);
const user = getUser()!;
const initialPeriod = readPeriod();
const initialScope = readScope();
const currentMonth = currentMonthValue();
const currentYear = String(new Date().getFullYear());
const initialRange = monthBounds(currentMonth);

root.innerHTML = `
  <section class="panel">
    <div class="filters reports-filters">
      <div class="field">
        <label>Properties</label>
        <select id="propertyScope">
          <option value="all"${initialScope === "all" ? " selected" : ""}>All</option>
          <option value="rental"${initialScope === "rental" ? " selected" : ""}>Rental</option>
          <option value="residential"${initialScope === "residential" ? " selected" : ""}>Residential</option>
        </select>
      </div>
      <div class="reports-period-row">
        <div class="field">
          <label>Period</label>
          <select id="periodType">
            <option value="year"${initialPeriod === "year" ? " selected" : ""}>Year</option>
            <option value="month"${initialPeriod === "month" ? " selected" : ""}>Month</option>
            <option value="range"${initialPeriod === "range" ? " selected" : ""}>Date range</option>
          </select>
        </div>
        <div class="field" id="month-filter-wrap">
          <label>Month</label>
          <input id="month" type="month" value="${currentMonth}" />
        </div>
        <div class="field" id="year-filter-wrap">
          <label>Year</label>
          <input id="year" type="number" min="2000" max="2100" value="${currentYear}" />
        </div>
        <div class="field" id="from-filter-wrap">
          <label>From</label>
          <input id="from" type="date" value="${initialRange.from}" />
        </div>
        <div class="field" id="to-filter-wrap">
          <label>To</label>
          <input id="to" type="date" value="${initialRange.to}" />
        </div>
      </div>
      <div class="actions reports-run"><button class="btn" id="apply" type="button">Run report</button></div>
    </div>
    <div class="status" id="status">Choose a period to report on.</div>
  </section>
  <section class="metrics" id="totals"></section>
  <section class="panel">
    <h2>Profitability by property</h2>
    <div class="table-wrap" id="list"></div>
  </section>
`;

function periodType(): PeriodType {
  const value = (document.getElementById("periodType") as HTMLSelectElement).value;
  return value === "month" || value === "range" ? value : "year";
}

function syncPeriodFilterUi(): void {
  const period = periodType();
  sessionStorage.setItem(PERIOD_KEY, period);
  (document.getElementById("month-filter-wrap") as HTMLElement).hidden = period !== "month";
  (document.getElementById("year-filter-wrap") as HTMLElement).hidden = period !== "year";
  (document.getElementById("from-filter-wrap") as HTMLElement).hidden = period !== "range";
  (document.getElementById("to-filter-wrap") as HTMLElement).hidden = period !== "range";
}

function propertyScope(): PropertyScope {
  const value = (document.getElementById("propertyScope") as HTMLSelectElement).value;
  return value === "rental" || value === "residential" ? value : "all";
}

function reportQuery(): string | null {
  const scope = propertyScope();
  sessionStorage.setItem(SCOPE_KEY, scope);
  const period = periodType();
  if (period === "year") {
    const year = (document.getElementById("year") as HTMLInputElement).value.trim();
    if (!/^\d{4}$/.test(year)) {
      setStatus(document.getElementById("status"), "Enter a valid year.", "error");
      return null;
    }
    return qs({ year, scope });
  }
  if (period === "range") {
    const from = (document.getElementById("from") as HTMLInputElement).value;
    const to = (document.getElementById("to") as HTMLInputElement).value;
    if (!from || !to) {
      setStatus(document.getElementById("status"), "Choose a from and to date.", "error");
      return null;
    }
    if (from > to) {
      setStatus(document.getElementById("status"), "From date must be on or before the to date.", "error");
      return null;
    }
    return qs({ from, to, scope });
  }
  const month = (document.getElementById("month") as HTMLInputElement).value;
  if (!month) {
    setStatus(document.getElementById("status"), "Choose a month.", "error");
    return null;
  }
  return qs({ month, scope });
}

async function loadReport(): Promise<void> {
  const query = reportQuery();
  if (!query) {
    return;
  }
  try {
    const data = await api<{
      from: string;
      to: string;
      totals: {
        rentReceived: number;
        rentExpected: number;
        mortgageSpend: number;
        propertyExpenses: number;
        additionalExpenses: number;
        netCashFlow: number;
      };
      properties: Array<Record<string, unknown>>;
    }>(`/reports${query}`);

    const t = data.totals;
    document.getElementById("totals")!.innerHTML = `
      <div class="metric"><div class="label">Rent expected</div><div class="value">${money(t.rentExpected, user.preferredCurrency)}</div></div>
      <div class="metric"><div class="label">Rent received</div><div class="value">${money(t.rentReceived, user.preferredCurrency)}</div></div>
      <div class="metric"><div class="label">Mortgage spend</div><div class="value">${money(t.mortgageSpend, user.preferredCurrency)}</div></div>
      <div class="metric"><div class="label">Property expenses</div><div class="value">${money(t.propertyExpenses, user.preferredCurrency)}</div></div>
      <div class="metric"><div class="label">Additional expenses</div><div class="value">${money(t.additionalExpenses, user.preferredCurrency)}</div></div>
      <div class="metric ${t.netCashFlow >= 0 ? "positive" : "negative"}"><div class="label">Net cash flow</div><div class="value">${money(t.netCashFlow, user.preferredCurrency)}</div></div>
    `;

    const list = document.getElementById("list")!;
    if (!data.properties.length) {
      list.innerHTML = `<p class="empty">No properties to report on.</p>`;
    } else {
      list.innerHTML = `<table class="reports-table">
        <thead><tr><th>Property</th><th>Rent</th><th>Mortgage</th><th>Expenses</th><th>Net</th></tr></thead>
        <tbody>
          ${data.properties
            .map(
              (p) => `<tr>
              <td><a href="/property?id=${p.id}">${p.name}</a></td>
              <td>${money(Number(p.rentReceived), user.preferredCurrency)}</td>
              <td>${money(Number(p.mortgageSpend), user.preferredCurrency)}</td>
              <td>${money(Number(p.propertyExpenses), user.preferredCurrency)}</td>
              <td>${money(Number(p.netCashFlow), user.preferredCurrency)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
    }

    setStatus(
      document.getElementById("status"),
      `Report for ${formatDateDmY(data.from)} to ${formatDateDmY(data.to)}.`,
      "success"
    );
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
}

syncPeriodFilterUi();
document.getElementById("apply")?.addEventListener("click", () => {
  void loadReport();
});
document.getElementById("periodType")?.addEventListener("change", () => {
  syncPeriodFilterUi();
  void loadReport();
});
document.getElementById("month")?.addEventListener("change", () => {
  void loadReport();
});
document.getElementById("year")?.addEventListener("change", () => {
  void loadReport();
});
document.getElementById("from")?.addEventListener("change", () => {
  void loadReport();
});
document.getElementById("propertyScope")?.addEventListener("change", () => {
  void loadReport();
});
document.getElementById("to")?.addEventListener("change", () => {
  void loadReport();
});

void loadReport();
