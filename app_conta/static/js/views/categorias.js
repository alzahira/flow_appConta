// Vista de categorías: Clasificación analítica de gastos e ingresos
import { esc, importe, vista, icono } from "../vistas.js";

let periodo = { desde: "", hasta: "" };

export function fijarPeriodo(desde, hasta) {
  periodo = { desde: desde || "", hasta: hasta || "" };
}

function punto(color) {
  const c = /^[0-9a-fA-F]{6}$/.test(String(color || "").replace("#", ""))
    ? `#${String(color).replace("#", "")}`
    : "var(--accent)";
  return `<span class="category-dot" style="background:${c}; color:${c};"></span>`;
}

function filaCategoria(c) {
  return `
    <tr class="cat-row">
      <td>
        <div class="cat-name-cell">
          ${punto(c.color)}
          <span class="cat-label">${esc(c.nombre)}</span>
        </div>
      </td>
      <td style="font-weight: 600; font-variant-numeric: tabular-nums;">${importe(c.total)}</td>
      <td style="text-align: center;">
        <span class="glass-filter-chip" style="font-size: 0.75rem; padding: 0.15rem 0.55rem;">${c.movimientos_asignados} movs</span>
      </td>
      <td style="text-align: right;">
        <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
          <button type="button" class="btn-card-more" data-accion="editar-categoria"
            data-id="${c.id}" data-nombre="${esc(c.nombre)}"
            data-color="${esc(c.color || "")}" title="Editar categoría">
            ${icono("editar")}
          </button>
          <button type="button" class="btn-card-more dropdown-item-danger" data-accion="borrar-categoria"
            data-id="${c.id}" data-nombre="${esc(c.nombre)}" title="Eliminar categoría">
            ${icono("borrar")}
          </button>
        </div>
      </td>
    </tr>
  `;
}

export default vista("categorias", async () => {
  const qs = new URLSearchParams();
  if (periodo.desde) qs.set("desde", periodo.desde);
  if (periodo.hasta) qs.set("hasta", periodo.hasta);
  const sufijo = qs.toString() ? `?${qs}` : "";

  const data = await API.get(`/categorias${sufijo}`);

  return `
  <!-- 1. Hero Total -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Gasto Acumulado en el Periodo</span>
    <div class="hero-total-amount text-primary">${importe(data.total)}</div>
    <span class="hero-total-sub">${data.items.length} categorías registradas</span>
  </div>

  <!-- 2. Barra de Filtro de Fechas -->
  <div class="glass-card" style="padding: 1rem 1.25rem; margin-bottom: 1.5rem;">
    <form data-accion="filtrar-categorias" data-err="err-categoria-periodo" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.85rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
          <label for="cat-desde" style="font-size: 0.8rem; color: var(--fg-2);">Desde:</label>
          <input id="cat-desde" name="desde" type="date" value="${periodo.desde}" class="glass-filter-chip" style="outline: none; color: var(--fg); padding: 0.35rem 0.65rem;">
        </div>
        <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
          <label for="cat-hasta" style="font-size: 0.8rem; color: var(--fg-2);">Hasta:</label>
          <input id="cat-hasta" name="hasta" type="date" value="${periodo.hasta}" class="glass-filter-chip" style="outline: none; color: var(--fg); padding: 0.35rem 0.65rem;">
        </div>
      </div>
      <div>
        <button class="btn-secondary" type="submit" style="padding: 0.45rem 1rem; font-size: 0.82rem;">
          ${icono("calendario")} Filtrar
        </button>
      </div>
    </form>
    <div id="err-categoria-periodo" class="modal-error-box" style="display: none; margin-top: 0.5rem;"></div>
  </div>

  <!-- 3. Lista de Categorías en Tabla de Cristal -->
  <section class="glass-card" style="padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
    ${
      data.items.length === 0
        ? `
      <div class="tarjeta-vacia">
        <div class="tarjeta-vacia-icon">${icono("categorias")}</div>
        <h4>No hay categorías registradas</h4>
        <p>Crea una categoría para empezar a agrupar y analizar tus gastos e ingresos con precisión.</p>
      </div>
    `
        : `
      <div class="glass-table-wrap">
        <table class="glass-table">
          <thead>
            <tr>
              <th>Categoría</th>
              <th style="width: 160px;">Total Acumulado</th>
              <th style="width: 140px; text-align: center;">Movimientos</th>
              <th style="width: 100px; text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(filaCategoria).join("\n")}
          </tbody>
        </table>
      </div>
    `
    }
  </section>

  <!-- 4. Acordeón para Nueva Categoría -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Crear Nueva Categoría
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-categoria" data-err="err-categoria" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Crea una etiqueta con color para organizar tus compras y transacciones.
          </p>

          <div class="form-grid-2">
            <div class="campo">
              <label for="cat-nombre">Nombre de la Categoría *</label>
              <input id="cat-nombre" name="nombre" placeholder="Ej. Alimentación, Gasolina, Suministros..." required>
            </div>
            <div class="campo">
              <label for="cat-color">Color Distintivo</label>
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-top: 4px;">
                <input id="cat-color" name="color" type="color" value="#6A4DF0" style="width: 48px; height: 38px; border-radius: var(--radius-xs); border: 1px solid var(--line); background: transparent; cursor: pointer; padding: 2px;">
                <span style="font-size: 0.78rem; color: var(--fg-2);">Tono para gráficos y puntos identificadores</span>
              </div>
            </div>
          </div>

          <div id="err-categoria" class="modal-error-box" style="display: none; margin-top: 0.75rem;"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Crear Categoría
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
