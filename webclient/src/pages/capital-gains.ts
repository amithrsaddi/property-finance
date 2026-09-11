import { api, getUser, money, qs } from "../lib.js";
import { escapeHtml } from "../list-view.js";
import { mountShell } from "../shell.js";

/** UK residential property CGT for the 2026/27 tax year (GOV.UK). */
const TAX_YEAR = "2026/27";
const ANNUAL_EXEMPT_AMOUNT = 3000;
const BASIC_RATE_BAND = 37700;
const BASIC_RATE = 0.18;
const HIGHER_RATE = 0.24;
const PRR_FINAL_MONTHS = 9;

type PropertyOption = {
  id: string;
  name: string;
  purchasePrice: number | null;
  purchaseDate: string | null;
  currentValue: number | null;
  ownershipPercentage: number;
  status: string;
};

type PrrMode = "months" | "period";

type CgtInputs = {
  salePrice: number;
  purchasePrice: number;
  buyingCosts: number;
  sellingCosts: number;
  improvements: number;
  ownershipShare: number;
  purchaseDate: string;
  saleDate: string;
  prr: boolean;
  occupiedMonths: number;
  occupiedFrom: string;
  occupiedTo: string;
  prrMode: PrrMode;
  taxableIncome: number;
  unusedAllowance: number;
  losses: number;
};

type CgtResult = {
  saleProceeds: number;
  baseCost: number;
  grossGain: number;
  yourGain: number;
  ownershipMonths: number;
  qualifyingMonths: number;
  prrAmount: number;
  afterPrr: number;
  lossesApplied: number;
  chargeable: number;
  allowanceApplied: number;
  taxableGain: number;
  remainingBasicBand: number;
  taxedAtBasic: number;
  taxedAtHigher: number;
  taxBasic: number;
  taxHigher: number;
  tax: number;
  isLoss: boolean;
  unusedLosses: number;
};

type PropertyListResponse = { properties?: PropertyOption[] };

const user = getUser()!;
const currencyMark = (() => {
  try {
    const part = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: user.preferredCurrency
    })
      .formatToParts(0)
      .find((item) => item.type === "currency");
    return part?.value || user.preferredCurrency;
  } catch {
    return user.preferredCurrency;
  }
})();

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = new Date();
const DEFAULTS = {
  sale: "350000",
  purchase: "250000",
  buying: "4000",
  selling: "5000",
  improvements: "0",
  share: "100",
  purchaseDate: isoDate(new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())),
  saleDate: isoDate(today),
  occupied: "0",
  income: "20000",
  allowance: String(ANNUAL_EXEMPT_AMOUNT),
  losses: "0"
};

const root = mountShell(
  "/capital-gains",
  "Capital Gains Calculator",
  `UK residential property · ${TAX_YEAR}`
);

