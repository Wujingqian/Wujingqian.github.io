// Share al-folio's existing theme preference without loading its page-wide scripts.
(() => {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let setting = "system";
  try {
    const saved = localStorage.getItem("theme");
    if (["light", "dark", "system"].includes(saved)) setting = saved;
  } catch (_) {
    // Theme selection still works when browser storage is unavailable.
  }
  const apply = () => {
    const theme = setting === "system" ? (system.matches ? "dark" : "light") : setting;
    document.documentElement.dataset.themeSetting = setting;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const button = document.querySelector(".appearance-button");
    if (button) button.setAttribute("aria-label", `Change appearance, currently ${setting}`);
  };
  window.researchTheme = {
    toggle() {
      setting = setting === "system" ? "light" : setting === "light" ? "dark" : "system";
      try {
        localStorage.setItem("theme", setting);
      } catch (_) {
        /* Optional preference storage. */
      }
      apply();
    },
  };
  system.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key !== "theme") return;
    setting = ["light", "dark", "system"].includes(event.newValue) ? event.newValue : "system";
    apply();
  });
  document.addEventListener("DOMContentLoaded", apply);
  apply();
})();
