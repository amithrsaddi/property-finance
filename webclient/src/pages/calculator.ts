import { api, getUser, money } from "../lib.js";
import { escapeHtml } from "../list-view.js";
import { mountShell } from "../shell.js";

type MortgageKind = "repayment" | "interest_only";

type MortgageOption = {
  id: string;
  property_name: string;
  lender: string;
  outstanding_balance: number;
  original_loan_amount: number;
  interest_rate: number;
  mortgage_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
};

type YearRow = {
  year: number;
  paid: number;
  interest: number;
  capital: number;
  balance: number;
};

type OverpayKind = "none" | "monthly" | "lump" | "yearly";

type CalcResult = {
  kind: MortgageKind;
  monthly: number;
  monthlyTotal: number;
  otherMonthly: number;
  months: number;
  monthsTaken: number;
  totalPaid: number;
  totalInterest: number;
  capitalRepaid: number;
  balanceEnd: number;
  interestSaved: number;
  monthsSaved: number;
  overpayKind: OverpayKind;
  overpayAmount: number;
  years: YearRow[];
};

const DEFAULTS = {
  amount: "250000",
  rate: "4.5",
  years: "25",
  months: "0"
};

const user = getUser()!;
const currencyMark = (() => {
  try {
    const part = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: user.preferredCurrency
    })
      .formatToParts(0)
      .find((item) => item.type === "currency");
    return part?.value || user.preferredCurrency;
  } catch {
    return user.preferredCurrency;
  }
})();

const root = mountShell(
  "/calculator",
  "Calculator",
  "Estimate monthly payments for repayment and interest-only mortgages."
);

root.innerHTML = `
  <section class="calc-board">
    <header class="calc-board-head">
      <div class="seg-tabs calc-type" role="group" aria-label="Mortgage type">
        <button class="seg-tab active" data-kind="repayment" type="button">Repayment</button>
        <button class="seg-tab" data-kind="interest_only" type="button">Interest only</button>
      </div>
      <button class="btn ghost calc-reset" id="calc-reset" type="button">Reset</button>
    </header>
    <div class="calc-board-main">
      <div class="calc-form">
        <div class="field">
          <label for="calc-mortgage">Start from an existing mortgage</label>
          <select id="calc-mortgage">
            <option value="">None</option>
          </select>
        </div>
        <label class="calc-input">
          <span>Loan amount</span>
          <span class="calc-input-box">
            <span class="calc-affix">${escapeHtml(currencyMark)}</span>
            <input id="calc-amount" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.amount}" />
          </span>
        </label>
        <label class="calc-input">
          <span>Interest rate</span>
          <span class="calc-input-box">
            <input id="calc-rate" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.rate}" />
            <span class="calc-affix is-suffix">%</span>
          </span>
        </label>
        <div class="calc-term" data-term-field>
          <span>Term</span>
          <div class="calc-term-row">
            <label class="calc-input-box">
              <span class="sr-only">Term years</span>
              <input id="calc-years" type="number" min="0" max="50" step="1" value="${DEFAULTS.years}" />
              <span class="calc-affix is-suffix">years</span>
            </label>
            <label class="calc-input-box">
              <span class="sr-only">Term months</span>
              <input id="calc-months" type="number" min="0" max="11" step="1" value="${DEFAULTS.months}" />
              <span class="calc-affix is-suffix">months</span>
            </label>
          </div>
        </div>
        <div class="calc-overpay" data-overpay-field>
          <span>Overpayment</span>
          <div class="seg-tabs calc-overpay-type" role="group" aria-label="Overpayment type">
            <button class="seg-tab active" data-overpay="none" type="button">None</button>
            <button class="seg-tab" data-overpay="lump" type="button">Lump sum</button>
            <button class="seg-tab" data-overpay="yearly" type="button">Yearly</button>
            <button class="seg-tab" data-overpay="monthly" type="button">Monthly</button>
          </div>
          <label class="calc-input" id="calc-overpay-amount-wrap" hidden>
            <span id="calc-overpay-label">Monthly extra</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="calc-overpay-amount" type="number" min="0" step="0.01" inputmode="decimal" value="0" />
            </span>
          </label>
        </div>
      </div>
      <div class="calc-summary" id="calc-output" aria-live="polite"></div>
    </div>
    <div class="calc-board-foot" id="calc-schedule-panel" hidden>
      <div class="calc-section-head">
        <div>
          <h2>Year by year</h2>
          <p>How each year splits between interest and capital.</p>
        </div>
        <div class="seg-tabs calc-year-tabs" role="tablist" aria-label="Year by year view">
          <button class="seg-tab active" id="calc-tab-list" data-year-view="list" type="button" role="tab" aria-selected="true">Breakdown</button>
          <button class="seg-tab" id="calc-tab-graph" data-year-view="graph" type="button" role="tab" aria-selected="false">Graph</button>
        </div>
      </div>
      <div class="calc-schedule-wrap" id="calc-schedule" role="tabpanel" aria-labelledby="calc-tab-list"></div>
      <div class="calc-graph-wrap" id="calc-graph" role="tabpanel" aria-labelledby="calc-tab-graph" hidden></div>
    </div>
  </section>
`;

