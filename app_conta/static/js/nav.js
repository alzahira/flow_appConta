// Navegación superior consolidada y limpia (5 pestañas principales sin scrollbar)
import { icono } from "./vistas.js";

const ITEMS_PRINCIPALES = [
  { grupo: "inicio", href: "#/inicio", label: "Resumen", iconoKey: "inicio" },
  { grupo: "cuentas-grupo", href: "#/cuentas", label: "Cuentas y Tarjetas", iconoKey: "cuentas" },
  { grupo: "prestamos", href: "#/prestamos", label: "Préstamos", iconoKey: "coche" },
  { grupo: "ahorro-grupo", href: "#/ahorro", label: "Ahorro y Botes", iconoKey: "ahorro" },
  { grupo: "movimientos", href: "#/movimientos", label: "Movimientos", iconoKey: "movimientos" },
];

const RUTAS_MAS = [
  { nombre: "pagos-recurrentes", desc: "Recibos y domiciliaciones fijas bancarias", label: "Recibos Fijos", iconoKey: "prevision" },
  { nombre: "categorias", desc: "Clasificación analítica de gastos", label: "Categorías", iconoKey: "categorias" },
  { nombre: "importar", desc: "Ingesta y conciliación de libros", label: "Importar Excel", iconoKey: "importar" },
  { nombre: "copia-seguridad", desc: "Exportar archivo, vaciar y restaurar", label: "Copia de Seguridad & Datos", iconoKey: "banco" },
];

export function pintarNav(_rutas) {
  const nav = document.getElementById("nav");
  if (!nav) return;

  nav.innerHTML = `
    ${ITEMS_PRINCIPALES.map(
      (item) => `
      <a data-nav-group="${item.grupo}" href="${item.href}" class="nav-tab">
        <span class="nav-icon">${icono(item.iconoKey)}</span>
        <span class="nav-label">${item.label}</span>
      </a>`
    ).join("")}

    <div class="nav-dropdown-wrap" id="nav-dropdown-wrap">
      <button type="button" class="nav-tab nav-dropdown-btn" id="btn-nav-mas" aria-haspopup="true" aria-expanded="false" title="Más opciones">
        <span class="nav-icon">${icono("mas")}</span>
        <span class="nav-label">Más</span>
        <span class="nav-chevron">${icono("chevron")}</span>
      </button>
      <div class="nav-dropdown-menu" id="nav-dropdown-menu">
        ${RUTAS_MAS.map(
          (item) => `
          <a data-vista="${item.nombre}" href="#/${item.nombre}" class="dropdown-item">
            <span class="dropdown-icon">${icono(item.iconoKey)}</span>
            <div class="dropdown-item-info">
              <span class="dropdown-item-title">${item.label}</span>
              <span class="dropdown-item-desc">${item.desc}</span>
            </div>
          </a>
        `
        ).join("")}
        <div style="border-top: 1px solid var(--border-subtle); margin: 0.35rem 0;"></div>
        <a href="/static/manual_arquitectura_app_conta.pdf" target="_blank" download="Manual_Arquitectura_App_Conta.pdf" class="dropdown-item">
          <span class="dropdown-icon">${icono("importar")}</span>
          <div class="dropdown-item-info">
            <span class="dropdown-item-title">📄 Manual Técnico (PDF)</span>
            <span class="dropdown-item-desc">Descargar guía completa de arquitectura</span>
          </div>
        </a>
      </div>
    </div>
  `;

  // Control interactivo del desplegable "Más"
  const wrap = document.getElementById("nav-dropdown-wrap");
  const btn = document.getElementById("btn-nav-mas");
  if (btn && wrap) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const abierto = wrap.classList.toggle("abierto");
      btn.setAttribute("aria-expanded", String(abierto));
    });

    wrap.querySelectorAll(".dropdown-item").forEach((a) => {
      a.addEventListener("click", () => {
        wrap.classList.remove("abierto");
        btn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Cerrar al pulsar fuera del menú
  document.addEventListener("click", (e) => {
    if (wrap && !wrap.contains(e.target)) {
      wrap.classList.remove("abierto");
      btn?.setAttribute("aria-expanded", "false");
    }
  });
}
