import { api, getUser, money, qs, statusClass, labelize } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const root = mountShell(
  "/properties.html",
  "Properties",
  "Manage your property portfolio.",
  `<button class="btn" id="add-property-btn" type="button">Add Property</button>`
);
const user = getUser()!;
let editingId: string | null = null;

root.innerHTML = `
  <section class="panel">
    <div class="list-toolbar">
      <div class="field">
        <label for="status-filter">Show</label>
        <select id="status-filter">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>
      <div class="status" id="status" style="margin:0;min-width:12rem" hidden></div>
    </div>
    <div class="property-list" id="property-list"></div>
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
  (form.elements.namedItem("purchaseDate") as HTMLInputElement).value = String(
    property.purchaseDate || ""
  );
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

async function loadProperties(): Promise<void> {
  const status = (document.getElementById("status-filter") as HTMLSelectElement).value;
  const data = await api<{ properties: Array<Record<string, unknown>> }>(
    `/properties${qs({ status })}`
  );
  const list = document.getElementById("property-list")!;
  if (!data.properties.length) {
    list.innerHTML = `<p class="empty">No properties found. Use Add Property to create one.</p>`;
    return;
  }

  list.innerHTML = data.properties
    .map((p) => {
      return `<article class="property-row">
        <div class="property-row-main">
          <div class="property-row-title">
            <a href="/property.html?id=${p.id}">${p.name}</a>
            <span class="badge ${statusClass(String(p.status))}">${labelize(String(p.status))}</span>
          </div>
          <div class="muted">${p.address || "No address"}</div>
          <div class="property-row-meta">
            <span>${labelize(String(p.propertyType))}</span>
            <span>Rent ${money(Number(p.expectedMonthlyRent), user.preferredCurrency)}</span>
            <span>Value ${money(Number(p.currentValue || 0), user.preferredCurrency)}</span>
            <span>Ownership ${p.ownershipPercentage ?? 100}%</span>
          </div>
        </div>
        <div class="property-row-actions actions">
          <a class="btn ghost" href="/property.html?id=${p.id}">Open</a>
          <button class="btn secondary" data-edit="${p.id}" type="button">Edit</button>
          ${
            p.status === "active"
              ? `<button class="btn danger" data-archive="${p.id}" type="button">Archive</button>`
              : ""
          }
        </div>
      </article>`;
    })
    .join("");

  list.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const property = data.properties.find((p) => String(p.id) === String(button.dataset.edit));
      if (!property) {
        return;
      }
      fillForm(property);
      openModal("Edit property");
    });
  });

  list.querySelectorAll<HTMLButtonElement>("[data-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/properties/${button.dataset.archive}/archive`, { method: "POST" });
        setStatus(document.getElementById("status"), "Property archived.", "success");
        await loadProperties();
      } catch (error) {
        setStatus(document.getElementById("status"), (error as Error).message, "error");
      }
    });
  });
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
});
document.getElementById("status-filter")?.addEventListener("change", () => {
  void loadProperties();
});

void loadProperties();
