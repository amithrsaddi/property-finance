import { apiFile } from "./lib.js";

export type ListViewMode = "list" | "grid";

export function storedListView(key: string, fallback: ListViewMode): ListViewMode {
  try {
    const value = sessionStorage.getItem(key);
    if (value === "list" || value === "grid") {
      return value;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export type ListExtra = {
  header: string;
  title: string;
  subtitle?: string;
};

export type ListRow = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  status: string;
  statusLabel?: string;
  summaryTitle: string;
  summarySub: string;
  extras?: ListExtra[];
  actions?: string;
  propertyId?: string | null;
  hasImage?: boolean;
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const HOUSE_ICON = `<svg class="property-thumb-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 21V10.5L12 4l8 6.5V21"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M9 21v-6h6v6"/></svg>`;

const thumbUrls = new Map<string, string>();

export function cachedPropertyThumb(id: string): string | undefined {
  return thumbUrls.get(id);
}

export function rememberPropertyThumb(id: string, url: string): void {
  thumbUrls.set(id, url);
}

export function forgetPropertyThumb(id: string): void {
  const url = thumbUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    thumbUrls.delete(id);
  }
}

export function propertyThumbHtml(propertyId: string, hasImage = false): string {
  const id = String(propertyId || "");
  const cached = id ? thumbUrls.get(id) : "";
  return `<span class="property-thumb-wrap${cached ? " has-photo" : ""}">
    <span class="property-thumb placeholder">${HOUSE_ICON}</span>
    ${
      id && hasImage
        ? `<img class="property-thumb" alt="" data-property-image="${escapeHtml(id)}"${
            cached ? ` src="${escapeHtml(cached)}"` : ""
          }>`
        : ""
    }
  </span>`;
}

export async function hydratePropertyThumbs(root: ParentNode): Promise<void> {
  const imgs = [...root.querySelectorAll<HTMLImageElement>("img[data-property-image]")];
  const unique = new Map<string, HTMLImageElement[]>();
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

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function avatarTone(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % 5;
}

export function pillKind(status: string): string {
  const value = String(status || "").toLowerCase();
  if (value === "paid" || value === "active" || value === "done" || value === "repayment") {
    return "done";
  }
  if (
    value === "upcoming" ||
    value === "partial" ||
    value === "partially_paid" ||
    value === "info" ||
    value === "interest_only"
  ) {
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

export function statusPill(status: string, label?: string): string {
  const text = label || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const slug = String(status || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `<span class="pill ${pillKind(status)}${slug ? ` pill-${slug}` : ""}">${escapeHtml(text)}</span>`;
}

export function nameCell(
  title: string,
  subtitle: string,
  href?: string,
  property?: { propertyId?: string | null; hasImage?: boolean }
): string {
  const heading = href
    ? `<a class="name-title" href="${escapeHtml(href)}">${escapeHtml(title)}</a>`
    : `<div class="name-title">${escapeHtml(title)}</div>`;
  const propertyId = String(property?.propertyId || "");
  const avatar = propertyId
    ? propertyThumbHtml(propertyId, Boolean(property?.hasImage))
    : `<span class="row-avatar tone-${avatarTone(title)}">${escapeHtml(initials(title))}</span>`;
  return `<div class="name-cell">
    ${avatar}
    <div>
      ${heading}
      ${subtitle ? `<div class="name-sub">${escapeHtml(subtitle)}</div>` : ""}
    </div>
  </div>`;
}

export function summaryCell(title: string, subtitle: string): string {
  return `<div class="summary-cell">
    <div class="name-title">${escapeHtml(title)}</div>
    <div class="name-sub">${escapeHtml(subtitle)}</div>
  </div>`;
}

export function extraCell(extra: ListExtra): string {
  return `<div class="summary-cell">
    <div class="name-title">${escapeHtml(extra.title)}</div>
    ${extra.subtitle ? `<div class="name-sub">${escapeHtml(extra.subtitle)}</div>` : ""}
  </div>`;
}

export function kebabMenu(id: string, open: boolean, itemsHtml: string): string {
  if (!itemsHtml.trim()) {
    return "";
  }
  return `<div class="row-menu ${open ? "open" : ""}">
    <button class="kebab-btn" data-menu="${escapeHtml(id)}" type="button" aria-label="Actions" aria-expanded="${open}">⋯</button>
    <div class="row-menu-pop"${open ? "" : " hidden"}>${itemsHtml}</div>
  </div>`;
}

export function viewToggleHtml(view: ListViewMode): string {
  return `<div class="view-toggle" role="group" aria-label="View">
    <button class="view-btn${view === "list" ? " active" : ""}" data-view-mode="list" type="button" aria-label="List view" aria-pressed="${view === "list"}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>
    </button>
    <button class="view-btn${view === "grid" ? " active" : ""}" data-view-mode="grid" type="button" aria-label="Grid view" aria-pressed="${view === "grid"}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
    </button>
  </div>`;
}

export function searchFieldHtml(id = "list-search"): string {
  return `<label class="search-field">
    <span class="sr-only">Search</span>
    <input id="${id}" type="search" placeholder="Search" />
    <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16.2 16.2 21 21"/></svg>
  </label>`;
}

export function sortFieldHtml(options: Array<{ value: string; label: string }>, id = "sort-by"): string {
  return `<label class="sort-field">
    <span>Sort by</span>
    <select id="${id}">
      ${options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}
    </select>
  </label>`;
}

export type ListRenderOptions = {
  selectedIds?: Set<string>;
};

export function renderDataList(
  rows: ListRow[],
  view: ListViewMode,
  empty: string,
  openMenuId: string | null,
  options?: ListRenderOptions
): string {
  if (!rows.length) {
    return `<p class="empty">${empty}</p>`;
  }
  const selectedIds = options?.selectedIds;
  const selectable = Boolean(selectedIds);
  const selectCell = (row: ListRow) => {
    if (!selectable || !selectedIds) {
      return "";
    }
    const checked = selectedIds.has(row.id);
    return `<label class="row-check">
      <span class="sr-only">Select ${escapeHtml(row.title)}</span>
      <input type="checkbox" data-select="${escapeHtml(row.id)}"${checked ? " checked" : ""} />
    </label>`;
  };
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selectedIds!.has(row.id));
  const someSelected = selectable && rows.some((row) => selectedIds!.has(row.id));
  const hasActions = rows.some((row) => Boolean(row.actions));
  const extraHeaders = rows[0]?.extras?.map((extra) => extra.header) ?? [];
  const hasExtras = extraHeaders.length > 0;
  const cells = (row: ListRow) => {
    const actions = kebabMenu(row.id, openMenuId === row.id, row.actions || "");
    return {
      name: nameCell(row.title, row.subtitle, row.href, row),
      status: statusPill(row.status, row.statusLabel),
      summary: summaryCell(row.summaryTitle, row.summarySub),
      extras: extraHeaders.map((header, index) => {
        const extra = row.extras?.[index] || { header, title: "—" };
        return extraCell(extra);
      }),
      actions
    };
  };
  if (view === "grid") {
    return `<div class="property-grid">${rows
      .map((row) => {
        const cell = cells(row);
        const extras = hasExtras
          ? `<div class="card-extras">${extraHeaders
              .map((header, index) => {
                const extra = row.extras?.[index] || { header, title: "—" };
                return `<div class="card-extra">
                  <div class="name-sub">${escapeHtml(header)}</div>
                  <div class="name-title">${escapeHtml(extra.title)}</div>
                  ${extra.subtitle ? `<div class="name-sub">${escapeHtml(extra.subtitle)}</div>` : ""}
                </div>`;
              })
              .join("")}</div>`
          : cell.summary;
        return `<article class="property-card">
          <div class="property-card-head">
            ${selectCell(row)}
            ${cell.name}
            ${hasActions ? cell.actions : ""}
          </div>
          <div class="property-card-meta">
            <div class="card-status">${cell.status}</div>
            ${extras}
          </div>
        </article>`;
      })
      .join("")}</div>`;
  }
  return `<div class="data-table-wrap">
    <table class="data-table${hasExtras ? " has-extras" : ""}${selectable ? " has-select" : ""}">
      <thead>
        <tr>
          ${
            selectable
              ? `<th class="col-check"><label class="row-check">
                  <span class="sr-only">Select all</span>
                  <input type="checkbox" data-select-all${allSelected ? " checked" : ""}${
                    someSelected && !allSelected ? " data-indeterminate=\"true\"" : ""
                  } />
                </label></th>`
              : ""
          }
          <th>Name</th>
          <th>Status</th>
          ${
            hasExtras
              ? extraHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")
              : "<th>Summary</th>"
          }
          ${hasActions ? `<th class="col-actions">Actions</th>` : ""}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const cell = cells(row);
            const extraTds = hasExtras
              ? cell.extras
                  .map(
                    (html, index) =>
                      `<td class="col-extra" data-label="${escapeHtml(extraHeaders[index] || "")}">${html}</td>`
                  )
                  .join("")
              : `<td class="col-summary">${cell.summary}</td>`;
            return `<tr>
              ${selectable ? `<td class="col-check">${selectCell(row)}</td>` : ""}
              <td class="col-name">${cell.name}</td>
              <td class="col-status">${cell.status}</td>
              ${extraTds}
              ${hasActions ? `<td class="col-actions">${cell.actions}</td>` : ""}
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>`;
}

export function bindListChrome(options: {
  view: ListViewMode;
  onView: (view: ListViewMode) => void;
  onSearch: (value: string) => void;
  onSort?: (value: string) => void;
  searchId?: string;
  sortId?: string;
}): void {
  document.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewMode === options.view);
    button.setAttribute("aria-pressed", String(button.dataset.viewMode === options.view));
    button.addEventListener("click", () => {
      const next = button.dataset.viewMode === "grid" ? "grid" : "list";
      document.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.viewMode === next);
        btn.setAttribute("aria-pressed", String(btn.dataset.viewMode === next));
      });
      options.onView(next);
    });
  });
  document.getElementById(options.searchId || "list-search")?.addEventListener("input", (event) => {
    options.onSearch((event.target as HTMLInputElement).value);
  });
  if (options.onSort) {
    document.getElementById(options.sortId || "sort-by")?.addEventListener("change", (event) => {
      options.onSort!((event.target as HTMLSelectElement).value);
    });
  }
}

export function positionOpenRowMenu(root: ParentNode = document): void {
  const menu = root.querySelector<HTMLElement>(".row-menu.open");
  const button = menu?.querySelector<HTMLElement>(".kebab-btn");
  const pop = menu?.querySelector<HTMLElement>(".row-menu-pop");
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

export function bindRowMenus(
  root: HTMLElement,
  openMenuId: string | null,
  setOpenMenuId: (id: string | null) => void,
  rerender: () => void
): void {
  root.querySelectorAll<HTMLButtonElement>("[data-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = String(button.dataset.menu);
      setOpenMenuId(openMenuId === id ? null : id);
      rerender();
    });
  });
  root.querySelectorAll(".row-menu-pop").forEach((pop) => {
    pop.addEventListener("click", (event) => event.stopPropagation());
  });
  if (openMenuId) {
    requestAnimationFrame(() => positionOpenRowMenu(root));
  }
  void hydratePropertyThumbs(root);
}

export function matchesQuery(row: Record<string, unknown>, query: string, keys: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
}
