import { api } from "../lib.js";
import { setStatus } from "../shell.js";

const form = document.getElementById("reset-form") as HTMLFormElement | null;
const status = document.getElementById("auth-status") as HTMLDivElement | null;
const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

if (!token) {
  setStatus(status, "Missing reset token. Request a new password reset link.", "error");
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password !== confirm) {
    setStatus(status, "Passwords do not match.", "error");
    return;
  }
  try {
    const result = await api<{ message: string }>("/auth/reset-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ token, password })
    });
    setStatus(status, result.message, "success");
    setTimeout(() => {
      window.location.href = "/";
    }, 1200);
  } catch (error) {
    setStatus(status, (error as Error).message, "error");
  }
});
