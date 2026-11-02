// Vista de Cuentas y Depósitos: Organización clara y elegante en carrusel de cristal con sparklines
import { vista, esc, importe, hoy, icono, subnavCuentas } from "../vistas.js";

const BANCOS_CONFIG = [
  { id: "caixa", nombre: "CaixaBank / Caixa", iconoKey: "caixa", color: "#0072ce" },
  { id: "deutsche", nombre: "Deutsche Bank", iconoKey: "deutsche", color: "#0018a8" },
  { id: "bbva", nombre: "BBVA", iconoKey: "bbva", color: "#004481" },
  { id: "revolut", nombre: "Revolut", iconoKey: "revolut", color: "#12141A" },
  { id: "otros", nombre: "Depósito / Efectivo", iconoKey: "banco", color: "#0d9488" },
];

function clasificarBanco(cuenta) {
  const nombre = (cuenta.nombre || "").toLowerCase();
  const entidad = (cuenta.entidad || "").toLowerCase();
  const texto = `${nombre} ${entidad}`;

  if (texto.includes("caixa")) return "caixa";
  if (texto.includes("deutsche") || texto.includes("deustche") || texto.includes(" db")) return "deutsche";
  if (texto.includes("bbva")) return "bbva";
  if (texto.includes("revolut")) return "revolut";
  return "otros";
}

