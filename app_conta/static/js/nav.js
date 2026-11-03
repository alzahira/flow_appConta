// Navegación Inferior Flotante de Cristal (Glass Floating Navigation Bar)
import { icono } from "./vistas.js";

const ITEMS_PRINCIPALES = [
  { id: "inicio", href: "/inicio", label: "Inicio", iconoKey: "inicio" },
  { id: "cuentas", href: "/cuentas", label: "Cuentas", iconoKey: "cuentas" },
  { id: "botes", href: "/botes", label: "Botes", iconoKey: "botes" },
  { id: "movimientos", href: "/movimientos", label: "Movimientos", iconoKey: "movimientos" },
];

const ITEMS_MAS = [
  { nombre: "pagos-diarios", desc: "Supermercado, gasoil y compras cotidianas", label: "Pagos Diarios", iconoKey: "carrito" },
  { nombre: "prestamos", desc: "Amortizaciones, cuotas e hipotecas", label: "Préstamos & Deudas", iconoKey: "coche" },
  { nombre: "prevision-gastos", desc: "Provisión mensual de gastos anuales (IBI, seguros...)", label: "Previsión Anual", iconoKey: "prevision" },
  { nombre: "pagos-recurrentes", desc: "Recibos bancarios y domiciliaciones fijas", label: "Recibos Fijos", iconoKey: "prevision" },
  { nombre: "categorias", desc: "Clasificación analítica y etiquetas de gasto", label: "Categorías", iconoKey: "categorias" },
  { nombre: "copia-seguridad", desc: "Exportar snapshot, vaciar y restaurar", label: "Copia de Seguridad", iconoKey: "banco" },
];

export function pintarNav(_rutas) {
  const nav = document.getElementById("nav");
  if (!nav) return;

  // 1. Barra flotante principal
  nav.innerHTML = `
    <div class="glass-nav-container">
      ${ITEMS_PRINCIPALES.map(
        (item) => `
        <a data-nav-group="${item.id}" href="${item.href}" class="glass-nav-item">
          <span class="glass-nav-icon">${icono(item.iconoKey)}</span>
          <span class="glass-nav-label">${item.label}</span>
        </a>`
      ).join("")}

      <button type="button" class="glass-nav-item glass-nav-more-btn" id="btn-nav-mas" aria-haspopup="true" aria-expanded="false" aria-label="Más opciones">
        <span class="glass-nav-icon">${icono("mas")}</span>
        <span class="glass-nav-label">Más</span>
      </button>
    </div>
  `;

  // 2. Portal para el Drawer / Bottom Sheet de "Más" fuera del nav
  let portal = document.getElementById("nav-sheet-portal");
  if (!portal) {
    portal = document.createElement("div");
    portal.id = "nav-sheet-portal";
    document.body.appendChild(portal);
  }

  portal.innerHTML = `
    <!-- Menú Bottom Sheet / Drawer de Cristal para "Más" -->
    <div class="glass-sheet-menu" id="glass-sheet-menu">
      <div class="glass-sheet-header">
        <div class="glass-sheet-handle"></div>
        <div class="glass-sheet-title-row">
          <span class="glass-sheet-title">Opciones & Ajustes</span>
          <button type="button" class="glass-sheet-close" id="btn-close-extras" aria-label="Cerrar">&times;</button>
        </div>
      </div>

      <!-- Conmutador de Tema dentro de Más -->
      <div class="theme-switcher-glass-card">
        <div class="theme-switcher-info">
          <span class="theme-switcher-title">Modo de Interfaz</span>
          <span class="theme-switcher-desc">Cambia entre luz natural y noche fintech</span>
        </div>
        <div class="segmented-control theme-segmented">
          <button type="button" class="seg-btn" id="btn-theme-dark">Oscuro</button>
          <button type="button" class="seg-btn" id="btn-theme-light">Claro</button>
        </div>
      </div>

      <div class="glass-sheet-links-list">
        ${ITEMS_MAS.map(
          (item) => `
          <a data-vista="${item.nombre}" href="/${item.nombre}" class="glass-sheet-item">
            <span class="glass-sheet-item-icon">${icono(item.iconoKey)}</span>
            <div class="glass-sheet-item-info">
              <span class="glass-sheet-item-title">${item.label}</span>
              <span class="glass-sheet-item-desc">${item.desc}</span>
            </div>
            <span class="glass-sheet-arrow">&rarr;</span>
          </a>`
        ).join("")}
      </div>

      <div class="glass-sheet-footer">
        <a href="/static/manual_arquitectura_app_conta.pdf" target="_blank" download="Manual_Arquitectura_App_Conta.pdf" class="glass-sheet-pdf-btn">
          <span class="pdf-icon">${icono("importar")}</span>
          <span>Manual Técnico de Arquitectura (PDF)</span>
        </a>
        <button type="button" id="btn-logout-action" class="glass-sheet-logout-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  `;

  // Control interactivo del Bottom Sheet
  const sheet = document.getElementById("glass-sheet-menu");
  const btnMas = document.getElementById("btn-nav-mas");
  const backdrop = document.getElementById("nav-dropdown-backdrop");
  const btnClose = document.getElementById("btn-close-extras");

  const abrirMenu = () => {
    sheet?.classList.add("visible");
    backdrop?.classList.add("visible");
    btnMas?.setAttribute("aria-expanded", "true");
  };

  const cerrarMenu = () => {
    sheet?.classList.remove("visible");
    backdrop?.classList.remove("visible");
    btnMas?.setAttribute("aria-expanded", "false");
  };

  if (btnMas) {
    btnMas.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (sheet?.classList.contains("visible")) {
        cerrarMenu();
      } else {
        abrirMenu();
      }
    });
  }

  sheet?.querySelectorAll(".glass-sheet-item, .glass-sheet-pdf-btn").forEach((a) => {
    a.addEventListener("click", cerrarMenu);
  });

  backdrop?.addEventListener("click", cerrarMenu);
  btnClose?.addEventListener("click", cerrarMenu);

  const btnLogout = document.getElementById("btn-logout-action");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await fetch("/api/v1/auth/logout", { method: "POST" });
      } catch (_e) {}
      window.location.reload();
    });
  }

  // Selector de Tema (Oscuro / Claro)
  const btnDark = document.getElementById("btn-theme-dark");
  const btnLight = document.getElementById("btn-theme-light");
  const quickToggle = document.getElementById("btn-theme-quick-toggle");

  const actualizarBotonesTema = (tema) => {
    btnDark?.classList.toggle("activo", tema === "dark");
    btnLight?.classList.toggle("activo", tema === "light");
  };

  const setTema = (tema) => {
    document.documentElement?.setAttribute("data-theme", tema);
    try { localStorage.setItem("flow-theme", tema); } catch (_e) {}
    actualizarBotonesTema(tema);
  };

  const temaActual = document.documentElement?.getAttribute("data-theme") || "light";
  actualizarBotonesTema(temaActual);

  btnDark?.addEventListener("click", () => setTema("dark"));
  btnLight?.addEventListener("click", () => setTema("light"));

  if (quickToggle) {
    quickToggle.addEventListener("click", () => {
      const actual = document.documentElement?.getAttribute("data-theme") || "light";
      setTema(actual === "dark" ? "light" : "dark");
    });
  }
}
