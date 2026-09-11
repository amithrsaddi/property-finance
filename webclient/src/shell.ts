import { apiBase, applyTheme, clearSession, getTheme, getUser, requireSession, setTheme } from "./lib.js";

type NavChild = { href: string; label: string; icon: string };
type NavItem = { href?: string; label: string; icon: string; id?: string; children?: NavChild[] };

function icon(path: string, className = "nav-icon"): string {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

const ICON_COG = icon(
  '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 3.5v2.2M12 18.3v2.2M4.8 6.5l1.6 1.6M17.6 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.5l1.6-1.6M17.6 8.1l1.6-1.6"/>'
);
const ICON_BACKUP = icon(
  '<rect x="4" y="4.5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 9.5h16M8 4.5v-1M16 4.5v-1M8 13h3M8 16.5h8"/>'
);
const ICON_MOON = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5z"/>'
);
const ICON_SUN_GLYPH = icon(
  '<circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2.8v1.8M12 19.4v1.8M4.6 4.6l1.3 1.3M18.1 18.1l1.3 1.3M2.8 12h1.8M19.4 12h1.8M4.6 19.4l1.3-1.3M18.1 5.9l1.3-1.3"/>',
  "theme-switch-glyph"
);
const ICON_MOON_GLYPH = icon(
  '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5z"/>',
  "theme-switch-glyph"
);
const ICON_USER = icon(
  '<circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5 19.2c.8-3.2 3.5-5 7-5s6.2 1.8 7 5"/>'
);
const ICON_CHEVRON = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>',
  "nav-chevron"
);
const ICON_DASHBOARD = icon(
  '<rect x="3" y="3" width="7" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="3" width="7" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="12" width="7" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="16" width="7" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/>'
);
const ICON_PROPERTIES = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 21V8.2L12 3l8 5.2V21"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M9 21v-6.5h6V21"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9 10.5h.01M12 10.5h.01M15 10.5h.01"/>'
);
const ICON_MORTGAGES = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 21h18M5.5 21V11.5h13V21M4 11.5 12 4l8 7.5"/>'
);
const ICON_RENT = icon(
  '<rect x="2.5" y="6.5" width="19" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M6.2 12h.01M17.8 12h.01"/>'
);
const ICON_PAYMENTS = icon(
  '<rect x="2.5" y="5.5" width="19" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M2.5 10h19"/>'
);
const ICON_RATES = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M18.5 5.5 5.5 18.5"/><circle cx="7" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/>'
);
const ICON_CALCULATOR = icon(
  '<rect x="4.5" y="3.5" width="15" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 8h8M8 12.2h.01M12 12.2h.01M16 12.2h.01M8 16.2h.01M12 16.2h.01M16 16.2h.01"/>'
);
const ICON_GAINS = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 17.5 9.2 12l3.4 3.4L20 8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M14.5 8H20v5.5"/>'
);
const ICON_DOCUMENTS = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M7 3.5h7.2L19.5 9v11.5H7z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 3.5V9h5.5M9.5 13h6M9.5 16.5h6"/>'
);
const ICON_EXPENSES = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M6 3.5v17l1.6-1 1.6 1 1.6-1 1.6 1 1.6-1 1.6 1 1.6-1V3.5l-1.6 1-1.6-1-1.6 1-1.6-1-1.6 1-1.6-1-1.6 1z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9 8.5h6M9 12h6M9 15.5h4"/>'
);
const ICON_REPORTS = icon(
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M6 19v-6M12 19V6M18 19v-9"/>'
);

function pagePath(path: string): string {
  const clean = String(path || "").split("?")[0].split("#")[0];
  if (clean.endsWith(".html")) {
    return clean.slice(0, -5) || "/";
  }
  return clean || "/";
}

