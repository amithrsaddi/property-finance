(() => {
  const dark = localStorage.getItem("pf-theme") === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", dark);
})();
