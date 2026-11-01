// Vista de Gastos Tarjetas: Detalle de movimientos de Tarjeta Caixa, Tarjeta Deutsche Bank, Tarjeta Carrefour...
import { vista, esc, importe, hoy, icono, subnavCuentas } from "../vistas.js";
import { pintarFilaMovimiento, setGlobalCaches } from "./movimientos.js";

// Estado de la tarjeta seleccionada para persistir entre renders
let tarjetaSeleccionadaId = null;

export default vista("gastos-tarjetas", async () => {
  const [cuentasData, botesData, categoriasData] = await Promise.all([
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/categorias"),
  ]);

  setGlobalCaches({
    cuentas: cuentasData.items,
    botes: botesData.items,
    categorias: categoriasData.items,
  });

  // Filtramos todas las tarjetas
  const tarjetas = cuentasData.items.filter(
    (c) => c.tipo === "tarjeta" || c.nombre.toUpperCase().startsWith("TARJETA")
  );

  if (tarjetas.length === 0) {
    return `
      ${subnavCuentas("gastos-tarjetas")}
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Gastos Tarjetas</h2>
          <p class="page-subtitle">Desglose de compras y recibos de tarjeta</p>
        </div>
      </div>
      <div class="empty-state">
        <span class="empty-icon">${icono("tarjetas")}</span>
        <p>No tienes tarjetas registradas aún.</p>
        <span class="empty-sub">Crea primero tus tarjetas (Caixa, Deutsche Bank, Carrefour) en la pestaña Tarjetas.</span>
        <a href="#/tarjetas" class="btn-primary mini">+ Ir a Tarjetas</a>
      </div>
    `;
  }

  // Si no hay tarjeta seleccionada o la que había no existe, cogemos la primera
  if (!tarjetaSeleccionadaId || !tarjetas.some((t) => t.id === tarjetaSeleccionadaId)) {
    tarjetaSeleccionadaId = tarjetas[0].id;
  }

  // Obtenemos los movimientos de la tarjeta seleccionada
  const tarjetaActual = tarjetas.find((t) => t.id === tarjetaSeleccionadaId) || tarjetas[0];
  const movsData = await API.get(`/movimientos?cuenta=${tarjetaActual.id}&limit=100`);

  // Opciones para el selector de tarjetas en el menú de píldoras
  const tabsTarjetasHtml = tarjetas
    .map(
      (t) => `
      <button type="button" class="pill-filter-btn ${t.id === tarjetaActual.id ? "activa" : ""}"
        data-tarjeta-id="${t.id}">
        <span class="pill-icon">${icono("tarjeta")}</span>
        <span>${esc(t.nombre)}</span>
      </button>
    `
    )
    .join("");

  const opcionesBote = botesData.items
    .map((b) => `<option value="${b.id}">${esc(b.nombre)}</option>`)
    .join("");

  const opcionesCategoria = categoriasData.items
    .map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`)
    .join("");

  const totalGastosTarjeta = movsData.items.reduce((acc, m) => acc + Number(m.importe), 0);

  // Instalar escucha de cambio de pestaña de tarjeta con setTimeout
  setTimeout(() => {
    document.querySelectorAll("[data-tarjeta-id]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = Number(e.currentTarget.dataset.tarjetaId);
        tarjetaSeleccionadaId = id;
        const main = document.getElementById("vista");
        const actual = (await import("./gastos-tarjetas.js")).default;
        main.innerHTML = await actual.render();
      });
    });
  }, 0);

  return `
  ${subnavCuentas("gastos-tarjetas")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Gastos Tarjetas</h2>
      <p class="page-subtitle">Desglose de compras de Tarjeta Caixa, Tarjeta Deutsche Bank, Tarjeta Carrefour...</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Saldo / Recibo de ${esc(tarjetaActual.nombre)}</span>
      <span class="header-total-value">${importe(tarjetaActual.saldo)}</span>
    </div>
  </div>

  <section class="section-block">
    <div class="pills-filter-bar">
      ${tabsTarjetasHtml}
    </div>
  </section>

  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Movimientos en ${esc(tarjetaActual.nombre)}</h3>
        <p class="section-desc">${movsData.total} compras o cargos registrados &bull; Total acumulado: ${importe(totalGastosTarjeta.toFixed(2))}</p>
      </div>
    </div>

    ${
      movsData.items.length === 0
        ? `
      <div class="empty-state">
        <span class="empty-icon">${icono("tarjetas")}</span>
        <p>No hay gastos registrados en ${esc(tarjetaActual.nombre)}.</p>
        <span class="empty-sub">Añade un cargo con el formulario inferior.</span>
      </div>
    `
        : `
      <div class="tx-date-items" style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${movsData.items.map(pintarFilaMovimiento).join("\n")}
      </div>
    `
    }
  </section>

  <section class="section-block">
    <div class="form-card-container">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("plus")}</div>
        <div>
          <h3 class="form-card-title">Añadir Gasto a ${esc(tarjetaActual.nombre)}</h3>
          <p class="form-card-subtitle">Registra un pago con esta tarjeta para actualizar su saldo y recibo</p>
        </div>
      </div>

      <form data-accion="crear-movimiento" data-err="err-gasto-tarjeta" class="fintech-form">
        <input type="hidden" name="cuenta_id" value="${tarjetaActual.id}">
        <input type="hidden" name="signo" value="-">

        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="gt-desc" class="form-label">Comercio / Concepto de la Compra</label>
            <input id="gt-desc" name="descripcion" placeholder="Ej. Gasolinera Repsol, Restaurante, Amazon..." required>
          </div>
          <div class="form-group form-span-2">
            <label for="gt-importe" class="form-label">Importe del Gasto (€)</label>
            <div class="input-currency-wrapper">
              <input id="gt-importe" name="importe" inputmode="decimal" placeholder="0.00" class="input-large" required>
              <span class="currency-symbol">€</span>
            </div>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group">
            <label for="gt-fecha" class="form-label">Fecha del Pago</label>
            <input id="gt-fecha" name="fecha" type="date" value="${hoy()}" required>
          </div>
          <div class="form-group">
            <label for="gt-bote" class="form-label">Bote / Sobre (Opcional)</label>
            <select id="gt-bote" name="bote_id">
              <option value="">— Sin bote asignado —</option>
              ${opcionesBote}
            </select>
          </div>
          <div class="form-group form-span-2">
            <label for="gt-cat" class="form-label">Categoría (Opcional)</label>
            <select id="gt-cat" name="categoria_id">
              <option value="">— Sin categoría —</option>
              ${opcionesCategoria}
            </select>
          </div>
        </div>

        <div id="err-gasto-tarjeta"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Registrar Gasto en ${esc(tarjetaActual.nombre)}
          </button>
        </div>
      </form>
    </div>
  </section>
  `;
});
