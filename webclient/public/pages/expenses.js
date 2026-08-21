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
function nameCell(title, subtitle, href, property) {
  const heading = href ? `<a class="name-title" href="${escapeHtml(href)}">${escapeHtml(title)}</a>` : `<div class="name-title">${escapeHtml(title)}</div>`;
  const propertyId = String(property?.propertyId || "");
  const avatar = propertyId ? propertyThumbHtml(propertyId, Boolean(property?.hasImage)) : `<span class="row-avatar tone-${avatarTone(title)}">${escapeHtml(initials(title))}</span>`;
  return `<div class="name-cell">
    ${avatar}
    <div>
      ${heading}
      ${subtitle ? `<div class="name-sub">${escapeHtml(subtitle)}</div>` : ""}
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
function renderDataList(rows, view2, empty, openMenuId2, options) {
  if (!rows.length) {
    return `<p class="empty">${empty}</p>`;
  }
  const selectedIds = options?.selectedIds;
  const selectable = Boolean(selectedIds);
  const selectCell = (row) => {
    if (!selectable || !selectedIds) {
      return "";
    }
    const checked = selectedIds.has(row.id);
    return `<label class="row-check">
      <span class="sr-only">Select ${escapeHtml(row.title)}</span>
      <input type="checkbox" data-select="${escapeHtml(row.id)}"${checked ? " checked" : ""} />
    </label>`;
  };
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const someSelected = selectable && rows.some((row) => selectedIds.has(row.id));
  const hasActions = rows.some((row) => Boolean(row.actions));
  const extraHeaders = rows[0]?.extras?.map((extra) => extra.header) ?? [];
  const hasExtras = extraHeaders.length > 0;
  const cells = (row) => {
    const actions = kebabMenu(row.id, openMenuId2 === row.id, row.actions || "");
    return {
      name: nameCell(row.title, row.subtitle, row.href, row),
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
            ${selectCell(row)}
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
    <table class="data-table${hasExtras ? " has-extras" : ""}${selectable ? " has-select" : ""}">
      <thead>
        <tr>
          ${selectable ? `<th class="col-check"><label class="row-check">
                  <span class="sr-only">Select all</span>
                  <input type="checkbox" data-select-all${allSelected ? " checked" : ""}${someSelected && !allSelected ? ' data-indeterminate="true"' : ""} />
                </label></th>` : ""}
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
    ).join("") : `<td class="col-summary">${cell.summary}</td>`;
    return `<tr>
              ${selectable ? `<td class="col-check">${selectCell(row)}</td>` : ""}
              <td class="col-name">${cell.name}</td>
              <td class="col-status">${cell.status}</td>
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

// src/pages/expenses.ts
var VIEW_KEY = "pf-expenses-view-v2";
var MAX_FILE_BYTES = 4 * 1024 * 1024;
var ACCEPT = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,image/*";
var root = mountShell(
  "/expenses.html",
  "Expenses",
  "Property expenses and portfolio-level additional costs.",
  `<button class="btn" id="add-expense-btn" type="button">+ Add Expense</button>`
);
var user = getUser();
var presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
var cache = [];
var search = "";
var sortBy = "date";
var view = storedListView(VIEW_KEY, "list");
var openMenuId = null;
var scope = "property";
var selectedFile = null;
root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="table-toolbar-start">
        <div class="seg-tabs" id="scope-tabs">
          <button class="seg-tab active" data-scope="property" type="button">Property expenses</button>
          <button class="seg-tab" data-scope="general" type="button">Additional expenses</button>
        </div>
        <div class="table-filters">
          <div class="field"><label>Month</label><input id="month" type="month" value="${currentMonthValue()}" /></div>
          <div class="field" id="filter-property-wrap"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        </div>
      </div>
      <div class="table-toolbar-end">
        ${sortFieldHtml([
  { value: "date", label: "Date" },
  { value: "name", label: "Name" },
  { value: "amount", label: "Amount" }
])}
        ${searchFieldHtml()}
        ${viewToggleHtml(view)}
      </div>
    </div>
    <div class="status" id="status" hidden></div>
    <div id="totals" class="metrics table-metrics"></div>
    <div id="list"></div>
  </section>

  <div class="modal-backdrop" id="expense-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
      <div class="modal-header">
        <h2 id="expense-form-title">Add property expense</h2>
        <button class="modal-close" id="close-expense-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="expense-form" class="stack">
        <div class="form-grid">
          <div class="field" id="property-field"><label>Property</label><select name="propertyId" id="propertyId"></select></div>
          <div class="field"><label>Category</label>
            <select name="category">
              <option>Repairs</option><option>Maintenance</option><option>Insurance</option>
              <option>Service charges</option><option>Ground rent</option><option>Council tax</option>
              <option>Utilities</option><option>Management fees</option><option>Furniture</option>
              <option>Legal fees</option><option>Accountant fees</option><option>Software</option>
              <option>Admin</option><option>Other</option>
            </select>
          </div>
          <div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" required /></div>
          <div class="field"><label>Expense date</label><input name="expenseDate" type="date" required /></div>
          <div class="field"><label>Frequency</label>
            <select name="frequency">
              <option value="one_off">One-off</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field"><label>Payment status</label>
            <select name="paymentStatus">
              <option value="paid">Paid</option>
              <option value="upcoming">Upcoming</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Description</label><input name="description" /></div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes"></textarea></div>
          <div class="field" style="grid-column:1/-1">
            <label>Receipt or document <span class="muted">(optional)</span></label>
            <label class="file-drop">
              <input id="expense-file" type="file" accept="${ACCEPT}" />
              <span class="file-drop-title">Choose file</span>
              <span class="file-drop-sub" id="expense-file-sub">PDF, image, Word, or Excel \xB7 up to 4 MB</span>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-expense-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save expense</button>
        </div>
      </form>
    </div>
  </div>
`;
var modal = document.getElementById("expense-modal");
var form = document.getElementById("expense-form");
var fileInput = document.getElementById("expense-file");
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
function setFileHint(text) {
  document.getElementById("expense-file-sub").textContent = text;
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
async function openOrDownload(documentId, download) {
  const file = await apiFile(`/documents/${documentId}/file`);
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
function openModal() {
  syncScopeUi();
  modal.hidden = false;
  document.body.classList.add("modal-open");
}
function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel \xB7 up to 4 MB");
}
async function loadProperties() {
  const data = await api(
    `/properties${qs({ status: "active" })}`
  );
  const selects = [
    document.getElementById("propertyId"),
    document.getElementById("filterProperty")
  ];
  for (const select of selects) {
    if (select.id === "propertyId") {
      select.innerHTML = "";
    }
    for (const property of data.properties) {
      const option = document.createElement("option");
      option.value = String(property.id);
      option.textContent = property.name;
      select.appendChild(option);
    }
  }
  if (presetPropertyId) {
    document.getElementById("propertyId").value = presetPropertyId;
    document.getElementById("filterProperty").value = presetPropertyId;
  }
}
function syncScopeUi() {
  document.querySelectorAll("#scope-tabs .seg-tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.scope === scope);
  });
  document.getElementById("expense-form-title").textContent = scope === "property" ? "Add property expense" : "Add additional expense";
  document.getElementById("property-field").style.display = scope === "property" ? "block" : "none";
  document.getElementById("filter-property-wrap").style.display = scope === "property" ? "block" : "none";
}
function visibleRows() {
  const rows = cache.filter(
    (row) => matchesQuery(row, search, [
      "category",
      "property_name",
      "description",
      "payment_status",
      "notes",
      "document_name"
    ])
  );
  rows.sort((a, b) => {
    if (sortBy === "name") {
      return String(a.category || "").localeCompare(String(b.category || ""), "en-GB");
    }
    if (sortBy === "amount") {
      return Number(b.amount || 0) - Number(a.amount || 0);
    }
    return String(a.expense_date || "").localeCompare(String(b.expense_date || ""));
  });
  return rows;
}
function renderList() {
  const list = document.getElementById("list");
  const rows = visibleRows();
  list.innerHTML = renderDataList(
    rows.map((e) => {
      const id = String(e.id);
      const documentId = String(e.document_id || "");
      const hasDocument = Boolean(e.has_document && documentId);
      const status = String(e.payment_status || "upcoming");
      const place = scope === "property" ? String(e.property_name || "Property") : "General / Portfolio";
      const receipt = hasDocument ? ` \xB7 ${e.document_name || "Receipt"}` : "";
      return {
        id,
        title: String(e.category || "Expense"),
        subtitle: e.description ? `${place} \xB7 ${e.description}` : place,
        href: scope === "property" && e.property_id ? `/property.html?id=${e.property_id}` : void 0,
        propertyId: e.property_id ? String(e.property_id) : void 0,
        hasImage: Boolean(e.hasImage),
        status,
        statusLabel: labelize(status),
        summaryTitle: money(Number(e.amount), user.preferredCurrency),
        summarySub: `${formatDateDmY(String(e.expense_date || ""))} \xB7 ${labelize(String(e.frequency || ""))}${receipt}`,
        actions: `${hasDocument ? `<button type="button" data-open="${documentId}">Open receipt</button><button type="button" data-download="${documentId}">Download receipt</button>` : ""}<button type="button" data-delete="${id}">Delete</button>`
      };
    }),
    view,
    "No expenses for this period.",
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
  list.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/expenses/${button.dataset.delete}`, { method: "DELETE" });
      setStatus(document.getElementById("status"), "Expense deleted.", "success");
      openMenuId = null;
      await loadExpenses();
    });
  });
}
async function loadExpenses() {
  const month = document.getElementById("month").value;
  const propertyId = scope === "property" ? document.getElementById("filterProperty").value : "";
  const data = await api(`/expenses${qs({ month, scope, propertyId })}`);
  document.getElementById("totals").innerHTML = `
    <div class="metric"><div class="label">Total</div><div class="value">${money(data.totals.amount, user.preferredCurrency)}</div></div>
  `;
  cache = data.expenses;
  renderList();
}
document.getElementById("scope-tabs")?.addEventListener("click", (event) => {
  const target = event.target;
  if (target.dataset.scope === "property" || target.dataset.scope === "general") {
    scope = target.dataset.scope;
    openMenuId = null;
    syncScopeUi();
    void loadExpenses();
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (fileInput.files?.[0] && fileInput.files[0].size > MAX_FILE_BYTES) {
    setStatus(document.getElementById("status"), "Files must be 4 MB or smaller.", "error");
    return;
  }
  const formData = new FormData(form);
  const payload = {
    scope,
    propertyId: scope === "property" ? String(formData.get("propertyId") || "") : null,
    category: String(formData.get("category")),
    description: String(formData.get("description") || ""),
    amount: Number(formData.get("amount")),
    expenseDate: String(formData.get("expenseDate")),
    frequency: String(formData.get("frequency")),
    paymentStatus: String(formData.get("paymentStatus")),
    notes: String(formData.get("notes") || "")
  };
  try {
    if (selectedFile) {
      payload.originalFilename = selectedFile.name;
      payload.mimeType = selectedFile.type || "application/octet-stream";
      payload.fileData = await readFileAsBase64(selectedFile);
    }
    await api("/expenses", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setStatus(document.getElementById("status"), "Expense saved.", "success");
    closeModal();
    await loadExpenses();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
});
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
  setFileHint(`${file.name} \xB7 ${formatBytes(file.size)}`);
});
document.getElementById("add-expense-btn")?.addEventListener("click", () => {
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel \xB7 up to 4 MB");
  if (presetPropertyId) {
    document.getElementById("propertyId").value = presetPropertyId;
  }
  openModal();
});
document.getElementById("close-expense-modal")?.addEventListener("click", closeModal);
document.getElementById("cancel-expense-modal")?.addEventListener("click", closeModal);
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
document.getElementById("filterProperty")?.addEventListener("change", () => {
  void loadExpenses();
});
document.getElementById("month")?.addEventListener("change", () => {
  void loadExpenses();
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
  await loadExpenses();
})();
