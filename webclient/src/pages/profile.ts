import { api, getUser, money, setSession, type AuthUser } from "../lib.js";
import { mountShell, setStatus } from "../shell.js";

const user = getUser()!;

const root = mountShell("/profile", "Profile", "Account details");

root.innerHTML = `
  <section class="panel account-panel">
    <div class="profile-overview" id="profile-overview">
      <div class="profile-overview-item"><span>Active</span><strong>—</strong></div>
      <div class="profile-overview-item"><span>Properties</span><strong>—</strong></div>
      <div class="profile-overview-item"><span>Portfolio</span><strong>—</strong></div>
    </div>
    <form id="profile-form" class="stack settings-fields">
      <div class="field"><label for="profile-name">Name</label><input id="profile-name" name="name" value="${user.name}" required /></div>
      <div class="field"><label for="profile-email">Email</label><input id="profile-email" value="${user.email}" disabled /></div>
      <div class="account-actions">
        <button class="btn" type="submit">Save profile</button>
        <div class="status" id="profile-status" hidden></div>
      </div>
    </form>
  </section>
  <section class="panel account-panel">
    <h2>Change password</h2>
    <form id="password-form" class="stack settings-fields">
      <div class="field"><label>Current password</label><input name="currentPassword" type="password" required /></div>
      <div class="field"><label>New password</label><input name="newPassword" type="password" minlength="6" required /></div>
      <div class="account-actions">
        <button class="btn secondary" type="submit">Update password</button>
        <div class="status" id="password-status" hidden></div>
      </div>
    </form>
  </section>
`;

const profileStatus = document.getElementById("profile-status") as HTMLDivElement;
const passwordStatus = document.getElementById("password-status") as HTMLDivElement;

async function loadProfile(): Promise<void> {
  try {
    const data = await api<{
      user: AuthUser;
      overview: { activeProperties: number; totalProperties: number; portfolioValue: number };
    }>("/profile");
    setSession(localStorage.getItem("authToken") || "", data.user);
    const nameInput = document.getElementById("profile-name") as HTMLInputElement;
    const emailInput = document.getElementById("profile-email") as HTMLInputElement;
    nameInput.value = data.user.name;
    emailInput.value = data.user.email;
    const nameEl = document.querySelector(".sidebar-profile-name");
    if (nameEl) {
      nameEl.textContent = data.user.name;
    }
    document.getElementById("profile-overview")!.innerHTML = `
      <div class="profile-overview-item"><span>Active</span><strong>${data.overview.activeProperties}</strong></div>
      <div class="profile-overview-item"><span>Properties</span><strong>${data.overview.totalProperties}</strong></div>
      <div class="profile-overview-item"><span>Portfolio</span><strong>${money(data.overview.portfolioValue, data.user.preferredCurrency)}</strong></div>
    `;
  } catch (error) {
    setStatus(profileStatus, (error as Error).message, "error");
  }
}

document.getElementById("profile-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);
  try {
    const result = await api<{ user: AuthUser; message: string }>("/profile", {
      method: "PATCH",
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim()
      })
    });
    setSession(localStorage.getItem("authToken") || "", result.user);
    const nameEl = document.querySelector(".sidebar-profile-name");
    if (nameEl) {
      nameEl.textContent = result.user.name;
    }
    setStatus(profileStatus, result.message, "success");
  } catch (error) {
    setStatus(profileStatus, (error as Error).message, "error");
  }
});

document.getElementById("password-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);
  try {
    const result = await api<{ message: string }>("/profile/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: String(formData.get("currentPassword") || ""),
        newPassword: String(formData.get("newPassword") || "")
      })
    });
    form.reset();
    setStatus(passwordStatus, result.message, "success");
  } catch (error) {
    setStatus(passwordStatus, (error as Error).message, "error");
  }
});

void loadProfile();