function isActivePath(href: string, activePath: string): boolean {
  return pagePath(href) === pagePath(activePath);
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: ICON_DASHBOARD },
  { href: "/properties", label: "Properties", icon: ICON_PROPERTIES },
  { href: "/rent", label: "Rent", icon: ICON_RENT },
  {
    id: "mortgages",
    label: "Mortgages",
    icon: ICON_MORTGAGES,
    children: [
      { href: "/payments", label: "Payments", icon: ICON_PAYMENTS },
      { href: "/rates", label: "Rates", icon: ICON_RATES },
    ],
  },
  {
    id: "calculators",
    label: "Calculators",
    icon: ICON_CALCULATOR,
    children: [
      { href: "/calculator", label: "Mortgage", icon: ICON_CALCULATOR },
      { href: "/capital-gains", label: "Capital Gains", icon: ICON_GAINS },
    ],
  },
  { href: "/expenses", label: "Expenses", icon: ICON_EXPENSES },
  { href: "/documents", label: "Documents", icon: ICON_DOCUMENTS },
  { href: "/reports", label: "Reports", icon: ICON_REPORTS },
];

function navGroupStorageKey(id: string): string {
  return `pf-nav-open-${id}`;
}

function isGroupChildActive(item: NavItem, path: string): boolean {
  return Boolean(item.children?.some((child) => isActivePath(child.href, path)));
}