root.innerHTML = `
  <section class="cgt-page">
    <div class="cgt-layout">
      <div class="cgt-form">
        <div class="cgt-form-head">
          <div class="field">
            <label for="cgt-property">Property</label>
            <select id="cgt-property">
              <option value="">None</option>
            </select>
          </div>
          <button class="btn ghost" id="cgt-reset" type="button">Reset</button>
        </div>
        <div class="cgt-grid">
          <label class="calc-input">
            <span>Sale price</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-sale" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.sale}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Purchase price</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-purchase" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.purchase}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Purchase date</span>
            <span class="calc-input-box">
              <input id="cgt-purchase-date" type="date" value="${DEFAULTS.purchaseDate}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Sale date</span>
            <span class="calc-input-box">
              <input id="cgt-sale-date" type="date" value="${DEFAULTS.saleDate}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Buying costs</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-buying" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.buying}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Selling costs</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-selling" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.selling}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Improvements</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-improvements" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.improvements}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Your share</span>
            <span class="calc-input-box">
              <input id="cgt-share" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${DEFAULTS.share}" />
              <span class="calc-affix is-suffix">%</span>
            </span>
          </label>
        </div>
        <div class="cgt-block">
          <span>Private Residence Relief</span>
          <div class="cgt-seg" role="group" aria-label="Private Residence Relief">
            <button class="cgt-seg-btn active" data-prr="no" type="button">None</button>
            <button class="cgt-seg-btn" data-prr="yes" type="button">Part main home</button>
          </div>
          <div id="cgt-prr-details" hidden>
            <div class="cgt-seg" role="group" aria-label="Main home period">
              <button class="cgt-seg-btn active" data-prr-mode="months" type="button">Months</button>
              <button class="cgt-seg-btn" data-prr-mode="period" type="button">Dates</button>
            </div>
            <label class="calc-input" id="cgt-occupied-wrap">
              <span>Months as your main home</span>
              <span class="calc-input-box">
                <input id="cgt-occupied" type="number" min="0" step="1" inputmode="numeric" value="${DEFAULTS.occupied}" />
                <span class="calc-affix is-suffix">months</span>
              </span>
            </label>
            <div class="cgt-period" id="cgt-period-wrap" hidden>
              <div class="cgt-grid">
                <label class="calc-input">
                  <span>From</span>
                  <span class="calc-input-box">
                    <input id="cgt-occupied-from" type="date" />
                  </span>
                </label>
                <label class="calc-input">
                  <span>To</span>
                  <span class="calc-input-box">
                    <input id="cgt-occupied-to" type="date" />
                  </span>
                </label>
              </div>
              <small class="calc-hint" id="cgt-period-hint"></small>
            </div>
          </div>
        </div>
        <div class="cgt-grid">
          <label class="calc-input">
            <span>Taxable income</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-income" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.income}" />
            </span>
          </label>
          <label class="calc-input">
            <span>Unused allowance</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-allowance" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.allowance}" />
            </span>
          </label>
          <label class="calc-input cgt-span">
            <span>Allowable losses</span>
            <span class="calc-input-box">
              <span class="calc-affix">${escapeHtml(currencyMark)}</span>
              <input id="cgt-losses" type="number" min="0" step="0.01" inputmode="decimal" value="${DEFAULTS.losses}" />
            </span>
          </label>
        </div>
      </div>
      <aside class="cgt-result" id="cgt-output" aria-live="polite"></aside>
    </div>
  </section>
`;

const saleInput = document.getElementById("cgt-sale") as HTMLInputElement;
const purchaseInput = document.getElementById("cgt-purchase") as HTMLInputElement;
const buyingInput = document.getElementById("cgt-buying") as HTMLInputElement;
const sellingInput = document.getElementById("cgt-selling") as HTMLInputElement;
const improvementsInput = document.getElementById("cgt-improvements") as HTMLInputElement;
const shareInput = document.getElementById("cgt-share") as HTMLInputElement;
const purchaseDateInput = document.getElementById("cgt-purchase-date") as HTMLInputElement;
const saleDateInput = document.getElementById("cgt-sale-date") as HTMLInputElement;
const occupiedInput = document.getElementById("cgt-occupied") as HTMLInputElement;
const occupiedWrap = document.getElementById("cgt-occupied-wrap") as HTMLLabelElement;
const prrDetails = document.getElementById("cgt-prr-details") as HTMLElement;
const periodWrap = document.getElementById("cgt-period-wrap") as HTMLElement;
const occupiedFromInput = document.getElementById("cgt-occupied-from") as HTMLInputElement;
const occupiedToInput = document.getElementById("cgt-occupied-to") as HTMLInputElement;
const periodHint = document.getElementById("cgt-period-hint") as HTMLElement;
const incomeInput = document.getElementById("cgt-income") as HTMLInputElement;
const allowanceInput = document.getElementById("cgt-allowance") as HTMLInputElement;
const lossesInput = document.getElementById("cgt-losses") as HTMLInputElement;
const propertySelect = document.getElementById("cgt-property") as HTMLSelectElement;
const output = document.getElementById("cgt-output")!;

let prrEnabled = false;
let prrMode: PrrMode = "months";
let properties: PropertyOption[] = [];

function gbp(value: number): string {
  return money(value, user.preferredCurrency);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyValue(input: HTMLInputElement): number {
  const value = Number(input.value);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function monthsBetween(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return 0;
  }
  return Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  );
}

function laterDate(a: string, b: string): string {
  return a && b && a > b ? a : b || a;
}

function earlierDate(a: string, b: string): string {
  return a && b && a < b ? a : b || a;
}

