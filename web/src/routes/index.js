export function switchPage(tabButtons, pages, pageId) {
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.page === pageId));
  pages.forEach((page) => page.classList.toggle("active", page.id === pageId));
}

export function bindPageRoutes(tabButtons, pages) {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchPage(tabButtons, pages, button.dataset.page));
  });
}