function navGroupOpen(item: NavItem, activePath: string): boolean {
  if (isGroupChildActive(item, activePath)) {
    return true;
  }
  const id = item.id;
  if (!id) {
    return false;
  }
  try {
    if (sessionStorage.getItem(navGroupStorageKey(id)) === "1") {
      return true;
    }
    if (id === "mortgages" && sessionStorage.getItem("pf-mortgages-nav-open") === "1") {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function renderNav(activePath: string): string {
  return NAV.map((item) => {
    if (item.children?.length) {
      const childActive = isGroupChildActive(item, activePath);
      const open = navGroupOpen(item, activePath);
      const groupId = item.id || item.label.toLowerCase().replace(/\s+/g, "-");
      const toggleId = `${groupId}-nav-toggle`;
      const subId = `${groupId}-nav-sub`;
      return `<div class="nav-group${open ? " open" : ""}">
        <button class="nav-group-toggle${childActive ? " active" : ""}" id="${toggleId}" data-nav-group="${groupId}" type="button" aria-expanded="${open}" aria-controls="${subId}">
          <span class="nav-group-label">${item.icon}${item.label}</span>
          ${ICON_CHEVRON}
        </button>
        <div class="nav-sub" id="${subId}"${open ? "" : " hidden"}>
          ${item.children
            .map(
              (child) =>
                `<a href="${child.href}" class="${isActivePath(child.href, activePath) ? "active" : ""}">${child.icon}${child.label}</a>`
            )
            .join("")}
        </div>
      </div>`;
    }
    return `<a href="${item.href}" class="${isActivePath(item.href || "", activePath) ? "active" : ""}">${item.icon}${item.label}</a>`;
  }).join("");
}

export function mountShell(
  activePath: string,
  title: string,
  subtitle = "",
  actionsHtml = ""
): HTMLElement {
  requireSession();
  applyTheme();
  const user = getUser()!;

  document.body.innerHTML = `
    <div class="app-shell" id="app-shell">
      <div class="nav-backdrop" id="nav-backdrop"></div>
      <aside class="sidebar" id="app-sidebar">
        <div class="brand">
          Property Finance
          <span>Management Suite</span>
        </div>
        <nav class="nav">
          ${renderNav(activePath)}
        </nav>
        <div class="sidebar-bottom">
          <div class="sidebar-system">
            <div class="sidebar-options-label">System</div>
            <nav class="nav">
              <a href="/settings" class="${isActivePath("/settings", activePath) ? "active" : ""}">
                ${ICON_COG}Settings
              </a>
              <a href="/backup" class="${isActivePath("/backup", activePath) ? "active" : ""}">
                ${ICON_BACKUP}Backup & Restore
              </a>
              <button class="theme-option" id="theme-toggle" type="button" role="switch" aria-checked="false">
                <span class="theme-option-label">${ICON_MOON}Dark mode</span>
                <span class="theme-switch-track" aria-hidden="true">
                  ${ICON_SUN_GLYPH}
                  <span class="theme-switch-thumb"></span>
                  ${ICON_MOON_GLYPH}
                </span>
              </button>
            </nav>
          </div>
          <a href="/profile" class="sidebar-profile${isActivePath("/profile", activePath) ? " active" : ""}">
            <span class="profile-avatar">${ICON_USER}</span>
            <span class="sidebar-profile-name">${user.name}</span>
          </a>
          <div class="sidebar-foot-actions">
            <button class="logout-link" id="logout-btn" type="button">
              <span class="logout-icon" aria-hidden="true"></span>
              Log Out
            </button>
            <div class="api-status checking" id="api-status" title="Checking API…">
              <span class="api-status-dot"></span>
              <span class="api-status-label">Checking</span>
            </div>
          </div>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div>
            <h1>${title}</h1>
            ${subtitle ? `<p>${subtitle}</p>` : ""}
          </div>
          <div class="topbar-end">
            ${actionsHtml ? `<div class="topbar-actions">${actionsHtml}</div>` : ""}
            <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Open menu" aria-controls="app-sidebar" aria-expanded="false">
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div id="page-root"></div>
      </main>
    </div>
  `;

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "/";
  });

  bindMobileNav();
  bindNavGroups();
  bindThemeToggle();
  void watchApiStatus();

  return document.getElementById("page-root")!;
}

async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${apiBase()}/health`, { method: "GET", cache: "no-store" });
    if (!response.ok) {
      return false;
    }
    const data = (await response.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}

function renderApiStatus(online: boolean): void {
  const el = document.getElementById("api-status");
  if (!el) {
    return;
  }
  el.className = `api-status ${online ? "online" : "offline"}`;
  el.title = online ? "Backend connected" : "Backend unreachable";
  const label = el.querySelector(".api-status-label");
  if (label) {
    label.textContent = online ? "API Online" : "API Offline";
  }
}

function setNavOpen(open: boolean): void {
  const shell = document.getElementById("app-shell");
  const toggle = document.getElementById("menu-toggle");
  if (!shell || !toggle) {
    return;
  }
  shell.classList.toggle("nav-open", open);
  document.body.classList.toggle("nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

function bindNavGroups(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-nav-group]").forEach((toggle) => {
    const groupId = toggle.dataset.navGroup;
    const group = toggle.closest(".nav-group");
    const subId = toggle.getAttribute("aria-controls");
    const sub = subId ? document.getElementById(subId) : null;
    if (!groupId || !group || !sub) {
      return;
    }
    toggle.addEventListener("click", () => {
      const open = !group.classList.contains("open");
      group.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      sub.hidden = !open;
      try {
        sessionStorage.setItem(navGroupStorageKey(groupId), open ? "1" : "0");
      } catch {
        /* ignore */
      }
    });
  });
}

function bindMobileNav(): void {
  const toggle = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("nav-backdrop");
  const sidebar = document.getElementById("app-sidebar");
  if (!toggle || !backdrop || !sidebar) {
    return;
  }

  toggle.addEventListener("click", () => {
    setNavOpen(!document.getElementById("app-shell")?.classList.contains("nav-open"));
  });
  backdrop.addEventListener("click", () => setNavOpen(false));
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setNavOpen(false);
    }
  });
  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 901px)").matches) {
      setNavOpen(false);
    }
  });
}

function renderThemeToggle(): void {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    return;
  }
  const dark = getTheme() === "dark";
  toggle.classList.toggle("on", dark);
  toggle.setAttribute("aria-checked", String(dark));
}

function bindThemeToggle(): void {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    return;
  }
  renderThemeToggle();
  toggle.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
    renderThemeToggle();
  });
}

async function watchApiStatus(): Promise<void> {
  const update = async () => {
    renderApiStatus(await checkApiStatus());
  };
  await update();
  window.setInterval(() => {
    void update();
  }, 15000);
}

export function setStatus(
  el: HTMLElement | null,
  message: string,
  type: "info" | "success" | "error" = "info"
): void {
  if (!el) {
    return;
  }
  el.hidden = !message;
  el.className = `status ${type === "info" ? "" : type}`.trim();
  el.textContent = message;
}
