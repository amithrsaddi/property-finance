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
  if (!headers.has("Content-Type") && options.body) {
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
function statusClass(status) {
  const map = {
    paid: "ok",
    upcoming: "info",
    unpaid: "warn",
    late: "warn",
    overdue: "warn",
    partially_paid: "warn",
    partial: "warn",
    missed: "bad",
    active: "ok",
    archived: "muted"
  };
  return map[status] || "info";
}
function labelize(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

// src/pages/payments.ts
var root = mountShell(
  "/payments.html",
  "Payments",
  "Upcoming, current, and past mortgage payments."
);
var user = getUser();
var presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
root.innerHTML = `
  <section class="panel">
    <div class="list-toolbar">
      <div class="filters" style="margin:0;flex:1">
        <div class="field"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        <div class="actions" style="align-self:end"><button class="btn secondary" id="refresh" type="button">Refresh</button></div>
      </div>
      <div class="status" id="status" style="margin:0;min-width:12rem" hidden></div>
    </div>
    <div class="tabs" id="view-tabs">
      <button class="tab active" data-view="upcoming" type="button">Upcoming</button>
      <button class="tab" data-view="current" type="button">Current</button>
      <button class="tab" data-view="past" type="button">Past</button>
      <button class="tab" data-view="mortgages" type="button">Mortgages</button>
    </div>
    <div class="property-list" id="content"></div>
  </section>

  <div class="modal-backdrop" id="payment-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="payment-form-title">
      <div class="modal-header">
        <h2 id="payment-form-title">Edit payment</h2>
        <button class="modal-close" id="close-payment-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="payment-form" class="stack">
        <input type="hidden" name="id" />
        <div class="form-grid">
          <div class="field"><label>Property</label><input name="propertyName" disabled /></div>
          <div class="field"><label>Lender</label><input name="lender" disabled /></div>
          <div class="field"><label>Due date</label><input name="dueDate" type="date" disabled /></div>
          <div class="field"><label>Expected amount</label><input name="expectedAmount" type="number" step="0.01" required /></div>
          <div class="field"><label>Amount paid</label><input name="amountPaid" type="number" step="0.01" /></div>
          <div class="field"><label>Paid date</label><input name="paidDate" type="date" /></div>
          <div class="field"><label>Status</label>
            <select name="status">
              <option value="upcoming">Upcoming</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes"></textarea></div>
        </div>
        <div class="status" id="payment-form-status" hidden></div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-payment-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save payment</button>
        </div>
      </form>
    </div>
  </div>
`;
var views = null;
var activeView = "upcoming";
var paymentModal = document.getElementById("payment-modal");
var paymentForm = document.getElementById("payment-form");
function openBackdrop(el) {
  el.hidden = false;
  document.body.classList.add("modal-open");
}
function closeBackdrop(el) {
  el.hidden = true;
  if (paymentModal.hidden) {
    document.body.classList.remove("modal-open");
  }
}
function field(form, name) {
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) {
    throw new Error(`Missing form field: ${name}`);
  }
  return el;
}
async function loadProperties() {
  const data = await api(
    `/properties${qs({ status: "active" })}`
  );
  const filter = document.getElementById("filterProperty");
  for (const property of data.properties) {
    const option = document.createElement("option");
    option.value = String(property.id);
    option.textContent = property.name;
    filter.appendChild(option);
  }
  if (presetPropertyId) {
    filter.value = presetPropertyId;
  }
}
async function loadViews() {
  const propertyId = document.getElementById("filterProperty").value;
  views = await api(`/mortgages/payments/views${qs({ propertyId })}`);
  render();
}
function render() {
  if (!views) {
    return;
  }
  document.querySelectorAll("#view-tabs .tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === activeView);
  });
  const content = document.getElementById("content");
  if (activeView === "mortgages") {
    content.innerHTML = mortgageList(views.activeMortgages);
    return;
  }
  const rows = views[activeView];
  content.innerHTML = paymentList(rows);
  content.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((r) => String(r.id || r._id) === String(button.dataset.edit));
      if (row) {
        openPaymentEditor(row, button.dataset.mode === "pay");
      }
    });
  });
}
function paymentList(rows) {
  if (!rows.length) {
    return `<p class="empty">No payments in this view.</p>`;
  }
  return rows.map(
    (r) => `<article class="property-row">
        <div class="property-row-main">
          <div class="property-row-title">
            <strong>${r.property_name}</strong>
            <span class="badge ${statusClass(String(r.status))}">${labelize(String(r.status))}</span>
          </div>
          <div class="muted">${r.lender} \xB7 Due ${r.due_date}</div>
          <div class="property-row-meta">
            <span>Expected ${money(Number(r.expected_amount), user.preferredCurrency)}</span>
            <span>Paid ${r.amount_paid != null ? money(Number(r.amount_paid), user.preferredCurrency) : "-"}</span>
            <span>Paid date ${r.paid_date || "-"}</span>
          </div>
        </div>
        <div class="property-row-actions actions">
          <button class="btn ghost" data-edit="${r.id || r._id}" data-mode="edit" type="button">Edit</button>
          ${r.status === "paid" ? "" : `<button class="btn secondary" data-edit="${r.id || r._id}" data-mode="pay" type="button">Mark paid</button>`}
        </div>
      </article>`
  ).join("");
}
function mortgageList(rows) {
  if (!rows.length) {
    return `<p class="empty">No active mortgages. Add one from <a href="/rates.html">Rates</a>.</p>`;
  }
  return rows.map(
    (m) => `<article class="property-row">
        <div class="property-row-main">
          <div class="property-row-title">
            <strong>${m.property_name}</strong>
            <span class="badge ok">Active</span>
          </div>
          <div class="muted">${m.lender}</div>
          <div class="property-row-meta">
            <span>Balance ${money(Number(m.outstanding_balance), user.preferredCurrency)}</span>
            <span>Rate ${m.interest_rate}%</span>
            <span>Monthly ${money(Number(m.monthly_repayment), user.preferredCurrency)}</span>
            <span>Fixed expiry ${m.fixed_rate_expiry || "-"}</span>
          </div>
        </div>
      </article>`
  ).join("");
}
function formStatusEl() {
  return document.getElementById("payment-form-status");
}
function isoDate(value) {
  const raw = String(value || "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : "";
}
function openPaymentEditor(row, markPaid) {
  document.getElementById("payment-form-title").textContent = markPaid ? "Mark payment as paid" : "Edit payment";
  field(paymentForm, "id").value = String(row.id || row._id || "");
  field(paymentForm, "propertyName").value = String(row.property_name || "");
  field(paymentForm, "lender").value = String(row.lender || "");
  field(paymentForm, "dueDate").value = isoDate(row.due_date);
  field(paymentForm, "expectedAmount").value = String(row.expected_amount ?? "");
  field(paymentForm, "amountPaid").value = markPaid ? String(row.expected_amount ?? "") : row.amount_paid != null ? String(row.amount_paid) : "";
  field(paymentForm, "paidDate").value = markPaid ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) : isoDate(row.paid_date);
  field(paymentForm, "status").value = markPaid ? "paid" : String(row.status || "upcoming");
  field(paymentForm, "notes").value = String(row.notes || "");
  setStatus(formStatusEl(), "", "info");
  openBackdrop(paymentModal);
}
function syncPaidFields() {
  const status = field(paymentForm, "status").value;
  const amountPaid = field(paymentForm, "amountPaid");
  const paidDate = field(paymentForm, "paidDate");
  const expectedAmount = field(paymentForm, "expectedAmount").value;
  if (status === "paid" || status === "partial") {
    if (!amountPaid.value && expectedAmount) {
      amountPaid.value = expectedAmount;
    }
    if (!paidDate.value) {
      paidDate.value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    }
  }
}
paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const paymentId = String(field(paymentForm, "id").value || "").trim();
  if (!paymentId || paymentId === "undefined") {
    setStatus(formStatusEl(), "Missing payment id. Re-open Edit and try again.", "error");
    return;
  }
  syncPaidFields();
  const expectedAmount = Number(field(paymentForm, "expectedAmount").value);
  const amountPaidRaw = field(paymentForm, "amountPaid").value.trim();
  const status = field(paymentForm, "status").value || "upcoming";
  const amountPaid = amountPaidRaw === "" ? null : Number(amountPaidRaw);
  try {
    await api(`/mortgages/payments/${paymentId}`, {
      method: "PUT",
      body: JSON.stringify({
        expectedAmount,
        amountPaid,
        paidDate: field(paymentForm, "paidDate").value || null,
        status,
        notes: field(paymentForm, "notes").value
      })
    });
    setStatus(document.getElementById("status"), "Payment updated.", "success");
    closeBackdrop(paymentModal);
    if (status === "paid" && activeView === "upcoming") {
      activeView = "past";
    }
    await loadViews();
  } catch (error) {
    setStatus(formStatusEl(), error.message, "error");
  }
});
field(paymentForm, "status").addEventListener("change", syncPaidFields);
document.getElementById("close-payment-modal")?.addEventListener("click", () => closeBackdrop(paymentModal));
document.getElementById("cancel-payment-modal")?.addEventListener("click", () => closeBackdrop(paymentModal));
paymentModal.addEventListener("click", (event) => {
  if (event.target === paymentModal) {
    closeBackdrop(paymentModal);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !paymentModal.hidden) {
    closeBackdrop(paymentModal);
  }
});
document.getElementById("view-tabs")?.addEventListener("click", (event) => {
  const target = event.target;
  if (target.dataset.view === "upcoming" || target.dataset.view === "current" || target.dataset.view === "past" || target.dataset.view === "mortgages") {
    activeView = target.dataset.view;
    render();
  }
});
document.getElementById("refresh")?.addEventListener("click", () => {
  void loadViews();
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadViews();
});
void (async () => {
  await loadProperties();
  await loadViews();
})();