function occupiedMonthsFromPeriod(
  purchaseDate: string,
  saleDate: string,
  from: string,
  to: string
): number {
  if (!purchaseDate || !saleDate || !from || !to) {
    return 0;
  }
  const overlapFrom = laterDate(from, purchaseDate);
  const overlapTo = earlierDate(to, saleDate);
  return monthsBetween(overlapFrom, overlapTo);
}

function calculateCgt(input: CgtInputs): CgtResult | null {
  if (input.salePrice <= 0 && input.purchasePrice <= 0) {
    return null;
  }

  const saleProceeds = roundMoney(Math.max(0, input.salePrice - input.sellingCosts));
  const baseCost = roundMoney(
    Math.max(0, input.purchasePrice + input.buyingCosts + input.improvements)
  );
  const grossGain = roundMoney(saleProceeds - baseCost);
  const share = Math.min(100, Math.max(0, input.ownershipShare)) / 100;
  const yourGain = roundMoney(grossGain * share);
  const ownershipMonths = monthsBetween(input.purchaseDate, input.saleDate);
  let qualifyingMonths = 0;
  let prrAmount = 0;

  if (input.prr && yourGain > 0 && ownershipMonths > 0) {
    const occupied = Math.max(0, Math.round(input.occupiedMonths));
    const leftover = Math.max(0, ownershipMonths - occupied);
    qualifyingMonths = Math.min(ownershipMonths, occupied + Math.min(PRR_FINAL_MONTHS, leftover));
    prrAmount = roundMoney(yourGain * (qualifyingMonths / ownershipMonths));
  }

  const afterPrr = roundMoney(yourGain - prrAmount);
  const isLoss = afterPrr < 0;
  const lossesApplied = isLoss ? 0 : roundMoney(Math.min(Math.max(0, input.losses), Math.max(0, afterPrr)));
  const unusedLosses = roundMoney(Math.max(0, input.losses - lossesApplied));
  const chargeable = isLoss ? afterPrr : roundMoney(Math.max(0, afterPrr - lossesApplied));
  const unusedAllowance = Math.max(0, input.unusedAllowance);
  const allowanceApplied = isLoss ? 0 : roundMoney(Math.min(Math.max(0, chargeable), unusedAllowance));
  const taxableGain = isLoss ? 0 : roundMoney(Math.max(0, chargeable - allowanceApplied));
  const remainingBasicBand = roundMoney(Math.max(0, BASIC_RATE_BAND - Math.max(0, input.taxableIncome)));
  const taxedAtBasic = roundMoney(Math.min(taxableGain, remainingBasicBand));
  const taxedAtHigher = roundMoney(Math.max(0, taxableGain - taxedAtBasic));
  const taxBasic = roundMoney(taxedAtBasic * BASIC_RATE);
  const taxHigher = roundMoney(taxedAtHigher * HIGHER_RATE);
  const tax = roundMoney(taxBasic + taxHigher);

  return {
    saleProceeds,
    baseCost,
    grossGain,
    yourGain,
    ownershipMonths,
    qualifyingMonths,
    prrAmount,
    afterPrr,
    lossesApplied,
    chargeable,
    allowanceApplied,
    taxableGain,
    remainingBasicBand,
    taxedAtBasic,
    taxedAtHigher,
    taxBasic,
    taxHigher,
    tax,
    isLoss,
    unusedLosses
  };
}

function readInputs(): CgtInputs {
  const purchaseDate = purchaseDateInput.value;
  const saleDate = saleDateInput.value;
  const occupiedFrom = occupiedFromInput.value;
  const occupiedTo = occupiedToInput.value;
  const occupiedMonths =
    prrMode === "period"
      ? occupiedMonthsFromPeriod(purchaseDate, saleDate, occupiedFrom, occupiedTo)
      : moneyValue(occupiedInput);
  return {
    salePrice: moneyValue(saleInput),
    purchasePrice: moneyValue(purchaseInput),
    buyingCosts: moneyValue(buyingInput),
    sellingCosts: moneyValue(sellingInput),
    improvements: moneyValue(improvementsInput),
    ownershipShare: moneyValue(shareInput),
    purchaseDate,
    saleDate,
    prr: prrEnabled,
    occupiedMonths,
    occupiedFrom,
    occupiedTo,
    prrMode,
    taxableIncome: moneyValue(incomeInput),
    unusedAllowance: moneyValue(allowanceInput),
    losses: moneyValue(lossesInput)
  };
}

