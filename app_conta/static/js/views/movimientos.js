// Vista de movimientos: Gestión y auditoría del flujo de caja
import { vista, esc, importe, fechaCorta, hoy, icono } from "../vistas.js";

let botesCache = [];
let categoriasCache = [];

function selectorBote(m) {
  if (botesCache.length === 0) return "";
  return `
    <select class="sel-bote sel-bote-chip" data-id="${m.id}" aria-label="Asignar bote">
      <option value="">— Sin bote —</option>
      ${botesCache
        .map(
          (b) =>
            `<option value="${b.id}" ${m.bote_id === b.id ? "selected" : ""}>${esc(
              b.nombre
            )}</option>`
        )
        .join("")}
    </select>
  `;
}

function selectorCategoria(m) {
  if (categoriasCache.length === 0) return "";
  return `
    <select class="sel-categoria sel-cat-chip" data-id="${m.id}" aria-label="Asignar categoría">
      <option value="">— Sin categoría —</option>
      ${categoriasCache
        .map(
          (c) =>
            `<option value="${c.id}" ${
              m.categoria_id === c.id ? "selected" : ""
            }>${esc(c.nombre)}</option>`
        )
        .join("")}
    </select>
  `;
}

export function pintarFilaMovimiento(m) {
  const esGasto = Number(m.importe) < 0;
  return `
  <tr class="tx-row">
    <td class="tx-date">
      <span class="date-badge">${fechaCorta(m.fecha)}</span>
    </td>
    <td class="tx-main">
      <div class="tx-concept">
        <span class="tx-direction-icon ${esGasto ? "out" : "in"}">
          ${esGasto ? "&darr;" : "&uarr;"}
        </span>
        <span class="tx-desc">${esc(m.descripcion)}</span>
      </div>
      <div class="tx-tags">
        ${selectorBote(m)}
        ${selectorCategoria(m)}
      </div>
    </td>
    <td class="num tx-amount">
      ${importe(m.importe)}
    </td>
    <td class="tx-actions">
      <button class="btn-action-icon delete mini" data-accion="borrar-movimiento" data-id="${m.id}" title="Eliminar este movimiento">
        ${icono("borrar")}
      </button>
    </td>
  </tr>
  `;
}

function tabla(items) {
  if (items.length === 0) {
    return `
      <div class="empty-state">
        <span class="empty-icon">${icono("movimientos")}</span>
        <p>No hay movimientos registrados todavía.</p>
        <span class="empty-sub">Usa el formulario inferior para añadir el primero.</span>
      </div>
    `;
  }
  return `
    <div class="card-table-wrap">
      <table class="table-fintech">
        <thead>
          <tr>
            <th style="width: 130px">Fecha</th>
            <th>Concepto y Destino</th>
            <th class="num" style="width: 140px">Importe</th>
            <th style="width: 44px"></th>
          </tr>
        </thead>
        <tbody id="lista-movimientos">
          ${items.map(pintarFilaMovimiento).join("\n")}
        </tbody>
      </table>
    </div>
  `;
}

export default vista("movimientos", async () => {
  const [data, cuentas, botes, categorias] = await Promise.all([
    API.get("/movimientos?limit=25"),
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/categorias"),
  ]);

  botesCache = botes.items;
  categoriasCache = categorias.items;

  const opcionesCuenta = cuentas.items
    .map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");
  const opcionesBote = botes.items
    .map((b) => `<option value="${b.id}">${esc(b.nombre)}</option>`)
    .join("");
  const opcionesCategoria = categorias.items
    .map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`)
    .join("");

  const hayMas = data.offset + data.items.length < data.total;

  return `
  <div class="page-header-row">
    <div>
      <h2 class="page-title">Movimientos</h2>
      <p class="page-subtitle">Registro cronológico de entradas y salidas del hogar</p>
    </div>
    <div class="header-stat-badge">
      <span>${data.total} movimientos totales</span>
    </div>
  </div>

  <section class="section-block">
    <div class="form-card-container">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("plus")}</div>
        <div>
          <h3 class="form-card-title">Registrar Nuevo Movimiento</h3>
          <p class="form-card-subtitle">Añade un ingreso o gasto y asígnalo a su cuenta y sobre</p>
        </div>
      </div>
      <form data-accion="crear-movimiento" data-err="err-movimiento" class="fintech-form">
        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label class="form-label">Tipo de Operación</label>
            <div class="segmented-control">
              <label class="segment-item">
                <input type="radio" name="signo" value="-" checked>
                <span class="segment-btn out">&darr; Gasto</span>
              </label>
              <label class="segment-item">
                <input type="radio" name="signo" value="+">
                <span class="segment-btn in">&uarr; Ingreso</span>
              </label>
            </div>
          </div>

          <div class="form-group form-span-2">
            <label for="mov-importe" class="form-label">Importe (€)</label>
            <div class="input-currency-wrapper">
              <input id="mov-importe" name="importe" inputmode="decimal" placeholder="0.00" class="input-large" required autofocus>
              <span class="currency-symbol">€</span>
            </div>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="mov-desc" class="form-label">Concepto o Comercio</label>
            <input id="mov-desc" name="descripcion" placeholder="Ej. Compra semanal Mercadona, Nómina..." required>
          </div>
          <div class="form-group form-span-2">
            <label for="mov-cuenta" class="form-label">Cuenta Bancaria / Tarjeta</label>
            <select id="mov-cuenta" name="cuenta_id" required>
              ${opcionesCuenta || '<option value="">Crea primero una cuenta</option>'}
            </select>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group">
            <label for="mov-fecha" class="form-label">Fecha</label>
            <input id="mov-fecha" name="fecha" type="date" value="${hoy()}" required>
          </div>
          <div class="form-group">
            <label for="mov-bote" class="form-label">Bote / Sobre (Opcional)</label>
            <select id="mov-bote" name="bote_id">
              <option value="">— Ninguno (Libre) —</option>
              ${opcionesBote}
            </select>
          </div>
          <div class="form-group form-span-2">
            <label for="mov-cat" class="form-label">Categoría (Opcional)</label>
            <select id="mov-cat" name="categoria_id">
              <option value="">— Sin categoría —</option>
              ${opcionesCategoria}
            </select>
          </div>
        </div>

        <div id="err-movimiento"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Guardar Movimiento
          </button>
        </div>
      </form>
    </div>
  </section>

  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Historial de Transacciones</h3>
        <p class="section-desc">Mostrando los últimos ${data.items.length} movimientos</p>
      </div>
    </div>

    ${tabla(data.items)}

    ${
      hayMas
        ? `
      <div class="load-more-row">
        <button class="btn-secondary" data-accion="mas-movimientos"
          data-limit="25" data-offset="${data.offset + data.items.length}">
          Cargar más movimientos (${data.total - (data.offset + data.items.length)} restantes)
        </button>
      </div>
    `
        : ""
    }
  </section>
  `;
});
