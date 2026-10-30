// Vista de Tarjetas: Gestión de tarjetas de crédito y débito del hogar
import { vista, esc, importe, hoy, fechaCorta, icono, subnavCuentas } from "../vistas.js";
import { esTarjetaRegalo } from "./tarjetas-regalo.js";

function tarjetaCreditoItem(c) {
  const saldoNum = Number(c.saldo);
  const esDeuda = saldoNum < 0;

  return `
    <article class="credit-card-fintech">
      <div class="credit-card-shine"></div>
      
      <div class="credit-card-top-row">
        <div class="credit-card-chip">
          <div class="chip-line"></div>
          <div class="chip-line"></div>
        </div>
        <div class="credit-card-top-actions">
          <span class="credit-card-brand">${esc(c.entidad || "TARJETA")}</span>
          <button class="btn-action-icon delete dark" data-accion="borrar-cuenta" data-id="${c.id}" data-nombre="${esc(c.nombre)}" title="Eliminar tarjeta">
            ${icono("borrar")}
          </button>
        </div>
      </div>

      <div class="credit-card-middle">
        <h3 class="credit-card-title">${esc(c.nombre)}</h3>
        <span class="credit-card-number">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 2026</span>
      </div>

      <div class="credit-card-bottom-row">
        <div class="credit-card-balance-block">
          <span class="credit-card-balance-label">${esDeuda ? "Deuda / Saldo dispuesto" : "Saldo disponible"}</span>
          <div class="credit-card-balance-value">${importe(c.saldo)}</div>
        </div>
        <div class="credit-card-meta">
          <span>Inicial: ${c.saldo_inicial} €</span>
          <span>Apertura: ${fechaCorta(c.fecha_apertura)}</span>
        </div>
      </div>
    </article>
  `;
}

export default vista("tarjetas", async () => {
  const data = await API.get("/cuentas");

  // Filtramos solo las tarjetas bancarias (excluimos tarjetas regalo, tienen su pestaña propia)
  const tarjetas = data.items.filter(
    (c) =>
      (c.tipo === "tarjeta" || c.nombre.toUpperCase().startsWith("TARJETA")) &&
      !esTarjetaRegalo(c)
  );

  const totalTarjetas = tarjetas.reduce((acc, c) => acc + Number(c.saldo), 0);

  return `
  ${subnavCuentas("tarjetas")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Tarjetas Bancarias</h2>
      <p class="page-subtitle">Control de tarjetas de crédito, débito y líneas de financiación bancarias</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Saldo Neto en Tarjetas</span>
      <span class="header-total-value">${importe(totalTarjetas.toFixed(2))}</span>
    </div>
  </div>

  <div class="tabs-subnav-row">
    <a href="#/tarjetas" class="tab-subnav-pill activa">Mis Tarjetas</a>
    <a href="#/gastos-tarjetas" class="tab-subnav-pill">Gastos de Tarjetas &rarr;</a>
    <a href="#/tarjetas-regalo" class="tab-subnav-pill">Ver Tarjetas Regalo &rarr;</a>
  </div>

  <section class="section-block">
    <div class="grid-credit-cards">
      ${
        tarjetas.length > 0
          ? tarjetas.map(tarjetaCreditoItem).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("tarjetas")}</span>
              <p>No tienes tarjetas dadas de alta aún.</p>
              <span class="empty-sub">Registra tu primera tarjeta con el formulario inferior.</span>
            </div>`
      }
    </div>
  </section>

  <section class="section-block">
    <div class="form-card-container">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("plus")}</div>
        <div>
          <h3 class="form-card-title">Dar de Alta Nueva Tarjeta</h3>
          <p class="form-card-subtitle">Registra una tarjeta de crédito o débito para seguir sus gastos y recibos</p>
        </div>
      </div>

      <form data-accion="crear-cuenta" data-err="err-tarjeta" class="fintech-form">
        <input type="hidden" name="tipo" value="tarjeta">

        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="tj-nombre" class="form-label">Nombre de la Tarjeta</label>
            <input id="tj-nombre" name="nombre" placeholder="Ej. Tarjeta Caixa Oro, Tarjeta Carrefour Pass, Tarjeta DB..." required>
          </div>
          <div class="form-group form-span-2">
            <label for="tj-entidad" class="form-label">Entidad Emisora</label>
            <select id="tj-entidad" name="entidad" required>
              <option value="Caixa">Caixa</option>
              <option value="Deutsche Bank">Deutsche Bank</option>
              <option value="Carrefour">Carrefour</option>
              <option value="BBVA">BBVA</option>
              <option value="Revolut">Revolut</option>
              <option value="Otras">Otra Entidad</option>
            </select>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="tj-saldo" class="form-label">Saldo Inicial o Deuda Pendiente (€)</label>
            <input id="tj-saldo" name="saldo_inicial" inputmode="decimal" placeholder="0.00 o -50.00 (deuda)" value="0.00">
          </div>
          <div class="form-group form-span-2">
            <label for="tj-apertura" class="form-label">Fecha de Apertura / Activación</label>
            <input id="tj-apertura" name="fecha_apertura" type="date" value="${hoy()}" required>
          </div>
        </div>

        <div id="err-tarjeta"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Crear Tarjeta
          </button>
        </div>
      </form>
    </div>
  </section>
  `;
});
