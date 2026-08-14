import {
  api,
  currencies,
  getDecimalPrecision,
  getUser,
  money,
  setSession,
  type AuthUser
} from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const CURRENCY_NAMES: Record<string, string> = {
  GBP: "British Pound",
  EUR: "Euro",
  USD: "US Dollar",
  AUD: "Australian Dollar",
  CAD: "Canadian Dollar"
};

const user = getUser()!;

const root = mountShell(
  "/settings.html",
  "Settings",
  "Manage global app preferences for number display and currency."
);

root.innerHTML = `
  <section class="panel account-panel">
    <form id="settings-form" class="stack settings-fields">
      <div class="field">
        <label for="preferredCurrency">Currency</label>
        <select id="preferredCurrency" name="preferredCurrency">
          ${currencies()
            .map(
              (code) =>
                `<option value="${code}" ${code === user.preferredCurrency ? "selected" : ""}>${code} — ${CURRENCY_NAMES[code] || code}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="field">
        <label for="decimalPrecision">Decimal Precision</label>
        <input id="decimalPrecision" name="decimalPrecision" type="number" min="0" max="4" step="1" value="${getDecimalPrecision()}" />
        <p class="muted">Applies to amounts and totals where numeric precision is shown.</p>
      </div>
      <div class="settings-preview">Preview: <strong id="money-preview"></strong></div>
      <div class="account-actions">
        <button class="btn" type="submit">Save Settings</button>
        <div class="status" id="settings-status" hidden></div>
      </div>
    </form>
  </section>
`;

const currencySelect = document.getElementById("preferredCurrency") as HTMLSelectElement;
const precisionInput = document.getElementById("decimalPrecision") as HTMLInputElement;
const preview = document.getElementById("money-preview") as HTMLElement;
const status = document.getElementById("settings-status") as HTMLDivElement;

function updatePreview(): void {
  const precision = Number(precisionInput.value);
  preview.textContent = money(1234.5678, currencySelect.value, precision);
}

currencySelect.addEventListener("change", updatePreview);
precisionInput.addEventListener("input", updatePreview);
updatePreview();

document.getElementById("settings-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const precision = Number(precisionInput.value);
  if (!Number.isInteger(precision) || precision < 0 || precision > 4) {
    setStatus(status, "Decimal precision must be a whole number from 0 to 4.", "error");
    return;
  }
  try {
    const result = await api<{ user: AuthUser; message: string }>("/profile", {
      method: "PATCH",
      body: JSON.stringify({
        preferredCurrency: currencySelect.value,
        decimalPrecision: precision
      })
    });
    setSession(localStorage.getItem("authToken") || "", result.user);
    updatePreview();
    setStatus(status, result.message, "success");
  } catch (error) {
    setStatus(status, (error as Error).message, "error");
  }
});
