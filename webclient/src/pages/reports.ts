import { api, currentMonthValue, getUser, money, qs } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const root = mountShell(
  "/reports.html",
  "Reports",
  "Income, costs, cash flow, and profitability by property."
);
const user = getUser()!;

root.innerHTML = `
  <section class="panel">
    <div class="filters">
      <div class="field"><label>Month</label><input id="month" type="month" value="${currentMonthValue()}" /></div>
      <div class="field"><label>Or year</label><input id="year" type="number" min="2000" max="2100" placeholder="e.g. 2026" /></div>
      <div class="actions" style="align-self:end"><button class="btn" id="apply" type="button">Run report</button></div>
    </div>
    <div class="status" id="status">Choose a month or year to report on.</div>
  </section>
  <section class="metrics" id="totals"></section>
  <section class="panel">
    <h2>Profitability by property</h2>
    <div class="table-wrap" id="list"></div>
  </section>
`;

async function loadReport(): Promise<void> {
  const month = (document.getElementById("month") as HTMLInputElement).value;
  const year = (document.getElementById("year") as HTMLInputElement).value;
  const query = year ? qs({ year }) : qs({ month });
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
      list.innerHTML = `<table>
        <thead><tr><th>Property</th><th>Rent</th><th>Mortgage</th><th>Expenses</th><th>Net</th></tr></thead>
        <tbody>
          ${data.properties
            .map(
              (p) => `<tr>
              <td><a href="/property.html?id=${p.id}">${p.name}</a></td>
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
      `Report for ${data.from} to ${data.to}.`,
      "success"
    );
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
}

document.getElementById("apply")?.addEventListener("click", () => {
  void loadReport();
});

void loadReport();
