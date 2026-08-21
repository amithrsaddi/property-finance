import { api, apiFile, formatDateDmY, qs } from "../lib.js";
import {
  bindRowMenus,
  escapeHtml,
  kebabMenu,
  matchesQuery,
  searchFieldHtml,
  viewToggleHtml,
  storedListView,
  type ListViewMode
} from "../list-view.js";
import { mountShell, setStatus } from "../shell.js";

const PAGE_VIEW_KEY = "pf-documents-page-view";
const FOLDER_VIEW_KEY = "pf-documents-folder-view-v2";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,image/*";
const FOLDER_GLYPH = `<svg class="folder-glyph" viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M8 18a6 6 0 0 1 6-6h13.2l3.8 5.2H50a6 6 0 0 1 6 6v23.8A6.2 6.2 0 0 1 49.8 53H14.2A6.2 6.2 0 0 1 8 46.8z"/></svg>`;

type PageView = "explorer" | "timeline";
type FileTab = "all" | "mixed" | "important" | "recent";
type DocRow = Record<string, unknown>;

const root = mountShell(
  "/documents.html",
  "Documents",
  "Organise files in folders, then preview or download them when you need them.",
  `<button class="btn" id="upload-file-btn" type="button">Upload file</button>
   <button class="btn" id="upload-folder-btn" type="button">Upload folder</button>`
);
const presetPropertyId = new URLSearchParams(window.location.search).get("propertyId") || "";

let filesCache: DocRow[] = [];
let foldersCache: DocRow[] = [];
let properties: Array<{ id: string; name: string }> = [];
let currentFolderId: string | null = null;
let pageView: PageView = sessionStorage.getItem(PAGE_VIEW_KEY) === "explorer" ? "explorer" : "timeline";
let folderView: ListViewMode = storedListView(FOLDER_VIEW_KEY, "list");
let fileTab: FileTab = "all";
let search = "";
let locationFilter = "";
let typeFilter = "";
let modifiedFilter = "";
let openMenuId: string | null = null;
let selectedIds = new Set<string>();
let editingId: string | null = null;
let renamingFolderId: string | null = null;
let movingFileIds: string[] = [];
let movingFolderId: string | null = null;
let selectedFile: File | null = null;
let previewUrl: string | null = null;

root.innerHTML = `
  <div class="docs-page">
    <div class="docs-toolbar">
      <div class="docs-view-toggle" role="group" aria-label="Page view">
        <button class="${pageView === "timeline" ? "active" : ""}" data-page-view="timeline" type="button">Timeline view</button>
        <button class="${pageView === "explorer" ? "active" : ""}" data-page-view="explorer" type="button">Explorer view</button>
      </div>
      <div class="docs-breadcrumb" id="docs-breadcrumb"></div>
    </div>
    <div class="status" id="status" hidden></div>
    <div id="docs-body"></div>
  </div>

  <input id="folder-upload-input" type="file" multiple hidden />

  <div class="modal-backdrop" id="document-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="document-form-title">
      <div class="modal-header">
        <h2 id="document-form-title">Upload file</h2>
        <button class="modal-close" id="close-document-modal" type="button" aria-label="Close">×</button>
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
              <span class="file-drop-sub" id="file-drop-sub">PDF, image, Word, or Excel · up to 4 MB</span>
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
        <button class="modal-close" id="close-folder-modal" type="button" aria-label="Close">×</button>
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
        <button class="modal-close" id="close-move-modal" type="button" aria-label="Close">×</button>
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
        <button class="modal-close" id="close-preview-modal" type="button" aria-label="Close">×</button>
      </div>
      <div class="preview-body" id="preview-body"></div>
    </div>
  </div>
`;

const modal = document.getElementById("document-modal") as HTMLDivElement;
const form = document.getElementById("document-form") as HTMLFormElement;
const fileInput = document.getElementById("document-file") as HTMLInputElement;
const folderModal = document.getElementById("folder-modal") as HTMLDivElement;
const folderForm = document.getElementById("folder-form") as HTMLFormElement;
const moveModal = document.getElementById("move-modal") as HTMLDivElement;
const moveForm = document.getElementById("move-form") as HTMLFormElement;
const previewModal = document.getElementById("preview-modal") as HTMLDivElement;
const previewBody = document.getElementById("preview-body") as HTMLElement;
const folderUploadInput = document.getElementById("folder-upload-input") as HTMLInputElement;
folderUploadInput.setAttribute("webkitdirectory", "");

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

function formatDateTable(value: unknown): string {
  const raw = String(value || "");
  const iso = raw.slice(0, 10);
  const formatted = formatDateDmY(iso);
  return formatted === "-" ? "-" : formatted.replace(/-/g, " / ");
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
  if (type.includes("csv") || type.includes("text") || /\.(txt|csv)$/i.test(filename)) {
    return "Text";
  }
  return "File";
}

function fileExt(filename: string): string {
  const match = /\.[a-z0-9]+$/i.exec(String(filename || ""));
  return match ? match[0].toLowerCase() : "";
}

function padCount(value: number): string {
  return String(value).padStart(2, "0");
}

function folderById(id: string | null): DocRow | undefined {
  return foldersCache.find((folder) => String(folder.id) === String(id || ""));
}

function childFolders(parentId: string | null): DocRow[] {
  return foldersCache
    .filter((folder) => String(folder.parent_id || "") === String(parentId || ""))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en-GB"));
}

function descendantFolderIds(rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
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

function folderPath(id: string): string {
  const names: string[] = [];
  let current: string | null = id;
  const seen = new Set<string>();
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

function folderOptions(selected = "", excludeIds: Set<string> = new Set()): string {
  const walk = (parentId: string | null, prefix: string): string =>
    childFolders(parentId)
      .filter((folder) => !excludeIds.has(String(folder.id)))
      .map((folder) => {
        const id = String(folder.id);
        return `<option value="${escapeHtml(id)}"${id === selected ? " selected" : ""}>${escapeHtml(prefix + String(folder.name))}</option>${walk(id, `${prefix}— `)}`;
      })
      .join("");
  return `<option value="">Unfiled</option>${walk(null, "")}`;
}

function propertyOptions(selected = ""): string {
  return `<option value="">General</option>${properties
    .map(
      (property) =>
        `<option value="${escapeHtml(property.id)}"${property.id === selected ? " selected" : ""}>${escapeHtml(property.name)}</option>`
    )
    .join("")}`;
}

function breadcrumb(): Array<{ id: string | null; name: string }> {
  const trail: Array<{ id: string | null; name: string }> = [];
  let id: string | null = currentFolderId;
  const seen = new Set<string>();
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

function setFileHint(text: string): void {
  document.getElementById("file-drop-sub")!.textContent = text;
}

function anyModalOpen(): boolean {
  return !modal.hidden || !folderModal.hidden || !moveModal.hidden || !previewModal.hidden;
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

function previewMime(mime: string, filename: string): string {
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

function canPreview(kind: string, mime: string, filename: string): boolean {
  if (kind === "PDF" || kind === "Image" || kind === "Text") {
    return true;
  }
  return mime.toLowerCase().startsWith("text/") || /\.(txt|csv)$/i.test(filename);
}

function closePreview(): void {
  previewModal.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove("modal-open");
  }
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  previewBody.innerHTML = "";
  document.getElementById("preview-title")!.textContent = "Preview";
}

async function showPreview(id: string, title: string): Promise<void> {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  document.getElementById("preview-title")!.textContent = title || "Preview";
  previewBody.innerHTML = `<p class="preview-fallback">Loading preview…</p>`;
  previewModal.hidden = false;
  document.body.classList.add("modal-open");

  const file = await apiFile(`/documents/${id}/file`);
  const mime = previewMime(file.mimeType, file.filename);
  const kind = fileKind(mime, file.filename);
  document.getElementById("preview-title")!.textContent = title || file.filename;

  if (!canPreview(kind, mime, file.filename)) {
    previewBody.innerHTML = `<p class="preview-fallback">${kind} files can’t be previewed in the browser. Use Download to save a copy.</p>`;
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

async function downloadFile(id: string): Promise<void> {
  const file = await apiFile(`/documents/${id}/file`);
  const mime = previewMime(file.mimeType, file.filename);
  const url = URL.createObjectURL(new Blob([file.blob], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openDocumentModal(title: string): void {
  document.getElementById("document-form-title")!.textContent = title;
  document.getElementById("file-label")!.textContent = editingId ? "Replace file (optional)" : "Upload a document";
  (document.getElementById("documentFolderId") as HTMLSelectElement).innerHTML = folderOptions(
    currentFolderId || ""
  );
  (document.getElementById("documentPropertyId") as HTMLSelectElement).innerHTML = propertyOptions(
    presetPropertyId
  );
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeDocumentModal(): void {
  modal.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove("modal-open");
  }
  editingId = null;
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel · up to 4 MB");
}

function openFolderModal(title: string, name = ""): void {
  document.getElementById("folder-form-title")!.textContent = title;
  (folderForm.elements.namedItem("name") as HTMLInputElement).value = name;
  folderModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeFolderModal(): void {
  folderModal.hidden = true;
  renamingFolderId = null;
  folderForm.reset();
  if (!anyModalOpen()) {
    document.body.classList.remove("modal-open");
  }
}

function openMoveModal(title: string, selected = "", excludeIds: Set<string> = new Set()): void {
  document.getElementById("move-form-title")!.textContent = title;
  (document.getElementById("moveFolderId") as HTMLSelectElement).innerHTML = folderOptions(selected, excludeIds);
  moveModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeMoveModal(): void {
  moveModal.hidden = true;
  movingFileIds = [];
  movingFolderId = null;
  if (!anyModalOpen()) {
    document.body.classList.remove("modal-open");
  }
}

function visibleFolders(): DocRow[] {
  return childFolders(currentFolderId);
}

function filesInScope(): DocRow[] {
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
  rows = rows.filter((row) =>
    matchesQuery(row, search, ["name", "original_filename", "folder_name", "property_name", "mime_type"])
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
    rows = [...rows]
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
      .slice(0, 20);
  }
  return rows;
}

function matchesModified(value: unknown, filter: string): boolean {
  const time = new Date(String(value || "")).getTime();
  if (!Number.isFinite(time)) {
    return false;
  }
  if (filter === "year") {
    return new Date(time).getFullYear() === new Date().getFullYear();
  }
  const days = Number(filter);
  return Date.now() - time <= days * 86400000;
}

function renderBreadcrumb(): void {
  const el = document.getElementById("docs-breadcrumb")!;
  el.innerHTML = breadcrumb()
    .map((item, index, all) => {
      const last = index === all.length - 1;
      if (last) {
        return `<button type="button" disabled>${escapeHtml(item.name)}</button>`;
      }
      return `<button type="button" data-crumb="${escapeHtml(item.id || "")}">${escapeHtml(item.name)}</button><span>/</span>`;
    })
    .join("");
  el.querySelectorAll<HTMLButtonElement>("[data-crumb]").forEach((button) => {
    button.addEventListener("click", () => {
      currentFolderId = button.dataset.crumb || null;
      selectedIds.clear();
      openMenuId = null;
      render();
    });
  });
}

function folderMenu(folder: DocRow): string {
  const id = String(folder.id);
  return kebabMenu(
    `folder:${id}`,
    openMenuId === `folder:${id}`,
    `<button type="button" data-folder-rename="${escapeHtml(id)}">Rename</button>
     <button type="button" data-folder-move="${escapeHtml(id)}">Move to folder</button>
     <button type="button" data-folder-delete="${escapeHtml(id)}">Delete folder</button>`
  );
}

function renderFolders(): string {
  const folders = visibleFolders();
  const count = folders.length;
  const tools = `${viewToggleHtml(folderView)}<button class="plus-btn" id="add-folder-btn" type="button" aria-label="New folder">+</button>`;
  const body = !folders.length
    ? `<p class="docs-empty">No folders here yet. Use + to create one.</p>`
    : folderView === "list"
      ? `<div class="folder-list">${folders
          .map(
            (folder) => `<article class="folder-row" data-open-folder="${escapeHtml(String(folder.id))}">
              ${FOLDER_GLYPH}
              <div><strong>${escapeHtml(String(folder.name))}</strong><div><span>${padCount(Number(folder.file_count || 0))} Files | ${padCount(Number(folder.folder_count || 0))} Folders</span></div></div>
              ${folderMenu(folder)}
            </article>`
          )
          .join("")}</div>`
      : `<div class="folder-grid">${folders
          .map(
            (folder) => `<article class="folder-card" data-open-folder="${escapeHtml(String(folder.id))}">
              ${folderMenu(folder)}
              ${FOLDER_GLYPH}
              <strong>${escapeHtml(String(folder.name))}</strong>
              <span>${padCount(Number(folder.file_count || 0))} Files | ${padCount(Number(folder.folder_count || 0))} Folders</span>
            </article>`
          )
          .join("")}</div>`;

  return `<section class="docs-section">
    <div class="docs-section-head">
      <div>
        <h2>Your folders | ${count} Folder${count === 1 ? "" : "s"}</h2>
        <p>Click on a folder to view the files / subfolders inside.</p>
      </div>
      <div class="docs-section-tools">${tools}</div>
    </div>
    ${body}
  </section>`;
}

function fileActions(row: DocRow): string {
  const id = String(row.id);
  return `<button type="button" data-download="${escapeHtml(id)}">Download document</button>
    <button type="button" data-delete="${escapeHtml(id)}">Delete document</button>
    <button type="button" data-replace="${escapeHtml(id)}">Replace document</button>
    <button type="button" data-move="${escapeHtml(id)}">Move to folder</button>
    <button type="button" data-preview="${escapeHtml(id)}">Preview document</button>`;
}

function renderFileTable(rows: DocRow[], includeFolders = false): string {
  const folders = includeFolders ? visibleFolders() : [];
  if (!rows.length && !folders.length) {
    return `<p class="docs-empty">No files yet. Use Upload file to add one.</p>`;
  }
  const folderRows = folders
    .map((folder) => {
      const id = String(folder.id);
      return `<tr>
        <td class="col-check"></td>
        <td><button class="docs-file-name" type="button" data-open-folder="${escapeHtml(id)}">${escapeHtml(String(folder.name))}</button></td>
        <td>${currentFolderId ? escapeHtml(String(folderById(currentFolderId)?.name || "Folder")) : "Documents"}</td>
        <td>Folder</td>
        <td>${formatDateTable(folder.updated_at || folder.created_at)}</td>
        <td class="col-actions">${folderMenu(folder)}</td>
      </tr>`;
    })
    .join("");
  const fileRows = rows
    .map((row) => {
      const id = String(row.id);
      const ext = fileExt(String(row.original_filename || "")) || fileKind(String(row.mime_type || ""), String(row.original_filename || ""));
      const folderName = String(row.folder_name || "Unfiled");
      const folderId = String(row.folder_id || "");
      return `<tr>
        <td class="col-check"><input type="checkbox" data-select="${escapeHtml(id)}"${selectedIds.has(id) ? " checked" : ""} /></td>
        <td><button class="docs-file-name" type="button" data-preview="${escapeHtml(id)}">${escapeHtml(String(row.name || "File"))}</button></td>
        <td>${
          folderId
            ? `<button class="docs-link" type="button" data-open-folder="${escapeHtml(folderId)}">${escapeHtml(folderName)}</button>`
            : "Unfiled"
        }</td>
        <td>${escapeHtml(ext)}</td>
        <td>${formatDateTable(row.updated_at || row.created_at)}</td>
        <td class="col-actions">${kebabMenu(`file:${id}`, openMenuId === `file:${id}`, fileActions(row))}</td>
      </tr>`;
    })
    .join("");

  return `<div class="docs-table-wrap"><table class="docs-table">
    <thead>
      <tr>
        <th class="col-check"><input type="checkbox" id="select-all"${rows.length && rows.every((row) => selectedIds.has(String(row.id))) ? " checked" : ""} /></th>
        <th>File name</th>
        <th>Location (Folder)</th>
        <th>File type</th>
        <th>Modified</th>
        <th class="col-actions">Action</th>
      </tr>
    </thead>
    <tbody>${folderRows}${fileRows}</tbody>
  </table></div>`;
}

function renderFiles(): string {
  const rows = filesInScope();
  const allCount = currentFolderId
    ? filesCache.filter((row) => String(row.folder_id || "") === currentFolderId).length
    : filesCache.length;
  const locationSelect = currentFolderId
    ? ""
    : `<label class="sr-only" for="filter-location">Location</label>
        <select id="filter-location">
          <option value="">Location</option>
          <option value="unfiled"${locationFilter === "unfiled" ? " selected" : ""}>Unfiled</option>
          ${foldersCache
            .map((folder) => {
              const id = String(folder.id);
              return `<option value="${escapeHtml(id)}"${locationFilter === id ? " selected" : ""}>${escapeHtml(folderPath(id))}</option>`;
            })
            .join("")}
        </select>`;

  const bulk = selectedIds.size
    ? `<div class="docs-bulk">
        ${selectedIds.size} selected
        <button class="btn secondary" id="bulk-move" type="button">Move to folder</button>
        <button class="btn danger" id="bulk-delete" type="button">Delete</button>
        <button class="btn ghost" id="bulk-clear" type="button">Clear</button>
      </div>`
    : "";

  return `<section class="docs-section">
    <div class="docs-section-head">
      <div>
        <h2>Your files | ${allCount} File${allCount === 1 ? "" : "s"}</h2>
        <p>Click on a file to preview the file.</p>
      </div>
      <div class="docs-section-tools"><button class="plus-btn" id="add-file-btn" type="button" aria-label="Upload file">+</button></div>
    </div>
    <div class="docs-file-toolbar">
      <div class="docs-filters">
        ${locationSelect}
        <label class="sr-only" for="filter-type">File type</label>
        <select id="filter-type">
          <option value="">File type</option>
          ${["PDF", "Image", "Word", "Excel", "Text"]
            .map((kind) => `<option${typeFilter === kind ? " selected" : ""}>${kind}</option>`)
            .join("")}
        </select>
        <label class="sr-only" for="filter-modified">Modified</label>
        <select id="filter-modified">
          <option value="">Modified</option>
          <option value="7"${modifiedFilter === "7" ? " selected" : ""}>Last 7 days</option>
          <option value="30"${modifiedFilter === "30" ? " selected" : ""}>Last 30 days</option>
          <option value="90"${modifiedFilter === "90" ? " selected" : ""}>Last 90 days</option>
          <option value="year"${modifiedFilter === "year" ? " selected" : ""}>This year</option>
        </select>
      </div>
      ${searchFieldHtml("docs-search")}
    </div>
    <div class="docs-tabs">
      <button class="docs-tab${fileTab === "all" ? " active" : ""}" data-file-tab="all" type="button">All files</button>
      <button class="docs-tab${fileTab === "mixed" ? " active" : ""}" data-file-tab="mixed" type="button">Files and folders</button>
      <button class="docs-tab${fileTab === "important" ? " active" : ""}" data-file-tab="important" type="button">Important</button>
      <button class="docs-tab${fileTab === "recent" ? " active" : ""}" data-file-tab="recent" type="button">Recent</button>
    </div>
    ${bulk}
    ${renderFileTable(rows, fileTab === "mixed")}
  </section>`;
}

function monthLabel(value: unknown): string {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function renderTimeline(): string {
  const rows = [...filesInScope()].sort((a, b) =>
    String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
  );
  if (!rows.length) {
    return `<section class="docs-section"><p class="docs-empty">No files to show on the timeline.</p></section>`;
  }
  const groups = new Map<string, DocRow[]>();
  for (const row of rows) {
    const key = monthLabel(row.updated_at || row.created_at);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return `<section class="docs-section"><div class="docs-timeline">${[...groups.entries()]
    .map(
      ([label, items]) => `<div class="docs-timeline-group">
        <h3>${escapeHtml(label)}</h3>
        ${renderFileTable(items)}
      </div>`
    )
    .join("")}</div></section>`;
}

function bindPage(): void {
  const body = document.getElementById("docs-body")!;
  bindRowMenus(
    body,
    openMenuId,
    (id) => {
      openMenuId = id;
    },
    render
  );

  body.querySelectorAll<HTMLElement>("[data-open-folder]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest(".row-menu")) {
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
    setFileHint("PDF, image, Word, or Excel · up to 4 MB");
    openDocumentModal("Upload file");
  });

  body.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      folderView = button.dataset.viewMode === "list" ? "list" : "grid";
      sessionStorage.setItem(FOLDER_VIEW_KEY, folderView);
      render();
    });
  });

  body.querySelectorAll<HTMLButtonElement>("[data-file-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      fileTab = button.dataset.fileTab as FileTab;
      openMenuId = null;
      render();
    });
  });

  document.getElementById("docs-search")?.addEventListener("input", (event) => {
    search = (event.target as HTMLInputElement).value;
    render();
  });
  const searchInput = document.getElementById("docs-search") as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = search;
  }
  document.getElementById("filter-location")?.addEventListener("change", (event) => {
    locationFilter = (event.target as HTMLSelectElement).value;
    render();
  });
  document.getElementById("filter-type")?.addEventListener("change", (event) => {
    typeFilter = (event.target as HTMLSelectElement).value;
    render();
  });
  document.getElementById("filter-modified")?.addEventListener("change", (event) => {
    modifiedFilter = (event.target as HTMLSelectElement).value;
    render();
  });

  document.getElementById("select-all")?.addEventListener("change", (event) => {
    const checked = (event.target as HTMLInputElement).checked;
    for (const row of filesInScope()) {
      if (checked) {
        selectedIds.add(String(row.id));
      } else {
        selectedIds.delete(String(row.id));
      }
    }
    render();
  });
  body.querySelectorAll<HTMLInputElement>("[data-select]").forEach((input) => {
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

  body.querySelectorAll<HTMLButtonElement>("[data-preview]").forEach((button) => {
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
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
  body.querySelectorAll<HTMLButtonElement>("[data-download]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await downloadFile(String(button.dataset.download));
      } catch (error) {
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
  body.querySelectorAll<HTMLButtonElement>("[data-replace]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = filesCache.find((item) => String(item.id) === String(button.dataset.replace));
      if (!row) {
        return;
      }
      fillDocumentForm(row);
    });
  });
  body.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = filesCache.find((item) => String(item.id) === String(button.dataset.move));
      movingFileIds = [String(button.dataset.move)];
      movingFolderId = null;
      openMoveModal("Move to folder", String(row?.folder_id || ""));
    });
  });
  body.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      void deleteFiles([String(button.dataset.delete)]);
    });
  });
  body.querySelectorAll<HTMLButtonElement>("[data-folder-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      const folder = folderById(String(button.dataset.folderRename));
      renamingFolderId = String(button.dataset.folderRename);
      openFolderModal("Rename folder", String(folder?.name || ""));
    });
  });
  body.querySelectorAll<HTMLButtonElement>("[data-folder-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = String(button.dataset.folderMove);
      const folder = folderById(id);
      movingFolderId = id;
      movingFileIds = [];
      openMoveModal("Move folder", String(folder?.parent_id || ""), descendantFolderIds(id));
    });
  });
  body.querySelectorAll<HTMLButtonElement>("[data-folder-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = String(button.dataset.folderDelete);
      const folder = folderById(id);
      if (!window.confirm(`Delete “${String(folder?.name || "this folder")}” and everything inside it?`)) {
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
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
}

function render(): void {
  renderBreadcrumb();
  document.querySelectorAll<HTMLButtonElement>("[data-page-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.pageView === pageView);
  });
  const body = document.getElementById("docs-body")!;
  body.innerHTML = pageView === "timeline" ? renderTimeline() : `${renderFolders()}${renderFiles()}`;
  bindPage();
}

function fillDocumentForm(row: DocRow): void {
  editingId = String(row.id);
  selectedFile = null;
  fileInput.value = "";
  (form.elements.namedItem("name") as HTMLInputElement).value = String(row.name || "");
  openDocumentModal("Replace document");
  (form.elements.namedItem("folderId") as HTMLSelectElement).value = String(row.folder_id || "");
  (form.elements.namedItem("propertyId") as HTMLSelectElement).value = String(row.property_id || "");
  (form.elements.namedItem("important") as HTMLInputElement).checked = Boolean(row.important);
  (form.elements.namedItem("validFrom") as HTMLInputElement).value = String(row.valid_from || "").slice(0, 10);
  (form.elements.namedItem("validUntil") as HTMLInputElement).value = String(row.valid_until || "").slice(0, 10);
  setFileHint(String(row.original_filename || "Current file will be kept unless you choose another."));
}

async function deleteFiles(ids: string[]): Promise<void> {
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
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
}

async function load(): Promise<void> {
  const [folderData, fileData] = await Promise.all([
    api<{ folders: DocRow[] }>("/folders"),
    api<{ documents: DocRow[] }>(`/documents${qs({ propertyId: presetPropertyId })}`)
  ]);
  foldersCache = folderData.folders;
  filesCache = fileData.documents;
  render();
}

async function loadProperties(): Promise<void> {
  const data = await api<{ properties: Array<{ id: string; name: string }> }>(
    `/properties${qs({ status: "active" })}`
  );
  properties = data.properties;
}

async function ensureFolderPath(parts: string[], rootParentId: string | null): Promise<string | null> {
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
    const created = await api<{ folder: { id: string } }>("/folders", {
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
  const validFrom = String(formData.get("validFrom") || "") || null;
  const validUntil = String(formData.get("validUntil") || "") || null;
  if (validFrom && validUntil && validFrom > validUntil) {
    setStatus(document.getElementById("status"), "Valid from must be on or before valid to.", "error");
    return;
  }
  const payload: Record<string, unknown> = {
    name: String(formData.get("name") || "").trim(),
    folderId: String(formData.get("folderId") || "") || null,
    propertyId: String(formData.get("propertyId") || "") || null,
    important: (form.elements.namedItem("important") as HTMLInputElement).checked,
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
    setStatus(document.getElementById("status"), (error as Error).message, "error");
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
    setStatus(document.getElementById("status"), (error as Error).message, "error");
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
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

folderUploadInput.addEventListener("change", async () => {
  const files = [...(folderUploadInput.files || [])];
  folderUploadInput.value = "";
  if (!files.length) {
    return;
  }
  const rootName = files[0]!.webkitRelativePath.split("/")[0] || "Uploaded folder";
  try {
    setStatus(document.getElementById("status"), `Uploading folder “${rootName}”…`);
    const created = await api<{ folder: { id: string } }>("/folders", {
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
        setStatus(document.getElementById("status"), `Uploading ${uploaded} of ${files.length}…`);
      } catch {
        /* skip files the API rejects */
      }
    }
    setStatus(document.getElementById("status"), `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} into ${rootName}.`, "success");
    await load();
  } catch (error) {
    setStatus(document.getElementById("status"), (error as Error).message, "error");
  }
});

document.getElementById("upload-file-btn")?.addEventListener("click", () => {
  editingId = null;
  selectedFile = null;
  form.reset();
  fileInput.value = "";
  setFileHint("PDF, image, Word, or Excel · up to 4 MB");
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
document.querySelectorAll<HTMLButtonElement>("[data-page-view]").forEach((button) => {
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
