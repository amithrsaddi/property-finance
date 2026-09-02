import { api, getUser, money, qs } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

if (location.hash === "#settings") {
  window.location.replace("/settings");
} else if (location.hash === "#backup") {
  window.location.replace("/backup");
} else if (location.hash === "#profile") {
  window.location.replace("/profile");
}

const nowYear = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => nowYear - 5 + i);
const PORTFOLIO_KEY = "pf-dashboard-property-scope";
type PortfolioScope = "all" | "rental" | "personal";
const user = getUser()!;

function readPortfolio(): PortfolioScope {
  const value = sessionStorage.getItem(PORTFOLIO_KEY);
  return value === "all" || value === "rental" || value === "personal" ? value : "rental";
}

const initialPortfolio = readPortfolio();

const root = mountShell(
  "/dashboard",
  `Financial overview ${nowYear}`,
  "Overview of income and expenses",
  `<label class="year-select"><span>Properties</span>
    <select id="portfolio">
      <option value="all"${initialPortfolio === "all" ? " selected" : ""}>All</option>
      <option value="rental"${initialPortfolio === "rental" ? " selected" : ""}>Rental</option>
      <option value="personal"${initialPortfolio === "personal" ? " selected" : ""}>Personal</option>
    </select>
  </label>
  <label class="year-select"><span>Year</span>
    <select id="year">${YEARS.map((year) => `<option value="${year}" ${year === nowYear ? "selected" : ""}>${year}</option>`).join("")}</select>
  </label>`
);

root.innerHTML = `
  <div class="status" id="status" hidden></div>
  <section class="overview-cards" id="cards"></section>
  <section class="overview-mid">
    <div class="panel overview-chart-panel">
      <div class="overview-panel-head">
        <h2>Income vs Expenses</h2>
        <div class="chart-toolbar">
          <div class="chart-menu">
            <button class="chart-menu-btn" id="chart-menu-btn" type="button" aria-label="Chart style options" aria-haspopup="true" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
            <div class="chart-menu-pop" id="chart-menu-pop" hidden>
              <div class="chart-menu-title">Chart style</div>
              <button type="button" data-chart="line">Line chart</button>
              <button type="button" data-chart="area">Area chart</button>
              <button type="button" data-chart="bar">Bar chart</button>
            </div>
          </div>
        </div>
      </div>
      <div id="chart"></div>
    </div>
    <div class="panel overview-status-panel">
      <h2>Status Overview</h2>
      <div id="status-overview"></div>
    </div>
  </section>
  <section class="panel overview-breakdowns">
    <div class="overview-panel-head">
      <h2>Financial Breakdowns</h2>
      <div class="period-toggle" id="period-toggle">
        <button type="button" data-period="year" class="active">Year</button>
        <button type="button" data-period="quarter">Quarter</button>
        <button type="button" data-period="month">Month</button>
      </div>
    </div>
    <div id="breakdowns"></div>
  </section>
`;

type MonthPoint = {
  month: string;
  label: string;
  rent: number;
  expenses: number;
  netProfit: number;
  pending: number;
};

type Overview = {
  year: number;
  cards: {
    rent: { amount: number; expected: number; outstanding: number; count: number };
    expenses: { amount: number; mortgage: number; property: number; additional: number; count: number };
    netProfit: { amount: number };
    pendingExpenses: { amount: number; expenses: number; mortgages: number; count: number };
    pendingIncome: { amount: number; count: number };
  };
  monthly: MonthPoint[];
  breakdowns: {
    year: { label: string; rent: number; expenses: number; netProfit: number; pending: number };
    quarters: MonthPoint[] | Array<{ label: string; rent: number; expenses: number; netProfit: number; pending: number }>;
    months: MonthPoint[];
  };
};

let cache: Overview | null = null;
let period: "year" | "quarter" | "month" = "year";
type ChartStyle = "line" | "area" | "bar";
const CHART_STYLE_KEY = "pf-chart-style";

function getChartStyle(): ChartStyle {
  const value = localStorage.getItem(CHART_STYLE_KEY);
  return value === "area" || value === "bar" ? value : "line";
}