function generarSparkline(seed, saldo) {
  const numSaldo = Number(saldo) || 0;
  const isPos = numSaldo >= 0;
  const s = Math.abs(Number(seed) || 1);
  const y1 = 28 + Math.sin(s * 1.5) * 8;
  const y2 = 18 + Math.cos(s * 2.1) * 9;
  const y3 = 22 + Math.sin(s * 3.7) * 7;
  const y4 = isPos ? 12 : 36;
  
  const strokeColor = isPos ? "var(--accent)" : "var(--neg)";
  const gradId = `spark-grad-${seed}`;

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

function tarjetaCuentaCarousel(c) {
  const bancoId = clasificarBanco(c);
  const bancoConfig = BANCOS_CONFIG.find((b) => b.id === bancoId) || {
    id: "otros",
    nombre: c.entidad || "Depósito Bancario",
    iconoKey: c.tipo === "efectivo" ? "efectivo" : "banco",
  };
  const iconoKey = c.tipo === "efectivo" ? "efectivo" : bancoConfig.iconoKey;
  const esEfectivo = c.tipo === "efectivo";
  const tipoLabel = esEfectivo ? "Efectivo / Caja" : c.tipo === "inversion" ? "Inversión" : "Cuenta Corriente";
  const numSaldo = Number(c.saldo) || 0;

  return `
    <article class="glass-account-card ${bancoId}">
      <div class="acc-card-top">
        <div class="acc-card-brand-group">
          <div class="acc-card-icon-wrap ${bancoId}">
            ${icono(iconoKey)}
          </div>
          <div class="acc-card-name-group">
            <h3 class="acc-card-name" title="${esc(c.nombre)}">${esc(c.nombre)}</h3>
            <span class="acc-card-badge">${esc(c.entidad || bancoConfig.nombre)} · ${esc(tipoLabel)}</span>
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
              ${icono("borrar")} Eliminar cuenta
            </button>
          </div>
        </div>
      </div>

      <div class="acc-card-balance-block">
        <span class="acc-card-balance-label">Saldo disponible</span>
        <div class="acc-card-balance-val ${numSaldo < 0 ? 'text-neg' : ''}">${importe(c.saldo)}</div>
      </div>

      ${generarSparkline(c.id, c.saldo)}
    </article>
  `;
}

export default vista("cuentas", async () => {
  const data = await API.get("/cuentas");

  // Filtramos: solo cuentas y depósitos (excluimos tarjetas, van a su pestaña propia)
  const cuentasValidas = data.items.filter(
    (c) => c.tipo !== "tarjeta" && !c.nombre.toUpperCase().startsWith("TARJETA")
  );

  const totalCuentas = cuentasValidas.reduce((acc, c) => acc + Number(c.saldo), 0);

  return `
  ${subnavCuentas("cuentas")}

  <!-- 1. Total Arriba Protagonista -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Total en Cuentas y Depósitos</span>
    <div class="hero-total-amount">${importe(totalCuentas.toFixed(2))}</div>
    <span class="hero-total-sub">${cuentasValidas.length} cuentas y depósitos activos</span>
  </div>

  <!-- 2. Carrusel Horizontal con Scroll-Snap -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <div class="carousel-section-header">
      <h3 class="carousel-title">Posición por Entidad</h3>
      <span class="carousel-counter">${cuentasValidas.length} tarjetas</span>
    </div>

    ${
      cuentasValidas.length > 0
        ? `
        <div class="accounts-carousel" role="region" aria-label="Carrusel de cuentas">
          ${cuentasValidas.map(tarjetaCuentaCarousel).join("\n")}
        </div>
        `
        : `
        <div class="glass-card tarjeta-vacia">
          <div class="tarjeta-vacia-icon">${icono("banco")}</div>
          <h4>No tienes cuentas registradas todavía</h4>
          <p>Añade tu primera cuenta corriente, libreta de ahorro o depósito en el formulario inferior para comenzar a operar.</p>
        </div>
        `
    }
  </section>

  <!-- 3. Desglose detallado en lista limpia -->
  ${
    cuentasValidas.length > 0
      ? `
    <section class="glass-card accounts-breakdown-card">
      <div class="carousel-section-header" style="margin-bottom: 0.75rem;">
        <h3 class="carousel-title">Desglose de saldos</h3>
        <span class="carousel-counter">Liquidación</span>
      </div>
      <div class="acc-breakdown-stream">
        ${cuentasValidas
          .map((c) => {
            const bancoId = clasificarBanco(c);
            const numSaldo = Number(c.saldo) || 0;
            return `
            <div class="acc-breakdown-row">
              <div class="acc-breakdown-left">
                <div class="acc-card-icon-wrap ${bancoId}" style="width: 34px; height: 34px; border-radius: 10px;">
                  ${icono(c.tipo === "efectivo" ? "efectivo" : "banco")}
                </div>
                <div class="acc-breakdown-info">
                  <span class="acc-breakdown-name">${esc(c.nombre)}</span>
                  <span class="acc-breakdown-meta">${esc(c.entidad || "Banco")} · Inicial: ${c.saldo_inicial} €</span>
                </div>
              </div>
              <div class="acc-breakdown-amount ${numSaldo < 0 ? 'text-neg' : ''}">
                ${importe(c.saldo)}
              </div>
            </div>
            `;
          })
          .join("\n")}
      </div>
    </section>
    `
      : ""
  }

  <!-- 4. Formulario desplegable en acordeón de cristal -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Dar de alta nueva cuenta bancaria o depósito
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-cuenta" data-err="err-cuenta" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Registra una cuenta corriente, depósito o caja de efectivo para gestionar cobros y transferencias.
          </p>

          <div class="form-grid-2">
            <div class="campo">
              <label for="ct-nombre">Nombre de la cuenta *</label>
              <input id="ct-nombre" name="nombre" placeholder="Ej. Cuenta Nómina Caixa, Disponible BBVA, Efectivo..." required>
            </div>
            <div class="campo">
              <label for="ct-entidad">Entidad Bancaria / Plataforma *</label>
              <select id="ct-entidad" name="entidad" required>
                <option value="Caixa">CaixaBank</option>
                <option value="Deutsche Bank">Deutsche Bank</option>
                <option value="BBVA">BBVA</option>
                <option value="Revolut">Revolut</option>
                <option value="Otros">Otra Entidad</option>
              </select>
            </div>
          </div>

          <div class="form-grid-3">
            <div class="campo">
              <label for="ct-tipo">Tipo de depósito</label>
              <select id="ct-tipo" name="tipo" required>
                <option value="banco">🏦 Cuenta Bancaria Corriente</option>
                <option value="efectivo">💵 Efectivo / Caja</option>
                <option value="inversion">📈 Inversión / Fondo</option>
              </select>
            </div>
            <div class="campo">
              <label for="ct-saldo">Saldo inicial (€)</label>
              <input id="ct-saldo" name="saldo_inicial" inputmode="decimal" placeholder="0.00" value="0.00">
            </div>
            <div class="campo">
              <label for="ct-apertura">Fecha de apertura</label>
              <input id="ct-apertura" name="fecha_apertura" type="date" value="${hoy()}" required>
            </div>
          </div>

          <div id="err-cuenta"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Crear Cuenta Bancaria
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