function syncPeriodBounds(): void {
  const purchase = purchaseDateInput.value;
  const sale = saleDateInput.value;
  for (const input of [occupiedFromInput, occupiedToInput]) {
    input.min = purchase;
    input.max = sale;
  }
  if (occupiedFromInput.value && purchase && occupiedFromInput.value < purchase) {
    occupiedFromInput.value = purchase;
  }
  if (occupiedFromInput.value && sale && occupiedFromInput.value > sale) {
    occupiedFromInput.value = sale;
  }
  if (occupiedToInput.value && purchase && occupiedToInput.value < purchase) {
    occupiedToInput.value = purchase;
  }
  if (occupiedToInput.value && sale && occupiedToInput.value > sale) {
    occupiedToInput.value = sale;
  }
}

function updatePeriodHint(): void {
  if (!prrEnabled || prrMode !== "period") {
    return;
  }
  const months = occupiedMonthsFromPeriod(
    purchaseDateInput.value,
    saleDateInput.value,
    occupiedFromInput.value,
    occupiedToInput.value
  );
  if (!occupiedFromInput.value || !occupiedToInput.value) {
    periodHint.textContent = "";
    return;
  }
  if (!months) {
    periodHint.textContent = "Those dates do not overlap the time you owned the property.";
    return;
  }
  periodHint.textContent = `${months} month${months === 1 ? "" : "s"} as main home`;
}

function ensurePeriodDefaults(): void {
  if (!occupiedFromInput.value && purchaseDateInput.value) {
    occupiedFromInput.value = purchaseDateInput.value;
  }
}

function syncPrrUi(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-prr]").forEach((button) => {
    const on = button.dataset.prr === "yes";
    button.classList.toggle("active", on === prrEnabled);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-prr-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.prrMode === prrMode);
  });
  prrDetails.hidden = !prrEnabled;
  occupiedWrap.hidden = !prrEnabled || prrMode !== "months";
  periodWrap.hidden = !prrEnabled || prrMode !== "period";
  if (prrEnabled && prrMode === "period") {
    ensurePeriodDefaults();
    syncPeriodBounds();
    updatePeriodHint();
  }
}

function heroCopy(result: CgtResult): { kicker: string; amount: string; sub: string } {
  if (result.isLoss) {
    return {
      kicker: "Estimated CGT",
      amount: gbp(0),
      sub: `Allowable loss of ${gbp(Math.abs(result.afterPrr))} · no tax due`
    };
  }
  if (result.taxableGain <= 0) {
    return {
      kicker: "Estimated CGT",
      amount: gbp(0),
      sub:
        result.yourGain <= 0
          ? "No chargeable gain on this disposal"
          : "Covered by reliefs and the annual allowance"
    };
  }
  const parts = [];
  if (result.taxedAtBasic > 0) {
    parts.push(`${BASIC_RATE * 100}% on ${gbp(result.taxedAtBasic)}`);
  }
  if (result.taxedAtHigher > 0) {
    parts.push(`${HIGHER_RATE * 100}% on ${gbp(result.taxedAtHigher)}`);
  }
  return {
    kicker: "Estimated CGT",
    amount: gbp(result.tax),
    sub: parts.join(" · ") || "No tax due"
  };
}

function renderResults(): void {
  const input = readInputs();
  const result = calculateCgt(input);
  if (!result) {
    output.innerHTML = `<div class="cgt-empty">Enter a sale and purchase price to estimate CGT.</div>`;
    return;
  }

  const hero = heroCopy(result);
  output.innerHTML = `
    <p class="cgt-kicker">${escapeHtml(hero.kicker)}</p>
    <p class="cgt-amount">${escapeHtml(hero.amount)}</p>
    <p class="cgt-sub">${escapeHtml(hero.sub)}</p>
    <dl class="cgt-metrics">
      <div><dt>Gross gain</dt><dd>${gbp(result.grossGain)}</dd></div>
      ${
        input.prr
          ? `<div><dt>Private Residence Relief</dt><dd>${gbp(result.prrAmount)}</dd></div>`
          : ""
      }
      ${
        result.lossesApplied > 0
          ? `<div><dt>Losses</dt><dd>${gbp(result.lossesApplied)}</dd></div>`
          : ""
      }
      <div><dt>Allowance used</dt><dd>${gbp(result.allowanceApplied)}</dd></div>
      <div><dt>Taxable gain</dt><dd>${gbp(result.taxableGain)}</dd></div>
    </dl>
    <p class="cgt-fineprint">Estimate only. Report and pay within 60 days of completion if CGT is due.</p>
  `;
}

