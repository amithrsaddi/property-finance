export type ListViewMode = "list" | "grid";

export type ListRow = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  status: string;
  statusLabel?: string;
  summaryTitle: string;
  summarySub: string;
  actions?: string;
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export function statusPill(status: string, label?: string): string {
  const text = label || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `<span class="pill ${pillKind(status)}">${escapeHtml(text)}</span>`;
}

export function nameCell(title: string, subtitle: string, href?: string): string {
  const heading = href
    ? `<a class="name-title" href="${escapeHtml(href)}">${escapeHtml(title)}</a>`
    : `<div class="name-title">${escapeHtml(title)}</div>`;
  return `<div class="name-cell">
    <span class="row-avatar tone-${avatarTone(title)}">${escapeHtml(initials(title))}</span>
    <div>
      ${heading}
      <div class="name-sub">${escapeHtml(subtitle)}</div>
    </div>
  </div>`;
}

export function summaryCell(title: string, subtitle: string): string {
  return `<div class="summary-cell">
    <div class="name-title">${escapeHtml(title)}</div>
    <div class="name-sub">${escapeHtml(subtitle)}</div>
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

export function renderDataList(rows: ListRow[], view: ListViewMode, empty: string, openMenuId: string | null): string {
  if (!rows.length) {
    return `<p class="empty">${empty}</p>`;
  }
  const hasActions = rows.some((row) => Boolean(row.actions));
  const cells = (row: ListRow) => {
    const actions = kebabMenu(row.id, openMenuId === row.id, row.actions || "");
    return {
      name: nameCell(row.title, row.subtitle, row.href),
      status: statusPill(row.status, row.statusLabel),
      summary: summaryCell(row.summaryTitle, row.summarySub),
      actions
    };
  };
  if (view === "grid") {
    return `<div class="property-grid">${rows
      .map((row) => {
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
      })
      .join("")}</div>`;
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
        ${rows
          .map((row) => {
            const cell = cells(row);
            return `<tr>
              <td>${cell.name}</td>
              <td>${cell.status}</td>
              <td>${cell.summary}</td>
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
}

export function matchesQuery(row: Record<string, unknown>, query: string, keys: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
}
