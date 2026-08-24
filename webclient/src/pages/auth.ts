import { api, clearSession, getToken, setSession, type AuthUser } from "../lib.js";
import { setStatus } from "../shell.js";

if (getToken()) {
  window.location.href = "/dashboard";
}

const panels = document.querySelectorAll<HTMLElement>(".form-panel");
const signInForm = document.getElementById("signin-form") as HTMLFormElement | null;
const registerForm = document.getElementById("register-form") as HTMLFormElement | null;
const forgotForm = document.getElementById("forgot-form") as HTMLFormElement | null;
const authStatus = document.getElementById("auth-status") as HTMLDivElement | null;

function showPanel(id: string): void {
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === id));
  if (authStatus) {
    authStatus.hidden = true;
    authStatus.textContent = "";
    authStatus.className = "status";
  }
}

document.querySelectorAll<HTMLElement>("[data-target]").forEach((el) => {
  el.addEventListener("click", () => {
    const target = el.dataset.target;
    if (target) {
      showPanel(target);
    }
  });
});

signInForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signInForm);
  try {
    const result = await api<{ message: string; token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || "")
      })
    });
    setSession(result.token, result.user);
    setStatus(authStatus, result.message, "success");
    window.location.href = "/dashboard";
  } catch (error) {
    setStatus(authStatus, (error as Error).message, "error");
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  try {
    const result = await api<{ message: string; token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || "")
      })
    });
    setSession(result.token, result.user);
    setStatus(authStatus, result.message, "success");
    window.location.href = "/dashboard";
  } catch (error) {
    setStatus(authStatus, (error as Error).message, "error");
  }
});

forgotForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(forgotForm);
  try {
    const result = await api<{ message: string; resetUrl?: string }>("/auth/forgot-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        email: String(formData.get("email") || "").trim()
      })
    });
    setStatus(
      authStatus,
      result.resetUrl ? `${result.message} Open: ${result.resetUrl}` : result.message,
      "success"
    );
  } catch (error) {
    setStatus(authStatus, (error as Error).message, "error");
  }
});

document.getElementById("clear-session")?.addEventListener("click", () => {
  clearSession();
});
