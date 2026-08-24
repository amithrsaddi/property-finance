import { api, apiFile, setSession, type AuthUser } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const ICON_DOWNLOAD = `<svg class="backup-card-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 4v11M8 11l4 4 4-4"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5 19h14"/></svg>`;
const ICON_UPLOAD = `<svg class="backup-card-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 15V4M8 8l4-4 4 4"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5 19h14"/></svg>`;
const ICON_FILE = `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M7 3.5h7.2L19.5 9v11.5H7z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 3.5V9h5.5"/></svg>`;
const ICON_CHOOSE = `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 15V4M8 8l4-4 4 4"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5 19h14"/></svg>`;

const root = mountShell(
  "/backup",
  "Backup & Restore",
  "Export all your data to a portable JSON file, or restore from a backup into your account."
);

root.innerHTML = `
  <section class="backup-board">
    <article class="backup-card">
      ${ICON_DOWNLOAD}
      <h2>Export Backup</h2>
      <p>Download a JSON file containing your properties, rent, mortgages, expenses, documents, photos, and display settings.</p>
      <div class="backup-card-actions">
        <button class="btn backup-btn" id="backup-download" type="button">${ICON_FILE}Download Backup</button>
        <div class="status" id="backup-download-status" hidden></div>
      </div>
    </article>
    <article class="backup-card">
      ${ICON_UPLOAD}
      <h2>Restore Backup</h2>
      <p>Import a backup file into your current account. Backups are portable — you can restore a file exported from any user profile into yours.</p>
      <div class="backup-card-actions">
        <input id="backup-file" type="file" accept="application/json,.json" hidden />
        <button class="btn ghost backup-btn" id="backup-choose" type="button">${ICON_CHOOSE}Choose Backup File</button>
        <div class="status" id="backup-restore-status" hidden></div>
      </div>
    </article>
  </section>
`;

const downloadBtn = document.getElementById("backup-download") as HTMLButtonElement;
const chooseBtn = document.getElementById("backup-choose") as HTMLButtonElement;
const backupFile = document.getElementById("backup-file") as HTMLInputElement;
const downloadStatus = document.getElementById("backup-download-status") as HTMLDivElement;
const restoreStatus = document.getElementById("backup-restore-status") as HTMLDivElement;

downloadBtn.addEventListener("click", async () => {
  downloadBtn.disabled = true;
  try {
    const file = await apiFile("/backup");
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename || "property-finance-backup.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(downloadStatus, "Backup downloaded.", "success");
  } catch (error) {
    setStatus(downloadStatus, (error as Error).message, "error");
  } finally {
    downloadBtn.disabled = false;
  }
});

chooseBtn.addEventListener("click", () => {
  backupFile.click();
});

backupFile.addEventListener("change", async () => {
  const file = backupFile.files?.[0];
  backupFile.value = "";
  if (!file) {
    return;
  }
  const confirmed = window.confirm(
    "Restore replaces all properties, rent, mortgages, expenses, and documents on this account. Continue?"
  );
  if (!confirmed) {
    return;
  }
  chooseBtn.disabled = true;
  try {
    const text = await file.text();
    const payload = JSON.parse(text) as unknown;
    const result = await api<{ user: AuthUser; message: string }>("/backup/restore", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setSession(localStorage.getItem("authToken") || "", result.user);
    setStatus(restoreStatus, result.message, "success");
  } catch (error) {
    const message =
      error instanceof SyntaxError ? "That file is not valid JSON." : (error as Error).message;
    setStatus(restoreStatus, message, "error");
  } finally {
    chooseBtn.disabled = false;
  }
});
