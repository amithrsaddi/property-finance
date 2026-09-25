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

// src/pages/capital-gains.ts
var TAX_YEAR = "2026/27";
var ANNUAL_EXEMPT_AMOUNT = 3e3;
var BASIC_RATE_BAND = 37700;
var BASIC_RATE = 0.18;
var HIGHER_RATE = 0.24;
var PRR_FINAL_MONTHS = 9;
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
function isoDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
var today = /* @__PURE__ */ new Date();
var DEFAULTS = {
  sale: "350000",
  purchase: "250000",
  buying: "4000",
  selling: "5000",
  improvements: "0",
  share: "100",
  purchaseDate: isoDate(new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())),
  saleDate: isoDate(today),
  occupied: "0",
  income: "20000",
  allowance: String(ANNUAL_EXEMPT_AMOUNT),
  losses: "0"
};
var root = mountShell(
  "/capital-gains",
  "Capital Gains Calculator",
  `UK residential property \xB7 ${TAX_YEAR}`
);
root.innerHTML = `
  <section class="cgt-page">
    <div class="cgt-layout">
      <div class="cgt-form">
        <div class="cgt-form-head">
          <div class="field">
            <label for="cgt-property">Property</label>
            <select id="cgt-property">
              <option value="">None</option>
            </select>
          </div>
          <button class="btn ghost" id="cgt-reset" type="button">Reset</button>
        </div>
        <div class="cgt-grid">
          <label class="calc-input">
            <span>Sale price</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-sale" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.sale}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Purchase price</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-purchase" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.purchase}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Purchase date</span>
            <span class="calc-input-box">
              <input id="cgt-purchase-date" type="date" value="${DEFAULTS.purchaseDate}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Sale date</span>
            <span class="calc-input-box">
              <input id="cgt-sale-date" type="date" value="${DEFAULTS.saleDate}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Buying costs</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-buying" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.buying}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Selling costs</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-selling" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.selling}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Improvements</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-improvements" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.improvements}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Your share</span>
            <span class="calc-input-box">
              <input id="cgt-share" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${DEFAULTS.share}" />
              <span class="calc-affix is-suffix">%</span>
            </span>
          </label>
        </div>
        <div class="cgt-block">
          <span>Private Residence Relief</span>
          <div class="cgt-seg" role="group" aria-label="Private Residence Relief">
            <button class="cgt-seg-btn active" data-prr="no" type="button">None</button>
            <button class="cgt-seg-btn" data-prr="yes" type="button">Part main home</button>
          </div>
          <div id="cgt-prr-details" hidden>
            <div class="cgt-seg" role="group" aria-label="Main home period">
              <button class="cgt-seg-btn active" data-prr-mode="months" type="button">Months</button>
              <button class="cgt-seg-btn" data-prr-mode="period" type="button">Dates</button>
            </div>
            <label class="calc-input" id="cgt-occupied-wrap">
              <span>Months as your main home</span>
              <span class="calc-input-box">
                <input id="cgt-occupied" type="number" min="0" step="1" inputmode="numeric" value="${DEFAULTS.occupied}" />
                <span class="calc-affix is-suffix">months</span>
              </span>
            </label>
            <div class="cgt-period" id="cgt-period-wrap" hidden>
              <div class="cgt-grid">
                <label class="calc-input">
                  <span>From</span>
                  <span class="calc-input-box">
                    <input id="cgt-occupied-from" type="date" />
                  </span>
                </label>
                <label class="calc-input">
                  <span>To</span>
                  <span class="calc-input-box">
                    <input id="cgt-occupied-to" type="date" />
                  </span>
                </label>
              </div>
              <small class="calc-hint" id="cgt-period-hint"></small>
            </div>
          </div>
        </div>
        <div class="cgt-grid">
          <label class="calc-input">
            <span>Taxable income</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-income" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.income}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Unused allowance</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-allowance" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.allowance}" />
            </span>
          </label>
          <label class="calc-input cgt-span">
            <span>Allowable losses</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-losses" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.losses}" />
            </span>
          </label>
        </div>
      </div>
      <aside class="cgt-result" id="cgt-output" aria-live="polite"></aside>
    </div>
  </section>
`;
var saleInput = document.getElementById("cgt-sale");
var purchaseInput = document.getElementById("cgt-purchase");
var buyingInput = document.getElementById("cgt-buying");
var sellingInput = document.getElementById("cgt-selling");
var improvementsInput = document.getElementById("cgt-improvements");
var shareInput = document.getElementById("cgt-share");
var purchaseDateInput = document.getElementById("cgt-purchase-date");
var saleDateInput = document.getElementById("cgt-sale-date");
var occupiedInput = document.getElementById("cgt-occupied");
var occupiedWrap = document.getElementById("cgt-occupied-wrap");
var prrDetails = document.getElementById("cgt-prr-details");
var periodWrap = document.getElementById("cgt-period-wrap");
var occupiedFromInput = document.getElementById("cgt-occupied-from");
var occupiedToInput = document.getElementById("cgt-occupied-to");
var periodHint = document.getElementById("cgt-period-hint");
var incomeInput = document.getElementById("cgt-income");
var allowanceInput = document.getElementById("cgt-allowance");
var lossesInput = document.getElementById("cgt-losses");
var propertySelect = document.getElementById("cgt-property");
var output = document.getElementById("cgt-output");
var prrEnabled = false;
var prrMode = "months";
var properties = [];
function gbp(value) {
  return money(value, user.preferredCurrency);
}
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function moneyValue(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
function monthsBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return 0;
  }
  return Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  );
}
function laterDate(a, b) {
  return a && b && a > b ? a : b || a;
}
function earlierDate(a, b) {
  return a && b && a < b ? a : b || a;
}
function occupiedMonthsFromPeriod(purchaseDate, saleDate, from, to) {
  if (!purchaseDate || !saleDate || !from || !to) {
    return 0;
  }
  const overlapFrom = laterDate(from, purchaseDate);
  const overlapTo = earlierDate(to, saleDate);
  return monthsBetween(overlapFrom, overlapTo);
}
function calculateCgt(input) {
  if (input.salePrice <= 0 && input.purchasePrice <= 0) {
    return null;
  }
  const saleProceeds = roundMoney(Math.max(0, input.salePrice - input.sellingCosts));
  const baseCost = roundMoney(
    Math.max(0, input.purchasePrice + input.buyingCosts + input.improvements)
  );
  const grossGain = roundMoney(saleProceeds - baseCost);
  const share = Math.min(100, Math.max(0, input.ownershipShare)) / 100;
  const yourGain = roundMoney(grossGain * share);
  const ownershipMonths = monthsBetween(input.purchaseDate, input.saleDate);
  let qualifyingMonths = 0;
  let prrAmount = 0;
  if (input.prr && yourGain > 0 && ownershipMonths > 0) {
    const occupied = Math.max(0, Math.round(input.occupiedMonths));
    const leftover = Math.max(0, ownershipMonths - occupied);
    qualifyingMonths = Math.min(ownershipMonths, occupied + Math.min(PRR_FINAL_MONTHS, leftover));
    prrAmount = roundMoney(yourGain * (qualifyingMonths / ownershipMonths));
  }
  const afterPrr = roundMoney(yourGain - prrAmount);
  const isLoss = afterPrr < 0;
  const lossesApplied = isLoss ? 0 : roundMoney(Math.min(Math.max(0, input.losses), Math.max(0, afterPrr)));
  const unusedLosses = roundMoney(Math.max(0, input.losses - lossesApplied));
  const chargeable = isLoss ? afterPrr : roundMoney(Math.max(0, afterPrr - lossesApplied));
  const unusedAllowance = Math.max(0, input.unusedAllowance);
  const allowanceApplied = isLoss ? 0 : roundMoney(Math.min(Math.max(0, chargeable), unusedAllowance));
  const taxableGain = isLoss ? 0 : roundMoney(Math.max(0, chargeable - allowanceApplied));
  const remainingBasicBand = roundMoney(Math.max(0, BASIC_RATE_BAND - Math.max(0, input.taxableIncome)));
  const taxedAtBasic = roundMoney(Math.min(taxableGain, remainingBasicBand));
  const taxedAtHigher = roundMoney(Math.max(0, taxableGain - taxedAtBasic));
  const taxBasic = roundMoney(taxedAtBasic * BASIC_RATE);
  const taxHigher = roundMoney(taxedAtHigher * HIGHER_RATE);
  const tax = roundMoney(taxBasic + taxHigher);
  return {
    saleProceeds,
    baseCost,
    grossGain,
    yourGain,
    ownershipMonths,
    qualifyingMonths,
    prrAmount,
    afterPrr,
    lossesApplied,
    chargeable,
    allowanceApplied,
    taxableGain,
    remainingBasicBand,
    taxedAtBasic,
    taxedAtHigher,
    taxBasic,
    taxHigher,
    tax,
    isLoss,
    unusedLosses
  };
}
function readInputs() {
  const purchaseDate = purchaseDateInput.value;
  const saleDate = saleDateInput.value;
  const occupiedFrom = occupiedFromInput.value;
  const occupiedTo = occupiedToInput.value;
  const occupiedMonths = prrMode === "period" ? occupiedMonthsFromPeriod(purchaseDate, saleDate, occupiedFrom, occupiedTo) : moneyValue(occupiedInput);
  return {
    salePrice: moneyValue(saleInput),
    purchasePrice: moneyValue(purchaseInput),
    buyingCosts: moneyValue(buyingInput),
    sellingCosts: moneyValue(sellingInput),
    improvements: moneyValue(improvementsInput),
    ownershipShare: moneyValue(shareInput),
    purchaseDate,
    saleDate,
    prr: prrEnabled,
    occupiedMonths,
    occupiedFrom,
    occupiedTo,
    prrMode,
    taxableIncome: moneyValue(incomeInput),
    unusedAllowance: moneyValue(allowanceInput),
    losses: moneyValue(lossesInput)
  };
}
function syncPeriodBounds() {
  const purchase = purchaseDateInput.value;
  const sale = saleDateInput.value;
  for (const input of [occupiedFromInput, occupiedToInput]) {
    input.min = purchase;
    input.max = sale;
  }
  if (occupiedFromInput.value && purchase && occupiedFromInput.value < purchase) {
    occupiedFromInput.value = purchase;
  }
  if (occupiedFromInput.value && sale && occupiedFromInput.value > sale) {
    occupiedFromInput.value = sale;
  }
  if (occupiedToInput.value && purchase && occupiedToInput.value < purchase) {
    occupiedToInput.value = purchase;
  }
  if (occupiedToInput.value && sale && occupiedToInput.value > sale) {
    occupiedToInput.value = sale;
  }
}
function updatePeriodHint() {
  if (!prrEnabled || prrMode !== "period") {
    return;
  }
  const months = occupiedMonthsFromPeriod(
    purchaseDateInput.value,
    saleDateInput.value,
    occupiedFromInput.value,
    occupiedToInput.value
  );
  if (!occupiedFromInput.value || !occupiedToInput.value) {
    periodHint.textContent = "";
    return;
  }
  if (!months) {
    periodHint.textContent = "Those dates do not overlap the time you owned the property.";
    return;
  }
  periodHint.textContent = `${months} month${months === 1 ? "" : "s"} as main home`;
}
function ensurePeriodDefaults() {
  if (!occupiedFromInput.value && purchaseDateInput.value) {
    occupiedFromInput.value = purchaseDateInput.value;
  }
}
function syncPrrUi() {
  document.querySelectorAll("[data-prr]").forEach((button) => {
    const on = button.dataset.prr === "yes";
    button.classList.toggle("active", on === prrEnabled);
  });
  document.querySelectorAll("[data-prr-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.prrMode === prrMode);
  });
  prrDetails.hidden = !prrEnabled;
  occupiedWrap.hidden = !prrEnabled || prrMode !== "months";
  periodWrap.hidden = !prrEnabled || prrMode !== "period";
  if (prrEnabled && prrMode === "period") {
    ensurePeriodDefaults();
    syncPeriodBounds();
    updatePeriodHint();
  }
}
function heroCopy(result) {
  if (result.isLoss) {
    return {
      kicker: "Estimated CGT",
      amount: gbp(0),
      sub: `Allowable loss of ${gbp(Math.abs(result.afterPrr))} \xB7 no tax due`
    };
  }
  if (result.taxableGain <= 0) {
    return {
      kicker: "Estimated CGT",
      amount: gbp(0),
      sub: result.yourGain <= 0 ? "No chargeable gain on this disposal" : "Covered by reliefs and the annual allowance"
    };
  }
  const parts = [];
  if (result.taxedAtBasic > 0) {
    parts.push(`${BASIC_RATE * 100}% on ${gbp(result.taxedAtBasic)}`);
  }
  if (result.taxedAtHigher > 0) {
    parts.push(`${HIGHER_RATE * 100}% on ${gbp(result.taxedAtHigher)}`);
  }
  return {
    kicker: "Estimated CGT",
    amount: gbp(result.tax),
    sub: parts.join(" \xB7 ") || "No tax due"
  };
}
function renderResults() {
  const input = readInputs();
  const result = calculateCgt(input);
  if (!result) {
    output.innerHTML = `<div class="cgt-empty">Enter a sale and purchase price to estimate CGT.</div>`;
    return;
  }
  const hero = heroCopy(result);
  output.innerHTML = `
    <p class="cgt-kicker">${escapeHtml(hero.kicker)}</p>
    <p class="cgt-amount">${escapeHtml(hero.amount)}</p>
    <p class="cgt-sub">${escapeHtml(hero.sub)}</p>
    <dl class="cgt-metrics">
      <div><dt>Gross gain</dt><dd>${gbp(result.grossGain)}</dd></div>
      ${input.prr ? `<div><dt>Private Residence Relief</dt><dd>${gbp(result.prrAmount)}</dd></div>` : ""}
      ${result.lossesApplied > 0 ? `<div><dt>Losses</dt><dd>${gbp(result.lossesApplied)}</dd></div>` : ""}
      <div><dt>Allowance used</dt><dd>${gbp(result.allowanceApplied)}</dd></div>
      <div><dt>Taxable gain</dt><dd>${gbp(result.taxableGain)}</dd></div>
    </dl>
    <p class="cgt-fineprint">Estimate only. Report and pay within 60 days of completion if CGT is due.</p>
  `;
}
function applyProperty(id) {
  const row = properties.find((item) => item.id === id);
  if (!row) {
    return;
  }
  const sale = roundMoney(Number(row.currentValue || 0));
  const purchase = roundMoney(Number(row.purchasePrice || 0));
  if (sale) {
    saleInput.value = String(sale);
  }
  if (purchase) {
    purchaseInput.value = String(purchase);
  }
  const share = Number(row.ownershipPercentage);
  shareInput.value = Number.isFinite(share) ? String(share) : "100";
  if (row.purchaseDate) {
    purchaseDateInput.value = String(row.purchaseDate).slice(0, 10);
  }
  syncPeriodBounds();
  renderResults();
}
function resetForm() {
  propertySelect.value = "";
  saleInput.value = DEFAULTS.sale;
  purchaseInput.value = DEFAULTS.purchase;
  buyingInput.value = DEFAULTS.buying;
  sellingInput.value = DEFAULTS.selling;
  improvementsInput.value = DEFAULTS.improvements;
  shareInput.value = DEFAULTS.share;
  purchaseDateInput.value = DEFAULTS.purchaseDate;
  saleDateInput.value = DEFAULTS.saleDate;
  occupiedInput.value = DEFAULTS.occupied;
  occupiedFromInput.value = "";
  occupiedToInput.value = "";
  incomeInput.value = DEFAULTS.income;
  allowanceInput.value = DEFAULTS.allowance;
  lossesInput.value = DEFAULTS.losses;
  prrEnabled = false;
  prrMode = "months";
  syncPrrUi();
  renderResults();
}
var moneyInputs = [
  saleInput,
  purchaseInput,
  buyingInput,
  sellingInput,
  improvementsInput,
  shareInput,
  occupiedInput,
  incomeInput,
  allowanceInput,
  lossesInput
];
for (const input of moneyInputs) {
  input.addEventListener("input", renderResults);
  input.addEventListener("blur", () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }
    if (input === occupiedInput) {
      input.value = String(Math.max(0, Math.round(value)));
      return;
    }
    input.value = String(roundMoney(Math.max(0, value)));
  });
}
for (const input of [purchaseDateInput, saleDateInput, occupiedFromInput, occupiedToInput]) {
  input.addEventListener("input", () => {
    if (input === purchaseDateInput || input === saleDateInput) {
      syncPeriodBounds();
    }
    updatePeriodHint();
    renderResults();
  });
  input.addEventListener("change", () => {
    if (input === purchaseDateInput || input === saleDateInput) {
      syncPeriodBounds();
    }
    updatePeriodHint();
    renderResults();
  });
}
document.querySelectorAll("[data-prr]").forEach((button) => {
  button.addEventListener("click", () => {
    prrEnabled = button.dataset.prr === "yes";
    syncPrrUi();
    renderResults();
  });
});
document.querySelectorAll("[data-prr-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    prrMode = button.dataset.prrMode === "period" ? "period" : "months";
    syncPrrUi();
    renderResults();
  });
});
propertySelect.addEventListener("change", () => {
  if (propertySelect.value) {
    applyProperty(propertySelect.value);
  } else {
    renderResults();
  }
});
document.getElementById("cgt-reset")?.addEventListener("click", resetForm);
async function loadProperties() {
  try {
    const data = await api(`/properties${qs({ status: "active" })}`);
    properties = data.properties || [];
    if (!properties.length) {
      return;
    }
    propertySelect.insertAdjacentHTML(
      "beforeend",
      properties.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("")
    );
  } catch {
  }
}
syncPrrUi();
renderResults();
void loadProperties();