function setChartStyle(style: ChartStyle): void {
  localStorage.setItem(CHART_STYLE_KEY, style);
}

function syncChartMenu(): void {
  const current = getChartStyle();
  document.querySelectorAll<HTMLButtonElement>("#chart-menu-pop [data-chart]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chart === current);
  });
}

function selectedYear(): string {
  return (document.getElementById("year") as HTMLSelectElement).value;
}

function selectedPortfolio(): PortfolioScope {
  const value = (document.getElementById("portfolio") as HTMLSelectElement).value;
  return value === "all" || value === "rental" || value === "personal" ? value : "rental";
}

function setTitle(year: string): void {
  const heading = document.querySelector(".topbar h1");
  if (heading) {
    heading.textContent = `Financial overview ${year}`;
  }
}

function setSubtitle(scope: PortfolioScope): void {
  const subtitle = document.querySelector(".topbar p");
  if (!subtitle) {
    return;
  }
  if (scope === "rental") {
    subtitle.textContent = "Income and expenses for buy-to-let properties.";
  } else if (scope === "personal") {
    subtitle.textContent = "Income and expenses for residential properties.";
  } else {
    subtitle.textContent = "Overview of income and expenses";
  }
}

function pct(part: number, total: number): number {
  if (!total) {
    return 0;
  }
  return Math.round((part / total) * 100);
}

function n(value: number): string {
  return value.toFixed(1);
}

function monotonePath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) {
    return "";
  }
  if (points.length === 1) {
    return `M${n(points[0].x)} ${n(points[0].y)}`;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const last = points.length - 1;
  const delta: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < last; i++) {
    delta[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1);
  }
  m[0] = delta[0];
  for (let i = 1; i < last; i++) {
    m[i] = (delta[i - 1] + delta[i]) / 2;
  }
  m[last] = delta[last - 1];
  for (let i = 0; i < last; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / delta[i];
      const b = m[i + 1] / delta[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * delta[i];
        m[i + 1] = t * b * delta[i];
      }
    }
  }
  let d = `M${n(xs[0])} ${n(ys[0])}`;
  for (let i = 0; i < last; i++) {
    const h = xs[i + 1] - xs[i];
    d += ` C${n(xs[i] + h / 3)} ${n(ys[i] + (m[i] * h) / 3)} ${n(xs[i + 1] - h / 3)} ${n(ys[i + 1] - (m[i + 1] * h) / 3)} ${n(xs[i + 1])} ${n(ys[i + 1])}`;
  }
  return d;
}

function donut(percent: number, kind: "rent" | "expenses" | "pending"): string {
  const size = 54;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = c - (clamped / 100) * c;
  const arc =
    clamped > 0
      ? `<circle class="donut-arc ${kind}" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>`
      : "";
  return `<div class="donut-wrap">
    <svg class="donut" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="donut-track ${kind}" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"/>
      ${arc}
    </svg>
    <span class="donut-pct">${Math.round(clamped)}%</span>
  </div>`;
}

