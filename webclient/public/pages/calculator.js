// src/lib.ts
var TOKEN_KEY = "authToken";
var USER_KEY = "authUser";
var THEME_KEY = "pf-theme";
function apiBase() {
  if (window.APP_CONFIG?.apiBaseUrl) {
    return window.APP_CONFIG.apiBaseUrl;
  }
  const host = window.location.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || /^(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\./.test(host);
  if (local) {
    return `${window.location.protocol}//${host}:3000`;
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

// src/list-view.ts
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// src/shell.ts
function icon(path, className = "nav-icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}
var ICON_COG = icon(
  '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 3.5v2.2M12 18.3v2.2M4.8 6.5l1.6 1.6M17.6 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.5l1.6-1.6M17.6 8.1l1.6-1.6"/>'
);
var ICON_BACKUP = icon(
  '<rect x="4" y="4.5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 9.5h16M8 4.5v-1M16 4.5v-1M8 13h3M8 16.5h8"/>'
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
var ICON_CALCULATOR = icon(
  '<rect x="4.5" y="3.5" width="15" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 8h8M8 12.2h.01M12 12.2h.01M16 12.2h.01M8 16.2h.01M12 16.2h.01M16 16.2h.01"/>'
);
var ICON_GAINS = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 17.5 9.2 12l3.4 3.4L20 8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M14.5 8H20v5.5"/>'
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
function pagePath(path) {
  const clean = String(path || "").split("?")[0].split("#")[0];
  if (clean.endsWith(".html")) {
    return clean.slice(0, -5) || "/";
  }
  return clean || "/";
}
function isActivePath(href, activePath) {
  return pagePath(href) === pagePath(activePath);
}
var NAV = [
  { href: "/dashboard", label: "Dashboard", icon: ICON_DASHBOARD },
  { href: "/properties", label: "Properties", icon: ICON_PROPERTIES },
  { href: "/rent", label: "Rent", icon: ICON_RENT },
  {
    id: "mortgages",
    label: "Mortgages",
    icon: ICON_MORTGAGES,
    children: [
      { href: "/payments", label: "Payments", icon: ICON_PAYMENTS },
      { href: "/rates", label: "Rates", icon: ICON_RATES }
    ]
  },
  {
    id: "calculators",
    label: "Calculators",
    icon: ICON_CALCULATOR,
    children: [
      { href: "/calculator", label: "Mortgage", icon: ICON_CALCULATOR },
      { href: "/capital-gains", label: "Capital Gains", icon: ICON_GAINS }
    ]
  },
  { href: "/expenses", label: "Expenses", icon: ICON_EXPENSES },
  { href: "/documents", label: "Documents", icon: ICON_DOCUMENTS },
  { href: "/reports", label: "Reports", icon: ICON_REPORTS }
];
function navGroupStorageKey(id) {
  return `pf-nav-open-${id}`;
}
function isGroupChildActive(item, path) {
  return Boolean(item.children?.some((child) => isActivePath(child.href, path)));
}
function navGroupOpen(item, activePath) {
  if (isGroupChildActive(item, activePath)) {
    return true;
  }
  const id = item.id;
  if (!id) {
    return false;
  }
  try {
    if (sessionStorage.getItem(navGroupStorageKey(id)) === "1") {
      return true;
    }
    if (id === "mortgages" && sessionStorage.getItem("pf-mortgages-nav-open") === "1") {
      return true;
    }
  } catch {
  }
  return false;
}
function renderNav(activePath) {
  return NAV.map((item) => {
    if (item.children?.length) {
      const childActive = isGroupChildActive(item, activePath);
      const open = navGroupOpen(item, activePath);
      const groupId = item.id || item.label.toLowerCase().replace(/\s+/g, "-");
      const toggleId = `${groupId}-nav-toggle`;
      const subId = `${groupId}-nav-sub`;
      return `<div class="nav-group${open ? " open" : ""}">
        <button class="nav-group-toggle${childActive ? " active" : ""}" id="${toggleId}" data-nav-group="${groupId}" type="button" aria-expanded="${open}" aria-controls="${subId}">
          <span class="nav-group-label">${item.icon}${item.label}</span>
          ${ICON_CHEVRON}
        </button>
        <div class="nav-sub" id="${subId}"${open ? "" : " hidden"}>
          ${item.children.map(
        (child) => `<a href="${child.href}" class="${isActivePath(child.href, activePath) ? "active" : ""}">${child.icon}${child.label}</a>`
      ).join("")}
        </div>
      </div>`;
    }
    return `<a href="${item.href}" class="${isActivePath(item.href || "", activePath) ? "active" : ""}">${item.icon}${item.label}</a>`;
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
              <a href="/settings" class="${isActivePath("/settings", activePath) ? "active" : ""}">
                ${ICON_COG}Settings
              </a>
              <a href="/backup" class="${isActivePath("/backup", activePath) ? "active" : ""}">
                ${ICON_BACKUP}Backup & Restore
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
          <a href="/profile" class="sidebar-profile${isActivePath("/profile", activePath) ? " active" : ""}">
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
  bindNavGroups();
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
function bindNavGroups() {
  document.querySelectorAll("[data-nav-group]").forEach((toggle) => {
    const groupId = toggle.dataset.navGroup;
    const group = toggle.closest(".nav-group");
    const subId = toggle.getAttribute("aria-controls");
    const sub = subId ? document.getElementById(subId) : null;
    if (!groupId || !group || !sub) {
      return;
    }
    toggle.addEventListener("click", () => {
      const open = !group.classList.contains("open");
      group.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      sub.hidden = !open;
      try {
        sessionStorage.setItem(navGroupStorageKey(groupId), open ? "1" : "0");
      } catch {
      }
    });
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

// src/pages/calculator.ts
var DEFAULTS = {
  amount: "250000",
  rate: "4.5",
  years: "25",
  months: "0"
};
var user = getUser();
var currencyMark = (() => {
  try {
    const part = new Intl.NumberFormat(void 0, {
      style: "currency",
      currency: user.preferredCurrency
    }).formatToParts(0).find((item) => item.type === "currency");
    return part?.value || user.preferredCurrency;
  } catch {
    return user.preferredCurrency;
  }
})();
var root = mountShell(
  "/calculator",
  "Mortgage Calculator",
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
var amountInput = document.getElementById("calc-amount");
var rateInput = document.getElementById("calc-rate");
var yearsInput = document.getElementById("calc-years");
var monthsInput = document.getElementById("calc-months");
var overpayAmountInput = document.getElementById("calc-overpay-amount");
var overpayAmountWrap = document.getElementById("calc-overpay-amount-wrap");
var overpayLabel = document.getElementById("calc-overpay-label");
var mortgageSelect = document.getElementById("calc-mortgage");
var output = document.getElementById("calc-output");
var schedulePanel = document.getElementById("calc-schedule-panel");
var scheduleEl = document.getElementById("calc-schedule");
var graphEl = document.getElementById("calc-graph");
var YEAR_VIEW_KEY = "pf-calc-year-view";
var yearView = sessionStorage.getItem(YEAR_VIEW_KEY) === "graph" ? "graph" : "list";
var kind = "repayment";
var overpayKind = "none";
var mortgages = [];
function gbp(value) {
  return money(value, user.preferredCurrency);
}
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function n(value) {
  return String(Math.round(value * 10) / 10);
}
function axisMoney(value) {
  if (value >= 1e6) {
    return `${Math.round(value / 1e5) / 10}m`;
  }
  if (value >= 1e3) {
    return `${Math.round(value / 1e3)}k`;
  }
  return String(Math.round(value));
}
function syncYearView() {
  document.querySelectorAll("[data-year-view]").forEach((button) => {
    const active = button.dataset.yearView === yearView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  scheduleEl.hidden = yearView !== "list";
  graphEl.hidden = yearView !== "graph";
}
function renderYearList(rows) {
  return rows.map((row) => {
    const yearPaid = row.paid || 1;
    const interestPct = Math.min(100, row.interest / yearPaid * 100);
    const capitalPct = 100 - interestPct;
    const last = row.balance <= 5e-3;
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
  }).join("");
}
function renderYearChart(rows) {
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
  const x = (i) => pad.l + band * (i + 0.5);
  const yPaid = (value) => pad.t + innerH - value / maxPaid * innerH;
  const yBal = (value) => pad.t + innerH - value / maxBalance * innerH;
  const baseY = yPaid(0);
  const ticks = 4;
  const hGrid = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = maxPaid / ticks * i;
    const yy = yPaid(value);
    return `<line x1="${pad.l}" y1="${n(yy)}" x2="${width - pad.r}" y2="${n(yy)}" class="chart-grid"/>
      <text x="${pad.l - 8}" y="${n(yy + 4)}" text-anchor="end" class="chart-axis">${axisMoney(value)}</text>
      <text x="${width - pad.r + 8}" y="${n(yBal(maxBalance / ticks * i) + 4)}" class="chart-axis calc-axis-right">${axisMoney(maxBalance / ticks * i)}</text>`;
  }).join("");
  const xAxis = `<line x1="${pad.l}" y1="${n(pad.t + innerH)}" x2="${width - pad.r}" y2="${n(pad.t + innerH)}" class="chart-axis-line"/>`;
  const step = Math.max(1, Math.ceil(count / 8));
  const labels = rows.map((row, i) => {
    if (i !== 0 && i !== count - 1 && (i + 1) % step !== 0) {
      return "";
    }
    return `<text x="${n(x(i))}" y="${height - 8}" text-anchor="middle" class="chart-axis">${row.year}</text>`;
  }).join("");
  const bars = rows.map((row, i) => {
    const center = x(i);
    const capY = yPaid(row.capital);
    const topY = yPaid(row.capital + row.interest);
    const capH = Math.max(baseY - capY, 0);
    const intH = Math.max(capY - topY, 0);
    return `<g class="calc-chart-col">
        <rect class="calc-bar-capital" x="${n(center - barW / 2)}" y="${n(capY)}" width="${n(barW)}" height="${n(capH)}" rx="3"/>
        <rect class="calc-bar-interest" x="${n(center - barW / 2)}" y="${n(topY)}" width="${n(barW)}" height="${n(intH)}" rx="${intH > 4 ? 3 : 0}"/>
      </g>`;
  }).join("");
  const balancePts = rows.map((row, i) => ({ x: x(i), y: yBal(row.balance) }));
  const balancePath = balancePts.map((point, i) => `${i ? "L" : "M"}${n(point.x)} ${n(point.y)}`).join(" ");
  const dots = balancePts.map((point) => `<circle class="calc-balance-dot" cx="${n(point.x)}" cy="${n(point.y)}" r="3.2"/>`).join("");
  const hits = rows.map((row, i) => {
    return `<rect class="chart-hit calc-chart-hit" data-year="${row.year}" data-paid="${row.paid}" data-interest="${row.interest}" data-capital="${row.capital}" data-balance="${row.balance}" data-x="${n(x(i))}" x="${n(pad.l + band * i)}" y="${pad.t}" width="${n(band)}" height="${n(innerH)}"/>`;
  }).join("");
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
function monthsBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return 0;
  }
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}
function monthlyRate(annualPercent) {
  return annualPercent / 100 / 12;
}
function repaymentMonthly(principal, annualPercent, months) {
  if (principal <= 0 || months <= 0) {
    return 0;
  }
  const rate = monthlyRate(annualPercent);
  if (rate === 0) {
    return principal / months;
  }
  const factor = (1 + rate) ** months;
  return principal * rate * factor / (factor - 1);
}
function interestOnlyMonthly(principal, annualPercent) {
  if (principal <= 0) {
    return 0;
  }
  return principal * monthlyRate(annualPercent);
}
function formatTerm(totalMonths) {
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
function syncOverpayUi() {
  document.querySelectorAll("[data-overpay]").forEach((button) => {
    button.classList.toggle("active", button.dataset.overpay === overpayKind);
  });
  overpayAmountWrap.hidden = overpayKind === "none";
  overpayLabel.textContent = overpayKind === "yearly" ? "Yearly lump" : overpayKind === "lump" ? "Lump sum" : "Monthly extra";
}
function buildSchedule(principal, annualPercent, months, monthly, extraMonthly = 0, lumpSum = 0, yearlyLump = 0) {
  const rate = monthlyRate(annualPercent);
  const payment = roundMoney(monthly);
  const extra = roundMoney(Math.max(0, extraMonthly));
  const yearly = roundMoney(Math.max(0, yearlyLump));
  const years = [];
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
  const applyLump = (amount) => {
    const lump = roundMoney(Math.min(Math.max(0, amount), balance));
    if (lump <= 0) {
      return false;
    }
    balance = roundMoney(balance - lump);
    paid += lump;
    capital += lump;
    if (balance <= 5e-3) {
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
    if (balance <= 5e-3) {
      break;
    }
    if (yearly > 0 && (month - 1) % 12 === 0 && applyLump(yearly)) {
      flush();
      break;
    }
    if (balance <= 5e-3) {
      break;
    }
    const monthInterest = roundMoney(balance * rate);
    let monthPaid = roundMoney(payment + extra);
    let monthCapital = roundMoney(Math.min(Math.max(monthPaid - monthInterest, 0), balance));
    if (monthCapital >= balance - 5e-3 || month === months) {
      monthCapital = roundMoney(balance);
      monthPaid = roundMoney(monthInterest + monthCapital);
    }
    balance = Math.max(0, roundMoney(balance - monthCapital));
    paid += monthPaid;
    interest += monthInterest;
    capital += monthCapital;
    monthsTaken = month;
    if (month % 12 === 0 || balance <= 5e-3) {
      flush();
    }
  }
  if (paid || interest || capital) {
    flush();
  }
  return { years, monthsTaken };
}
function calculate() {
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
function renderResults() {
  const result = calculate();
  if (!result) {
    output.innerHTML = `<div class="calc-empty">${kind === "interest_only" ? "Enter a loan amount and rate to see the monthly interest." : "Enter a loan amount, rate, and term to see monthly payments."}</div>`;
    schedulePanel.hidden = true;
    scheduleEl.innerHTML = "";
    graphEl.innerHTML = "";
    return;
  }
  if (result.kind === "interest_only") {
    output.innerHTML = `
      <p class="calc-kicker">Monthly payment</p>
      <p class="calc-monthly">${gbp(result.monthly)}</p>
      <p class="calc-sub">Interest only \xB7 the loan balance stays the same</p>
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
  const interestShare = result.totalPaid > 0 ? Math.min(100, result.totalInterest / result.totalPaid * 100) : 0;
  const capitalShare = 100 - interestShare;
  const hasOverpay = result.overpayKind !== "none" && result.overpayAmount > 0;
  const paidOff = formatTerm(result.monthsTaken);
  const sub = result.monthsTaken === 0 && hasOverpay ? result.overpayKind === "yearly" ? "Cleared by yearly lump" : "Cleared by lump sum" : hasOverpay && result.monthsSaved ? `Paid off in ${paidOff} \xB7 ${formatTerm(result.monthsSaved)} sooner` : `${result.months} scheduled payments \xB7 capital and interest`;
  const heroAmount = result.overpayKind === "monthly" && result.overpayAmount > 0 ? result.monthlyTotal : result.monthly;
  const heroNote = result.overpayKind === "monthly" && result.overpayAmount > 0 ? `includes ${gbp(result.overpayAmount)} overpayment` : result.overpayKind === "lump" && result.overpayAmount > 0 ? `required payment \xB7 ${gbp(result.overpayAmount)} lump sum at start` : result.overpayKind === "yearly" && result.overpayAmount > 0 ? `required payment \xB7 ${gbp(result.overpayAmount)} at the start of each year` : "capital and interest";
  output.innerHTML = `
    <p class="calc-kicker">Monthly payment</p>
    <p class="calc-monthly">${gbp(heroAmount)}</p>
    <p class="calc-sub">${escapeHtml(heroNote)} \xB7 ${escapeHtml(sub)}</p>
    <dl class="calc-metrics">
      <div><dt>Interest over term</dt><dd>${gbp(result.totalInterest)}</dd></div>
      <div><dt>Total paid</dt><dd>${gbp(result.totalPaid)}</dd></div>
      <div><dt>Capital repaid</dt><dd>${gbp(result.capitalRepaid)}</dd></div>
      ${hasOverpay ? `<div><dt>Interest saved</dt><dd>${gbp(result.interestSaved)}</dd></div>
             <div><dt>Paid off in</dt><dd>${escapeHtml(paidOff)}</dd></div>` : ""}
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
    ${hasOverpay && result.interestSaved > 0 ? `<p class="calc-compare">Overpaying saves <strong>${gbp(result.interestSaved)}</strong>${result.monthsSaved ? ` and ${formatTerm(result.monthsSaved)}` : ""}.</p>` : `<p class="calc-compare">Interest-only would be <strong>${gbp(result.otherMonthly)}</strong> / month</p>`}
  `;
  scheduleEl.innerHTML = renderYearList(result.years);
  graphEl.innerHTML = renderYearChart(result.years);
  schedulePanel.hidden = false;
  syncYearView();
}
function setKind(next) {
  kind = next;
  document.querySelectorAll("[data-kind]").forEach((button) => {
    button.classList.toggle("active", button.dataset.kind === kind);
  });
  document.querySelectorAll("[data-term-field], [data-overpay-field]").forEach((field) => {
    field.hidden = kind === "interest_only";
  });
  renderResults();
}
function applyMortgage(id) {
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
function resetForm() {
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
document.querySelectorAll("[data-kind]").forEach((button) => {
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
document.querySelectorAll("[data-overpay]").forEach((button) => {
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
document.querySelectorAll("[data-year-view]").forEach((button) => {
  button.addEventListener("click", () => {
    yearView = button.dataset.yearView === "graph" ? "graph" : "list";
    sessionStorage.setItem(YEAR_VIEW_KEY, yearView);
    syncYearView();
  });
});
function hideCalcChartTip() {
  const tip = document.getElementById("calc-chart-tooltip");
  if (tip) {
    tip.hidden = true;
  }
}
graphEl.addEventListener("pointermove", (event) => {
  const hit = event.target?.closest(".calc-chart-hit");
  const tip = document.getElementById("calc-chart-tooltip");
  const canvas = graphEl.querySelector(".calc-chart-canvas");
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
async function loadMortgages() {
  try {
    const data = await api("/mortgages");
    mortgages = data.mortgages.filter((row) => row.status === "active");
    if (!mortgages.length) {
      return;
    }
    mortgageSelect.insertAdjacentHTML(
      "beforeend",
      mortgages.map((row) => {
        const label = `${row.property_name} \xB7 ${row.lender}`;
        return `<option value="${escapeHtml(row.id)}">${escapeHtml(label)}</option>`;
      }).join("")
    );
  } catch {
  }
}
renderResults();
void loadMortgages();
