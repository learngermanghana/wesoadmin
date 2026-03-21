const ROUTES = {
  "reports-page": "/overview",
  "makeup-school-page": "/makeup-school",
  "bulk-sms-page": "/funds-use",
  "data-page": "/beneficiaries",
  "donations-page": "/donations",
  "exports-page": "/exports",
  "audit-log-page": "/audit-log"
};

const FALLBACK_PAGE = "reports-page";

function normalizeRoute(path) {
  const value = (path || "").trim().toLowerCase();
  if (!value) return ROUTES[FALLBACK_PAGE];
  return value.startsWith("/") ? value : `/${value}`;
}

function pageIdFromRoute(path) {
  const normalized = normalizeRoute(path);
  return Object.keys(ROUTES).find((key) => ROUTES[key] === normalized) || FALLBACK_PAGE;
}

export function getCurrentRoute() {
  return normalizeRoute(window.location.hash.replace(/^#/, ""));
}

export function switchPage(tabButtons, pages, pageId, options = {}) {
  const nextPageId = ROUTES[pageId] ? pageId : FALLBACK_PAGE;
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.page === nextPageId));
  pages.forEach((page) => page.classList.toggle("active", page.id === nextPageId));
  if (!options.skipRouteUpdate) {
    const nextRoute = ROUTES[nextPageId];
    if (window.location.hash !== `#${nextRoute}`) window.history.replaceState({}, "", `#${nextRoute}`);
  }
}

export function applyRoute(tabButtons, pages) {
  const pageId = pageIdFromRoute(getCurrentRoute());
  switchPage(tabButtons, pages, pageId, { skipRouteUpdate: true });
}

export function bindPageRoutes(tabButtons, pages) {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchPage(tabButtons, pages, button.dataset.page));
  });
  window.addEventListener("hashchange", () => applyRoute(tabButtons, pages));
}
