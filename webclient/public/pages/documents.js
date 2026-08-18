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
  const user = getUser();
  if (!token || !user) {
    clearSession();
    window.location.href = "/";
    throw new Error("Not authenticated");
  }
  return user;
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
async function apiFile(path) {
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${apiBase()}${path}`, { headers });
  if (response.status === 401) {
    clearSession();
    window.location.href = "/";
    throw new Error("Session expired.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Could not download the file.");
  }
  const blob = await response.blob();
  const mimeType = response.headers.get("content-type") || blob.type || "application/octet-stream";
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1].replace(/"/g, "")) : "document";
  return { blob, filename, mimeType };
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
  if (value === "paid" || value === "active" || value === "done") {
    return "done";
  }
  if (value === "upcoming" || value === "partial" || value === "partially_paid" || value === "info") {
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
  const cells = (row) => {
    const actions = kebabMenu(row.id, openMenuId2 === row.id, row.actions || "");
    return {
      name: nameCell(row.title, row.subtitle, row.href),
      status: statusPill(row.status, row.statusLabel),
      summary: summaryCell(row.summaryTitle, row.summarySub),
      actions
    };
  };
  if (view2 === "grid") {
    return `<div class="property-grid">${rows.map((row) => {
      const cell = cells(row);
      return `<article class="property-card">
          <div class="property-card-head">
            ${cell.name}
            ${hasActions ? cell.actions : ""}
          </div>
          <div class="property-card-meta">
            ${cell.status}
            ${cell.summary}
          </div>
        </article>`;
    }).join("")}</div>`;
  }
  return `<div class="data-table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Summary</th>
          ${hasActions ? `<th class="col-actions">Actions</th>` : ""}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
    const cell = cells(row);
    return `<tr>
              <td>${cell.name}</td>
              <td>${cell.status}</td>
              <td>${cell.summary}</td>
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
  const user = getUser();
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
            <span class="sidebar-profile-name">${user.name}</span>
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

// src/pages/documents.ts
var VIEW_KEY = "pf-documents-view";
var MAX_FILE_BYTES = 4 * 1024 * 1024;
var ACCEPT = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,image/*";
var root = mountShell(
  "/documents.html",
  "Documents",
  "Store files against a property or in a general folder.",
  `<button class="btn" id="add-document-btn" type="button">+ Add Document</button>`
);
var presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
var cache = [];
var search = "";
var sortBy = "newest";
var view = sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
var openMenuId = null;
var scope = presetPropertyId ? "property" : "all";
var editingId = null;
var selectedFile = null;
root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="table-toolbar-start">
        <div class="seg-tabs" id="scope-tabs">
          <button class="seg-tab${scope === "all" ? " active" : ""}" data-scope="all" type="button">All documents</button>
          <button class="seg-tab${scope === "property" ? " active" : ""}" data-scope="property" type="button">Property</button>
          <button class="seg-tab${String(scope) === "general" ? " active" : ""}" data-scope="general" type="button">General</button>
        </div>
        <div class="table-filters">
          <div class="field" id="filter-property-wrap"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        </div>
      </div>
      <div class="table-toolbar-end">
        ${sortFieldHtml([
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
  { value: "expiry", label: "Validity" }
])}
        ${searchFieldHtml()}
        ${viewToggleHtml(view)}
      </div>
    </div>
    <div class="status" id="status" hidden></div>
    <div id="list"></div>
  </section>

  <div class="modal-backdrop" id="document-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="document-form-title">
      <div class="modal-header">
        <h2 id="document-form-title">Add document</h2>
        <button class="modal-close" id="close-document-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="document-form" class="stack">
        <div class="form-grid">
          <div class="field"><label>Document name</label><input name="name" required placeholder="e.g. Tenancy agreement" /></div>
          <div class="field">
            <label>Linked to</label>
            <select name="propertyId" id="documentPropertyId">
              <option value="">General</option>
            </select>
          </div>
          <div class="field"><label>Validity <span class="muted">(optional)</span></label><input name="validUntil" type="date" /></div>
          <div class="field" style="grid-column:1/-1">
            <label id="file-label">Upload a document</label>
            <label class="file-drop">
              <input id="document-file" type="file" accept="${ACCEPT}" />
              <span class="file-drop-title">Choose file</span>
              <span class="file-drop-sub" id="file-drop-sub">PDF, image, Word, or Excel \xB7 up to 4 MB</span>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-document-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save document</button>
        </div>
      </form>
    </div>
  </div>
`;
var modal = document.getElementById("document-modal");
var form = document.getElementById("document-form");
var fileInput = document.getElementById("document-file");
function todayIso() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fileKind(mime, filename) {
  const type = `${mime} ${filename}`.toLowerCase();
  if (type.includes("pdf")) {
    return "PDF";
  }
  if (type.includes("image") || /\.(jpe?g|png|gif|webp)$/i.test(filename)) {
    return "Image";
  }
  if (type.includes("word") || /\.docx?$/i.test(filename)) {
    return "Word";
  }
  if (type.includes("excel") || type.includes("spreadsheet") || /\.xlsx?$/i.test(filename)) {
    return "Excel";
  }
  return "File";
}
function validity(row) {
  const value = String(row.valid_until || "");
  if (!value) {
    return { status: "upcoming", label: "No expiry" };
  }
  if (value < todayIso()) {
    return { status: "overdue", label: `Expired ${formatDateDmY(value)}` };
  }
  return { status: "active", label: `Valid until ${formatDateDmY(value)}` };
}
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
function syncScopeUi() {
  document.querySelectorAll("#scope-tabs .seg-tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.scope === scope);
  });
  document.getElementById("filter-property-wrap").style.display = scope === "general" ? "none" : "block";
}
function setFileHint(text) {
  document.getElementById("file-drop-sub").textContent = text;
}
function openModal(title) {
  document.getElementById("document-form-title").textContent = title;
  document.getElementById("file-label").textContent = editingId ? "Replace file (optional)" : "Upload a document";
  modal.hidden = false;
  document.body.classList.add("modal-open");
}
function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  editingId = null;
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel \xB7 up to 4 MB");
  if (presetPropertyId) {
    document.getElementById("documentPropertyId").value = presetPropertyId;
  }
}
async function loadProperties() {
  const data = await api(
    `/properties${qs({ status: "active" })}`
  );
  const filter = document.getElementById("filterProperty");
  const formSelect = document.getElementById("documentPropertyId");
  for (const property of data.properties) {
    const option = document.createElement("option");
    option.value = String(property.id);
    option.textContent = property.name;
    filter.appendChild(option.cloneNode(true));
    formSelect.appendChild(option);
  }
  if (presetPropertyId) {
    filter.value = presetPropertyId;
    formSelect.value = presetPropertyId;
  }
}
function visibleRows() {
  const rows = cache.filter(
    (row) => matchesQuery(row, search, ["name", "original_filename", "property_name", "scope", "mime_type"])
  );
  rows.sort((a, b) => {
    if (sortBy === "name") {
      return String(a.name || "").localeCompare(String(b.name || ""), "en-GB");
    }
    if (sortBy === "expiry") {
      return String(a.valid_until || "9999").localeCompare(String(b.valid_until || "9999"));
    }
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
  return rows;
}
async function openOrDownload(id, download) {
  const file = await apiFile(`/documents/${id}/file`);
  const url = URL.createObjectURL(file.blob);
  if (download) {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.click();
  } else {
    window.open(url, "_blank", "noopener");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
function renderList() {
  const list = document.getElementById("list");
  const rows = visibleRows();
  list.innerHTML = renderDataList(
    rows.map((row) => {
      const id = String(row.id);
      const kind = fileKind(String(row.mime_type || ""), String(row.original_filename || ""));
      const place = row.scope === "property" ? String(row.property_name || "Property") : "General";
      const valid = validity(row);
      return {
        id,
        title: String(row.name || "Document"),
        subtitle: `${row.original_filename || "File"} \xB7 ${formatBytes(Number(row.file_size || 0))}`,
        href: row.property_id ? `/property.html?id=${row.property_id}` : void 0,
        status: valid.status,
        statusLabel: valid.label,
        summaryTitle: place,
        summarySub: kind,
        actions: `<button type="button" data-open="${id}">Open</button><button type="button" data-download="${id}">Download</button><button type="button" data-edit="${id}">Edit</button><button type="button" data-delete="${id}">Delete</button>`
      };
    }),
    view,
    "No documents yet. Use + Add Document to upload one.",
    openMenuId
  );
  bindRowMenus(
    list,
    openMenuId,
    (id) => {
      openMenuId = id;
    },
    renderList
  );
  list.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await openOrDownload(String(button.dataset.open), false);
      } catch (error) {
        setStatus(document.getElementById("status"), error.message, "error");
      }
    });
  });
  list.querySelectorAll("[data-download]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await openOrDownload(String(button.dataset.download), true);
      } catch (error) {
        setStatus(document.getElementById("status"), error.message, "error");
      }
    });
  });
  list.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((item) => String(item.id) === String(button.dataset.edit));
      if (!row) {
        return;
      }
      openMenuId = null;
      fillForm(row);
      openModal("Edit document");
    });
  });
  list.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/documents/${button.dataset.delete}`, { method: "DELETE" });
      setStatus(document.getElementById("status"), "Document deleted.", "success");
      openMenuId = null;
      await loadDocuments();
    });
  });
}
function fillForm(row) {
  editingId = String(row.id);
  selectedFile = null;
  fileInput.value = "";
  form.elements.namedItem("name").value = String(row.name || "");
  form.elements.namedItem("propertyId").value = String(row.property_id || "");
  form.elements.namedItem("validUntil").value = String(row.valid_until || "").slice(0, 10);
  setFileHint(String(row.original_filename || "Current file will be kept unless you choose another."));
}
async function loadDocuments() {
  const propertyId = scope === "general" ? "" : document.getElementById("filterProperty").value;
  const data = await api(
    `/documents${qs({ scope: scope === "all" ? "" : scope, propertyId })}`
  );
  cache = data.documents;
  renderList();
}
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0] || null;
  selectedFile = file;
  if (!file) {
    setFileHint("PDF, image, Word, or Excel \xB7 up to 4 MB");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    selectedFile = null;
    fileInput.value = "";
    setFileHint("That file is larger than 4 MB. Choose a smaller file.");
    return;
  }
  const nameInput = form.elements.namedItem("name");
  if (!nameInput.value.trim()) {
    nameInput.value = file.name.replace(/\.[^.]+$/, "");
  }
  setFileHint(`${file.name} \xB7 ${formatBytes(file.size)}`);
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingId && !selectedFile) {
    setStatus(document.getElementById("status"), "Upload a document file.", "error");
    return;
  }
  const formData = new FormData(form);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    propertyId: String(formData.get("propertyId") || "") || null,
    validUntil: String(formData.get("validUntil") || "") || null
  };
  try {
    if (selectedFile) {
      payload.originalFilename = selectedFile.name;
      payload.mimeType = selectedFile.type || "application/octet-stream";
      payload.fileData = await readFileAsBase64(selectedFile);
    }
    if (editingId) {
      await api(`/documents/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Document updated.", "success");
    } else {
      await api("/documents", { method: "POST", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Document saved.", "success");
    }
    closeModal();
    await loadDocuments();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
});
document.getElementById("add-document-btn")?.addEventListener("click", () => {
  editingId = null;
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel \xB7 up to 4 MB");
  if (presetPropertyId) {
    document.getElementById("documentPropertyId").value = presetPropertyId;
  } else if (scope === "general") {
    document.getElementById("documentPropertyId").value = "";
  }
  openModal("Add document");
});
document.getElementById("close-document-modal")?.addEventListener("click", closeModal);
document.getElementById("cancel-document-modal")?.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    closeModal();
  } else if (event.key === "Escape" && openMenuId) {
    openMenuId = null;
    renderList();
  }
});
document.addEventListener("click", () => {
  if (!openMenuId) {
    return;
  }
  openMenuId = null;
  renderList();
});
document.getElementById("scope-tabs")?.addEventListener("click", (event) => {
  const target = event.target;
  if (target.dataset.scope === "all" || target.dataset.scope === "property" || target.dataset.scope === "general") {
    scope = target.dataset.scope;
    openMenuId = null;
    syncScopeUi();
    void loadDocuments();
  }
});
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadDocuments();
});
bindListChrome({
  view,
  onView: (next) => {
    view = next;
    sessionStorage.setItem(VIEW_KEY, view);
    renderList();
  },
  onSearch: (value) => {
    search = value;
    renderList();
  },
  onSort: (value) => {
    sortBy = value;
    renderList();
  }
});
syncScopeUi();
void (async () => {
  await loadProperties();
  await loadDocuments();
})();
