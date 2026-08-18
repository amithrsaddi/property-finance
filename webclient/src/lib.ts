declare global {
  interface Window {
    APP_CONFIG?: {
      apiBaseUrl?: string;
    };
  }
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  preferredCurrency: string;
  decimalPrecision?: number;
};

export type ThemeMode = "light" | "dark";

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";
const THEME_KEY = "pf-theme";
const CURRENCIES = ["GBP", "EUR", "USD", "AUD", "CAD"] as const;

export function currencies(): readonly string[] {
  return CURRENCIES;
}

export function apiBase(): string {
  if (window.APP_CONFIG?.apiBaseUrl) {
    return window.APP_CONFIG.apiBaseUrl;
  }
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3000";
  }
  return "/api";
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function requireSession(): AuthUser {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    clearSession();
    window.location.href = "/";
    throw new Error("Not authenticated");
  }
  return user;
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers
  });

  const data = (await response.json().catch(() => ({}))) as T & { message?: string };

  if (response.status === 401 && options.auth !== false) {
    clearSession();
    window.location.href = "/";
    throw new Error(data.message || "Session expired.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export async function apiFile(path: string): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${apiBase()}${path}`, { headers });
  if (response.status === 401) {
    clearSession();
    window.location.href = "/";
    throw new Error("Session expired.");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || "Could not download the file.");
  }
  const blob = await response.blob();
  const mimeType = response.headers.get("content-type") || blob.type || "application/octet-stream";
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]!.replace(/"/g, "")) : "document";
  return { blob, filename, mimeType };
}

export function getDecimalPrecision(): number {
  const n = Number(getUser()?.decimalPrecision);
  if (!Number.isFinite(n)) {
    return 2;
  }
  return Math.min(4, Math.max(0, Math.round(n)));
}

export function money(
  amount: number,
  currency = getUser()?.preferredCurrency || "GBP",
  precision = getDecimalPrecision()
): string {
  const n = Number(precision);
  const digits = Number.isFinite(n) ? Math.min(4, Math.max(0, Math.round(n))) : 2;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toFixed(digits)}`;
  }
}

export function getTheme(): ThemeMode {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme = getTheme()): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: ThemeMode): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function qs(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}

export function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Formats YYYY-MM (or YYYY-MM-DD) as "Aug 2026". */
export function formatMonthYear(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})/.exec(raw);
  if (!match) {
    return raw || "-";
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
    return raw;
  }
  const label = new Date(Date.UTC(year, monthIndex, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
  return label;
}

/** Formats YYYY-MM-DD as DD-MM-YYYY. */
export function formatDateDmY(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) {
    return raw || "-";
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function statusClass(status: string): string {
  const map: Record<string, string> = {
    paid: "ok",
    upcoming: "info",
    unpaid: "warn",
    late: "warn",
    overdue: "warn",
    partially_paid: "warn",
    partial: "warn",
    missed: "bad",
    active: "ok",
    archived: "muted"
  };
  return map[status] || "info";
}

export function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
