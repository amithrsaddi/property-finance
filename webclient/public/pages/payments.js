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
  const search2 = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0 && value !== null && value !== "") {
      search2.set(key, String(value));
    }
  }
  const result = search2.toString();
  return result ? `?${result}` : "";
}
function formatDateDmY(value) {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) {
    return raw || "-";
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}
function labelize(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// src/list-view.ts
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function initials(value) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}
function avatarTone(value) {
  let hash = 0;
  for (const char of value) {
    hash = hash * 31 + char.charCodeAt(0) >>> 0;
  }
  return hash % 5;
}
function pillKind(status) {
  const value = String(status || "").toLowerCase();
  if (value === "paid" || value === "active" || value === "done" || value === "repayment") {
    return "done";
  }
  if (value === "upcoming" || value === "partial" || value === "partially_paid" || value === "info" || value === "interest_only") {
    return "progress";
  }
  if (value === "archived" || value === "paused") {
    return "paused";
  }
  if (value === "missed" || value === "overdue" || value === "unpaid" || value === "bad") {
    return "bad";
  }
  return "warn";
}
function statusPill(status, label) {
  const text = label || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `<span class="pill ${pillKind(status)}">${escapeHtml(text)}</span>`;
}
function nameCell(title, subtitle, href) {
  const heading = href ? `<a class="name-title" href="${escapeHtml(href)}">${escapeHtml(title)}</a>` : `<div class="name-title">${escapeHtml(title)}</div>`;
  return `<div class="name-cell">
    <span class="row-avatar tone-${avatarTone(title)}">${escapeHtml(initials(title))}</span>
    <div>
      ${heading}
      <div class="name-sub">${escapeHtml(subtitle)}</div>
    </div>
  </div>`;
}
function summaryCell(title, subtitle) {
  return `<div class="summary-cell">
    <div class="name-title">${escapeHtml(title)}</div>
    <div class="name-sub">${escapeHtml(subtitle)}</div>
  </div>`;
}
function extraCell(extra) {
  return `<div class="summary-cell">
    <div class="name-title">${escapeHtml(extra.title)}</div>
    ${extra.subtitle ? `<div class="name-sub">${escapeHtml(extra.subtitle)}</div>` : ""}
  </div>`;
}
function kebabMenu(id, open, itemsHtml) {
  if (!itemsHtml.trim()) {
    return "";
  }
  return `<div class="row-menu ${open ? "open" : ""}">
    <button class="kebab-btn" data-menu="${escapeHtml(id)}" type="button" aria-label="Actions" aria-expanded="${open}">\u22EF</button>
    <div class="row-menu-pop"${open ? "" : " hidden"}>${itemsHtml}</div>
  </div>`;
}
function viewToggleHtml(view2) {
  return `<div class="view-toggle" role="group" aria-label="View">
    <button class="view-btn${view2 === "list" ? " active" : ""}" data-view-mode="list" type="button" aria-label="List view" aria-pressed="${view2 === "list"}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>
    </button>
    <button class="view-btn${view2 === "grid" ? " active" : ""}" data-view-mode="grid" type="button" aria-label="Grid view" aria-pressed="${view2 === "grid"}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
    </button>
  </div>`;
}
function searchFieldHtml(id = "list-search") {
  return `<label class="search-field">
    <span class="sr-only">Search</span>
    <input id="${id}" type="search" placeholder="Search" />
    <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16.2 16.2 21 21"/></svg>
  </label>`;
}
function sortFieldHtml(options, id = "sort-by") {
  return `<label class="sort-field">
    <span>Sort by</span>
    <select id="${id}">
      ${options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}
    </select>
  </label>`;
}
function renderDataList(rows, view2, empty, openMenuId2) {
  if (!rows.length) {
    return `<p class="empty">${empty}</p>`;
  }
  const hasActions = rows.some((row) => Boolean(row.actions));
  const extraHeaders = rows[0]?.extras?.map((extra) => extra.header) ?? [];
  const hasExtras = extraHeaders.length > 0;
  const cells = (row) => {
    const actions = kebabMenu(row.id, openMenuId2 === row.id, row.actions || "");
    return {
      name: nameCell(row.title, row.subtitle, row.href),
      status: statusPill(row.status, row.statusLabel),
      summary: summaryCell(row.summaryTitle, row.summarySub),
      extras: extraHeaders.map((header, index) => {
        const extra = row.extras?.[index] || { header, title: "\u2014" };
        return extraCell(extra);
      }),
      actions
    };
  };
  if (view2 === "grid") {
    return `<div class="property-grid">${rows.map((row) => {
      const cell = cells(row);
      const extras = hasExtras ? `<div class="card-extras">${extraHeaders.map((header, index) => {
        const extra = row.extras?.[index] || { header, title: "\u2014" };
        return `<div class="card-extra">
                  <div class="name-sub">${escapeHtml(header)}</div>
                  <div class="name-title">${escapeHtml(extra.title)}</div>
                  ${extra.subtitle ? `<div class="name-sub">${escapeHtml(extra.subtitle)}</div>` : ""}
                </div>`;
      }).join("")}</div>` : cell.summary;
      return `<article class="property-card">
          <div class="property-card-head">
            ${cell.name}
            ${hasActions ? cell.actions : ""}
          </div>
          <div class="property-card-meta">
            ${cell.status}
            ${extras}
          </div>
        </article>`;
    }).join("")}</div>`;
  }
  return `<div class="data-table-wrap">
    <table class="data-table${hasExtras ? " has-extras" : ""}">
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          ${hasExtras ? extraHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("") : "<th>Summary</th>"}
          ${hasActions ? `<th class="col-actions">Actions</th>` : ""}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
    const cell = cells(row);
    const extraTds = hasExtras ? cell.extras.map(
      (html, index) => `<td class="col-extra" data-label="${escapeHtml(extraHeaders[index] || "")}">${html}</td>`
    ).join("") : `<td>${cell.summary}</td>`;
    return `<tr>
              <td>${cell.name}</td>
              <td>${cell.status}</td>
              ${extraTds}
              ${hasActions ? `<td class="col-actions">${cell.actions}</td>` : ""}
            </tr>`;
  }).join("")}
      </tbody>
    </table>
  </div>`;
}
function bindListChrome(options) {
  document.querySelectorAll("[data-view-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewMode === options.view);
    button.setAttribute("aria-pressed", String(button.dataset.viewMode === options.view));
    button.addEventListener("click", () => {
      const next = button.dataset.viewMode === "grid" ? "grid" : "list";
      document.querySelectorAll("[data-view-mode]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.viewMode === next);
        btn.setAttribute("aria-pressed", String(btn.dataset.viewMode === next));
      });
      options.onView(next);
    });
  });
  document.getElementById(options.searchId || "list-search")?.addEventListener("input", (event) => {
    options.onSearch(event.target.value);
  });
  if (options.onSort) {
    document.getElementById(options.sortId || "sort-by")?.addEventListener("change", (event) => {
      options.onSort(event.target.value);
    });
  }
}
function positionOpenRowMenu(root2 = document) {
  const menu = root2.querySelector(".row-menu.open");
  const button = menu?.querySelector(".kebab-btn");
  const pop = menu?.querySelector(".row-menu-pop");
  if (!menu || !button || !pop) {
    return;
  }
  pop.classList.add("fixed-pop");
  const rect = button.getBoundingClientRect();
  const width = Math.max(pop.offsetWidth, 136);
  const height = pop.offsetHeight || 160;
  let left = rect.right - width;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  pop.style.left = `${left}px`;
  pop.style.right = "auto";
  if (window.innerHeight - rect.bottom < height + 12) {
    pop.style.top = "auto";
    pop.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  } else {
    pop.style.bottom = "auto";
    pop.style.top = `${rect.bottom + 6}px`;
  }
}
function bindRowMenus(root2, openMenuId2, setOpenMenuId, rerender) {
  root2.querySelectorAll("[data-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = String(button.dataset.menu);
      setOpenMenuId(openMenuId2 === id ? null : id);
      rerender();
    });
  });
  root2.querySelectorAll(".row-menu-pop").forEach((pop) => {
    pop.addEventListener("click", (event) => event.stopPropagation());
  });
  if (openMenuId2) {
    requestAnimationFrame(() => positionOpenRowMenu(root2));
  }
}
function matchesQuery(row, query, keys) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
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

