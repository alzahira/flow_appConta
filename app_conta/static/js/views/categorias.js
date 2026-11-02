// Vista de categorías: Clasificación analítica de gastos e ingresos
import { esc, importe, vista, icono } from "../vistas.js";

let periodo = { desde: "", hasta: "" };

export function fijarPeriodo(desde, hasta) {
  periodo = { desde: desde || "", hasta: hasta || "" };
}

function punto(color) {
  const c = /^[0-9a-fA-F]{6}$/.test(String(color || "").replace("#", ""))
    ? `#${String(color).replace("#", "")}`
    : "#6366f1";
  return `<span class="category-dot" style="background:${c}"></span>`;
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
      <td class="num">${importe(c.total)}</td>
      <td class="text-center">
        <span class="badge-subtle">${c.movimientos_asignados} movs</span>
      </td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-icon" data-accion="editar-categoria"
            data-id="${c.id}" data-nombre="${esc(c.nombre)}"
            data-color="${esc(c.color || "")}" title="Editar categoría">
            ${icono("editar")}
          </button>
          <button class="btn-icon danger" data-accion="borrar-categoria"
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
  <div class="page-header-row">
    <div>
      <h2 class="page-title">Categorías</h2>
      <p class="page-subtitle">Organiza tus movimientos por conceptos de gasto e ingreso</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Gasto Acumulado en Periodo</span>
      <span class="header-total-value">${importe(data.total)}</span>
    </div>
  </div>

  <section class="section-block">
    <div class="filter-card">
      <form data-accion="filtrar-categorias" data-err="err-categoria-periodo" class="filter-form">
        <div class="filter-inputs">
          <div class="form-group">
            <label for="cat-desde" class="form-label">Desde</label>
            <input id="cat-desde" name="desde" type="date" value="${periodo.desde}">
          </div>
          <div class="form-group">
            <label for="cat-hasta" class="form-label">Hasta</label>
            <input id="cat-hasta" name="hasta" type="date" value="${periodo.hasta}">
          </div>
        </div>
        <div class="filter-actions">
          <button class="btn-secondary" type="submit">
            ${icono("calendario")} Filtrar Periodo
          </button>
        </div>
      </form>
    </div>

    ${
      data.items.length === 0
        ? `
      <div class="empty-state">
        <span class="empty-icon">${icono("categorias")}</span>
        <p>No hay categorías registradas.</p>
        <span class="empty-sub">Crea una categoría para empezar a agrupar tus gastos.</span>
      </div>
    `
        : `
      <div class="card-table-wrap">
        <table class="table-fintech">
          <thead>
            <tr>
              <th>Categoría</th>
              <th class="num">Total Acumulado</th>
              <th class="text-center" style="width: 140px">Movimientos</th>
              <th class="text-right" style="width: 100px">Acciones</th>
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

  <section class="section-block">
    <details class="form-inversion-details">
      <summary class="btn-nuevo-inversion-trigger">
        ${icono("plus")} Crear Nueva Categoría
      </summary>
      <div class="form-container" style="padding: 0 1.5rem 1.5rem 1.5rem;">
        <p class="form-desc">Crea una etiqueta con color para tus transacciones</p>

        <form data-accion="crear-categoria" data-err="err-categoria" class="fintech-form">
          <div class="form-row-grid">
            <div class="form-group form-span-3">
              <label for="cat-nombre" class="form-label">Nombre de la Categoría</label>
              <input id="cat-nombre" name="nombre" placeholder="Ej. Alimentación, Suministros, Gasolina, Ocio..." required>
            </div>
            <div class="form-group">
              <label for="cat-color" class="form-label">Color Distintivo</label>
              <div class="color-picker-wrap">
                <input id="cat-color" name="color" type="color" value="#6366f1" class="color-picker-input">
              </div>
            </div>
          </div>

          <div id="err-categoria"></div>

          <div class="form-actions-right">
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