function renderChart(points: MonthPoint[], style: ChartStyle, size?: { width: number; height: number }): string {
  const width = size?.width ?? 760;
  const height = size?.height ?? 248;
  const pad = { l: 36, r: 16, t: 10, b: 26 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...points.flatMap((p) => [p.rent, p.expenses]), 1);
  const count = Math.max(points.length, 1);
  const band = innerW / count;
  const x = (i: number) => pad.l + band * (i + 0.5);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const baseY = y(0);
  const ticks = 4;
  const year = selectedYear();
  const hGrid = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = (max / ticks) * i;
    const yy = y(value);
    const label = value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value));
    return `<line x1="${pad.l}" y1="${yy}" x2="${width - pad.r}" y2="${yy}" class="chart-grid"/>
      <text x="${pad.l - 8}" y="${yy + 4}" text-anchor="end" class="chart-axis">${label}</text>`;
  }).join("");
  const vGrid = points
    .map((_, i) => `<line x1="${n(x(i))}" y1="${pad.t}" x2="${n(x(i))}" y2="${pad.t + innerH}" class="chart-grid"/>`)
    .join("");
  const xAxis = `<line x1="${pad.l}" y1="${pad.t + innerH}" x2="${width - pad.r}" y2="${pad.t + innerH}" class="chart-axis-line"/>`;
  const labels = points
    .map((p, i) => `<text x="${n(x(i))}" y="${height - 8}" text-anchor="middle" class="chart-axis">${p.label}</text>`)
    .join("");

  const rentPts = points.map((p, i) => ({ x: x(i), y: y(p.rent) }));
  const expPts = points.map((p, i) => ({ x: x(i), y: y(p.expenses) }));
  const rentPath = monotonePath(rentPts);
  const expPath = monotonePath(expPts);
  const last = count - 1;

  let series = "";
  if (style === "bar") {
    const barW = Math.max(4, Math.min(28, (band * 0.8) / 2 - 1));
    series = points
      .map((p, i) => {
        const center = x(i);
        const rentH = Math.max(baseY - y(p.rent), 0);
        const expH = Math.max(baseY - y(p.expenses), 0);
        return `<rect class="chart-bar rent" x="${n(center - barW - 1)}" y="${n(y(p.rent))}" width="${n(barW)}" height="${n(rentH)}" rx="4" ry="4"/>
          <rect class="chart-bar expense" x="${n(center + 1)}" y="${n(y(p.expenses))}" width="${n(barW)}" height="${n(expH)}" rx="4" ry="4"/>`;
      })
      .join("");
  } else {
    if (style === "area") {
      series += `<path class="chart-area expense" d="${expPath} L${n(x(last))} ${n(baseY)} L${n(x(0))} ${n(baseY)} Z"/>`;
      series += `<path class="chart-area rent" d="${rentPath} L${n(x(last))} ${n(baseY)} L${n(x(0))} ${n(baseY)} Z"/>`;
    }
    const dash = style === "line" ? ` stroke-dasharray="6 4"` : "";
    series += `<path class="chart-series expense" d="${expPath}" stroke-width="2"${dash}/>`;
    series += `<path class="chart-series rent" d="${rentPath}" stroke-width="2.5"/>`;
    const rentR = style === "line" ? 4 : 3;
    series += rentPts
      .map((p) => `<circle class="chart-dot rent" cx="${n(p.x)}" cy="${n(p.y)}" r="${rentR}" stroke-width="2"/>`)
      .join("");
    series += expPts
      .map((p) => `<circle class="chart-dot expense" cx="${n(p.x)}" cy="${n(p.y)}" r="3" stroke-width="2"/>`)
      .join("");
  }

  const hits = points
    .map((p, i) => {
      const tip = `${p.label} ${year}`;
      return `<rect class="chart-hit" data-i="${i}" data-label="${tip}" data-rent="${p.rent}" data-expenses="${p.expenses}" data-x="${n(x(i))}" data-yr="${n(y(p.rent))}" data-ye="${n(y(p.expenses))}" x="${n(pad.l + band * i)}" y="${pad.t}" width="${n(band)}" height="${n(innerH)}"/>`;
    })
    .join("");

  return `<div class="overview-chart-wrap">
    <div class="chart-in-legend">
      <span><i class="legend-rent"></i> Rent</span>
      <span><i class="legend-expense"></i> Expenses</span>
    </div>
    <div class="overview-chart-canvas">
      <svg class="overview-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" width="100%" height="100%" role="img" aria-label="Rent versus expenses ${style} chart">
        ${hGrid}${vGrid}${xAxis}
        <rect class="chart-hover-band" id="chart-hover-band" x="0" y="${pad.t}" width="${n(band)}" height="${n(innerH)}" />
        ${series}
        ${labels}
        <line class="chart-cursor" id="chart-cursor" x1="0" y1="${pad.t}" x2="0" y2="${pad.t + innerH}" hidden />
        <circle class="chart-dot rent" id="chart-active-rent" cx="0" cy="0" r="6" stroke-width="2" hidden />
        <circle class="chart-dot expense" id="chart-active-exp" cx="0" cy="0" r="5" stroke-width="2" hidden />
        ${hits}
      </svg>
      <div class="chart-tooltip" id="chart-tooltip" hidden></div>
    </div>
  </div>`;
}