const amountInput = document.getElementById("calc-amount") as HTMLInputElement;
const rateInput = document.getElementById("calc-rate") as HTMLInputElement;
const yearsInput = document.getElementById("calc-years") as HTMLInputElement;
const monthsInput = document.getElementById("calc-months") as HTMLInputElement;
const overpayAmountInput = document.getElementById("calc-overpay-amount") as HTMLInputElement;
const overpayAmountWrap = document.getElementById("calc-overpay-amount-wrap") as HTMLLabelElement;
const overpayLabel = document.getElementById("calc-overpay-label")!;
const mortgageSelect = document.getElementById("calc-mortgage") as HTMLSelectElement;
const output = document.getElementById("calc-output")!;
const schedulePanel = document.getElementById("calc-schedule-panel") as HTMLElement;
const scheduleEl = document.getElementById("calc-schedule")!;
const graphEl = document.getElementById("calc-graph")!;

const YEAR_VIEW_KEY = "pf-calc-year-view";
type YearView = "list" | "graph";
let yearView: YearView = sessionStorage.getItem(YEAR_VIEW_KEY) === "graph" ? "graph" : "list";
let kind: MortgageKind = "repayment";
let overpayKind: OverpayKind = "none";
let mortgages: MortgageOption[] = [];

function gbp(value: number): string {
  return money(value, user.preferredCurrency);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function axisMoney(value: number): string {
  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}m`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return String(Math.round(value));
}

function syncYearView(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-year-view]").forEach((button) => {
    const active = button.dataset.yearView === yearView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  scheduleEl.hidden = yearView !== "list";
  graphEl.hidden = yearView !== "graph";
}

function renderYearList(rows: YearRow[]): string {
  return rows
    .map((row) => {
      const yearPaid = row.paid || 1;
      const interestPct = Math.min(100, (row.interest / yearPaid) * 100);
      const capitalPct = 100 - interestPct;
      const last = row.balance <= 0.005;
      return `<article class="calc-year${last ? " is-done" : ""}">
        <div class="calc-year-head">
          <strong>Year ${row.year}</strong>
          <span>Balance ${gbp(row.balance)}</span>
        </div>
        <div class="calc-split-track calc-year-track">
          <span class="calc-split-interest" style="width:${interestPct.toFixed(2)}%"></span>
          <span class="calc-split-capital" style="width:${capitalPct.toFixed(2)}%"></span>
        </div>
        <div class="calc-year-meta">
          <span>Paid ${gbp(row.paid)}</span>
          <span>Interest ${gbp(row.interest)}</span>
          <span>Capital ${gbp(row.capital)}</span>
        </div>
      </article>`;
    })
    .join("");
}

function renderYearChart(rows: YearRow[]): string {
  const width = 760;
  const height = 280;
  const pad = { l: 42, r: 44, t: 16, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const count = Math.max(rows.length, 1);
  const band = innerW / count;
  const barW = Math.max(4, Math.min(32, band * 0.58));
  const maxPaid = Math.max(...rows.map((row) => row.paid), 1);
  const maxBalance = Math.max(...rows.map((row) => row.balance), 1);
  const x = (i: number) => pad.l + band * (i + 0.5);
  const yPaid = (value: number) => pad.t + innerH - (value / maxPaid) * innerH;
  const yBal = (value: number) => pad.t + innerH - (value / maxBalance) * innerH;
  const baseY = yPaid(0);
  const ticks = 4;
  const hGrid = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = (maxPaid / ticks) * i;
    const yy = yPaid(value);
    return `<line x1="${pad.l}" y1="${n(yy)}" x2="${width - pad.r}" y2="${n(yy)}" class="chart-grid"/>
      <text x="${pad.l - 8}" y="${n(yy + 4)}" text-anchor="end" class="chart-axis">${axisMoney(value)}</text>
      <text x="${width - pad.r + 8}" y="${n(yBal((maxBalance / ticks) * i) + 4)}" class="chart-axis calc-axis-right">${axisMoney((maxBalance / ticks) * i)}</text>`;
  }).join("");
  const xAxis = `<line x1="${pad.l}" y1="${n(pad.t + innerH)}" x2="${width - pad.r}" y2="${n(pad.t + innerH)}" class="chart-axis-line"/>`;
  const step = Math.max(1, Math.ceil(count / 8));
  const labels = rows
    .map((row, i) => {
      if (i !== 0 && i !== count - 1 && (i + 1) % step !== 0) {
        return "";
      }
      return `<text x="${n(x(i))}" y="${height - 8}" text-anchor="middle" class="chart-axis">${row.year}</text>`;
    })
    .join("");
  const bars = rows
    .map((row, i) => {
      const center = x(i);
      const capY = yPaid(row.capital);
      const topY = yPaid(row.capital + row.interest);
      const capH = Math.max(baseY - capY, 0);
      const intH = Math.max(capY - topY, 0);
      return `<g class="calc-chart-col">
        <rect class="calc-bar-capital" x="${n(center - barW / 2)}" y="${n(capY)}" width="${n(barW)}" height="${n(capH)}" rx="3"/>
        <rect class="calc-bar-interest" x="${n(center - barW / 2)}" y="${n(topY)}" width="${n(barW)}" height="${n(intH)}" rx="${intH > 4 ? 3 : 0}"/>
      </g>`;
    })
    .join("");
  const balancePts = rows.map((row, i) => ({ x: x(i), y: yBal(row.balance) }));
  const balancePath = balancePts.map((point, i) => `${i ? "L" : "M"}${n(point.x)} ${n(point.y)}`).join(" ");
  const dots = balancePts
    .map((point) => `<circle class="calc-balance-dot" cx="${n(point.x)}" cy="${n(point.y)}" r="3.2"/>`)
    .join("");
  const hits = rows
    .map((row, i) => {
      return `<rect class="chart-hit calc-chart-hit" data-year="${row.year}" data-paid="${row.paid}" data-interest="${row.interest}" data-capital="${row.capital}" data-balance="${row.balance}" data-x="${n(x(i))}" x="${n(pad.l + band * i)}" y="${pad.t}" width="${n(band)}" height="${n(innerH)}"/>`;
    })
    .join("");

  return `<div class="calc-chart">
    <div class="chart-in-legend calc-chart-legend">
      <span><i class="legend-calc-interest"></i> Interest</span>
      <span><i class="legend-calc-capital"></i> Capital</span>
      <span><i class="legend-calc-balance"></i> Balance</span>
    </div>
    <div class="calc-chart-canvas">
      <svg class="calc-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" width="100%" height="100%" role="img" aria-label="Year by year interest, capital, and remaining balance">
        ${hGrid}${xAxis}
        ${bars}
        <path class="calc-balance-line" d="${balancePath}"/>
        ${dots}
        ${labels}
        ${hits}
      </svg>
      <div class="chart-tooltip" id="calc-chart-tooltip" hidden></div>
    </div>
  </div>`;
}

function monthsBetween(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return 0;
  }
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}

function monthlyRate(annualPercent: number): number {
  return annualPercent / 100 / 12;
}

function repaymentMonthly(principal: number, annualPercent: number, months: number): number {
  if (principal <= 0 || months <= 0) {
    return 0;
  }
  const rate = monthlyRate(annualPercent);
  if (rate === 0) {
    return principal / months;
  }
  const factor = (1 + rate) ** months;
  return (principal * rate * factor) / (factor - 1);
}

function interestOnlyMonthly(principal: number, annualPercent: number): number {
  if (principal <= 0) {
    return 0;
  }
  return principal * monthlyRate(annualPercent);
}

function formatTerm(totalMonths: number): string {
  const months = Math.max(0, Math.round(totalMonths));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (months === 0) {
    return "immediately";
  }
  const yearPart = years ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthPart = rest ? `${rest} month${rest === 1 ? "" : "s"}` : "";
  return [yearPart, monthPart].filter(Boolean).join(" ");
}

function syncOverpayUi(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-overpay]").forEach((button) => {
    button.classList.toggle("active", button.dataset.overpay === overpayKind);
  });
  overpayAmountWrap.hidden = overpayKind === "none";
  overpayLabel.textContent =
    overpayKind === "yearly" ? "Yearly lump" : overpayKind === "lump" ? "Lump sum" : "Monthly extra";
}

function buildSchedule(
  principal: number,
  annualPercent: number,
  months: number,
  monthly: number,
  extraMonthly = 0,
  lumpSum = 0,
  yearlyLump = 0
): { years: YearRow[]; monthsTaken: number } {
  const rate = monthlyRate(annualPercent);
  const payment = roundMoney(monthly);
  const extra = roundMoney(Math.max(0, extraMonthly));
  const yearly = roundMoney(Math.max(0, yearlyLump));
  const years: YearRow[] = [];
  let balance = principal;
  let paid = 0;
  let interest = 0;
  let capital = 0;
  let year = 1;
  let monthsTaken = 0;

  const flush = () => {
    years.push({
      year,
      paid: roundMoney(paid),
      interest: roundMoney(interest),
      capital: roundMoney(capital),
      balance: roundMoney(Math.max(0, balance))
    });
    paid = 0;
    interest = 0;
    capital = 0;
    year += 1;
  };

  const applyLump = (amount: number): boolean => {
    const lump = roundMoney(Math.min(Math.max(0, amount), balance));
    if (lump <= 0) {
      return false;
    }
    balance = roundMoney(balance - lump);
    paid += lump;
    capital += lump;
    if (balance <= 0.005) {
      balance = 0;
      return true;
    }
    return false;
  };

  if (applyLump(lumpSum)) {
    flush();
    return { years, monthsTaken: 0 };
  }

  for (let month = 1; month <= months; month += 1) {
    if (balance <= 0.005) {
      break;
    }
    if (yearly > 0 && (month - 1) % 12 === 0 && applyLump(yearly)) {
      flush();
      break;
    }
    if (balance <= 0.005) {
      break;
    }
    const monthInterest = roundMoney(balance * rate);
    let monthPaid = roundMoney(payment + extra);
    let monthCapital = roundMoney(Math.min(Math.max(monthPaid - monthInterest, 0), balance));
    if (monthCapital >= balance - 0.005 || month === months) {
      monthCapital = roundMoney(balance);
      monthPaid = roundMoney(monthInterest + monthCapital);
    }
    balance = Math.max(0, roundMoney(balance - monthCapital));
    paid += monthPaid;
    interest += monthInterest;
    capital += monthCapital;
    monthsTaken = month;
    if (month % 12 === 0 || balance <= 0.005) {
      flush();
    }
  }
  if (paid || interest || capital) {
    flush();
  }
  return { years, monthsTaken };
}

function calculate(): CalcResult | null {
  const amount = Number(amountInput.value);
  const rate = Number(rateInput.value);
  if (![amount, rate].every(Number.isFinite) || amount <= 0 || rate < 0) {
    return null;
  }
  const interestOnly = interestOnlyMonthly(amount, rate);
  if (kind === "interest_only") {
    const monthly = roundMoney(interestOnly);
    return {
      kind,
      monthly,
      monthlyTotal: monthly,
      otherMonthly: 0,
      months: 0,
      monthsTaken: 0,
      totalPaid: roundMoney(monthly * 12),
      totalInterest: roundMoney(monthly * 12),
      capitalRepaid: 0,
      balanceEnd: roundMoney(amount),
      interestSaved: 0,
      monthsSaved: 0,
      overpayKind: "none",
      overpayAmount: 0,
      years: []
    };
  }
  const years = Number(yearsInput.value);
  const extraMonths = Number(monthsInput.value);
  if (![years, extraMonths].every(Number.isFinite)) {
    return null;
  }
  const months = Math.round(years) * 12 + Math.round(extraMonths);
  if (months < 1 || months > 50 * 12) {
    return null;
  }
  const overpayAmount = Math.max(0, Number(overpayAmountInput.value) || 0);
  const extraMonthly = overpayKind === "monthly" ? overpayAmount : 0;
  const lumpSum = overpayKind === "lump" ? overpayAmount : 0;
  const yearlyLump = overpayKind === "yearly" ? overpayAmount : 0;
  const repayment = repaymentMonthly(amount, rate, months);
  const baseline = buildSchedule(amount, rate, months, repayment);
  const withOver = buildSchedule(amount, rate, months, repayment, extraMonthly, lumpSum, yearlyLump);
  const totalPaid = withOver.years.reduce((sum, row) => sum + row.paid, 0);
  const totalInterest = withOver.years.reduce((sum, row) => sum + row.interest, 0);
  const capitalRepaid = withOver.years.reduce((sum, row) => sum + row.capital, 0);
  const baseInterest = baseline.years.reduce((sum, row) => sum + row.interest, 0);
  return {
    kind,
    monthly: roundMoney(repayment),
    monthlyTotal: roundMoney(repayment + extraMonthly),
    otherMonthly: roundMoney(interestOnly),
    months,
    monthsTaken: withOver.monthsTaken,
    totalPaid: roundMoney(totalPaid),
    totalInterest: roundMoney(totalInterest),
    capitalRepaid: roundMoney(capitalRepaid),
    balanceEnd: roundMoney(withOver.years.at(-1)?.balance ?? 0),
    interestSaved: roundMoney(Math.max(0, baseInterest - totalInterest)),
    monthsSaved: Math.max(0, baseline.monthsTaken - withOver.monthsTaken),
    overpayKind,
    overpayAmount: roundMoney(overpayAmount),
    years: withOver.years
  };
}

function renderResults(): void {
  const result = calculate();
  if (!result) {
    output.innerHTML = `<div class="calc-empty">${
      kind === "interest_only"
        ? "Enter a loan amount and rate to see the monthly interest."
        : "Enter a loan amount, rate, and term to see monthly payments."
    }</div>`;
    schedulePanel.hidden = true;
    scheduleEl.innerHTML = "";
    graphEl.innerHTML = "";
    return;
  }

  if (result.kind === "interest_only") {
    output.innerHTML = `
      <p class="calc-kicker">Monthly payment</p>
      <p class="calc-monthly">${gbp(result.monthly)}</p>
      <p class="calc-sub">Interest only · the loan balance stays the same</p>
      <dl class="calc-metrics">
        <div><dt>Interest per year</dt><dd>${gbp(result.totalInterest)}</dd></div>
        <div><dt>Still owed</dt><dd>${gbp(result.balanceEnd)}</dd></div>
      </dl>
      <p class="calc-note">You only pay interest. The ${gbp(result.balanceEnd)} capital remains owing until it is repaid separately.</p>
    `;
    schedulePanel.hidden = true;
    scheduleEl.innerHTML = "";
    graphEl.innerHTML = "";
    return;
  }

  const interestShare =
    result.totalPaid > 0 ? Math.min(100, (result.totalInterest / result.totalPaid) * 100) : 0;
  const capitalShare = 100 - interestShare;
  const hasOverpay = result.overpayKind !== "none" && result.overpayAmount > 0;
  const paidOff = formatTerm(result.monthsTaken);
  const sub =
    result.monthsTaken === 0 && hasOverpay
      ? result.overpayKind === "yearly"
        ? "Cleared by yearly lump"
        : "Cleared by lump sum"
      : hasOverpay && result.monthsSaved
        ? `Paid off in ${paidOff} · ${formatTerm(result.monthsSaved)} sooner`
        : `${result.months} scheduled payments · capital and interest`;
  const heroAmount = result.overpayKind === "monthly" && result.overpayAmount > 0 ? result.monthlyTotal : result.monthly;
  const heroNote =
    result.overpayKind === "monthly" && result.overpayAmount > 0
      ? `includes ${gbp(result.overpayAmount)} overpayment`
      : result.overpayKind === "lump" && result.overpayAmount > 0
        ? `required payment · ${gbp(result.overpayAmount)} lump sum at start`
        : result.overpayKind === "yearly" && result.overpayAmount > 0
          ? `required payment · ${gbp(result.overpayAmount)} at the start of each year`
          : "capital and interest";

  output.innerHTML = `
    <p class="calc-kicker">Monthly payment</p>
    <p class="calc-monthly">${gbp(heroAmount)}</p>
    <p class="calc-sub">${escapeHtml(heroNote)} · ${escapeHtml(sub)}</p>
    <dl class="calc-metrics">
      <div><dt>Interest over term</dt><dd>${gbp(result.totalInterest)}</dd></div>
      <div><dt>Total paid</dt><dd>${gbp(result.totalPaid)}</dd></div>
      <div><dt>Capital repaid</dt><dd>${gbp(result.capitalRepaid)}</dd></div>
      ${
        hasOverpay
          ? `<div><dt>Interest saved</dt><dd>${gbp(result.interestSaved)}</dd></div>
             <div><dt>Paid off in</dt><dd>${escapeHtml(paidOff)}</dd></div>`
          : ""
      }
    </dl>
    <div class="calc-split" title="Share of total paid">
      <div class="calc-split-track">
        <span class="calc-split-interest" style="width:${interestShare.toFixed(2)}%"></span>
        <span class="calc-split-capital" style="width:${capitalShare.toFixed(2)}%"></span>
      </div>
      <div class="calc-split-legend">
        <span>Interest ${interestShare.toFixed(0)}%</span>
        <span>Capital ${capitalShare.toFixed(0)}%</span>
      </div>
    </div>
    ${
      hasOverpay && result.interestSaved > 0
        ? `<p class="calc-compare">Overpaying saves <strong>${gbp(result.interestSaved)}</strong>${
            result.monthsSaved ? ` and ${formatTerm(result.monthsSaved)}` : ""
          }.</p>`
        : `<p class="calc-compare">Interest-only would be <strong>${gbp(result.otherMonthly)}</strong> / month</p>`
    }
  `;

  scheduleEl.innerHTML = renderYearList(result.years);
  graphEl.innerHTML = renderYearChart(result.years);
  schedulePanel.hidden = false;
  syncYearView();
}

function setKind(next: MortgageKind): void {
  kind = next;
  document.querySelectorAll<HTMLButtonElement>("[data-kind]").forEach((button) => {
    button.classList.toggle("active", button.dataset.kind === kind);
  });
  document.querySelectorAll<HTMLElement>("[data-term-field], [data-overpay-field]").forEach((field) => {
    field.hidden = kind === "interest_only";
  });
  renderResults();
}

function applyMortgage(id: string): void {
  const row = mortgages.find((item) => item.id === id);
  if (!row) {
    return;
  }
  const amount = roundMoney(Number(row.outstanding_balance || row.original_loan_amount || 0));
  amountInput.value = amount ? String(amount) : "";
  const rate = Number(row.interest_rate);
  rateInput.value = Number.isFinite(rate) ? String(roundMoney(rate)) : "";
  const type = String(row.mortgage_type || "repayment");
  setKind(type === "interest_only" ? "interest_only" : "repayment");
  const termMonths = monthsBetween(String(row.start_date || ""), String(row.end_date || ""));
  if (termMonths) {
    yearsInput.value = String(Math.floor(termMonths / 12));
    monthsInput.value = String(termMonths % 12);
  }
  renderResults();
}

function resetForm(): void {
  mortgageSelect.value = "";
  amountInput.value = DEFAULTS.amount;
  rateInput.value = DEFAULTS.rate;
  yearsInput.value = DEFAULTS.years;
  monthsInput.value = DEFAULTS.months;
  overpayKind = "none";
  overpayAmountInput.value = "0";
  syncOverpayUi();
  setKind("repayment");
}

document.querySelectorAll<HTMLButtonElement>("[data-kind]").forEach((button) => {
  button.addEventListener("click", () => {
    setKind(button.dataset.kind === "interest_only" ? "interest_only" : "repayment");
  });
});

for (const input of [amountInput, rateInput, yearsInput, monthsInput, overpayAmountInput]) {
  input.addEventListener("input", renderResults);
  input.addEventListener("blur", () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }
    if (input === yearsInput || input === monthsInput) {
      input.value = String(Math.round(value));
      return;
    }
    input.value = String(roundMoney(value));
  });
}

document.querySelectorAll<HTMLButtonElement>("[data-overpay]").forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.overpay;
    overpayKind = next === "monthly" || next === "lump" || next === "yearly" ? next : "none";
    syncOverpayUi();
    renderResults();
  });
});

mortgageSelect.addEventListener("change", () => {
  if (mortgageSelect.value) {
    applyMortgage(mortgageSelect.value);
  } else {
    renderResults();
  }
});

document.getElementById("calc-reset")?.addEventListener("click", resetForm);

document.querySelectorAll<HTMLButtonElement>("[data-year-view]").forEach((button) => {
  button.addEventListener("click", () => {
    yearView = button.dataset.yearView === "graph" ? "graph" : "list";
    sessionStorage.setItem(YEAR_VIEW_KEY, yearView);
    syncYearView();
  });
});

function hideCalcChartTip(): void {
  const tip = document.getElementById("calc-chart-tooltip");
  if (tip) {
    tip.hidden = true;
  }
}

graphEl.addEventListener("pointermove", (event) => {
  const hit = (event.target as Element | null)?.closest(".calc-chart-hit") as SVGRectElement | null;
  const tip = document.getElementById("calc-chart-tooltip");
  const canvas = graphEl.querySelector(".calc-chart-canvas") as HTMLElement | null;
  if (!hit || !tip || !canvas) {
    hideCalcChartTip();
    return;
  }
  const year = hit.dataset.year || "";
  tip.hidden = false;
  tip.innerHTML = `<div class="tip-label">Year ${escapeHtml(year)}</div>
    <div>Interest ${gbp(Number(hit.dataset.interest))}</div>
    <div>Capital ${gbp(Number(hit.dataset.capital))}</div>
    <div>Paid ${gbp(Number(hit.dataset.paid))}</div>
    <div>Balance ${gbp(Number(hit.dataset.balance))}</div>`;
  const box = canvas.getBoundingClientRect();
  const left = event.clientX - box.left;
  const half = Math.min(110, box.width / 3);
  tip.style.left = `${Math.min(box.width - half - 8, Math.max(half + 8, left))}px`;
  tip.style.top = `${Math.max(12, event.clientY - box.top - 12)}px`;
});
graphEl.addEventListener("pointerleave", hideCalcChartTip);

async function loadMortgages(): Promise<void> {
  try {
    const data = await api<{ mortgages: MortgageOption[] }>("/mortgages");
    mortgages = data.mortgages.filter((row) => row.status === "active");
    if (!mortgages.length) {
      return;
    }
    mortgageSelect.insertAdjacentHTML(
      "beforeend",
      mortgages
        .map((row) => {
          const label = `${row.property_name} · ${row.lender}`;
          return `<option value="${escapeHtml(row.id)}">${escapeHtml(label)}</option>`;
        })
        .join("")
    );
  } catch {
    /* calculator still works without saved mortgages */
  }
}

renderResults();
void loadMortgages();