// src/pages/payments.ts
var VIEW_KEY = "pf-payments-view";
var root = mountShell(
  "/payments.html",
  "Payments",
  "Upcoming, current, and past mortgage payments.",
  `<button class="btn" id="add-payment-btn" type="button">+ Add Mortgage Payment</button>`
);
var user = getUser();
var presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="table-toolbar-start">
        <div class="seg-tabs" id="view-tabs">
          <button class="seg-tab active" data-view="upcoming" type="button">Upcoming</button>
          <button class="seg-tab" data-view="current" type="button">Current</button>
          <button class="seg-tab" data-view="past" type="button">Past</button>
        </div>
        <div class="table-filters">
          <div class="field"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
          <div class="field"><label>Year</label><select id="filterYear"><option value="">All</option></select></div>
        </div>
      </div>
      <div class="table-toolbar-end">
        ${sortFieldHtml([
  { value: "due", label: "Due date" },
  { value: "name", label: "Name" },
  { value: "amount", label: "Amount" }
])}
        ${searchFieldHtml()}
        ${viewToggleHtml(sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list")}
      </div>
    </div>
    <div class="status" id="status" hidden></div>
    <div id="content"></div>
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
          <div class="field" id="mortgage-field" hidden style="grid-column:1/-1">
            <label>Mortgage</label>
            <select name="mortgageId" id="mortgageId">
              <option value="">Select mortgage</option>
            </select>
          </div>
          <div class="field" id="property-name-field"><label>Property</label><input name="propertyName" disabled /></div>
          <div class="field" id="lender-field"><label>Lender</label><input name="lender" disabled /></div>
          <div class="field"><label>Due date</label><input name="dueDate" type="date" /></div>
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
          <button class="btn" type="submit" id="payment-submit-btn">Save payment</button>
        </div>
      </form>
    </div>
  </div>
`;
var views = null;
var activeView = "upcoming";
var search = "";
var sortBy = "due";
var view = sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
var openMenuId = null;
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
function fillYearOptions(years) {
  const select = document.getElementById("filterYear");
  const selected = select.value;
  const unique = [...new Set(years.filter((year) => Number.isInteger(year)))].sort((a, b) => b - a);
  select.innerHTML = `<option value="">All</option>${unique.map((year) => `<option value="${year}">${year}</option>`).join("")}`;
  if (selected && unique.includes(Number(selected))) {
    select.value = selected;
  }
}
async function loadViews() {
  const propertyId = document.getElementById("filterProperty").value;
  const year = document.getElementById("filterYear").value;
  views = await api(`/mortgages/payments/views${qs({ propertyId, year })}`);
  fillYearOptions(views.years || []);
  fillMortgageOptions();
  render();
}
function fillMortgageOptions() {
  const select = field(paymentForm, "mortgageId");
  const mortgages = views?.activeMortgages || [];
  const selected = select.value;
  select.innerHTML = `<option value="">Select mortgage</option>${mortgages.map((m) => {
    const id = escapeHtml(String(m.id || m._id || ""));
    const label = escapeHtml(`${m.property_name || "Property"} (${m.lender || "Lender"})`);
    const amount = escapeHtml(String(m.monthly_repayment ?? ""));
    return `<option value="${id}" data-amount="${amount}">${label}</option>`;
  }).join("")}`;
  if (selected && [...select.options].some((option) => option.value === selected)) {
    select.value = selected;
  }
}
function sortRows(rows, keys) {
  const filtered = rows.filter((row) => matchesQuery(row, search, keys));
  filtered.sort((a, b) => {
    if (sortBy === "name") {
      return String(a.property_name || "").localeCompare(String(b.property_name || ""), "en-GB");
    }
    if (sortBy === "amount") {
      const aAmount = Number(a.expected_amount ?? a.outstanding_balance ?? 0);
      const bAmount = Number(b.expected_amount ?? b.outstanding_balance ?? 0);
      return bAmount - aAmount;
    }
    return String(a.due_date || a.fixed_rate_expiry || "").localeCompare(
      String(b.due_date || b.fixed_rate_expiry || "")
    );
  });
  return filtered;
}
function render() {
  if (!views) {
    return;
  }
  document.querySelectorAll("#view-tabs .seg-tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === activeView);
  });
  const content = document.getElementById("content");
  const source = views[activeView];
  const rows = sortRows(source, ["property_name", "lender", "status", "notes", "due_date", "paid_date"]);
  content.innerHTML = renderDataList(
    rows.map((r) => {
      const id = String(r.id || r._id);
      const status = String(r.status || "upcoming");
      return {
        id,
        title: String(r.property_name || "Property"),
        subtitle: `${r.lender || "Lender"} \xB7 Due ${formatDateDmY(String(r.due_date || ""))}`,
        href: r.property_id ? `/property.html?id=${r.property_id}` : void 0,
        status,
        statusLabel: labelize(status),
        summaryTitle: `Expected ${money(Number(r.expected_amount), user.preferredCurrency)}`,
        summarySub: `Paid ${r.amount_paid != null ? money(Number(r.amount_paid), user.preferredCurrency) : "-"}${r.paid_date ? ` \xB7 ${formatDateDmY(String(r.paid_date))}` : ""}`,
        actions: `<button type="button" data-edit="${id}" data-mode="edit">Edit</button>${status === "paid" ? "" : `<button type="button" data-edit="${id}" data-mode="pay">Mark paid</button>`}`
      };
    }),
    view,
    "No payments in this view.",
    openMenuId
  );
  bindRowMenus(
    content,
    openMenuId,
    (id) => {
      openMenuId = id;
    },
    render
  );
  content.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((r) => String(r.id || r._id) === String(button.dataset.edit));
      if (row) {
        openMenuId = null;
        openPaymentEditor(row, button.dataset.mode === "pay");
      }
    });
  });
}
function formStatusEl() {
  return document.getElementById("payment-form-status");
}
function isoDate(value) {
  const raw = String(value || "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : "";
}
function setCreateMode(create) {
  const mortgageField = document.getElementById("mortgage-field");
  const propertyField = document.getElementById("property-name-field");
  const lenderField = document.getElementById("lender-field");
  const mortgageSelect = field(paymentForm, "mortgageId");
  const dueDate = field(paymentForm, "dueDate");
  mortgageField.hidden = !create;
  propertyField.hidden = create;
  lenderField.hidden = create;
  mortgageSelect.required = create;
  dueDate.required = create;
  dueDate.disabled = !create;
  document.getElementById("payment-submit-btn").textContent = create ? "Add payment" : "Save payment";
}
function fillExpectedFromMortgage() {
  const select = field(paymentForm, "mortgageId");
  const option = select.selectedOptions[0];
  const amount = option?.dataset.amount || "";
  const expected = field(paymentForm, "expectedAmount");
  if (amount) {
    expected.value = amount;
  }
}
function openPaymentCreate() {
  const mortgages = views?.activeMortgages || [];
  if (!mortgages.length) {
    setStatus(
      document.getElementById("status"),
      "Add a mortgage on Rates before recording a payment.",
      "error"
    );
    return;
  }
  paymentForm.reset();
  setCreateMode(true);
  fillMortgageOptions();
  field(paymentForm, "id").value = "";
  field(paymentForm, "dueDate").value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  field(paymentForm, "status").value = "upcoming";
  const filterProperty = document.getElementById("filterProperty").value;
  const preferred = presetPropertyId || filterProperty;
  if (preferred) {
    const match = mortgages.find((m) => String(m.property_id) === preferred);
    if (match) {
      field(paymentForm, "mortgageId").value = String(match.id || match._id);
    }
  } else if (mortgages.length === 1) {
    field(paymentForm, "mortgageId").value = String(mortgages[0].id || mortgages[0]._id);
  }
  fillExpectedFromMortgage();
  document.getElementById("payment-form-title").textContent = "Add mortgage payment";
  setStatus(formStatusEl(), "", "info");
  openBackdrop(paymentModal);
}
function openPaymentEditor(row, markPaid) {
  paymentForm.reset();
  setCreateMode(false);
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
  const creating = !paymentId || paymentId === "undefined";
  if (creating && !field(paymentForm, "mortgageId").value) {
    setStatus(formStatusEl(), "Select a mortgage.", "error");
    return;
  }
  if (creating && !field(paymentForm, "dueDate").value) {
    setStatus(formStatusEl(), "A due date is required.", "error");
    return;
  }
  syncPaidFields();
  const expectedAmount = Number(field(paymentForm, "expectedAmount").value);
  const amountPaidRaw = field(paymentForm, "amountPaid").value.trim();
  const status = field(paymentForm, "status").value || "upcoming";
  const amountPaid = amountPaidRaw === "" ? null : Number(amountPaidRaw);
  const dueDate = field(paymentForm, "dueDate").value;
  const payload = {
    expectedAmount,
    amountPaid,
    paidDate: field(paymentForm, "paidDate").value || null,
    status,
    notes: field(paymentForm, "notes").value
  };
  try {
    if (creating) {
      await api("/mortgages/payments", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          mortgageId: field(paymentForm, "mortgageId").value,
          dueDate
        })
      });
      setStatus(document.getElementById("status"), "Mortgage payment added.", "success");
    } else {
      await api(`/mortgages/payments/${paymentId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setStatus(document.getElementById("status"), "Payment updated.", "success");
    }
    closeBackdrop(paymentModal);
    if (status === "paid") {
      activeView = "past";
    } else if (dueDate) {
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const monthStart = `${today.slice(0, 8)}01`;
      const monthEndDate = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0));
      const monthEnd = monthEndDate.toISOString().slice(0, 10);
      if (dueDate >= monthStart && dueDate <= monthEnd) {
        activeView = "current";
      } else if (dueDate >= today) {
        activeView = "upcoming";
      } else {
        activeView = "past";
      }
    }
    await loadViews();
  } catch (error) {
    setStatus(formStatusEl(), error.message, "error");
  }
});
field(paymentForm, "status").addEventListener("change", syncPaidFields);
field(paymentForm, "mortgageId").addEventListener("change", fillExpectedFromMortgage);
document.getElementById("add-payment-btn")?.addEventListener("click", () => {
  openMenuId = null;
  openPaymentCreate();
});
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
  } else if (event.key === "Escape" && openMenuId) {
    openMenuId = null;
    render();
  }
});
document.addEventListener("click", () => {
  if (!openMenuId) {
    return;
  }
  openMenuId = null;
  render();
});
document.getElementById("view-tabs")?.addEventListener("click", (event) => {
  const target = event.target;
  if (target.dataset.view === "upcoming" || target.dataset.view === "current" || target.dataset.view === "past") {
    activeView = target.dataset.view;
    openMenuId = null;
    render();
  }
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadViews();
});
document.getElementById("filterYear")?.addEventListener("change", () => {
  void loadViews();
});
bindListChrome({
  view,
  onView: (next) => {
    view = next;
    sessionStorage.setItem(VIEW_KEY, view);
    render();
  },
  onSearch: (value) => {
    search = value;
    render();
  },
  onSort: (value) => {
    sortBy = value;
    render();
  }
});
void (async () => {
  await loadProperties();
  await loadViews();
})();
