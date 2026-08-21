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
function labelize(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// src/list-view.ts
function storedListView(key, fallback) {
  try {
    const value = sessionStorage.getItem(key);
    if (value === "list" || value === "grid") {
      return value;
    }
  } catch {
  }
  return fallback;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var HOUSE_ICON = `<svg class="property-thumb-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 21V10.5L12 4l8 6.5V21"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M9 21v-6h6v6"/></svg>`;
var thumbUrls = /* @__PURE__ */ new Map();
function cachedPropertyThumb(id) {
  return thumbUrls.get(id);
}
function forgetPropertyThumb(id) {
  const url = thumbUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    thumbUrls.delete(id);
  }
}
function propertyThumbHtml(propertyId, hasImage = false) {
  const id = String(propertyId || "");
  const cached = id ? thumbUrls.get(id) : "";
  return `<span class="property-thumb-wrap${cached ? " has-photo" : ""}">
    <span class="property-thumb placeholder">${HOUSE_ICON}</span>
    ${id && hasImage ? `<img class="property-thumb" alt="" data-property-image="${escapeHtml(id)}"${cached ? ` src="${escapeHtml(cached)}"` : ""}>` : ""}
  </span>`;
}
async function hydratePropertyThumbs(root2) {
  const imgs = [...root2.querySelectorAll("img[data-property-image]")];
  const unique = /* @__PURE__ */ new Map();
  for (const img of imgs) {
    const id = img.dataset.propertyImage || "";
    if (!id) {
      continue;
    }
    const group = unique.get(id) || [];
    group.push(img);
    unique.set(id, group);
  }
  await Promise.all(
    [...unique.entries()].map(async ([id, group]) => {
      let url = group.find((img) => img.getAttribute("src"))?.getAttribute("src") || thumbUrls.get(id) || "";
      if (!url) {
        try {
          const file = await apiFile(`/properties/${id}/image`);
          url = URL.createObjectURL(file.blob);
          thumbUrls.set(id, url);
        } catch {
          return;
        }
      }
      for (const img of group) {
        img.src = url;
        const wrap = img.closest(".property-thumb-wrap");
        const reveal = () => wrap?.classList.add("has-photo");
        if (img.complete && img.naturalWidth) {
          reveal();
        } else {
          img.addEventListener("load", reveal, { once: true });
        }
      }
    })
  );
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

// src/pages/properties.ts
var VIEW_KEY = "pf-properties-view-v2";
var MAX_IMAGE_BYTES = 4 * 1024 * 1024;
var IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp";
var user = getUser();
var root = mountShell(
  "/properties.html",
  "Properties",
  "Manage your property portfolio.",
  `<button class="btn" id="add-property-btn" type="button">+ Add Property</button>`
);
var editingId = null;
var cache = [];
var statusFilter = "all";
var sortBy = "newest";
var search = "";
var view = storedListView(VIEW_KEY, "grid");
var openMenuId = null;
var selectedImage = null;
var removeImage = false;
var previewObjectUrl = null;
root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="seg-tabs" id="status-tabs">
        <button class="seg-tab active" data-status="all" type="button">All properties</button>
        <button class="seg-tab" data-status="archived" type="button">Archived</button>
      </div>
      <div class="table-toolbar-end">
        <label class="sort-field">
          <span>Sort by</span>
          <select id="sort-by">
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="value">Value</option>
            <option value="rent">Rent</option>
          </select>
        </label>
        <label class="search-field">
          <span class="sr-only">Search</span>
          <input id="property-search" type="search" placeholder="Search" />
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16.2 16.2 21 21"/></svg>
        </label>
        <div class="view-toggle" role="group" aria-label="View">
          <button class="view-btn${view === "list" ? " active" : ""}" id="view-list" type="button" aria-label="List view" aria-pressed="${view === "list"}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>
          </button>
          <button class="view-btn${view === "grid" ? " active" : ""}" id="view-grid" type="button" aria-label="Grid view" aria-pressed="${view === "grid"}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="status" id="status" hidden></div>
    <div id="property-list"></div>
  </section>

  <div class="modal-backdrop" id="property-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div class="modal-header">
        <h2 id="form-title">Add property</h2>
        <button class="modal-close" id="close-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="property-form" class="stack">
        <div class="form-grid">
          <div class="field"><label>Name / reference</label><input name="name" required /></div>
          <div class="field"><label>Property type</label>
            <select name="propertyType">
              <option value="residential">Residential</option>
              <option value="buy_to_let">Buy To Let</option>
              <option value="commercial">Commercial</option>
              <option value="hmo">HMO</option>
              <option value="land">Land</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Address</label><input name="address" /></div>
          <div class="field" style="grid-column:1/-1">
            <label>Property image</label>
            <div class="property-image-editor">
              <div class="property-thumb-wrap property-thumb-wrap-lg" id="property-image-preview">
                <span class="property-thumb placeholder" id="property-image-placeholder">${HOUSE_ICON}</span>
                <img class="property-thumb" id="property-image-preview-img" alt="" />
              </div>
              <div class="property-image-actions">
                <label class="file-drop">
                  <input id="property-image" type="file" accept="${IMAGE_ACCEPT}" />
                  <span class="file-drop-title">Upload property image</span>
                  <span class="file-drop-sub" id="property-image-sub">JPG, PNG, GIF, or WebP \xB7 up to 4 MB</span>
                </label>
                <button class="btn secondary" id="remove-property-image" type="button" hidden>Remove image</button>
              </div>
            </div>
          </div>
          <div class="field"><label>Purchase price</label><input name="purchasePrice" type="number" step="0.01" /></div>
          <div class="field"><label>Purchase date</label><input name="purchaseDate" type="date" /></div>
          <div class="field"><label>Current value</label><input name="currentValue" type="number" step="0.01" /></div>
          <div class="field"><label>Ownership %</label><input name="ownershipPercentage" type="number" step="0.01" value="100" /></div>
          <div class="field"><label>Expected monthly rent</label><input name="expectedMonthlyRent" type="number" step="0.01" value="0" /></div>
          <div class="field"><label>Status</label>
            <select name="status"><option value="active">Active</option><option value="archived">Archived</option></select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes"></textarea></div>
        </div>
        <div class="status" id="property-form-status" hidden></div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save property</button>
        </div>
      </form>
    </div>
  </div>
`;
var form = document.getElementById("property-form");
var modal = document.getElementById("property-modal");
var imageInput = document.getElementById("property-image");
var previewImg = document.getElementById("property-image-preview-img");
var removeImageBtn = document.getElementById("remove-property-image");
function escapeHtml2(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function createdTime(row) {
  const raw = row.createdAt || row.created_at;
  const time = raw ? new Date(String(raw)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}
function setImageHint(text) {
  document.getElementById("property-image-sub").textContent = text;
}
function clearPreviewUrl() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}
function forgetThumb(id) {
  forgetPropertyThumb(id);
}
function showPreview(url) {
  const wrap = document.getElementById("property-image-preview");
  if (url) {
    previewImg.src = url;
    wrap?.classList.add("has-photo");
    removeImageBtn.hidden = false;
    return;
  }
  previewImg.removeAttribute("src");
  wrap?.classList.remove("has-photo");
  removeImageBtn.hidden = true;
}
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the photo."));
    reader.readAsDataURL(file);
  });
}
async function hydrateThumbs(root2) {
  await hydratePropertyThumbs(root2);
}
function formStatusEl() {
  return document.getElementById("property-form-status");
}
function openModal(title) {
  document.getElementById("form-title").textContent = title;
  setStatus(formStatusEl(), "", "info");
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.namedItem("name").focus();
}
function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  resetForm();
}
function resetForm() {
  editingId = null;
  selectedImage = null;
  removeImage = false;
  form.reset();
  imageInput.value = "";
  clearPreviewUrl();
  showPreview(null);
  setImageHint("JPG, PNG, GIF, or WebP \xB7 up to 4 MB");
  form.elements.namedItem("ownershipPercentage").value = "100";
  form.elements.namedItem("expectedMonthlyRent").value = "0";
  form.elements.namedItem("status").value = "active";
  document.getElementById("form-title").textContent = "Add property";
}
async function fillForm(property) {
  editingId = String(property.id);
  selectedImage = null;
  removeImage = false;
  imageInput.value = "";
  clearPreviewUrl();
  form.elements.namedItem("name").value = String(property.name || "");
  form.elements.namedItem("address").value = String(property.address || "");
  form.elements.namedItem("propertyType").value = String(
    property.propertyType || "residential"
  );
  form.elements.namedItem("purchasePrice").value = property.purchasePrice != null ? String(property.purchasePrice) : "";
  form.elements.namedItem("purchaseDate").value = String(property.purchaseDate || "");
  form.elements.namedItem("currentValue").value = property.currentValue != null ? String(property.currentValue) : "";
  form.elements.namedItem("ownershipPercentage").value = String(
    property.ownershipPercentage ?? 100
  );
  form.elements.namedItem("expectedMonthlyRent").value = String(
    property.expectedMonthlyRent ?? 0
  );
  form.elements.namedItem("status").value = String(property.status || "active");
  form.elements.namedItem("notes").value = String(property.notes || "");
  if (property.hasImage) {
    const cached = cachedPropertyThumb(String(property.id));
    if (cached) {
      showPreview(cached);
      setImageHint("Current photo");
    } else {
      try {
        const file = await apiFile(`/properties/${property.id}/image`);
        const url = URL.createObjectURL(file.blob);
        previewObjectUrl = url;
        showPreview(url);
        setImageHint("Current photo");
      } catch {
        showPreview(null);
        setImageHint("JPG, PNG, GIF, or WebP \xB7 up to 4 MB");
      }
    }
  } else {
    showPreview(null);
    setImageHint("JPG, PNG, GIF, or WebP \xB7 up to 4 MB");
  }
}
function visibleRows() {
  const query = search.trim().toLowerCase();
  const rows = cache.filter((row) => {
    if (!query) {
      return true;
    }
    const haystack = [row.name, row.address, row.propertyType, row.notes].map((value) => String(value || "").toLowerCase()).join(" ");
    return haystack.includes(query);
  });
  rows.sort((a, b) => {
    if (sortBy === "name") {
      return String(a.name || "").localeCompare(String(b.name || ""), "en-GB");
    }
    if (sortBy === "value") {
      return Number(b.currentValue || 0) - Number(a.currentValue || 0);
    }
    if (sortBy === "rent") {
      return Number(b.expectedMonthlyRent || 0) - Number(a.expectedMonthlyRent || 0);
    }
    return createdTime(b) - createdTime(a);
  });
  return rows;
}
function statusBadge(status) {
  const archived = status === "archived";
  return `<span class="pill ${archived ? "paused" : "done"}">${archived ? "Archived" : "Active"}</span>`;
}
function nameCell(row) {
  const name = String(row.name || "Untitled");
  const id = String(row.id);
  return `<div class="name-cell">
    ${propertyThumbHtml(id, Boolean(row.hasImage))}
    <div>
      <a class="name-title" href="/property.html?id=${escapeHtml2(id)}">${escapeHtml2(name)}</a>
      <div class="name-sub">${escapeHtml2(row.address || "No address")}</div>
    </div>
  </div>`;
}
function summaryCell(row) {
  const type = labelize(String(row.propertyType || "residential"));
  const rent = money(Number(row.expectedMonthlyRent || 0), user.preferredCurrency);
  const value = money(Number(row.currentValue || 0), user.preferredCurrency);
  return `<div class="summary-cell">
    <div class="name-title">${escapeHtml2(type)}</div>
    <div class="name-sub">Rent ${escapeHtml2(rent)} \xB7 Value ${escapeHtml2(value)}</div>
  </div>`;
}
function actionMenu(row) {
  const id = String(row.id);
  const open = openMenuId === id;
  const archived = row.status === "archived";
  return `<div class="row-menu ${open ? "open" : ""}">
    <button class="kebab-btn" data-menu="${escapeHtml2(id)}" type="button" aria-label="Actions" aria-expanded="${open}">\u22EF</button>
    <div class="row-menu-pop"${open ? "" : " hidden"}>
      <a href="/property.html?id=${escapeHtml2(id)}">Open</a>
      <button type="button" data-edit="${escapeHtml2(id)}">Edit</button>
      ${archived ? `<button type="button" data-restore="${escapeHtml2(id)}">Restore</button>` : `<button type="button" data-archive="${escapeHtml2(id)}">Archive</button>`}
    </div>
  </div>`;
}
function renderList(rows) {
  if (!rows.length) {
    return `<p class="empty">No properties found. Use + Add Property to create one.</p>`;
  }
  if (view === "grid") {
    return `<div class="property-grid">${rows.map(
      (row) => `<article class="property-card">
          <div class="property-card-head">
            ${nameCell(row)}
            ${actionMenu(row)}
          </div>
          <div class="property-card-meta">
            ${statusBadge(String(row.status))}
            ${summaryCell(row)}
          </div>
        </article>`
    ).join("")}</div>`;
  }
  return `<div class="data-table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Summary</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(
    (row) => `<tr>
              <td class="col-name">${nameCell(row)}</td>
              <td class="col-status">${statusBadge(String(row.status))}</td>
              <td class="col-summary">${summaryCell(row)}</td>
              <td class="col-actions">${actionMenu(row)}</td>
            </tr>`
  ).join("")}
      </tbody>
    </table>
  </div>`;
}
function bindListActions(rows) {
  const list = document.getElementById("property-list");
  list.querySelectorAll("[data-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = String(button.dataset.menu);
      openMenuId = openMenuId === id ? null : id;
      render();
    });
  });
  list.querySelectorAll(".row-menu-pop").forEach((pop) => {
    pop.addEventListener("click", (event) => event.stopPropagation());
  });
  list.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const property = rows.find((row) => String(row.id) === String(button.dataset.edit));
      if (!property) {
        return;
      }
      openMenuId = null;
      void fillForm(property).then(() => openModal("Edit property"));
    });
  });
  list.querySelectorAll("[data-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/properties/${button.dataset.archive}/archive`, { method: "POST" });
        setStatus(document.getElementById("status"), "Property archived.", "success");
        openMenuId = null;
        await loadProperties();
      } catch (error) {
        setStatus(document.getElementById("status"), error.message, "error");
      }
    });
  });
  list.querySelectorAll("[data-restore]").forEach((button) => {
    button.addEventListener("click", async () => {
      const property = rows.find((row) => String(row.id) === String(button.dataset.restore));
      if (!property) {
        return;
      }
      try {
        await api(`/properties/${property.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: property.name,
            address: property.address,
            propertyType: property.propertyType,
            purchasePrice: property.purchasePrice,
            purchaseDate: property.purchaseDate,
            currentValue: property.currentValue,
            ownershipPercentage: property.ownershipPercentage,
            expectedMonthlyRent: property.expectedMonthlyRent,
            notes: property.notes,
            status: "active"
          })
        });
        setStatus(document.getElementById("status"), "Property restored.", "success");
        openMenuId = null;
        await loadProperties();
      } catch (error) {
        setStatus(document.getElementById("status"), error.message, "error");
      }
    });
  });
  if (openMenuId) {
    requestAnimationFrame(() => positionOpenRowMenu(list));
  }
}
function render() {
  document.querySelectorAll("#status-tabs .seg-tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.status === statusFilter);
  });
  document.getElementById("view-list")?.classList.toggle("active", view === "list");
  document.getElementById("view-grid")?.classList.toggle("active", view === "grid");
  document.getElementById("view-list")?.setAttribute("aria-pressed", String(view === "list"));
  document.getElementById("view-grid")?.setAttribute("aria-pressed", String(view === "grid"));
  const rows = visibleRows();
  const list = document.getElementById("property-list");
  list.innerHTML = renderList(rows);
  bindListActions(rows);
  void hydrateThumbs(list);
}
async function loadProperties() {
  const data = await api(
    `/properties${qs({ status: statusFilter === "archived" ? "archived" : "active" })}`
  );
  cache = data.properties;
  render();
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  if (selectedImage && selectedImage.size > MAX_IMAGE_BYTES) {
    setStatus(formStatusEl(), "Images must be 4 MB or smaller.", "error");
    return;
  }
  const payload = {
    name: String(formData.get("name") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    propertyType: String(formData.get("propertyType") || "residential"),
    purchasePrice: formData.get("purchasePrice") ? Number(formData.get("purchasePrice")) : null,
    purchaseDate: String(formData.get("purchaseDate") || "") || null,
    currentValue: formData.get("currentValue") ? Number(formData.get("currentValue")) : null,
    ownershipPercentage: Number(formData.get("ownershipPercentage") || 100),
    expectedMonthlyRent: Number(formData.get("expectedMonthlyRent") || 0),
    notes: String(formData.get("notes") || ""),
    status: String(formData.get("status") || "active")
  };
  if (selectedImage) {
    payload.imageData = await readFileAsBase64(selectedImage);
    payload.imageFilename = selectedImage.name;
    payload.imageMimeType = selectedImage.type;
  } else if (removeImage) {
    payload.removeImage = true;
  }
  try {
    if (editingId) {
      forgetThumb(editingId);
      await api(`/properties/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Property updated.", "success");
    } else {
      await api("/properties", { method: "POST", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Property created.", "success");
    }
    closeModal();
    await loadProperties();
  } catch (error) {
    setStatus(formStatusEl(), error.message, "error");
  }
});
document.getElementById("add-property-btn")?.addEventListener("click", () => {
  resetForm();
  openModal("Add property");
});
imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0] || null;
  if (!file) {
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    selectedImage = null;
    imageInput.value = "";
    setImageHint("That photo is larger than 4 MB. Choose a smaller file.");
    return;
  }
  if (!file.type.startsWith("image/")) {
    selectedImage = null;
    imageInput.value = "";
    setImageHint("Use a JPG, PNG, GIF, or WebP image.");
    return;
  }
  selectedImage = file;
  removeImage = false;
  clearPreviewUrl();
  previewObjectUrl = URL.createObjectURL(file);
  showPreview(previewObjectUrl);
  setImageHint(`${file.name} \xB7 ${(file.size / 1024).toFixed(0)} KB`);
});
removeImageBtn.addEventListener("click", () => {
  selectedImage = null;
  removeImage = true;
  imageInput.value = "";
  clearPreviewUrl();
  showPreview(null);
  setImageHint("Photo will be removed when you save.");
});
document.getElementById("close-modal")?.addEventListener("click", closeModal);
document.getElementById("cancel-modal")?.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    closeModal();
  }
  if (event.key === "Escape" && openMenuId) {
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
document.getElementById("status-tabs")?.addEventListener("click", (event) => {
  const target = event.target;
  if (target.dataset.status === "all" || target.dataset.status === "archived") {
    statusFilter = target.dataset.status;
    void loadProperties();
  }
});
document.getElementById("sort-by")?.addEventListener("change", (event) => {
  sortBy = event.target.value;
  render();
});
document.getElementById("property-search")?.addEventListener("input", (event) => {
  search = event.target.value;
  render();
});
document.getElementById("view-list")?.addEventListener("click", () => {
  view = "list";
  sessionStorage.setItem(VIEW_KEY, view);
  render();
});
document.getElementById("view-grid")?.addEventListener("click", () => {
  view = "grid";
  sessionStorage.setItem(VIEW_KEY, view);
  render();
});
void loadProperties();