function renderCards(data: Overview): string {
  const c = data.cards;
  const currency = user.preferredCurrency;
  return `
    <article class="overview-card rent">
      <div class="label">Rent</div>
      <div class="value">${money(c.rent.amount, currency)}</div>
      <div class="details">
        <span>Payments: ${c.rent.count}</span>
        <span>Expected: ${money(c.rent.expected, currency)}</span>
        <span>Outstanding: ${money(c.rent.outstanding, currency)}</span>
      </div>
    </article>
    <article class="overview-card expenses">
      <div class="label">Expenses</div>
      <div class="value">${money(c.expenses.amount, currency)}</div>
      <div class="details">
        <span>Items: ${c.expenses.count}</span>
        <span>Mortgage: ${money(c.expenses.mortgage, currency)}</span>
        <span>Property: ${money(c.expenses.property + c.expenses.additional, currency)}</span>
      </div>
    </article>
    <article class="overview-card profit">
      <div class="label">Net Profit</div>
      <div class="value">${money(c.netProfit.amount, currency)}</div>
      <div class="details">
        <span>Rent − Expenses</span>
        <span>${c.netProfit.amount >= 0 ? "In profit" : "In deficit"}</span>
      </div>
    </article>
    <article class="overview-card pending-expense">
      <div class="label">Pending Expenses</div>
      <div class="value">${money(c.pendingExpenses.amount, currency)}</div>
      <div class="details">
        <span>Items: ${c.pendingExpenses.count}</span>
        <span>Mortgage: ${money(c.pendingExpenses.mortgages, currency)}</span>
        <span>Other: ${money(c.pendingExpenses.expenses, currency)}</span>
      </div>
    </article>
    <article class="overview-card pending-income">
      <div class="label">Pending Income</div>
      <div class="value">${money(c.pendingIncome.amount, currency)}</div>
      <div class="details">
        <span>Payments: ${c.pendingIncome.count}</span>
        <span>Still to collect</span>
      </div>
    </article>
  `;
}

function renderStatus(data: Overview): string {
  const rent = data.cards.rent.amount;
  const expenses = data.cards.expenses.amount;
  const pending = data.cards.pendingIncome.amount + data.cards.pendingExpenses.amount;
  const total = rent + expenses + pending;
  return `
    <div class="donut-row">${donut(pct(rent, total), "rent")}
      <div><strong>Rent</strong><span>Payments: ${data.cards.rent.count.toLocaleString("en-GB")}</span></div></div>
    <div class="donut-row">${donut(pct(expenses, total), "expenses")}
      <div><strong>Expenses</strong><span>Items: ${data.cards.expenses.count.toLocaleString("en-GB")}</span></div></div>
    <div class="donut-row">${donut(pct(pending, total), "pending")}
      <div><strong>Pending</strong><span>Items: ${(data.cards.pendingIncome.count + data.cards.pendingExpenses.count).toLocaleString("en-GB")}</span></div></div>
  `;
}

function breakdownLabel(row: { label: string }): string {
  const quarters: Record<string, string> = {
    Q1: "Q1 — Jan, Feb, Mar",
    Q2: "Q2 — Apr, May, Jun",
    Q3: "Q3 — Jul, Aug, Sep",
    Q4: "Q4 — Oct, Nov, Dec"
  };
  if (quarters[row.label]) {
    return quarters[row.label];
  }
  const months: Record<string, string> = {
    Jan: "January",
    Feb: "February",
    Mar: "March",
    Apr: "April",
    May: "May",
    Jun: "June",
    Jul: "July",
    Aug: "August",
    Sep: "September",
    Oct: "October",
    Nov: "November",
    Dec: "December"
  };
  return months[row.label] || row.label;
}

