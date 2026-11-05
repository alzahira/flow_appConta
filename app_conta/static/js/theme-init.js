/* Aplica el tema guardado antes del primer pintado (sin scripts inline por CSP). */
(function () {
  try {
    var saved = localStorage.getItem("flow-theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (_e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
