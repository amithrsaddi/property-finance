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
var thumbUrls = /* @__PURE__ */ new Map();
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
var ICON_CHEVRON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>`;
var ICON_SEARCH = `<svg class="props-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16.2 16.2 21 21"/></svg>`;
function kebabMenu(id, open, itemsHtml) {
  if (!itemsHtml.trim()) {
    return "";
  }
  return `<div class="row-menu ${open ? "open" : ""}">
    <button class="kebab-btn props-item-more" data-menu="${escapeHtml(id)}" type="button" aria-label="Actions" aria-expanded="${open}">${ICON_CHEVRON}</button>
    <div class="row-menu-pop"${open ? "" : " hidden"}>${itemsHtml}</div>
  </div>`;
}
function viewToggleHtml(view) {
  return `<div class="view-toggle" role="group" aria-label="View">
    <button class="view-btn${view === "list" ? " active" : ""}" data-view-mode="list" type="button" aria-label="List view" aria-pressed="${view === "list"}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>
    </button>
    <button class="view-btn${view === "grid" ? " active" : ""}" data-view-mode="grid" type="button" aria-label="Grid view" aria-pressed="${view === "grid"}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
    </button>
  </div>`;
}
function searchFieldHtml(id = "list-search", placeholder = "Search") {
  return `<label class="props-search">
    <span class="sr-only">${escapeHtml(placeholder)}</span>
    ${ICON_SEARCH}
    <input id="${id}" type="search" placeholder="${escapeHtml(placeholder)}" />
  </label>`;
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
  void hydratePropertyThumbs(root2);
}
function matchesQuery(row, query, keys) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
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
var ICON_CHEVRON2 = icon(
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
          ${ICON_CHEVRON2}
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
function setStatus(el, message, type = "info") {
  if (!el) {
    return;
  }
  el.hidden = !message;
  el.className = `status ${type === "info" ? "" : type}`.trim();
  el.textContent = message;
}

// src/pages/documents.ts
var PAGE_VIEW_KEY = "pf-documents-page-view";
var FOLDER_VIEW_KEY = "pf-documents-folder-view-v2";
var MAX_FILE_BYTES = 4 * 1024 * 1024;
var ACCEPT = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,image/*";
var FOLDER_GLYPH = `<svg class="folder-glyph" viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M8 18a6 6 0 0 1 6-6h13.2l3.8 5.2H50a6 6 0 0 1 6 6v23.8A6.2 6.2 0 0 1 49.8 53H14.2A6.2 6.2 0 0 1 8 46.8z"/></svg>`;
var ICON_UPLOAD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V7M8.5 10 12 6.5 15.5 10"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M6 16.5v2A1.5 1.5 0 0 0 7.5 20h9A1.5 1.5 0 0 0 18 18.5v-2"/></svg>`;
var ICON_FOLDER_UP = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3.5 7.5h5.2l1.8 2H20.5v9.2A1.8 1.8 0 0 1 18.7 20.5H5.3A1.8 1.8 0 0 1 3.5 18.7z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 16.2V11M9.8 13 12 10.8 14.2 13"/></svg>`;
var ICON_TIMELINE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M7 4.5v15"/><circle cx="7" cy="7" r="1.7" fill="currentColor"/><circle cx="7" cy="12" r="1.7" fill="currentColor"/><circle cx="7" cy="17" r="1.7" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M11 7h8M11 12h8M11 17h6"/></svg>`;
var ICON_EXPLORER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3.5 8h5.1l1.7 2H20.5v8.2A1.8 1.8 0 0 1 18.7 20H5.3A1.8 1.8 0 0 1 3.5 18.2z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M3.5 8V6.6A1.6 1.6 0 0 1 5.1 5h4.1l1.5 1.8"/></svg>`;
var ICON_FOLDER_SM = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3.5 8h5.1l1.7 2H20.5v8.2A1.8 1.8 0 0 1 18.7 20H5.3A1.8 1.8 0 0 1 3.5 18.2z"/></svg>`;
var ICON_EMPTY_FILE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M7 3.5h7.2L19.5 9v11.5H7z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M14 3.5V9h5.5M9.5 13h6M9.5 16.5h4"/></svg>`;
var root = mountShell(
  "/documents",
  "Documents",
  "Organise files in folders, then preview or download them when you need them.",
  `<button class="btn" id="upload-file-btn" type="button">${ICON_UPLOAD} Upload file</button>
   <button class="btn secondary" id="upload-folder-btn" type="button">${ICON_FOLDER_UP} Upload folder</button>`
);
var presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
var filesCache = [];
var foldersCache = [];
var properties = [];
var currentFolderId = null;
var pageView = sessionStorage.getItem(PAGE_VIEW_KEY) === "explorer" ? "explorer" : "timeline";
var folderView = storedListView(FOLDER_VIEW_KEY, "list");
var fileTab = "all";
var search = "";
var locationFilter = "";
var typeFilter = "";
var modifiedFilter = "";
var openMenuId = null;
var selectedIds = /* @__PURE__ */ new Set();
var editingId = null;
var renamingFolderId = null;
var movingFileIds = [];
var movingFolderId = null;
var selectedFile = null;
var previewUrl = null;
root.innerHTML = `
  <div class="docs-page">
    <div class="docs-toolbar">
      <div class="docs-view-toggle" role="group" aria-label="Page view">
        <button class="${pageView === "timeline" ? "active" : ""}" data-page-view="timeline" type="button">${ICON_TIMELINE} Timeline</button>
        <button class="${pageView === "explorer" ? "active" : ""}" data-page-view="explorer" type="button">${ICON_EXPLORER} Explorer</button>
      </div>
      <div class="docs-breadcrumb" id="docs-breadcrumb"></div>
      ${searchFieldHtml("docs-search")}
    </div>
    <div class="status" id="status" hidden></div>
    <div id="docs-body"></div>
  </div>

  <input id="folder-upload-input" type="file" multiple hidden />

  <div class="modal-backdrop" id="document-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="document-form-title">
      <div class="modal-header">
        <h2 id="document-form-title">Upload file</h2>
        <button class="modal-close" id="close-document-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="document-form" class="stack">
        <div class="form-grid">
          <div class="field"><label>File name</label><input name="name" required placeholder="e.g. Tenancy agreement" /></div>
          <div class="field">
            <label>Folder</label>
            <select name="folderId" id="documentFolderId"></select>
          </div>
          <div class="field">
            <label>Linked to</label>
            <select name="propertyId" id="documentPropertyId">
              <option value="">General</option>
            </select>
          </div>
          <div class="field"><label class="switch-label">Important</label>
            <label class="switch"><input name="important" type="checkbox" /><span class="switch-ui"></span></label>
          </div>
          <div class="field"><label>Valid from <span class="muted">(optional)</span></label><input name="validFrom" type="date" /></div>
          <div class="field"><label>Valid to <span class="muted">(optional)</span></label><input name="validUntil" type="date" /></div>
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
          <button class="btn" type="submit">Save file</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal-backdrop" id="folder-modal" hidden>
    <div class="modal compact" role="dialog" aria-modal="true" aria-labelledby="folder-form-title">
      <div class="modal-header">
        <h2 id="folder-form-title">New folder</h2>
        <button class="modal-close" id="close-folder-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="folder-form" class="stack">
        <div class="field"><label>Folder name</label><input name="name" required placeholder="e.g. Personal documents" /></div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-folder-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save folder</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal-backdrop" id="move-modal" hidden>
    <div class="modal compact" role="dialog" aria-modal="true" aria-labelledby="move-form-title">
      <div class="modal-header">
        <h2 id="move-form-title">Move to folder</h2>
        <button class="modal-close" id="close-move-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="move-form" class="stack">
        <div class="field"><label>Folder</label><select name="folderId" id="moveFolderId"></select></div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-move-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Move</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal-backdrop" id="preview-modal" hidden>
    <div class="modal preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div class="modal-header">
        <h2 id="preview-title">Preview</h2>
        <button class="modal-close" id="close-preview-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <div class="preview-body" id="preview-body"></div>
    </div>
  </div>
`;
var modal = document.getElementById("document-modal");
var form = document.getElementById("document-form");
var fileInput = document.getElementById("document-file");
var folderModal = document.getElementById("folder-modal");
var folderForm = document.getElementById("folder-form");
var moveModal = document.getElementById("move-modal");
var moveForm = document.getElementById("move-form");
var previewModal = document.getElementById("preview-modal");
var previewBody = document.getElementById("preview-body");
var folderUploadInput = document.getElementById("folder-upload-input");
folderUploadInput.setAttribute("webkitdirectory", "");
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
function formatDateTable(value) {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) {
    return "\u2014";
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
  if (type.includes("csv") || type.includes("text") || /\.(txt|csv)$/i.test(filename)) {
    return "Text";
  }
  return "File";
}
function fileExt(filename) {
  const match = /\.[a-z0-9]+$/i.exec(String(filename || ""));
  return match ? match[0].toLowerCase() : "";
}
function kindSlug(kind) {
  return String(kind || "file").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
function fileBadgeLabel(kind, filename = "") {
  if (kind === "PDF") {
    return "PDF";
  }
  if (kind === "Word") {
    return "DOC";
  }
  if (kind === "Excel") {
    return "XLS";
  }
  if (kind === "Image") {
    return "IMG";
  }
  if (kind === "Text") {
    return fileExt(filename) === ".csv" ? "CSV" : "TXT";
  }
  if (kind === "Folder") {
    return ICON_FOLDER_SM;
  }
  const ext = fileExt(filename).replace(".", "");
  return (ext || "FILE").slice(0, 4).toUpperCase();
}
function fileBadge(kind, filename = "") {
  return `<span class="file-badge kind-${kindSlug(kind)}">${fileBadgeLabel(kind, filename)}</span>`;
}
function typeChip(kind) {
  return `<span class="docs-type-chip kind-${kindSlug(kind)}">${escapeHtml(kind)}</span>`;
}
function folderChip(name, folderId = "") {
  const label = `<span>${ICON_FOLDER_SM}${escapeHtml(name)}</span>`;
  if (!folderId) {
    return `<span class="docs-folder-chip is-static">${label}</span>`;
  }
  return `<button class="docs-folder-chip" type="button" data-open-folder="${escapeHtml(folderId)}">${label}</button>`;
}
function typeLabel(kind, filename = "") {
  if (kind === "Text" && fileExt(filename) === ".csv") {
    return "CSV";
  }
  return kind;
}
function fileSubtitle(row) {
  const filename = String(row.original_filename || "");
  const ext = fileExt(filename);
  const size = formatBytes(Number(row.file_size || 0));
  return [ext || fileKind(String(row.mime_type || ""), filename), size].filter(Boolean).join(" \xB7 ");
}
function padCount(value) {
  return String(value).padStart(2, "0");
}
function folderById(id) {
  return foldersCache.find((folder) => String(folder.id) === String(id || ""));
}
function childFolders(parentId) {
  return foldersCache.filter((folder) => String(folder.parent_id || "") === String(parentId || "")).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en-GB"));
}
function descendantFolderIds(rootId) {
  const ids = /* @__PURE__ */ new Set([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    for (const child of childFolders(id)) {
      const childId = String(child.id);
      if (!ids.has(childId)) {
        ids.add(childId);
        stack.push(childId);
      }
    }
  }
  return ids;
}
function folderPath(id) {
  const names = [];
  let current = id;
  const seen = /* @__PURE__ */ new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    const folder = folderById(current);
    if (!folder) {
      break;
    }
    names.unshift(String(folder.name || "Folder"));
    current = folder.parent_id ? String(folder.parent_id) : null;
  }
  return names.join(" / ");
}
function folderOptions(selected = "", excludeIds = /* @__PURE__ */ new Set()) {
  const walk = (parentId, prefix) => childFolders(parentId).filter((folder) => !excludeIds.has(String(folder.id))).map((folder) => {
    const id = String(folder.id);
    return `<option value="${escapeHtml(id)}"${id === selected ? " selected" : ""}>${escapeHtml(prefix + String(folder.name))}</option>${walk(id, `${prefix}\u2014 `)}`;
  }).join("");
  return `<option value="">Unfiled</option>${walk(null, "")}`;
}
function propertyOptions(selected = "") {
  return `<option value="">General</option>${properties.map(
    (property) => `<option value="${escapeHtml(property.id)}"${property.id === selected ? " selected" : ""}>${escapeHtml(property.name)}</option>`
  ).join("")}`;
}
function breadcrumb() {
  const trail = [];
  let id = currentFolderId;
  const seen = /* @__PURE__ */ new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folderById(id);
    if (!folder) {
      break;
    }
    trail.unshift({ id, name: String(folder.name || "Folder") });
    id = folder.parent_id ? String(folder.parent_id) : null;
  }
  trail.unshift({ id: null, name: "Documents" });
  return trail;
}
function setFileHint(text) {
  document.getElementById("file-drop-sub").textContent = text;
}
function anyModalOpen() {
  return !modal.hidden || !folderModal.hidden || !moveModal.hidden || !previewModal.hidden;
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
function previewMime(mime, filename) {
  const kind = fileKind(mime, filename);
  if (kind === "PDF") {
    return "application/pdf";
  }
  if (kind === "Image") {
    if (/\.png$/i.test(filename)) {
      return "image/png";
    }
    if (/\.gif$/i.test(filename)) {
      return "image/gif";
    }
    if (/\.webp$/i.test(filename)) {
      return "image/webp";
    }
    return mime.toLowerCase().startsWith("image/") ? mime : "image/jpeg";
  }
  if (kind === "Text" || mime.toLowerCase().startsWith("text/")) {
    return mime.toLowerCase().startsWith("text/") ? mime : "text/plain";
  }
  return mime || "application/octet-stream";
}
function canPreview(kind, mime, filename) {
  if (kind === "PDF" || kind === "Image" || kind === "Text") {
    return true;
  }
  return mime.toLowerCase().startsWith("text/") || /\.(txt|csv)$/i.test(filename);
}
function closePreview() {
  previewModal.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove("modal-open");
  }
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  previewBody.innerHTML = "";
  document.getElementById("preview-title").textContent = "Preview";
}
async function showPreview(id, title) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  document.getElementById("preview-title").textContent = title || "Preview";
  previewBody.innerHTML = `<p class="preview-fallback">Loading preview\u2026</p>`;
  previewModal.hidden = false;
  document.body.classList.add("modal-open");
  const file = await apiFile(`/documents/${id}/file`);
  const mime = previewMime(file.mimeType, file.filename);
  const kind = fileKind(mime, file.filename);
  document.getElementById("preview-title").textContent = title || file.filename;
  if (!canPreview(kind, mime, file.filename)) {
    previewBody.innerHTML = `<p class="preview-fallback">${kind} files can\u2019t be previewed in the browser. Use Download to save a copy.</p>`;
    return;
  }
  const typed = new Blob([file.blob], { type: mime });
  previewUrl = URL.createObjectURL(typed);
  if (kind === "Image") {
    const image = document.createElement("img");
    image.alt = title || "Document preview";
    image.src = previewUrl;
    previewBody.replaceChildren(image);
    return;
  }
  if (kind === "PDF") {
    const frame = document.createElement("iframe");
    frame.title = "Document preview";
    frame.src = previewUrl;
    previewBody.replaceChildren(frame);
    return;
  }
  const text = await typed.text();
  const pre = document.createElement("pre");
  pre.className = "preview-text";
  pre.textContent = text;
  previewBody.replaceChildren(pre);
}
async function downloadFile(id) {
  const file = await apiFile(`/documents/${id}/file`);
  const mime = previewMime(file.mimeType, file.filename);
  const url = URL.createObjectURL(new Blob([file.blob], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
function openDocumentModal(title) {
  document.getElementById("document-form-title").textContent = title;
  document.getElementById("file-label").textContent = editingId ? "Replace file (optional)" : "Upload a document";
  document.getElementById("documentFolderId").innerHTML = folderOptions(
    currentFolderId || ""
  );
  document.getElementById("documentPropertyId").innerHTML = propertyOptions(
    presetPropertyId
  );
  modal.hidden = false;
  document.body.classList.add("modal-open");
}
function closeDocumentModal() {
  modal.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove("modal-open");
  }
  editingId = null;
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel \xB7 up to 4 MB");
}
function openFolderModal(title, name = "") {
  document.getElementById("folder-form-title").textContent = title;
  folderForm.elements.namedItem("name").value = name;
  folderModal.hidden = false;
  document.body.classList.add("modal-open");
}
function closeFolderModal() {
  folderModal.hidden = true;
  renamingFolderId = null;
  folderForm.reset();
  if (!anyModalOpen()) {
    document.body.classList.remove("modal-open");
  }
}
function openMoveModal(title, selected = "", excludeIds = /* @__PURE__ */ new Set()) {
  document.getElementById("move-form-title").textContent = title;
  document.getElementById("moveFolderId").innerHTML = folderOptions(selected, excludeIds);
  moveModal.hidden = false;
  document.body.classList.add("modal-open");
}
function closeMoveModal() {
  moveModal.hidden = true;
  movingFileIds = [];
  movingFolderId = null;
  if (!anyModalOpen()) {
    document.body.classList.remove("modal-open");
  }
}
function visibleFolders() {
  return childFolders(currentFolderId);
}
function filesInScope() {
  let rows = filesCache;
  if (currentFolderId) {
    rows = rows.filter((row) => String(row.folder_id || "") === currentFolderId);
  } else if (locationFilter === "unfiled") {
    rows = rows.filter((row) => !row.folder_id);
  } else if (locationFilter) {
    rows = rows.filter((row) => String(row.folder_id || "") === locationFilter);
  }
  if (presetPropertyId) {
    rows = rows.filter((row) => String(row.property_id || "") === presetPropertyId);
  }
  rows = rows.filter(
    (row) => matchesQuery(row, search, ["name", "original_filename", "folder_name", "property_name", "mime_type"])
  );
  if (typeFilter) {
    rows = rows.filter((row) => fileKind(String(row.mime_type || ""), String(row.original_filename || "")) === typeFilter);
  }
  if (modifiedFilter) {
    rows = rows.filter((row) => matchesModified(row.updated_at || row.created_at, modifiedFilter));
  }
  if (fileTab === "important") {
    rows = rows.filter((row) => Boolean(row.important));
  }
  if (fileTab === "recent") {
    rows = [...rows].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))).slice(0, 20);
  }
  return rows;
}
function matchesModified(value, filter) {
  const time = new Date(String(value || "")).getTime();
  if (!Number.isFinite(time)) {
    return false;
  }
  if (filter === "year") {
    return new Date(time).getFullYear() === (/* @__PURE__ */ new Date()).getFullYear();
  }
  const days = Number(filter);
  return Date.now() - time <= days * 864e5;
}
function renderBreadcrumb() {
  const el = document.getElementById("docs-breadcrumb");
  el.innerHTML = breadcrumb().map((item, index, all) => {
    const last = index === all.length - 1;
    const sep = index ? `<span class="docs-crumb-sep" aria-hidden="true">/</span>` : "";
    if (last) {
      return `${sep}<span class="docs-crumb-current">${escapeHtml(item.name)}</span>`;
    }
    return `${sep}<button type="button" data-crumb="${escapeHtml(item.id || "")}">${escapeHtml(item.name)}</button>`;
  }).join("");
  el.querySelectorAll("[data-crumb]").forEach((button) => {
    button.addEventListener("click", () => {
      currentFolderId = button.dataset.crumb || null;
      selectedIds.clear();
      openMenuId = null;
      render();
    });
  });
}
function folderMenu(folder) {
  const id = String(folder.id);
  return kebabMenu(
    `folder:${id}`,
    openMenuId === `folder:${id}`,
    `<button type="button" data-folder-rename="${escapeHtml(id)}">Rename</button>
     <button type="button" data-folder-move="${escapeHtml(id)}">Move to folder</button>
     <button type="button" data-folder-delete="${escapeHtml(id)}">Delete folder</button>`
  );
}
function renderFolders() {
  const folders = visibleFolders();
  const count = folders.length;
  const tools = `${viewToggleHtml(folderView)}<button class="plus-btn" id="add-folder-btn" type="button" aria-label="New folder">+</button>`;
  const body = !folders.length ? `<p class="docs-empty">No folders here yet. Use + to create one.</p>` : folderView === "list" ? `<div class="folder-list">${folders.map(
    (folder) => `<article class="folder-row" data-open-folder="${escapeHtml(String(folder.id))}">
              ${FOLDER_GLYPH}
              <div>
                <strong>${escapeHtml(String(folder.name))}</strong>
                <div class="folder-counts">
                  <span>${padCount(Number(folder.file_count || 0))} files</span>
                  <span>${padCount(Number(folder.folder_count || 0))} folders</span>
                </div>
              </div>
              ${folderMenu(folder)}
            </article>`
  ).join("")}</div>` : `<div class="folder-grid">${folders.map(
    (folder) => `<article class="folder-card" data-open-folder="${escapeHtml(String(folder.id))}">
              ${folderMenu(folder)}
              ${FOLDER_GLYPH}
              <strong>${escapeHtml(String(folder.name))}</strong>
              <div class="folder-counts">
                <span>${padCount(Number(folder.file_count || 0))} files</span>
                <span>${padCount(Number(folder.folder_count || 0))} folders</span>
              </div>
            </article>`
  ).join("")}</div>`;
  return `<section class="docs-section">
    <div class="docs-section-head">
      <div>
        <h2>Your folders <span class="docs-count">${count}</span></h2>
        <p>Open a folder to see the files and subfolders inside.</p>
      </div>
      <div class="docs-section-tools">${tools}</div>
    </div>
    ${body}
  </section>`;
}
function fileActions(row) {
  const id = String(row.id);
  return `<button type="button" data-download="${escapeHtml(id)}">Download document</button>
    <button type="button" data-delete="${escapeHtml(id)}">Delete document</button>
    <button type="button" data-replace="${escapeHtml(id)}">Replace document</button>
    <button type="button" data-move="${escapeHtml(id)}">Move to folder</button>
    <button type="button" data-preview="${escapeHtml(id)}">Preview document</button>`;
}
function renderEmptyDocs(title, copy, actionLabel = "") {
  const action = actionLabel ? `<button class="btn" id="empty-upload-btn" type="button">${ICON_UPLOAD} ${escapeHtml(actionLabel)}</button>` : "";
  return `<div class="docs-empty-card">
    <div class="docs-empty-icon">${ICON_EMPTY_FILE}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(copy)}</p>
    ${action}
  </div>`;
}
function renderFileFilters() {
  const locationSelect = currentFolderId ? "" : `<label class="sr-only" for="filter-location">Location</label>
        <select id="filter-location">
          <option value="">All locations</option>
          <option value="unfiled"${locationFilter === "unfiled" ? " selected" : ""}>Unfiled</option>
          ${foldersCache.map((folder) => {
    const id = String(folder.id);
    return `<option value="${escapeHtml(id)}"${locationFilter === id ? " selected" : ""}>${escapeHtml(folderPath(id))}</option>`;
  }).join("")}
        </select>`;
  return `<div class="docs-filters">
      ${locationSelect}
      <label class="sr-only" for="filter-type">File type</label>
      <select id="filter-type">
        <option value="">All types</option>
        ${["PDF", "Image", "Word", "Excel", "Text"].map((kind) => `<option${typeFilter === kind ? " selected" : ""}>${kind}</option>`).join("")}
      </select>
      <label class="sr-only" for="filter-modified">Modified</label>
      <select id="filter-modified">
        <option value="">Any time</option>
        <option value="7"${modifiedFilter === "7" ? " selected" : ""}>Last 7 days</option>
        <option value="30"${modifiedFilter === "30" ? " selected" : ""}>Last 30 days</option>
        <option value="90"${modifiedFilter === "90" ? " selected" : ""}>Last 90 days</option>
        <option value="year"${modifiedFilter === "year" ? " selected" : ""}>This year</option>
      </select>
    </div>`;
}
function renderBulkBar() {
  if (!selectedIds.size) {
    return "";
  }
  return `<div class="docs-bulk">
        <span>${selectedIds.size} selected</span>
        <button class="btn secondary" id="bulk-move" type="button">Move to folder</button>
        <button class="btn danger" id="bulk-delete" type="button">Delete</button>
        <button class="btn ghost" id="bulk-clear" type="button">Clear</button>
      </div>`;
}
function renderFolderRow(folder) {
  const id = String(folder.id);
  const parentName = currentFolderId ? String(folderById(currentFolderId)?.name || "Folder") : "Documents";
  return `<article class="docs-file-row is-folder">
      <span class="docs-check"></span>
      <div class="name-cell docs-name-cell">
        ${fileBadge("Folder")}
        <div>
          <button class="docs-file-name" type="button" data-open-folder="${escapeHtml(id)}">${escapeHtml(String(folder.name))}</button>
          <div class="name-sub">${padCount(Number(folder.file_count || 0))} files \xB7 ${padCount(Number(folder.folder_count || 0))} folders</div>
        </div>
      </div>
      <div class="docs-col-location" data-label="Location">${folderChip(parentName, currentFolderId || "")}</div>
      <div class="docs-col-type" data-label="Type">${typeChip("Folder")}</div>
      <time class="docs-col-modified" data-label="Modified">${formatDateTable(folder.updated_at || folder.created_at)}</time>
      <div class="col-actions">${folderMenu(folder)}</div>
    </article>`;
}
function renderFileRow(row) {
  const id = String(row.id);
  const filename = String(row.original_filename || "");
  const kind = fileKind(String(row.mime_type || ""), filename);
  const folderName = String(row.folder_name || "Unfiled");
  const folderId = String(row.folder_id || "");
  const important = row.important ? `<span class="docs-star" title="Important">\u2605</span>` : "";
  return `<article class="docs-file-row">
      <label class="docs-check">
        <span class="sr-only">Select ${escapeHtml(String(row.name || "file"))}</span>
        <input type="checkbox" data-select="${escapeHtml(id)}"${selectedIds.has(id) ? " checked" : ""} />
      </label>
      <div class="name-cell docs-name-cell">
        ${fileBadge(typeLabel(kind, filename), filename)}
        <div>
          <button class="docs-file-name" type="button" data-preview="${escapeHtml(id)}">${escapeHtml(String(row.name || "File"))}${important}</button>
          <div class="name-sub">${escapeHtml(fileSubtitle(row))}</div>
        </div>
      </div>
      <div class="docs-col-location" data-label="Location">${folderChip(folderName, folderId)}</div>
      <div class="docs-col-type" data-label="Type">${typeChip(typeLabel(kind, filename))}</div>
      <time class="docs-col-modified" data-label="Modified">${formatDateTable(row.updated_at || row.created_at)}</time>
      <div class="col-actions">${kebabMenu(`file:${id}`, openMenuId === `file:${id}`, fileActions(row))}</div>
    </article>`;
}
function renderFileHead(rows) {
  const allChecked = Boolean(rows.length && rows.every((row) => selectedIds.has(String(row.id))));
  return `<div class="docs-file-head">
      <label class="docs-check">
        <span class="sr-only">Select all</span>
        <input type="checkbox" id="select-all"${allChecked ? " checked" : ""} />
      </label>
      <span>Name</span>
      <span>Location</span>
      <span>Type</span>
      <span>Modified</span>
      <span class="col-actions">Action</span>
    </div>`;
}
function renderFileList(rows, includeFolders = false) {
  const folders = includeFolders ? visibleFolders() : [];
  if (!rows.length && !folders.length) {
    return "";
  }
  return `<div class="docs-file-list">
    ${renderFileHead(rows)}
    ${folders.map(renderFolderRow).join("")}
    ${rows.map(renderFileRow).join("")}
  </div>`;
}
function renderFiles() {
  const rows = filesInScope();
  const folders = fileTab === "mixed" ? visibleFolders() : [];
  const allCount = currentFolderId ? filesCache.filter((row) => String(row.folder_id || "") === currentFolderId).length : filesCache.length;
  const list = renderFileList(rows, fileTab === "mixed");
  const empty = !rows.length && !folders.length ? renderEmptyDocs(
    filesCache.length ? "No files match" : "No files yet",
    filesCache.length ? "Try a different search or filter." : "Upload a file to start organising this folder.",
    filesCache.length ? "" : "Upload file"
  ) : "";
  return `<section class="docs-section">
    <div class="docs-section-head">
      <div>
        <h2>Your files <span class="docs-count">${allCount}</span></h2>
        <p>Click a file to preview it.</p>
      </div>
      <div class="docs-section-tools"><button class="plus-btn" id="add-file-btn" type="button" aria-label="Upload file">+</button></div>
    </div>
    <div class="docs-file-toolbar">
      ${renderFileFilters()}
    </div>
    <div class="docs-tabs">
      <button class="docs-tab${fileTab === "all" ? " active" : ""}" data-file-tab="all" type="button">All files</button>
      <button class="docs-tab${fileTab === "mixed" ? " active" : ""}" data-file-tab="mixed" type="button">Files and folders</button>
      <button class="docs-tab${fileTab === "important" ? " active" : ""}" data-file-tab="important" type="button">Important</button>
      <button class="docs-tab${fileTab === "recent" ? " active" : ""}" data-file-tab="recent" type="button">Recent</button>
    </div>
    ${renderBulkBar()}
    ${list || empty}
  </section>`;
}
function monthLabel(value) {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleString("en-GB", { month: "long", year: "numeric" });
}
function renderTimeline() {
  const rows = [...filesInScope()].sort(
    (a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
  );
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = monthLabel(row.updated_at || row.created_at);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const body = !rows.length ? renderEmptyDocs(
    filesCache.length ? "No files match" : "No files yet",
    filesCache.length ? "Try a different search or filter." : "Upload a file to see it on the timeline.",
    filesCache.length ? "" : "Upload file"
  ) : `<div class="docs-file-list">
        ${renderFileHead(rows)}
        ${[...groups.entries()].map(
    ([label, items]) => `<div class="docs-month">
              <h3><span class="docs-month-dot" aria-hidden="true"></span>${escapeHtml(label)} <span>${items.length} file${items.length === 1 ? "" : "s"}</span></h3>
              ${items.map(renderFileRow).join("")}
            </div>`
  ).join("")}
      </div>`;
  return `<section class="docs-section docs-timeline-panel">
    <div class="docs-file-toolbar">
      ${renderFileFilters()}
    </div>
    ${renderBulkBar()}
    ${body}
  </section>`;
}
function bindPage() {
  const body = document.getElementById("docs-body");
  bindRowMenus(
    body,
    openMenuId,
    (id) => {
      openMenuId = id;
    },
    render
  );
  body.querySelectorAll("[data-open-folder]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (event.target.closest(".row-menu")) {
        return;
      }
      event.stopPropagation();
      currentFolderId = String(el.dataset.openFolder || "") || null;
      selectedIds.clear();
      openMenuId = null;
      fileTab = "all";
      render();
    });
  });
  document.getElementById("add-folder-btn")?.addEventListener("click", () => {
    renamingFolderId = null;
    openFolderModal("New folder");
  });
  document.getElementById("add-file-btn")?.addEventListener("click", () => {
    editingId = null;
    selectedFile = null;
    form.reset();
    fileInput.value = "";
    setFileHint("PDF, image, Word, or Excel \xB7 up to 4 MB");
    openDocumentModal("Upload file");
  });
  document.getElementById("empty-upload-btn")?.addEventListener("click", () => {
    document.getElementById("upload-file-btn")?.click();
  });
  body.querySelectorAll("[data-view-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      folderView = button.dataset.viewMode === "list" ? "list" : "grid";
      sessionStorage.setItem(FOLDER_VIEW_KEY, folderView);
      render();
    });
  });
  body.querySelectorAll("[data-file-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      fileTab = button.dataset.fileTab;
      openMenuId = null;
      render();
    });
  });
  document.getElementById("filter-location")?.addEventListener("change", (event) => {
    locationFilter = event.target.value;
    render();
  });
  document.getElementById("filter-type")?.addEventListener("change", (event) => {
    typeFilter = event.target.value;
    render();
  });
  document.getElementById("filter-modified")?.addEventListener("change", (event) => {
    modifiedFilter = event.target.value;
    render();
  });
  document.getElementById("select-all")?.addEventListener("change", (event) => {
    const checked = event.target.checked;
    for (const row of filesInScope()) {
      if (checked) {
        selectedIds.add(String(row.id));
      } else {
        selectedIds.delete(String(row.id));
      }
    }
    render();
  });
  body.querySelectorAll("[data-select]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const id = String(input.dataset.select);
      if (input.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
      render();
    });
  });
  document.getElementById("bulk-clear")?.addEventListener("click", () => {
    selectedIds.clear();
    render();
  });
  document.getElementById("bulk-move")?.addEventListener("click", () => {
    movingFileIds = [...selectedIds];
    movingFolderId = null;
    openMoveModal("Move to folder", currentFolderId || "");
  });
  document.getElementById("bulk-delete")?.addEventListener("click", () => {
    void deleteFiles([...selectedIds]);
  });
  body.querySelectorAll("[data-preview]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const id = String(button.dataset.preview);
      const row = filesCache.find((item) => String(item.id) === id);
      openMenuId = null;
      render();
      try {
        await showPreview(id, String(row?.name || "Preview"));
      } catch (error) {
        closePreview();
        setStatus(document.getElementById("status"), error.message, "error");
      }
    });
  });
  body.querySelectorAll("[data-download]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await downloadFile(String(button.dataset.download));
      } catch (error) {
        setStatus(document.getElementById("status"), error.message, "error");
      }
    });
  });
  body.querySelectorAll("[data-replace]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = filesCache.find((item) => String(item.id) === String(button.dataset.replace));
      if (!row) {
        return;
      }
      fillDocumentForm(row);
    });
  });
  body.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = filesCache.find((item) => String(item.id) === String(button.dataset.move));
      movingFileIds = [String(button.dataset.move)];
      movingFolderId = null;
      openMoveModal("Move to folder", String(row?.folder_id || ""));
    });
  });
  body.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      void deleteFiles([String(button.dataset.delete)]);
    });
  });
  body.querySelectorAll("[data-folder-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      const folder = folderById(String(button.dataset.folderRename));
      renamingFolderId = String(button.dataset.folderRename);
      openFolderModal("Rename folder", String(folder?.name || ""));
    });
  });
  body.querySelectorAll("[data-folder-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = String(button.dataset.folderMove);
      const folder = folderById(id);
      movingFolderId = id;
      movingFileIds = [];
      openMoveModal("Move folder", String(folder?.parent_id || ""), descendantFolderIds(id));
    });
  });
  body.querySelectorAll("[data-folder-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = String(button.dataset.folderDelete);
      const folder = folderById(id);
      if (!window.confirm(`Delete \u201C${String(folder?.name || "this folder")}\u201D and everything inside it?`)) {
        return;
      }
      try {
        await api(`/folders/${id}`, { method: "DELETE" });
        if (currentFolderId && descendantFolderIds(id).has(currentFolderId)) {
          currentFolderId = null;
        }
        setStatus(document.getElementById("status"), "Folder deleted.", "success");
        await load();
      } catch (error) {
        setStatus(document.getElementById("status"), error.message, "error");
      }
    });
  });
}
function render() {
  renderBreadcrumb();
  document.querySelectorAll("[data-page-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.pageView === pageView);
  });
  const body = document.getElementById("docs-body");
  body.innerHTML = pageView === "timeline" ? renderTimeline() : `${renderFolders()}${renderFiles()}`;
  bindPage();
}
function fillDocumentForm(row) {
  editingId = String(row.id);
  selectedFile = null;
  fileInput.value = "";
  form.elements.namedItem("name").value = String(row.name || "");
  openDocumentModal("Replace document");
  form.elements.namedItem("folderId").value = String(row.folder_id || "");
  form.elements.namedItem("propertyId").value = String(row.property_id || "");
  form.elements.namedItem("important").checked = Boolean(row.important);
  form.elements.namedItem("validFrom").value = String(row.valid_from || "").slice(0, 10);
  form.elements.namedItem("validUntil").value = String(row.valid_until || "").slice(0, 10);
  setFileHint(String(row.original_filename || "Current file will be kept unless you choose another."));
}
async function deleteFiles(ids) {
  if (!ids.length) {
    return;
  }
  if (!window.confirm(ids.length === 1 ? "Delete this document?" : `Delete ${ids.length} documents?`)) {
    return;
  }
  try {
    for (const id of ids) {
      await api(`/documents/${id}`, { method: "DELETE" });
    }
    selectedIds.clear();
    openMenuId = null;
    setStatus(document.getElementById("status"), ids.length === 1 ? "Document deleted." : "Documents deleted.", "success");
    await load();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
}
async function load() {
  const [folderData, fileData] = await Promise.all([
    api("/folders"),
    api(`/documents${qs({ propertyId: presetPropertyId })}`)
  ]);
  foldersCache = folderData.folders;
  filesCache = fileData.documents;
  render();
}
async function loadProperties() {
  const data = await api(
    `/properties${qs({ status: "active" })}`
  );
  properties = data.properties;
}
async function ensureFolderPath(parts, rootParentId) {
  let parentId = rootParentId;
  for (const part of parts) {
    const name = part.trim();
    if (!name) {
      continue;
    }
    const existing = childFolders(parentId).find(
      (folder) => String(folder.name).toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      parentId = String(existing.id);
      continue;
    }
    const created = await api("/folders", {
      method: "POST",
      body: JSON.stringify({ name, parentId })
    });
    foldersCache.push({
      id: created.folder.id,
      parent_id: parentId,
      name,
      file_count: 0,
      folder_count: 0
    });
    parentId = created.folder.id;
  }
  return parentId;
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
  const validFrom = String(formData.get("validFrom") || "") || null;
  const validUntil = String(formData.get("validUntil") || "") || null;
  if (validFrom && validUntil && validFrom > validUntil) {
    setStatus(document.getElementById("status"), "Valid from must be on or before valid to.", "error");
    return;
  }
  const payload = {
    name: String(formData.get("name") || "").trim(),
    folderId: String(formData.get("folderId") || "") || null,
    propertyId: String(formData.get("propertyId") || "") || null,
    important: form.elements.namedItem("important").checked,
    validFrom,
    validUntil
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
    closeDocumentModal();
    await load();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
});
folderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = String(new FormData(folderForm).get("name") || "").trim();
  try {
    if (renamingFolderId) {
      await api(`/folders/${renamingFolderId}`, { method: "PUT", body: JSON.stringify({ name }) });
      setStatus(document.getElementById("status"), "Folder renamed.", "success");
    } else {
      await api("/folders", {
        method: "POST",
        body: JSON.stringify({ name, parentId: currentFolderId })
      });
      setStatus(document.getElementById("status"), "Folder created.", "success");
    }
    closeFolderModal();
    await load();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
});
moveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const folderId = String(new FormData(moveForm).get("folderId") || "") || null;
  try {
    if (movingFolderId) {
      await api(`/folders/${movingFolderId}`, { method: "PUT", body: JSON.stringify({ parentId: folderId }) });
      setStatus(document.getElementById("status"), "Folder moved.", "success");
    } else {
      for (const id of movingFileIds) {
        await api(`/documents/${id}`, { method: "PUT", body: JSON.stringify({ folderId }) });
      }
      selectedIds.clear();
      setStatus(document.getElementById("status"), "Moved to folder.", "success");
    }
    closeMoveModal();
    await load();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
});
folderUploadInput.addEventListener("change", async () => {
  const files = [...folderUploadInput.files || []];
  folderUploadInput.value = "";
  if (!files.length) {
    return;
  }
  const rootName = files[0].webkitRelativePath.split("/")[0] || "Uploaded folder";
  try {
    setStatus(document.getElementById("status"), `Uploading folder \u201C${rootName}\u201D\u2026`);
    const created = await api("/folders", {
      method: "POST",
      body: JSON.stringify({ name: rootName, parentId: currentFolderId })
    });
    foldersCache.push({
      id: created.folder.id,
      parent_id: currentFolderId,
      name: rootName,
      file_count: 0,
      folder_count: 0
    });
    let uploaded = 0;
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        continue;
      }
      const parts = file.webkitRelativePath.split("/").slice(1, -1);
      const folderId = await ensureFolderPath(parts, created.folder.id);
      try {
        await api("/documents", {
          method: "POST",
          body: JSON.stringify({
            name: file.name.replace(/\.[^.]+$/, "") || file.name,
            folderId,
            propertyId: presetPropertyId || null,
            originalFilename: file.name,
            mimeType: file.type || "application/octet-stream",
            fileData: await readFileAsBase64(file)
          })
        });
        uploaded += 1;
        setStatus(document.getElementById("status"), `Uploading ${uploaded} of ${files.length}\u2026`);
      } catch {
      }
    }
    setStatus(document.getElementById("status"), `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} into ${rootName}.`, "success");
    await load();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
});
document.getElementById("upload-file-btn")?.addEventListener("click", () => {
  editingId = null;
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel \xB7 up to 4 MB");
  openDocumentModal("Upload file");
});
document.getElementById("upload-folder-btn")?.addEventListener("click", () => {
  folderUploadInput.click();
});
document.getElementById("close-document-modal")?.addEventListener("click", closeDocumentModal);
document.getElementById("cancel-document-modal")?.addEventListener("click", closeDocumentModal);
document.getElementById("close-folder-modal")?.addEventListener("click", closeFolderModal);
document.getElementById("cancel-folder-modal")?.addEventListener("click", closeFolderModal);
document.getElementById("close-move-modal")?.addEventListener("click", closeMoveModal);
document.getElementById("cancel-move-modal")?.addEventListener("click", closeMoveModal);
document.getElementById("close-preview-modal")?.addEventListener("click", closePreview);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeDocumentModal();
  }
});
folderModal.addEventListener("click", (event) => {
  if (event.target === folderModal) {
    closeFolderModal();
  }
});
moveModal.addEventListener("click", (event) => {
  if (event.target === moveModal) {
    closeMoveModal();
  }
});
previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) {
    closePreview();
  }
});
document.getElementById("docs-search")?.addEventListener("input", (event) => {
  search = event.target.value;
  render();
});
document.querySelectorAll("[data-page-view]").forEach((button) => {
  button.addEventListener("click", () => {
    pageView = button.dataset.pageView === "timeline" ? "timeline" : "explorer";
    sessionStorage.setItem(PAGE_VIEW_KEY, pageView);
    openMenuId = null;
    render();
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (!previewModal.hidden) {
    closePreview();
  } else if (!moveModal.hidden) {
    closeMoveModal();
  } else if (!folderModal.hidden) {
    closeFolderModal();
  } else if (!modal.hidden) {
    closeDocumentModal();
  } else if (openMenuId) {
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
void (async () => {
  await loadProperties();
  await load();
})();
