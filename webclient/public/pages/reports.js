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
  const n = Number(getUser()?.decimalPrecision);
  if (!Number.isFinite(n)) {
    return 2;
  }
  return Math.min(4, Math.max(0, Math.round(n)));
}
function money(amount, currency = getUser()?.preferredCurrency || "GBP", precision = getDecimalPrecision()) {
  const n = Number(precision);
  const digits = Number.isFinite(n) ? Math.min(4, Math.max(0, Math.round(n))) : 2;
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
function currentMonthValue() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function formatDateDmY(value) {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) {
    return raw || "-";
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
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

// src/pages/reports.ts
var PERIOD_KEY = "pf-reports-period-v2";
var SCOPE_KEY = "pf-reports-property-scope";
function readPeriod() {
  const value = sessionStorage.getItem(PERIOD_KEY);
  return value === "month" || value === "range" ? value : "year";
}
function readScope() {
  const value = sessionStorage.getItem(SCOPE_KEY);
  return value === "rental" || value === "residential" ? value : "all";
}
function monthBounds(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) {
    const now = /* @__PURE__ */ new Date();
    const from2 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const last2 = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return { from: from2, to: `${from2.slice(0, 8)}${String(last2).padStart(2, "0")}` };
  }
  const last = new Date(year, month, 0).getDate();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  return { from, to: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}
var root = mountShell(
  "/reports.html",
  "Reports",
  "Income, costs, cash flow, and profitability by property."
);
var user = getUser();
var initialPeriod = readPeriod();
var initialScope = readScope();
var currentMonth = currentMonthValue();
var currentYear = String((/* @__PURE__ */ new Date()).getFullYear());
var initialRange = monthBounds(currentMonth);
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
function periodType() {
  const value = document.getElementById("periodType").value;
  return value === "month" || value === "range" ? value : "year";
}
function syncPeriodFilterUi() {
  const period = periodType();
  sessionStorage.setItem(PERIOD_KEY, period);
  document.getElementById("month-filter-wrap").hidden = period !== "month";
  document.getElementById("year-filter-wrap").hidden = period !== "year";
  document.getElementById("from-filter-wrap").hidden = period !== "range";
  document.getElementById("to-filter-wrap").hidden = period !== "range";
}
function propertyScope() {
  const value = document.getElementById("propertyScope").value;
  return value === "rental" || value === "residential" ? value : "all";
}
function reportQuery() {
  const scope = propertyScope();
  sessionStorage.setItem(SCOPE_KEY, scope);
  const period = periodType();
  if (period === "year") {
    const year = document.getElementById("year").value.trim();
    if (!/^\d{4}$/.test(year)) {
      setStatus(document.getElementById("status"), "Enter a valid year.", "error");
      return null;
    }
    return qs({ year, scope });
  }
  if (period === "range") {
    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
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
  const month = document.getElementById("month").value;
  if (!month) {
    setStatus(document.getElementById("status"), "Choose a month.", "error");
    return null;
  }
  return qs({ month, scope });
}
async function loadReport() {
  const query = reportQuery();
  if (!query) {
    return;
  }
  try {
    const data = await api(`/reports${query}`);
    const t = data.totals;
    document.getElementById("totals").innerHTML = `
      <div class="metric"><div class="label">Rent expected</div><div class="value">${money(t.rentExpected, user.preferredCurrency)}</div></div>
      <div class="metric"><div class="label">Rent received</div><div class="value">${money(t.rentReceived, user.preferredCurrency)}</div></div>
      <div class="metric"><div class="label">Mortgage spend</div><div class="value">${money(t.mortgageSpend, user.preferredCurrency)}</div></div>
      <div class="metric"><div class="label">Property expenses</div><div class="value">${money(t.propertyExpenses, user.preferredCurrency)}</div></div>
      <div class="metric"><div class="label">Additional expenses</div><div class="value">${money(t.additionalExpenses, user.preferredCurrency)}</div></div>
      <div class="metric ${t.netCashFlow >= 0 ? "positive" : "negative"}"><div class="label">Net cash flow</div><div class="value">${money(t.netCashFlow, user.preferredCurrency)}</div></div>
    `;
    const list = document.getElementById("list");
    if (!data.properties.length) {
      list.innerHTML = `<p class="empty">No properties to report on.</p>`;
    } else {
      list.innerHTML = `<table class="reports-table">
        <thead><tr><th>Property</th><th>Rent</th><th>Mortgage</th><th>Expenses</th><th>Net</th></tr></thead>
        <tbody>
          ${data.properties.map(
        (p) => `<tr>
              <td><a href="/property.html?id=${p.id}">${p.name}</a></td>
              <td>${money(Number(p.rentReceived), user.preferredCurrency)}</td>
              <td>${money(Number(p.mortgageSpend), user.preferredCurrency)}</td>
              <td>${money(Number(p.propertyExpenses), user.preferredCurrency)}</td>
              <td>${money(Number(p.netCashFlow), user.preferredCurrency)}</td>
            </tr>`
      ).join("")}
        </tbody>
      </table>`;
    }
    setStatus(
      document.getElementById("status"),
      `Report for ${formatDateDmY(data.from)} to ${formatDateDmY(data.to)}.`,
      "success"
    );
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
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