function applyProperty(id: string): void {
  const row = properties.find((item) => item.id === id);
  if (!row) {
    return;
  }
  const sale = roundMoney(Number(row.currentValue || 0));
  const purchase = roundMoney(Number(row.purchasePrice || 0));
  if (sale) {
    saleInput.value = String(sale);
  }
  if (purchase) {
    purchaseInput.value = String(purchase);
  }
  const share = Number(row.ownershipPercentage);
  shareInput.value = Number.isFinite(share) ? String(share) : "100";
  if (row.purchaseDate) {
    purchaseDateInput.value = String(row.purchaseDate).slice(0, 10);
  }
  syncPeriodBounds();
  renderResults();
}

function resetForm(): void {
  propertySelect.value = "";
  saleInput.value = DEFAULTS.sale;
  purchaseInput.value = DEFAULTS.purchase;
  buyingInput.value = DEFAULTS.buying;
  sellingInput.value = DEFAULTS.selling;
  improvementsInput.value = DEFAULTS.improvements;
  shareInput.value = DEFAULTS.share;
  purchaseDateInput.value = DEFAULTS.purchaseDate;
  saleDateInput.value = DEFAULTS.saleDate;
  occupiedInput.value = DEFAULTS.occupied;
  occupiedFromInput.value = "";
  occupiedToInput.value = "";
  incomeInput.value = DEFAULTS.income;
  allowanceInput.value = DEFAULTS.allowance;
  lossesInput.value = DEFAULTS.losses;
  prrEnabled = false;
  prrMode = "months";
  syncPrrUi();
  renderResults();
}

const moneyInputs = [
  saleInput,
  purchaseInput,
  buyingInput,
  sellingInput,
  improvementsInput,
  shareInput,
  occupiedInput,
  incomeInput,
  allowanceInput,
  lossesInput
];

for (const input of moneyInputs) {
  input.addEventListener("input", renderResults);
  input.addEventListener("blur", () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }
    if (input === occupiedInput) {
      input.value = String(Math.max(0, Math.round(value)));
      return;
    }
    input.value = String(roundMoney(Math.max(0, value)));
  });
}

for (const input of [purchaseDateInput, saleDateInput, occupiedFromInput, occupiedToInput]) {
  input.addEventListener("input", () => {
    if (input === purchaseDateInput || input === saleDateInput) {
      syncPeriodBounds();
    }
    updatePeriodHint();
    renderResults();
  });
  input.addEventListener("change", () => {
    if (input === purchaseDateInput || input === saleDateInput) {
      syncPeriodBounds();
    }
    updatePeriodHint();
    renderResults();
  });
}

document.querySelectorAll<HTMLButtonElement>("[data-prr]").forEach((button) => {
  button.addEventListener("click", () => {
    prrEnabled = button.dataset.prr === "yes";
    syncPrrUi();
    renderResults();
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-prr-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    prrMode = button.dataset.prrMode === "period" ? "period" : "months";
    syncPrrUi();
    renderResults();
  });
});

propertySelect.addEventListener("change", () => {
  if (propertySelect.value) {
    applyProperty(propertySelect.value);
  } else {
    renderResults();
  }
});

document.getElementById("cgt-reset")?.addEventListener("click", resetForm);

async function loadProperties(): Promise<void> {
  try {
    const data = await api<PropertyListResponse>(`/properties${qs({ status: "active" })}`);
    properties = data.properties || [];
    if (!properties.length) {
      return;
    }
    propertySelect.insertAdjacentHTML(
      "beforeend",
      properties
        .map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`)
        .join("")
    );
  } catch {
    /* calculator still works without saved properties */
  }
}

syncPrrUi();
renderResults();
void loadProperties();
