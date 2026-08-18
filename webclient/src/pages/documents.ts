import { api, apiFile, formatDateDmY, getUser, qs } from "../lib.js";
import {
  bindListChrome,
  bindRowMenus,
  matchesQuery,
  renderDataList,
  searchFieldHtml,
  sortFieldHtml,
  viewToggleHtml,
  type ListViewMode
} from "../list-view.js";
import { mountShell, setStatus } from "../shell.js";

const VIEW_KEY = "pf-documents-view";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,image/*";

const root = mountShell(
  "/documents.html",
  "Documents",
  "Store files against a property or in a general folder.",
  `<button class="btn" id="add-document-btn" type="button">+ Add Document</button>`
);
const presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";

let cache: Array<Record<string, unknown>> = [];
let search = "";
let sortBy = "newest";
let view: ListViewMode = sessionStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
let openMenuId: string | null = null;
let scope: "all" | "property" | "general" = presetPropertyId ? "property" : "all";
let editingId: string | null = null;
let selectedFile: File | null = null;

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
        <button class="modal-close" id="close-document-modal" type="button" aria-label="Close">×</button>
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
              <span class="file-drop-sub" id="file-drop-sub">PDF, image, Word, or Excel · up to 4 MB</span>
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

const modal = document.getElementById("document-modal") as HTMLDivElement;
const form = document.getElementById("document-form") as HTMLFormElement;
const fileInput = document.getElementById("document-file") as HTMLInputElement;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
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

function fileKind(mime: string, filename: string): string {
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

function validity(row: Record<string, unknown>): { status: string; label: string } {
  const value = String(row.valid_until || "");
  if (!value) {
    return { status: "upcoming", label: "No expiry" };
  }
  if (value < todayIso()) {
    return { status: "overdue", label: `Expired ${formatDateDmY(value)}` };
  }
  return { status: "active", label: `Valid until ${formatDateDmY(value)}` };
}

function readFileAsBase64(file: File): Promise<string> {
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

function syncScopeUi(): void {
  document.querySelectorAll("#scope-tabs .seg-tab").forEach((el) => {
    el.classList.toggle("active", (el as HTMLElement).dataset.scope === scope);
  });
  (document.getElementById("filter-property-wrap") as HTMLElement).style.display =
    scope === "general" ? "none" : "block";
}

function setFileHint(text: string): void {
  document.getElementById("file-drop-sub")!.textContent = text;
}

function openModal(title: string): void {
  document.getElementById("document-form-title")!.textContent = title;
  document.getElementById("file-label")!.textContent = editingId ? "Replace file (optional)" : "Upload a document";
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(): void {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  editingId = null;
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel · up to 4 MB");
  if (presetPropertyId) {
    (document.getElementById("documentPropertyId") as HTMLSelectElement).value = presetPropertyId;
  }
}

async function loadProperties(): Promise<void> {
  const data = await api<{ properties: Array<{ id: string; name: string }> }>(
    `/properties${qs({ status: "active" })}`
  );
  const filter = document.getElementById("filterProperty") as HTMLSelectElement;
  const formSelect = document.getElementById("documentPropertyId") as HTMLSelectElement;
  for (const property of data.properties) {
    const option = document.createElement("option");
    option.value = String(property.id);
    option.textContent = property.name;
    filter.appendChild(option.cloneNode(true) as HTMLOptionElement);
    formSelect.appendChild(option);
  }
  if (presetPropertyId) {
    filter.value = presetPropertyId;
    formSelect.value = presetPropertyId;
  }
}

function visibleRows(): Array<Record<string, unknown>> {
  const rows = cache.filter((row) =>
    matchesQuery(row, search, ["name", "original_filename", "property_name", "scope", "mime_type"])
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

async function openOrDownload(id: string, download: boolean): Promise<void> {
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
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function renderList(): void {
  const list = document.getElementById("list")!;
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
        subtitle: `${row.original_filename || "File"} · ${formatBytes(Number(row.file_size || 0))}`,
        href: row.property_id ? `/property.html?id=${row.property_id}` : undefined,
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
  list.querySelectorAll<HTMLButtonElement>("[data-open]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await openOrDownload(String(button.dataset.open), false);
      } catch (error) {
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-download]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await openOrDownload(String(button.dataset.download), true);
      } catch (error) {
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
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
  list.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/documents/${button.dataset.delete}`, { method: "DELETE" });
      setStatus(document.getElementById("status"), "Document deleted.", "success");
      openMenuId = null;
      await loadDocuments();
    });
  });
}

function fillForm(row: Record<string, unknown>): void {
  editingId = String(row.id);
  selectedFile = null;
  fileInput.value = "";
  (form.elements.namedItem("name") as HTMLInputElement).value = String(row.name || "");
  (form.elements.namedItem("propertyId") as HTMLSelectElement).value = String(row.property_id || "");
  (form.elements.namedItem("validUntil") as HTMLInputElement).value = String(row.valid_until || "").slice(0, 10);
  setFileHint(String(row.original_filename || "Current file will be kept unless you choose another."));
}

async function loadDocuments(): Promise<void> {
  const propertyId =
    scope === "general" ? "" : (document.getElementById("filterProperty") as HTMLSelectElement).value;
  const data = await api<{ documents: Array<Record<string, unknown>> }>(
    `/documents${qs({ scope: scope === "all" ? "" : scope, propertyId })}`
  );
  cache = data.documents;
  renderList();
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0] || null;
  selectedFile = file;
  if (!file) {
    setFileHint("PDF, image, Word, or Excel · up to 4 MB");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    selectedFile = null;
    fileInput.value = "";
    setFileHint("That file is larger than 4 MB. Choose a smaller file.");
    return;
  }
  const nameInput = form.elements.namedItem("name") as HTMLInputElement;
  if (!nameInput.value.trim()) {
    nameInput.value = file.name.replace(/\.[^.]+$/, "");
  }
  setFileHint(`${file.name} · ${formatBytes(file.size)}`);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingId && !selectedFile) {
    setStatus(document.getElementById("status"), "Upload a document file.", "error");
    return;
  }
  const formData = new FormData(form);
  const payload: Record<string, unknown> = {
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
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

document.getElementById("add-document-btn")?.addEventListener("click", () => {
  editingId = null;
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel · up to 4 MB");
  if (presetPropertyId) {
    (document.getElementById("documentPropertyId") as HTMLSelectElement).value = presetPropertyId;
  } else if (scope === "general") {
    (document.getElementById("documentPropertyId") as HTMLSelectElement).value = "";
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
  const target = event.target as HTMLElement;
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
