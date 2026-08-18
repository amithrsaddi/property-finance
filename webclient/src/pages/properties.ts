import { api, getUser, money, qs, labelize } from "../lib.js";
import { positionOpenRowMenu } from "../list-view.js";
import { mountShell, setStatus } from "../shell.js";

const VIEW_KEY = "pf-properties-view";
const user = getUser()!;

const root = mountShell(
  "/properties.html",
  "Properties",
  "Manage your property portfolio.",
  `<button class="btn" id="add-property-btn" type="button">+ Add Property</button>`
);

let editingId: string | null = null;
let cache: Array<Record<string, unknown>> = [];
let statusFilter: "all" | "archived" = "all";
let sortBy: "newest" | "name" | "value" | "rent" = "newest";
let search = "";
let view: "list" | "grid" = sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
let openMenuId: string | null = null;

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
        <button class="modal-close" id="close-modal" type="button" aria-label="Close">×</button>
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
        <div class="modal-actions">
          <button class="btn secondary" id="cancel-modal" type="button">Cancel</button>
          <button class="btn" type="submit">Save property</button>
        </div>
      </form>
    </div>
  </div>
`;

const form = document.getElementById("property-form") as HTMLFormElement;
const modal = document.getElementById("property-modal") as HTMLDivElement;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function avatarTone(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % 5;
}

function createdTime(row: Record<string, unknown>): number {
  const raw = row.createdAt || row.created_at;
  const time = raw ? new Date(String(raw)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function openModal(title: string): void {
  document.getElementById("form-title")!.textContent = title;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  (form.elements.namedItem("name") as HTMLInputElement).focus();
}

function closeModal(): void {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  resetForm();
}

function resetForm(): void {
  editingId = null;
  form.reset();
  (form.elements.namedItem("ownershipPercentage") as HTMLInputElement).value = "100";
  (form.elements.namedItem("expectedMonthlyRent") as HTMLInputElement).value = "0";
  (form.elements.namedItem("status") as HTMLSelectElement).value = "active";
  document.getElementById("form-title")!.textContent = "Add property";
}

function fillForm(property: Record<string, unknown>): void {
  editingId = String(property.id);
  (form.elements.namedItem("name") as HTMLInputElement).value = String(property.name || "");
  (form.elements.namedItem("address") as HTMLInputElement).value = String(property.address || "");
  (form.elements.namedItem("propertyType") as HTMLSelectElement).value = String(
    property.propertyType || "residential"
  );
  (form.elements.namedItem("purchasePrice") as HTMLInputElement).value =
    property.purchasePrice != null ? String(property.purchasePrice) : "";
  (form.elements.namedItem("purchaseDate") as HTMLInputElement).value = String(property.purchaseDate || "");
  (form.elements.namedItem("currentValue") as HTMLInputElement).value =
    property.currentValue != null ? String(property.currentValue) : "";
  (form.elements.namedItem("ownershipPercentage") as HTMLInputElement).value = String(
    property.ownershipPercentage ?? 100
  );
  (form.elements.namedItem("expectedMonthlyRent") as HTMLInputElement).value = String(
    property.expectedMonthlyRent ?? 0
  );
  (form.elements.namedItem("status") as HTMLSelectElement).value = String(property.status || "active");
  (form.elements.namedItem("notes") as HTMLTextAreaElement).value = String(property.notes || "");
}

function visibleRows(): Array<Record<string, unknown>> {
  const query = search.trim().toLowerCase();
  const rows = cache.filter((row) => {
    if (!query) {
      return true;
    }
    const haystack = [row.name, row.address, row.propertyType, row.notes]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
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

function statusBadge(status: string): string {
  const archived = status === "archived";
  return `<span class="pill ${archived ? "paused" : "done"}">${archived ? "Archived" : "Active"}</span>`;
}

function nameCell(row: Record<string, unknown>): string {
  const name = String(row.name || "Untitled");
  return `<div class="name-cell">
    <span class="row-avatar tone-${avatarTone(name)}">${escapeHtml(initials(name))}</span>
    <div>
      <a class="name-title" href="/property.html?id=${escapeHtml(row.id)}">${escapeHtml(name)}</a>
      <div class="name-sub">${escapeHtml(row.address || "No address")}</div>
    </div>
  </div>`;
}

function summaryCell(row: Record<string, unknown>): string {
  const type = labelize(String(row.propertyType || "residential"));
  const rent = money(Number(row.expectedMonthlyRent || 0), user.preferredCurrency);
  const value = money(Number(row.currentValue || 0), user.preferredCurrency);
  return `<div class="summary-cell">
    <div class="name-title">${escapeHtml(type)}</div>
    <div class="name-sub">Rent ${escapeHtml(rent)} · Value ${escapeHtml(value)}</div>
  </div>`;
}

function actionMenu(row: Record<string, unknown>): string {
  const id = String(row.id);
  const open = openMenuId === id;
  const archived = row.status === "archived";
  return `<div class="row-menu ${open ? "open" : ""}">
    <button class="kebab-btn" data-menu="${escapeHtml(id)}" type="button" aria-label="Actions" aria-expanded="${open}">⋯</button>
    <div class="row-menu-pop"${open ? "" : " hidden"}>
      <a href="/property.html?id=${escapeHtml(id)}">Open</a>
      <button type="button" data-edit="${escapeHtml(id)}">Edit</button>
      ${
        archived
          ? `<button type="button" data-restore="${escapeHtml(id)}">Restore</button>`
          : `<button type="button" data-archive="${escapeHtml(id)}">Archive</button>`
      }
    </div>
  </div>`;
}

function renderList(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return `<p class="empty">No properties found. Use + Add Property to create one.</p>`;
  }
  if (view === "grid") {
    return `<div class="property-grid">${rows
      .map(
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
      )
      .join("")}</div>`;
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
        ${rows
          .map(
            (row) => `<tr>
              <td>${nameCell(row)}</td>
              <td>${statusBadge(String(row.status))}</td>
              <td>${summaryCell(row)}</td>
              <td class="col-actions">${actionMenu(row)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function bindListActions(rows: Array<Record<string, unknown>>): void {
  const list = document.getElementById("property-list")!;
  list.querySelectorAll<HTMLButtonElement>("[data-menu]").forEach((button) => {
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
  list.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const property = rows.find((row) => String(row.id) === String(button.dataset.edit));
      if (!property) {
        return;
      }
      openMenuId = null;
      fillForm(property);
      openModal("Edit property");
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/properties/${button.dataset.archive}/archive`, { method: "POST" });
        setStatus(document.getElementById("status"), "Property archived.", "success");
        openMenuId = null;
        await loadProperties();
      } catch (error) {
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-restore]").forEach((button) => {
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
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
  if (openMenuId) {
    requestAnimationFrame(() => positionOpenRowMenu(list));
  }
}

function render(): void {
  document.querySelectorAll("#status-tabs .seg-tab").forEach((el) => {
    el.classList.toggle("active", (el as HTMLElement).dataset.status === statusFilter);
  });
  document.getElementById("view-list")?.classList.toggle("active", view === "list");
  document.getElementById("view-grid")?.classList.toggle("active", view === "grid");
  document.getElementById("view-list")?.setAttribute("aria-pressed", String(view === "list"));
  document.getElementById("view-grid")?.setAttribute("aria-pressed", String(view === "grid"));
  const rows = visibleRows();
  const list = document.getElementById("property-list")!;
  list.innerHTML = renderList(rows);
  bindListActions(rows);
}

async function loadProperties(): Promise<void> {
  const data = await api<{ properties: Array<Record<string, unknown>> }>(
    `/properties${qs({ status: statusFilter === "archived" ? "archived" : "active" })}`
  );
  cache = data.properties;
  render();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
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

  try {
    if (editingId) {
      await api(`/properties/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Property updated.", "success");
    } else {
      await api("/properties", { method: "POST", body: JSON.stringify(payload) });
      setStatus(document.getElementById("status"), "Property created.", "success");
    }
    closeModal();
    await loadProperties();
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

document.getElementById("add-property-btn")?.addEventListener("click", () => {
  resetForm();
  openModal("Add property");
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
  const target = event.target as HTMLElement;
  if (target.dataset.status === "all" || target.dataset.status === "archived") {
    statusFilter = target.dataset.status;
    void loadProperties();
  }
});
document.getElementById("sort-by")?.addEventListener("change", (event) => {
  sortBy = (event.target as HTMLSelectElement).value as typeof sortBy;
  render();
});
document.getElementById("property-search")?.addEventListener("input", (event) => {
  search = (event.target as HTMLInputElement).value;
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
