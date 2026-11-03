// Vista de Tarjetas: Control y liquidación de tarjetas de crédito y débito bancarias
import { vista, esc, importe, hoy, icono, subnavCuentas } from "../vistas.js";
import { esTarjetaRegalo } from "./tarjetas-regalo.js";

function generarSparklineTarjeta(seed, saldo) {
  const numSaldo = Number(saldo) || 0;
  const isPos = numSaldo >= 0;
  const s = Math.abs(Number(seed) || 2);
  const y1 = 26 + Math.cos(s * 1.8) * 8;
  const y2 = 18 + Math.sin(s * 2.5) * 8;
  const y3 = 24 + Math.cos(s * 3.1) * 6;
  const y4 = isPos ? 12 : 28;

  const strokeColor = "var(--accent)";
  const gradId = `spark-tarjeta-${seed}`;

  return `
    <div class="acc-card-sparkline-wrap" aria-hidden="true">
      <svg class="acc-card-sparkline-svg" viewBox="0 0 200 48" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="M 0 48 L 0 ${y1.toFixed(1)} C 50 ${y2.toFixed(1)}, 100 ${y3.toFixed(1)}, 200 ${y4.toFixed(1)} L 200 48 Z" fill="url(#${gradId})"/>
        <path d="M 0 ${y1.toFixed(1)} C 50 ${y2.toFixed(1)}, 100 ${y3.toFixed(1)}, 200 ${y4.toFixed(1)}" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
    </div>
  `;
}

function tarjetaCreditoItem(c) {
  const saldoNum = Number(c.saldo);
  const esDispuesto = saldoNum < 0;
  const importeMostrar = esDispuesto ? Math.abs(saldoNum).toFixed(2) : c.saldo;

  return `
    <article class="glass-account-card">
      <div class="acc-card-top">
        <div class="acc-card-brand-group">
          <div class="acc-card-icon-wrap" style="color: var(--accent);">
            ${icono("tarjetas")}
          </div>
          <div class="acc-card-name-group">
            <h3 class="acc-card-name" title="${esc(c.nombre)}">${esc(c.nombre)}</h3>
            <span class="acc-card-badge">${esc(c.entidad || "Tarjeta crédito")} · ${esDispuesto ? "Pendiente de liquidar" : "Al día"}</span>
          </div>
        </div>

        <div class="card-more-menu-wrapper">
          <button type="button" class="btn-card-more" aria-label="Opciones de ${esc(c.nombre)}" title="Opciones" onclick="this.nextElementSibling.classList.toggle('is-open')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <div class="card-more-dropdown">
            <button type="button" class="dropdown-item-danger" data-accion="borrar-cuenta" data-id="${c.id}" data-nombre="${esc(c.nombre)}">
              ${icono("borrar")} Eliminar tarjeta
            </button>
          </div>
        </div>
      </div>

      <div class="acc-card-balance-block">
        <span class="acc-card-balance-label">${esDispuesto ? "Gasto dispuesto (a pagar en banco)" : "Saldo disponible"}</span>
        <div class="acc-card-balance-val">${importe(importeMostrar)}</div>
      </div>

      ${generarSparklineTarjeta(c.id, c.saldo)}

      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--divider); display: flex; justify-content: flex-end;">
        <button type="button" class="btn-secondary" data-accion-fintech="liquidar-tarjeta" data-tarjeta-id="${c.id}" style="font-size: 0.78rem; padding: 0.35rem 0.85rem;">
          💳 Liquidar Recibo en Banco
        </button>
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

  const totalGastoDispuesto = tarjetas
    .filter((c) => Number(c.saldo) < 0)
    .reduce((acc, c) => acc + Math.abs(Number(c.saldo)), 0);

  return `
  ${subnavCuentas("tarjetas")}

  <!-- 1. Total Arriba Protagonista -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Gasto Acumulado en Tarjetas</span>
    <div class="hero-total-amount">${importe(totalGastoDispuesto.toFixed(2))}</div>
    <span class="hero-total-sub">Dinero adelantado pendiente de cobro mensual en banco · ${tarjetas.length} tarjeta(s)</span>
  </div>

  <!-- 2. Carrusel Horizontal con Scroll-Snap -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <div class="carousel-section-header">
      <h3 class="carousel-title">Tarjetas y Líneas de Crédito</h3>
      <span class="carousel-counter">${tarjetas.length} emitidas</span>
    </div>

    ${
      tarjetas.length > 0
        ? `
        <div class="accounts-carousel" role="region" aria-label="Carrusel de tarjetas">
          ${tarjetas.map(tarjetaCreditoItem).join("\n")}
        </div>
        `
        : `
        <div class="glass-card tarjeta-vacia">
          <div class="tarjeta-vacia-icon">${icono("tarjetas")}</div>
          <h4>No tienes tarjetas dadas de alta aún</h4>
          <p>Registra tu primera tarjeta de crédito o débito con el formulario inferior.</p>
        </div>
        `
    }
  </section>

  <!-- 3. Formulario desplegable en acordeón de cristal -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Dar de Alta Nueva Tarjeta
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-cuenta" data-err="err-tarjeta" class="fintech-form">
          <input type="hidden" name="tipo" value="tarjeta">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Registra una tarjeta de crédito o débito para seguir sus compras y pagos periódicos.
          </p>

          <div class="form-grid-2">
            <div class="campo">
              <label for="tj-nombre">Nombre de la Tarjeta *</label>
              <input id="tj-nombre" name="nombre" placeholder="Ej. Tarjeta Caixa Oro, Tarjeta Pass..." required>
            </div>
            <div class="campo">
              <label for="tj-entidad">Entidad Emisora *</label>
              <select id="tj-entidad" name="entidad" required>
                <option value="Caixa">CaixaBank</option>
                <option value="Deutsche Bank">Deutsche Bank</option>
                <option value="Carrefour">Carrefour</option>
                <option value="BBVA">BBVA</option>
                <option value="Revolut">Revolut</option>
                <option value="Otras">Otra Entidad</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label for="tj-saldo">Saldo Inicial o Deuda Pendiente (€)</label>
              <input id="tj-saldo" name="saldo_inicial" inputmode="decimal" placeholder="0.00 o -50.00" value="0.00">
            </div>
            <div class="campo">
              <label for="tj-apertura">Fecha de Activación</label>
              <input id="tj-apertura" name="fecha_apertura" type="date" value="${hoy()}" required>
            </div>
          </div>

          <div id="err-tarjeta"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Crear Tarjeta
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