function renderBreakdowns(data: Overview): string {
  const currency = user.preferredCurrency;
  const rows =
    period === "year"
      ? [data.breakdowns.year]
      : period === "quarter"
        ? data.breakdowns.quarters
        : data.breakdowns.months;
  return rows
    .map(
      (row) => `
      <article class="breakdown-block">
        <div class="breakdown-block-head">${breakdownLabel(row)}</div>
        <div class="breakdown-grid">
          <div class="breakdown-cell">
            <div class="label">Gross Rent</div>
            <div class="value rent">${money(row.rent, currency)}</div>
          </div>
          <div class="breakdown-cell">
            <div class="label">Gross Expenses</div>
            <div class="value expenses">${money(row.expenses, currency)}</div>
          </div>
          <div class="breakdown-cell">
            <div class="label">Net Profit</div>
            <div class="value profit${row.netProfit < 0 ? " negative" : ""}">${money(row.netProfit, currency)}</div>
            <div class="hint">Rent − Expenses</div>
          </div>
          <div class="breakdown-cell">
            <div class="label">Pending</div>
            <div class="value pending${row.pending < 0 ? " negative" : ""}">${money(row.pending, currency)}</div>
            <div class="hint">Income + Expenses still due</div>
          </div>
        </div>
      </article>`
    )
    .join("");
}

function chartBox(): { width: number; height: number } {
  const host = document.getElementById("chart");
  const width = Math.max(360, Math.round(host?.clientWidth || 760));
  const height = Math.max(240, Math.round(host?.clientHeight ? Math.max(host.clientHeight - 28, 240) : 248));
  return { width, height };
}

function paintChart(points: MonthPoint[], style: ChartStyle): void {
  const host = document.getElementById("chart");
  if (!host) {
    return;
  }
  const size = chartBox();
  const key = `${size.width}x${size.height}:${style}:${points.length}`;
  if (host.dataset.chartKey === key && host.querySelector("svg.overview-chart")) {
    return;
  }
  host.dataset.chartKey = key;
  host.innerHTML = renderChart(points, style, size);
}

function bindChartResize(): void {
  const host = document.getElementById("chart");
  if (!host || host.dataset.resizeBound === "1") {
    return;
  }
  host.dataset.resizeBound = "1";
  const observer = new ResizeObserver(() => {
    if (cache) {
      paintChart(cache.monthly, getChartStyle());
    }
  });
  observer.observe(host);
}

function render(data: Overview): void {
  document.getElementById("cards")!.innerHTML = renderCards(data);
  paintChart(data.monthly, getChartStyle());
  bindChartResize();
  syncChartMenu();
  document.getElementById("status-overview")!.innerHTML = renderStatus(data);
  document.getElementById("breakdowns")!.innerHTML = renderBreakdowns(data);
}

async function loadOverview(): Promise<void> {
  const status = document.getElementById("status") as HTMLDivElement;
  const year = selectedYear();
  const scope = selectedPortfolio();
  sessionStorage.setItem(PORTFOLIO_KEY, scope);
  setTitle(year);
  setSubtitle(scope);
  try {
    cache = await api<Overview>(`/dashboard${qs({ year, scope })}`);
    render(cache);
    setStatus(status, "", "info");
  } catch (error) {
    setStatus(status, (error as Error).message, "error");
  }
}

document.getElementById("year")?.addEventListener("change", () => {
  void loadOverview();
});
document.getElementById("portfolio")?.addEventListener("change", () => {
  void loadOverview();
});

document.getElementById("period-toggle")?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button[data-period]") as HTMLButtonElement | null;
  if (!button || !cache) {
    return;
  }
  period = button.dataset.period as "year" | "quarter" | "month";
  document.querySelectorAll("#period-toggle button").forEach((el) => {
    el.classList.toggle("active", el === button);
  });
  document.getElementById("breakdowns")!.innerHTML = renderBreakdowns(cache);
});

const chartMenuBtn = document.getElementById("chart-menu-btn");
const chartMenuPop = document.getElementById("chart-menu-pop");

function setChartMenuOpen(open: boolean): void {
  if (!chartMenuPop || !chartMenuBtn) {
    return;
  }
  chartMenuPop.hidden = !open;
  chartMenuBtn.setAttribute("aria-expanded", String(open));
}

chartMenuBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  setChartMenuOpen(Boolean(chartMenuPop?.hidden));
});

chartMenuPop?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button[data-chart]") as HTMLButtonElement | null;
  if (!button || !cache) {
    return;
  }
  const style = button.dataset.chart as ChartStyle;
  if (style !== "line" && style !== "area" && style !== "bar") {
    return;
  }
  setChartStyle(style);
  setChartMenuOpen(false);
  paintChart(cache.monthly, style);
  syncChartMenu();
});

