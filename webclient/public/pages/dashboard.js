// src/lib.ts
var TOKEN_KEY = "authToken";
var USER_KEY = "authUser";
var THEME_KEY = "pf-theme";
function apiBase() {
  if (window.APP_CONFIG?.apiBaseUrl) {
    return window.APP_CONFIG.apiBaseUrl;
  }
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3000";
  }
  return "/api";
}
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function requireSession() {
  const token = getToken();
  const user2 = getUser();
  if (!token || !user2) {
    clearSession();
    window.location.href = "/";
    throw new Error("Not authenticated");
  }
  return user2;
}
async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && options.auth !== false) {
    clearSession();
    window.location.href = "/";
    throw new Error(data.message || "Session expired.");
  }
  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}
function getDecimalPrecision() {
  const n2 = Number(getUser()?.decimalPrecision);
  if (!Number.isFinite(n2)) {
    return 2;
  }
  return Math.min(4, Math.max(0, Math.round(n2)));
}
function money(amount, currency = getUser()?.preferredCurrency || "GBP", precision = getDecimalPrecision()) {
  const n2 = Number(precision);
  const digits = Number.isFinite(n2) ? Math.min(4, Math.max(0, Math.round(n2))) : 2;
  try {
    return new Intl.NumberFormat(void 0, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toFixed(digits)}`;
  }
}
function getTheme() {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}
function applyTheme(theme = getTheme()) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}
function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}
function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0 && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}

// src/shell.ts
var MORTGAGES_NAV_KEY = "pf-mortgages-nav-open";
function icon(path, className = "nav-icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}
var ICON_COG = icon(
  '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 3.5v2.2M12 18.3v2.2M4.8 6.5l1.6 1.6M17.6 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.5l1.6-1.6M17.6 8.1l1.6-1.6"/>'
);
var ICON_MOON = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5z"/>'
);
var ICON_SUN_GLYPH = icon(
  '<circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2.8v1.8M12 19.4v1.8M4.6 4.6l1.3 1.3M18.1 18.1l1.3 1.3M2.8 12h1.8M19.4 12h1.8M4.6 19.4l1.3-1.3M18.1 5.9l1.3-1.3"/>',
  "theme-switch-glyph"
);
var ICON_MOON_GLYPH = icon(
  '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5z"/>',
  "theme-switch-glyph"
);
var ICON_USER = icon(
  '<circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5 19.2c.8-3.2 3.5-5 7-5s6.2 1.8 7 5"/>'
);
var ICON_CHEVRON = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>',
  "nav-chevron"
);
var ICON_DASHBOARD = icon(
  '<rect x="3" y="3" width="7" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="3" width="7" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="12" width="7" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="16" width="7" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/>'
);
var ICON_PROPERTIES = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 21V8.2L12 3l8 5.2V21"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M9 21v-6.5h6V21"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9 10.5h.01M12 10.5h.01M15 10.5h.01"/>'
);
var ICON_MORTGAGES = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 21h18M5.5 21V11.5h13V21M4 11.5 12 4l8 7.5"/>'
);
var ICON_RENT = icon(
  '<rect x="2.5" y="6.5" width="19" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M6.2 12h.01M17.8 12h.01"/>'
);
var ICON_PAYMENTS = icon(
  '<rect x="2.5" y="5.5" width="19" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M2.5 10h19"/>'
);
var ICON_RATES = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M18.5 5.5 5.5 18.5"/><circle cx="7" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/>'
);
var ICON_DOCUMENTS = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M7 3.5h7.2L19.5 9v11.5H7z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 3.5V9h5.5M9.5 13h6M9.5 16.5h6"/>'
);
var ICON_EXPENSES = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M6 3.5v17l1.6-1 1.6 1 1.6-1 1.6 1 1.6-1 1.6 1 1.6-1V3.5l-1.6 1-1.6-1-1.6 1-1.6-1-1.6 1-1.6-1-1.6 1z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9 8.5h6M9 12h6M9 15.5h4"/>'
);
var ICON_REPORTS = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M6 19v-6M12 19V6M18 19v-9"/>'
);
var NAV = [
  { href: "/dashboard.html", label: "Dashboard", icon: ICON_DASHBOARD },
  { href: "/properties.html", label: "Properties", icon: ICON_PROPERTIES },
  { href: "/rent.html", label: "Rent", icon: ICON_RENT },
  {
    label: "Mortgages",
    icon: ICON_MORTGAGES,
    children: [
      { href: "/payments.html", label: "Payments", icon: ICON_PAYMENTS },
      { href: "/rates.html", label: "Rates", icon: ICON_RATES }
    ]
  },
  { href: "/expenses.html", label: "Expenses", icon: ICON_EXPENSES },
  { href: "/documents.html", label: "Documents", icon: ICON_DOCUMENTS },
  { href: "/reports.html", label: "Reports", icon: ICON_REPORTS }
];
function isMortgagesPath(path) {
  return path === "/payments.html" || path === "/rates.html";
}
function mortgagesNavOpen(activePath) {
  if (isMortgagesPath(activePath)) {
    return true;
  }
  try {
    return sessionStorage.getItem(MORTGAGES_NAV_KEY) === "1";
  } catch {
    return false;
  }
}
function renderNav(activePath) {
  return NAV.map((item) => {
    if (item.children?.length) {
      const childActive = item.children.some((child) => child.href === activePath);
      const open = mortgagesNavOpen(activePath);
      return `<div class="nav-group${open ? " open" : ""}">
        <button class="nav-group-toggle${childActive ? " active" : ""}" id="mortgages-nav-toggle" type="button" aria-expanded="${open}" aria-controls="mortgages-nav-sub">
          <span class="nav-group-label">${item.icon}${item.label}</span>
          ${ICON_CHEVRON}
        </button>
        <div class="nav-sub" id="mortgages-nav-sub"${open ? "" : " hidden"}>
          ${item.children.map(
        (child) => `<a href="${child.href}" class="${child.href === activePath ? "active" : ""}">${child.icon}${child.label}</a>`
      ).join("")}
        </div>
      </div>`;
    }
    return `<a href="${item.href}" class="${item.href === activePath ? "active" : ""}">${item.icon}${item.label}</a>`;
  }).join("");
}
function mountShell(activePath, title, subtitle = "", actionsHtml = "") {
  requireSession();
  applyTheme();
  const user2 = getUser();
  document.body.innerHTML = `
    <div class="app-shell" id="app-shell">
      <div class="nav-backdrop" id="nav-backdrop"></div>
      <aside class="sidebar" id="app-sidebar">
        <div class="brand">
          Property Finance
          <span>Management Suite</span>
        </div>
        <nav class="nav">
          ${renderNav(activePath)}
        </nav>
        <div class="sidebar-bottom">
          <div class="sidebar-system">
            <div class="sidebar-options-label">System</div>
            <nav class="nav">
              <a href="/settings.html" class="${activePath === "/settings.html" ? "active" : ""}">
                ${ICON_COG}Settings
              </a>
              <button class="theme-option" id="theme-toggle" type="button" role="switch" aria-checked="false">
                <span class="theme-option-label">${ICON_MOON}Dark mode</span>
                <span class="theme-switch-track" aria-hidden="true">
                  ${ICON_SUN_GLYPH}
                  <span class="theme-switch-thumb"></span>
                  ${ICON_MOON_GLYPH}
                </span>
              </button>
            </nav>
          </div>
          <a href="/profile.html" class="sidebar-profile${activePath === "/profile.html" ? " active" : ""}">
            <span class="profile-avatar">${ICON_USER}</span>
            <span class="sidebar-profile-name">${user2.name}</span>
          </a>
          <div class="sidebar-foot-actions">
            <button class="logout-link" id="logout-btn" type="button">
              <span class="logout-icon" aria-hidden="true"></span>
              Log Out
            </button>
            <div class="api-status checking" id="api-status" title="Checking API\u2026">
              <span class="api-status-dot"></span>
              <span class="api-status-label">Checking</span>
            </div>
          </div>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div>
            <h1>${title}</h1>
            ${subtitle ? `<p>${subtitle}</p>` : ""}
          </div>
          <div class="topbar-end">
            ${actionsHtml ? `<div class="topbar-actions">${actionsHtml}</div>` : ""}
            <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Open menu" aria-controls="app-sidebar" aria-expanded="false">
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div id="page-root"></div>
      </main>
    </div>
  `;
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "/";
  });
  bindMobileNav();
  bindMortgagesNav();
  bindThemeToggle();
  void watchApiStatus();
  return document.getElementById("page-root");
}
async function checkApiStatus() {
  try {
    const response = await fetch(`${apiBase()}/health`, { method: "GET", cache: "no-store" });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}
function renderApiStatus(online) {
  const el = document.getElementById("api-status");
  if (!el) {
    return;
  }
  el.className = `api-status ${online ? "online" : "offline"}`;
  el.title = online ? "Backend connected" : "Backend unreachable";
  const label = el.querySelector(".api-status-label");
  if (label) {
    label.textContent = online ? "API Online" : "API Offline";
  }
}
function setNavOpen(open) {
  const shell = document.getElementById("app-shell");
  const toggle = document.getElementById("menu-toggle");
  if (!shell || !toggle) {
    return;
  }
  shell.classList.toggle("nav-open", open);
  document.body.classList.toggle("nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
function bindMortgagesNav() {
  const toggle = document.getElementById("mortgages-nav-toggle");
  const group = toggle?.closest(".nav-group");
  const sub = document.getElementById("mortgages-nav-sub");
  if (!toggle || !group || !sub) {
    return;
  }
  toggle.addEventListener("click", () => {
    const open = !group.classList.contains("open");
    group.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    sub.hidden = !open;
    try {
      sessionStorage.setItem(MORTGAGES_NAV_KEY, open ? "1" : "0");
    } catch {
    }
  });
}
function bindMobileNav() {
  const toggle = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("nav-backdrop");
  const sidebar = document.getElementById("app-sidebar");
  if (!toggle || !backdrop || !sidebar) {
    return;
  }
  toggle.addEventListener("click", () => {
    setNavOpen(!document.getElementById("app-shell")?.classList.contains("nav-open"));
  });
  backdrop.addEventListener("click", () => setNavOpen(false));
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setNavOpen(false);
    }
  });
  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 901px)").matches) {
      setNavOpen(false);
    }
  });
}
function renderThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    return;
  }
  const dark = getTheme() === "dark";
  toggle.classList.toggle("on", dark);
  toggle.setAttribute("aria-checked", String(dark));
}
function bindThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    return;
  }
  renderThemeToggle();
  toggle.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
    renderThemeToggle();
  });
}
async function watchApiStatus() {
  const update = async () => {
    renderApiStatus(await checkApiStatus());
  };
  await update();
  window.setInterval(() => {
    void update();
  }, 15e3);
}
function setStatus(el, message, type = "info") {
  if (!el) {
    return;
  }
  el.hidden = !message;
  el.className = `status ${type === "info" ? "" : type}`.trim();
  el.textContent = message;
}

// src/pages/dashboard.ts
if (location.hash === "#settings") {
  window.location.replace("/settings.html");
} else if (location.hash === "#profile") {
  window.location.replace("/profile.html");
}
var nowYear = (/* @__PURE__ */ new Date()).getFullYear();
var YEARS = Array.from({ length: 8 }, (_, i) => nowYear - 5 + i);
var PORTFOLIO_KEY = "pf-dashboard-property-scope";
var user = getUser();
function readPortfolio() {
  const value = sessionStorage.getItem(PORTFOLIO_KEY);
  return value === "all" || value === "rental" || value === "personal" ? value : "rental";
}
var initialPortfolio = readPortfolio();
var root = mountShell(
  "/dashboard.html",
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
var cache = null;
var period = "year";
var CHART_STYLE_KEY = "pf-chart-style";
function getChartStyle() {
  const value = localStorage.getItem(CHART_STYLE_KEY);
  return value === "area" || value === "bar" ? value : "line";
}
function setChartStyle(style) {
  localStorage.setItem(CHART_STYLE_KEY, style);
}
function syncChartMenu() {
  const current = getChartStyle();
  document.querySelectorAll("#chart-menu-pop [data-chart]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chart === current);
  });
}
function selectedYear() {
  return document.getElementById("year").value;
}
function selectedPortfolio() {
  const value = document.getElementById("portfolio").value;
  return value === "all" || value === "rental" || value === "personal" ? value : "rental";
}
function setTitle(year) {
  const heading = document.querySelector(".topbar h1");
  if (heading) {
    heading.textContent = `Financial overview ${year}`;
  }
}
function setSubtitle(scope) {
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
function pct(part, total) {
  if (!total) {
    return 0;
  }
  return Math.round(part / total * 100);
}
function n(value) {
  return value.toFixed(1);
}
function monotonePath(points) {
  if (!points.length) {
    return "";
  }
  if (points.length === 1) {
    return `M${n(points[0].x)} ${n(points[0].y)}`;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const last = points.length - 1;
  const delta = [];
  const m = [];
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
    d += ` C${n(xs[i] + h / 3)} ${n(ys[i] + m[i] * h / 3)} ${n(xs[i + 1] - h / 3)} ${n(ys[i + 1] - m[i + 1] * h / 3)} ${n(xs[i + 1])} ${n(ys[i + 1])}`;
  }
  return d;
}
function donut(percent, kind) {
  const size = 54;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = c - clamped / 100 * c;
  const arc = clamped > 0 ? `<circle class="donut-arc ${kind}" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>` : "";
  return `<div class="donut-wrap">
    <svg class="donut" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="donut-track ${kind}" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"/>
      ${arc}
    </svg>
    <span class="donut-pct">${Math.round(clamped)}%</span>
  </div>`;
}
function renderChart(points, style) {
  const width = 760;
  const height = 220;
  const pad = { l: 40, r: 16, t: 12, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...points.flatMap((p) => [p.rent, p.expenses]), 1);
  const count = Math.max(points.length, 1);
  const band = innerW / count;
  const x = (i) => pad.l + band * (i + 0.5);
  const y = (v) => pad.t + innerH - v / max * innerH;
  const baseY = y(0);
  const ticks = 4;
  const year = selectedYear();
  const hGrid = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = max / ticks * i;
    const yy = y(value);
    const label = value >= 1e3 ? `${Math.round(value / 1e3)}k` : String(Math.round(value));
    return `<line x1="${pad.l}" y1="${yy}" x2="${width - pad.r}" y2="${yy}" class="chart-grid"/>
      <text x="${pad.l - 8}" y="${yy + 4}" text-anchor="end" class="chart-axis">${label}</text>`;
  }).join("");
  const vGrid = points.map((_, i) => `<line x1="${n(x(i))}" y1="${pad.t}" x2="${n(x(i))}" y2="${pad.t + innerH}" class="chart-grid"/>`).join("");
  const xAxis = `<line x1="${pad.l}" y1="${pad.t + innerH}" x2="${width - pad.r}" y2="${pad.t + innerH}" class="chart-axis-line"/>`;
  const labels = points.map((p, i) => `<text x="${n(x(i))}" y="${height - 8}" text-anchor="middle" class="chart-axis">${p.label}</text>`).join("");
  const rentPts = points.map((p, i) => ({ x: x(i), y: y(p.rent) }));
  const expPts = points.map((p, i) => ({ x: x(i), y: y(p.expenses) }));
  const rentPath = monotonePath(rentPts);
  const expPath = monotonePath(expPts);
  const last = count - 1;
  let series = "";
  if (style === "bar") {
    const barW = Math.max(4, Math.min(28, band * 0.8 / 2 - 1));
    series = points.map((p, i) => {
      const center = x(i);
      const rentH = Math.max(baseY - y(p.rent), 0);
      const expH = Math.max(baseY - y(p.expenses), 0);
      return `<rect class="chart-bar rent" x="${n(center - barW - 1)}" y="${n(y(p.rent))}" width="${n(barW)}" height="${n(rentH)}" rx="4" ry="4"/>
          <rect class="chart-bar expense" x="${n(center + 1)}" y="${n(y(p.expenses))}" width="${n(barW)}" height="${n(expH)}" rx="4" ry="4"/>`;
    }).join("");
  } else {
    if (style === "area") {
      series += `<path class="chart-area expense" d="${expPath} L${n(x(last))} ${n(baseY)} L${n(x(0))} ${n(baseY)} Z"/>`;
      series += `<path class="chart-area rent" d="${rentPath} L${n(x(last))} ${n(baseY)} L${n(x(0))} ${n(baseY)} Z"/>`;
    }
    const dash = style === "line" ? ` stroke-dasharray="6 4"` : "";
    series += `<path class="chart-series expense" d="${expPath}" stroke-width="2"${dash}/>`;
    series += `<path class="chart-series rent" d="${rentPath}" stroke-width="2.5"/>`;
    const rentR = style === "line" ? 4 : 3;
    series += rentPts.map((p) => `<circle class="chart-dot rent" cx="${n(p.x)}" cy="${n(p.y)}" r="${rentR}" stroke-width="2"/>`).join("");
    series += expPts.map((p) => `<circle class="chart-dot expense" cx="${n(p.x)}" cy="${n(p.y)}" r="3" stroke-width="2"/>`).join("");
  }
  const hits = points.map((p, i) => {
    const tip = `${p.label} ${year}`;
    return `<rect class="chart-hit" data-i="${i}" data-label="${tip}" data-rent="${p.rent}" data-expenses="${p.expenses}" data-x="${n(x(i))}" data-yr="${n(y(p.rent))}" data-ye="${n(y(p.expenses))}" x="${n(pad.l + band * i)}" y="${pad.t}" width="${n(band)}" height="${n(innerH)}"/>`;
  }).join("");
  return `<div class="overview-chart-wrap">
    <div class="chart-in-legend">
      <span><i class="legend-rent"></i> Rent</span>
      <span><i class="legend-expense"></i> Expenses</span>
    </div>
    <div class="overview-chart-canvas">
      <svg class="overview-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Rent versus expenses ${style} chart">
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
function renderCards(data) {
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
        <span>Rent \u2212 expenses</span>
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
function renderStatus(data) {
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
function breakdownLabel(row) {
  const quarters = {
    Q1: "Q1 \u2014 Jan, Feb, Mar",
    Q2: "Q2 \u2014 Apr, May, Jun",
    Q3: "Q3 \u2014 Jul, Aug, Sep",
    Q4: "Q4 \u2014 Oct, Nov, Dec"
  };
  if (quarters[row.label]) {
    return quarters[row.label];
  }
  const months = {
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
function renderBreakdowns(data) {
  const currency = user.preferredCurrency;
  const rows = period === "year" ? [data.breakdowns.year] : period === "quarter" ? data.breakdowns.quarters : data.breakdowns.months;
  return rows.map(
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
            <div class="hint">Rent \u2212 expenses</div>
          </div>
          <div class="breakdown-cell">
            <div class="label">Pending</div>
            <div class="value pending${row.pending < 0 ? " negative" : ""}">${money(row.pending, currency)}</div>
            <div class="hint">Income + expenses still due</div>
          </div>
        </div>
      </article>`
  ).join("");
}
function render(data) {
  document.getElementById("cards").innerHTML = renderCards(data);
  document.getElementById("chart").innerHTML = renderChart(data.monthly, getChartStyle());
  syncChartMenu();
  document.getElementById("status-overview").innerHTML = renderStatus(data);
  document.getElementById("breakdowns").innerHTML = renderBreakdowns(data);
}
async function loadOverview() {
  const status = document.getElementById("status");
  const year = selectedYear();
  const scope = selectedPortfolio();
  sessionStorage.setItem(PORTFOLIO_KEY, scope);
  setTitle(year);
  setSubtitle(scope);
  try {
    cache = await api(`/dashboard${qs({ year, scope })}`);
    render(cache);
    setStatus(status, "", "info");
  } catch (error) {
    setStatus(status, error.message, "error");
  }
}
document.getElementById("year")?.addEventListener("change", () => {
  void loadOverview();
});
document.getElementById("portfolio")?.addEventListener("change", () => {
  void loadOverview();
});
document.getElementById("period-toggle")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-period]");
  if (!button || !cache) {
    return;
  }
  period = button.dataset.period;
  document.querySelectorAll("#period-toggle button").forEach((el) => {
    el.classList.toggle("active", el === button);
  });
  document.getElementById("breakdowns").innerHTML = renderBreakdowns(cache);
});
var chartMenuBtn = document.getElementById("chart-menu-btn");
var chartMenuPop = document.getElementById("chart-menu-pop");
function setChartMenuOpen(open) {
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
  const button = event.target.closest("button[data-chart]");
  if (!button || !cache) {
    return;
  }
  const style = button.dataset.chart;
  if (style !== "line" && style !== "area" && style !== "bar") {
    return;
  }
  setChartStyle(style);
  setChartMenuOpen(false);
  document.getElementById("chart").innerHTML = renderChart(cache.monthly, style);
  syncChartMenu();
});
document.addEventListener("click", () => setChartMenuOpen(false));
function hideChartHover() {
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
function showChartHover(hit) {
  const tooltip = document.getElementById("chart-tooltip");
  const cursor = document.getElementById("chart-cursor");
  const band = document.getElementById("chart-hover-band");
  const rentDot = document.getElementById("chart-active-rent");
  const expDot = document.getElementById("chart-active-exp");
  const canvas = document.querySelector(".overview-chart-canvas");
  const svg = canvas?.querySelector("svg");
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
function bindChartHover() {
  const host = document.getElementById("chart");
  if (!host || host.dataset.bound === "1") {
    return;
  }
  host.dataset.bound = "1";
  host.addEventListener("mousemove", (event) => {
    const hit = event.target?.closest(".chart-hit");
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
