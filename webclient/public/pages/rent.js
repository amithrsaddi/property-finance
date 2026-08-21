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
function formatMonthYear(value) {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})/.exec(raw);
  if (!match) {
    return raw || "-";
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
    return raw;
  }
  const label = new Date(Date.UTC(year, monthIndex, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
  return label;
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
    ).join("") : `<td>${cell.summary}</td>`;
    return `<tr>
              ${selectable ? `<td class="col-check">${selectCell(row)}</td>` : ""}
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

// src/pages/rent.ts
var VIEW_KEY = "pf-rent-view";
var root = mountShell(
  "/rent.html",
  "Rent",
  "Track expected and received rental payments.",
  `<div class="actions">
    <button class="btn secondary" id="recurring-rent-btn" type="button">Recurring rent</button>
    <button class="btn" id="add-rent-btn" type="button">+ Add Rent</button>
  </div>`
);
var user = getUser();
var presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";
var propertyOptions = [];
var editingId = null;
var cache = [];
var search = "";
var sortBy = "due";
var view = sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
var openMenuId = null;
root.innerHTML = `
  <section class="panel table-card">
    <div class="table-toolbar">
      <div class="table-toolbar-start">
        <div class="table-filters">
          <div class="field">
            <label>Period</label>
            <select id="periodType">
              <option value="month" selected>Month</option>
              <option value="year">Year</option>
            </select>
          </div>
          <div class="field" id="month-filter-wrap">
            <label>Month</label>
            <input id="month" type="month" value="${currentMonthValue()}" />
          </div>
          <div class="field" id="year-filter-wrap" hidden>
            <label>Year</label>
            <input id="year" type="number" min="2000" max="2100" value="${(/* @__PURE__ */ new Date()).getFullYear()}" />
          </div>
          <div class="field"><label>Property</label><select id="filterProperty"><option value="">All</option></select></div>
        </div>
      </div>
      <div class="table-toolbar-end">
        ${sortFieldHtml([
  { value: "due", label: "Due date" },
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

  <div class="modal-backdrop" id="rent-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rent-form-title">
      <div class="modal-header">
        <h2 id="rent-form-title">Add rent</h2>
        <button class="modal-close" id="close-rent-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="rent-form" class="stack">
        <div class="form-grid">
          <div class="field"><label>Property</label><select name="propertyId" id="propertyId" required></select></div>
          <div class="field"><label>Rental period</label><input name="rentalPeriod" type="month" required /></div>
          <div class="field"><label>Expected amount</label><input name="expectedAmount" type="number" step="0.01" required /></div>
          <div class="field"><label>Amount received</label><input name="amountReceived" type="number" step="0.01" value="0" /></div>
          <div class="field"><label>Expected payment date</label><input name="expectedPaymentDate" type="date" required /></div>
          <div class="field"><label>Actual payment date</label><input name="actualPaymentDate" type="date" /></div>
          <div class="field"><label>Status</label>
            <select name="status">
              <option value="upcoming">Upcoming</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes"></textarea></div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-rent-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save rent record</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal-backdrop" id="recurring-rent-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="recurring-rent-title">
      <div class="modal-header">
        <h2 id="recurring-rent-title">Recurring rent</h2>
        <button class="modal-close" id="close-recurring-rent-modal" type="button" aria-label="Close">\xD7</button>
      </div>
      <form id="recurring-rent-form" class="stack">
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1">
            <label>Property</label>
            <select name="propertyId" id="recurringPropertyId" required></select>
          </div>
          <div class="field"><label>From</label><input name="from" type="date" required /></div>
          <div class="field"><label>To</label><input name="to" type="date" required /></div>
          <div class="field"><label>Rent amount</label><input name="expectedAmount" type="number" step="0.01" min="0" required /></div>
          <div class="field">
            <label>Status</label>
            <input value="Upcoming" disabled />
            <input type="hidden" name="status" value="upcoming" />
          </div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" placeholder="Optional"></textarea></div>
        </div>
        <p class="muted" style="margin:0">
          Creates one Upcoming rent record for each month from From through To. Existing months for the property are skipped.
        </p>
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-recurring-rent-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Create recurring rent</button>
        </div>
      </form>
    </div>
  </div>
`;
var modal = document.getElementById("rent-modal");
var form = document.getElementById("rent-form");
var recurringModal = document.getElementById("recurring-rent-modal");
var recurringForm = document.getElementById("recurring-rent-form");
function normalizeStatus(status) {
  if (status === "paid") {
    return "paid";
  }
  if (status === "upcoming") {
    return "upcoming";
  }
  return "unpaid";
}
function displayStatus(status) {
  return labelize(normalizeStatus(status));
}
function openModal(title) {
  document.getElementById("rent-form-title").textContent = title;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}
function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  editingId = null;
  delete form.dataset.editingId;
  form.reset();
  form.elements.namedItem("amountReceived").value = "0";
  form.elements.namedItem("status").value = "upcoming";
  if (presetPropertyId) {
    document.getElementById("propertyId").value = presetPropertyId;
  }
}
function openRecurringModal() {
  recurringModal.hidden = false;
  document.body.classList.add("modal-open");
}
function closeRecurringModal() {
  recurringModal.hidden = true;
  document.body.classList.remove("modal-open");
  recurringForm.reset();
  fillRecurringDefaults();
}
function fillExpectedFromProperty() {
  const selected = propertyOptions.find(
    (p) => String(p.id) === document.getElementById("propertyId").value
  );
  if (selected) {
    form.elements.namedItem("expectedAmount").value = String(
      selected.expectedMonthlyRent || ""
    );
  }
}
function fillRecurringExpectedFromProperty() {
  const selected = propertyOptions.find(
    (p) => String(p.id) === document.getElementById("recurringPropertyId").value
  );
  if (selected) {
    recurringForm.elements.namedItem("expectedAmount").value = String(
      selected.expectedMonthlyRent || ""
    );
  }
}
function fillRecurringDefaults() {
  const fromInput = recurringForm.elements.namedItem("from");
  const toInput = recurringForm.elements.namedItem("to");
  const today = /* @__PURE__ */ new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 11, 1);
  const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  fromInput.value = toLocalDate(from);
  toInput.value = toLocalDate(to);
  if (presetPropertyId) {
    document.getElementById("recurringPropertyId").value = presetPropertyId;
  }
  fillRecurringExpectedFromProperty();
}
function fillForm(row) {
  editingId = String(row.id);
  form.dataset.editingId = editingId;
  document.getElementById("propertyId").value = String(row.property_id || "");
  form.elements.namedItem("rentalPeriod").value = String(row.rental_period || "").slice(
    0,
    7
  );
  form.elements.namedItem("expectedAmount").value = String(row.expected_amount ?? "");
  form.elements.namedItem("amountReceived").value = String(row.amount_received ?? 0);
  form.elements.namedItem("expectedPaymentDate").value = String(
    row.expected_payment_date || ""
  ).slice(0, 10);
  form.elements.namedItem("actualPaymentDate").value = String(
    row.actual_payment_date || ""
  ).slice(0, 10);
  form.elements.namedItem("status").value = normalizeStatus(String(row.status || "upcoming"));
  form.elements.namedItem("notes").value = String(row.notes || "");
}
async function loadProperties() {
  const data = await api(
    `/properties${qs({ status: "active" })}`
  );
  propertyOptions = data.properties;
  const formSelect = document.getElementById("propertyId");
  const recurringSelect = document.getElementById("recurringPropertyId");
  const filterSelect = document.getElementById("filterProperty");
  formSelect.innerHTML = "";
  recurringSelect.innerHTML = "";
  for (const property of data.properties) {
    const option = document.createElement("option");
    option.value = String(property.id);
    option.textContent = property.name;
    formSelect.appendChild(option);
    recurringSelect.appendChild(option.cloneNode(true));
    filterSelect.appendChild(option.cloneNode(true));
  }
  if (presetPropertyId) {
    formSelect.value = presetPropertyId;
    recurringSelect.value = presetPropertyId;
    filterSelect.value = presetPropertyId;
  }
  fillRecurringDefaults();
}
function visibleRows() {
  const rows = cache.filter(
    (row) => matchesQuery(row, search, ["property_name", "rental_period", "status", "notes"])
  );
  rows.sort((a, b) => {
    if (sortBy === "name") {
      return String(a.property_name || "").localeCompare(String(b.property_name || ""), "en-GB");
    }
    if (sortBy === "amount") {
      return Number(b.expected_amount || 0) - Number(a.expected_amount || 0);
    }
    return String(a.expected_payment_date || "").localeCompare(String(b.expected_payment_date || ""));
  });
  return rows;
}
function renderList() {
  const list = document.getElementById("list");
  const rows = visibleRows();
  list.innerHTML = renderDataList(
    rows.map((row) => {
      const status = normalizeStatus(String(row.status));
      const id = String(row.id);
      return {
        id,
        title: String(row.property_name || "Property"),
        subtitle: `Period ${formatMonthYear(String(row.rental_period || ""))} \xB7 Due ${formatDateDmY(String(row.expected_payment_date || ""))}`,
        href: row.property_id ? `/property.html?id=${row.property_id}` : void 0,
        propertyId: row.property_id ? String(row.property_id) : void 0,
        hasImage: Boolean(row.hasImage),
        status,
        statusLabel: displayStatus(status),
        summaryTitle: `Expected ${money(Number(row.expected_amount), user.preferredCurrency)}`,
        summarySub: `Received ${money(Number(row.amount_received), user.preferredCurrency)}`,
        actions: `<button type="button" data-edit="${id}">Edit</button>${status === "paid" ? "" : `<button type="button" data-mark-paid="${id}">Mark paid</button>`}<button type="button" data-delete="${id}">Delete</button>`
      };
    }),
    view,
    "No rent records for this period.",
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
  list.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((item) => String(item.id) === String(button.dataset.edit));
      if (!row) {
        return;
      }
      openMenuId = null;
      fillForm(row);
      openModal("Edit rent");
    });
  });
  list.querySelectorAll("[data-mark-paid]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = rows.find((item) => String(item.id) === String(button.dataset.markPaid));
      if (!row) {
        return;
      }
      await api(`/rent/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amountReceived: row.expected_amount,
          actualPaymentDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
          status: "paid"
        })
      });
      setStatus(document.getElementById("status"), "Rent marked as paid.", "success");
      openMenuId = null;
      await loadRent();
    });
  });
  list.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/rent/${button.dataset.delete}`, { method: "DELETE" });
      setStatus(document.getElementById("status"), "Rent record deleted.", "success");
      openMenuId = null;
      await loadRent();
    });
  });
}
async function loadRent() {
  const periodType = document.getElementById("periodType").value;
  const propertyId = document.getElementById("filterProperty").value;
  const query = periodType === "year" ? qs({ year: document.getElementById("year").value, propertyId }) : qs({ month: document.getElementById("month").value, propertyId });
  const data = await api(`/rent${query}`);
  document.getElementById("totals").innerHTML = `
    <div class="metric"><div class="label">Expected</div><div class="value">${money(data.totals.expected, user.preferredCurrency)}</div></div>
    <div class="metric"><div class="label">Received</div><div class="value">${money(data.totals.received, user.preferredCurrency)}</div></div>
  `;
  cache = data.rentPayments;
  renderList();
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const formData = new FormData(form);
  const status = normalizeStatus(String(formData.get("status") || "upcoming"));
  let amountReceived = Number(formData.get("amountReceived") || 0);
  let actualPaymentDate = String(formData.get("actualPaymentDate") || "") || null;
  const expectedAmount = Number(formData.get("expectedAmount"));
  const rentId = editingId || form.dataset.editingId || null;
  if (status === "paid") {
    if (!amountReceived) {
      amountReceived = expectedAmount;
    }
    if (!actualPaymentDate) {
      actualPaymentDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    }
  }
  const payload = {
    propertyId: String(formData.get("propertyId") || ""),
    rentalPeriod: String(formData.get("rentalPeriod")).slice(0, 7),
    expectedAmount,
    amountReceived,
    expectedPaymentDate: String(formData.get("expectedPaymentDate")).slice(0, 10),
    actualPaymentDate,
    status,
    notes: String(formData.get("notes") || "")
  };
  try {
    if (rentId) {
      await api(`/rent/${rentId}`, { method: "PUT", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Rent record updated.", "success");
    } else {
      await api("/rent", { method: "POST", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Rent record saved.", "success");
    }
    closeModal();
    await loadRent();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
});
recurringForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recurringForm.checkValidity()) {
    recurringForm.reportValidity();
    return;
  }
  const formData = new FormData(recurringForm);
  const from = String(formData.get("from") || "");
  const to = String(formData.get("to") || "");
  if (from > to) {
    setStatus(document.getElementById("status"), "From date must be on or before To date.", "error");
    return;
  }
  const payload = {
    propertyId: String(formData.get("propertyId") || ""),
    from,
    to,
    expectedAmount: Number(formData.get("expectedAmount")),
    status: "upcoming",
    notes: String(formData.get("notes") || "")
  };
  try {
    const result = await api(
      "/rent/recurring",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
    closeRecurringModal();
    setStatus(document.getElementById("status"), result.message, "success");
    await loadRent();
  } catch (error) {
    setStatus(document.getElementById("status"), error.message, "error");
  }
});
document.getElementById("propertyId")?.addEventListener("change", fillExpectedFromProperty);
document.getElementById("recurringPropertyId")?.addEventListener("change", fillRecurringExpectedFromProperty);
document.getElementById("add-rent-btn")?.addEventListener("click", () => {
  editingId = null;
  delete form.dataset.editingId;
  form.reset();
  form.elements.namedItem("amountReceived").value = "0";
  form.elements.namedItem("status").value = "upcoming";
  if (presetPropertyId) {
    document.getElementById("propertyId").value = presetPropertyId;
  }
  fillExpectedFromProperty();
  openModal("Add rent");
});
document.getElementById("recurring-rent-btn")?.addEventListener("click", () => {
  fillRecurringDefaults();
  openRecurringModal();
});
document.getElementById("close-rent-modal")?.addEventListener("click", closeModal);
document.getElementById("cancel-rent-modal")?.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});
document.getElementById("close-recurring-rent-modal")?.addEventListener("click", closeRecurringModal);
document.getElementById("cancel-recurring-rent-modal")?.addEventListener("click", closeRecurringModal);
recurringModal.addEventListener("click", (event) => {
  if (event.target === recurringModal) {
    closeRecurringModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (!modal.hidden) {
    closeModal();
  } else if (!recurringModal.hidden) {
    closeRecurringModal();
  } else if (openMenuId) {
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
  void loadRent();
});
function syncPeriodFilterUi() {
  const periodType = document.getElementById("periodType").value;
  const monthWrap = document.getElementById("month-filter-wrap");
  const yearWrap = document.getElementById("year-filter-wrap");
  const showYear = periodType === "year";
  monthWrap.hidden = showYear;
  yearWrap.hidden = !showYear;
}
document.getElementById("periodType")?.addEventListener("change", () => {
  syncPeriodFilterUi();
  void loadRent();
});
document.getElementById("month")?.addEventListener("change", () => {
  void loadRent();
});
document.getElementById("year")?.addEventListener("change", () => {
  void loadRent();
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
void (async () => {
  syncPeriodFilterUi();
  await loadProperties();
  await loadRent();
})();