document.addEventListener("click", () => setChartMenuOpen(false));

function hideChartHover(): void {
  const tooltip = document.getElementById("chart-tooltip");
  const cursor = document.getElementById("chart-cursor");
  const band = document.getElementById("chart-hover-band");
  const rentDot = document.getElementById("chart-active-rent");
  const expDot = document.getElementById("chart-active-exp");
  if (tooltip) {
    tooltip.hidden = true;
  }
  cursor?.setAttribute("hidden", "");
  rentDot?.setAttribute("hidden", "");
  expDot?.setAttribute("hidden", "");
  band?.classList.remove("is-on");
}

function showChartHover(hit: SVGRectElement): void {
  const tooltip = document.getElementById("chart-tooltip");
  const cursor = document.getElementById("chart-cursor") as SVGLineElement | null;
  const band = document.getElementById("chart-hover-band") as SVGRectElement | null;
  const rentDot = document.getElementById("chart-active-rent") as SVGCircleElement | null;
  const expDot = document.getElementById("chart-active-exp") as SVGCircleElement | null;
  const canvas = document.querySelector(".overview-chart-canvas") as HTMLElement | null;
  const svg = canvas?.querySelector("svg") as SVGSVGElement | null;
  if (!tooltip || !canvas || !svg) {
    return;
  }
  const rent = Number(hit.dataset.rent || 0);
  const expenses = Number(hit.dataset.expenses || 0);
  const label = hit.dataset.label || "";
  const px = Number(hit.dataset.x || 0);
  const yr = Number(hit.dataset.yr || 0);
  const ye = Number(hit.dataset.ye || 0);
  const style = getChartStyle();
  tooltip.innerHTML = `<p class="tip-label">${label}</p>
    <p class="tip-rent">Rent ${money(rent, user.preferredCurrency)}</p>
    <p class="tip-exp">Expenses ${money(expenses, user.preferredCurrency)}</p>`;
  tooltip.hidden = false;
  const canvasBox = canvas.getBoundingClientRect();
  const pt = svg.createSVGPoint();
  pt.x = px;
  pt.y = Math.min(yr, ye);
  const ctm = svg.getScreenCTM();
  const screen = ctm ? pt.matrixTransform(ctm) : { x: canvasBox.left + canvasBox.width / 2, y: canvasBox.top };
  const left = screen.x - canvasBox.left;
  const top = screen.y - canvasBox.top;
  const half = tooltip.offsetWidth / 2;
  tooltip.style.left = `${Math.min(canvas.clientWidth - half - 8, Math.max(half + 8, left))}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.transform = top < 56 ? "translate(-50%, 12px)" : "translate(-50%, calc(-100% - 10px))";
  if (band) {
    band.setAttribute("x", hit.getAttribute("x") || "0");
    band.classList.toggle("is-on", style === "bar");
  }
  if (cursor) {
    if (style === "bar") {
      cursor.setAttribute("hidden", "");
    } else {
      cursor.removeAttribute("hidden");
      cursor.setAttribute("x1", String(px));
      cursor.setAttribute("x2", String(px));
    }
  }
  if (rentDot && expDot) {
    if (style === "bar") {
      rentDot.setAttribute("hidden", "");
      expDot.setAttribute("hidden", "");
    } else {
      rentDot.removeAttribute("hidden");
      expDot.removeAttribute("hidden");
      rentDot.setAttribute("cx", String(px));
      rentDot.setAttribute("cy", String(yr));
      expDot.setAttribute("cx", String(px));
      expDot.setAttribute("cy", String(ye));
    }
  }
}

function bindChartHover(): void {
  const host = document.getElementById("chart");
  if (!host || host.dataset.bound === "1") {
    return;
  }
  host.dataset.bound = "1";
  host.addEventListener("mousemove", (event) => {
    const hit = (event.target as Element | null)?.closest(".chart-hit") as SVGRectElement | null;
    if (!hit) {
      return;
    }
    showChartHover(hit);
  });
  host.addEventListener("mouseleave", () => hideChartHover());
}

syncChartMenu();
bindChartHover();
void loadOverview();
