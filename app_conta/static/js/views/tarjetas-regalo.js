// Vista de Tarjetas Regalo y Monederos: Control del saldo disponible en tarjetas prepago y regalo
import { vista, esc, importe, hoy, icono, subnavCuentas } from "../vistas.js";

export function esTarjetaRegalo(c) {
  if (c.tipo !== "tarjeta") return false;
  const txt = `${c.nombre} ${c.entidad || ""}`.toLowerCase();
  const esBanco =
    txt.includes("caixa") ||
    txt.includes("deutsche") ||
    txt.includes("bbva") ||
    txt.includes("revolut") ||
    txt.includes("santander") ||
    txt.includes("banco") ||
    txt.includes("bank");
  if (esBanco && !txt.includes("regalo")) return false;
  return (
    txt.includes("regalo") ||
    txt.includes("gift") ||
    txt.includes("monedero") ||
    txt.includes("prepago") ||
    txt.includes("amazon") ||
    txt.includes("corte ingles") ||
    txt.includes("corte inglés") ||
    txt.includes("ikea") ||
    txt.includes("decathlon") ||
    txt.includes("zalando") ||
    txt.includes("steam") ||
    (!txt.includes("carrefour pass") && txt.includes("carrefour regalo")) ||
    (c.entidad && c.entidad.toLowerCase().includes("regalo"))
  );
}

function tarjetaRegaloItem(c) {
  return `
    <article class="glass-account-card">
      <div class="acc-card-top">
        <div class="acc-card-brand-group">
          <div class="acc-card-icon-wrap" style="color: var(--accent-2);">
            ${icono("regalo")}
          </div>
          <div class="acc-card-name-group">
            <h3 class="acc-card-name" title="${esc(c.nombre)}">${esc(c.nombre)}</h3>
            <span class="acc-card-badge">${esc(c.entidad || "Tarjeta Regalo")}</span>
          </div>
        </div>

        <div class="card-more-menu-wrapper">
          <button type="button" class="btn-card-more" aria-label="Opciones de ${esc(c.nombre)}" title="Opciones" onclick="this.nextElementSibling.classList.toggle('is-open')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
        <span class="acc-card-balance-label">Saldo disponible</span>
        <div class="acc-card-balance-val text-pos">${importe(c.saldo)}</div>
      </div>

      <div class="loan-card-bottom-meta" style="margin-top: 1rem;">
        <span>Tarjeta prepago</span>
        <span>Inicial: ${c.saldo_inicial} €</span>
      </div>
    </article>
  `;
}

export default vista("tarjetas-regalo", async () => {
  const data = await API.get("/cuentas");
  const tarjetasRegalo = data.items.filter(esTarjetaRegalo);
  const totalRegalo = tarjetasRegalo.reduce((acc, c) => acc + Number(c.saldo), 0);

  return `
  ${subnavCuentas("tarjetas-regalo")}

  <!-- 1. Total en Tarjetas Regalo Arriba -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Total en Tarjetas Regalo</span>
    <div class="hero-total-amount text-pos">${importe(totalRegalo.toFixed(2))}</div>
    <span class="hero-total-sub">${tarjetasRegalo.length} tarjetas regalo activas</span>
  </div>

  <!-- 2. Cuadrícula de Tarjetas Regalo -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <div class="loans-grid">
      ${
        tarjetasRegalo.length > 0
          ? tarjetasRegalo.map(tarjetaRegaloItem).join("\n")
          : `
          <div class="glass-card tarjeta-vacia" style="grid-column: 1 / -1;">
            <div class="tarjeta-vacia-icon">${icono("regalo")}</div>
            <h4>No tienes tarjetas regalo registradas</h4>
            <p>Añade tarjetas prepago o saldo de Amazon, El Corte Inglés, Carrefour, etc.</p>
          </div>
          `
      }
    </div>
  </section>

  <!-- 3. Formulario para nueva tarjeta regalo -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Dar de Alta Nueva Tarjeta Regalo
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-tarjeta-regalo" data-err="err-tarjeta-regalo" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Registra una tarjeta prepago para seguir las compras y el saldo restante.
          </p>

          <div class="form-grid-2">
            <div class="campo">
              <label for="tjr-nombre">Nombre de la Tarjeta *</label>
              <input id="tjr-nombre" name="nombre" placeholder="Ej. Tarjeta Amazon 50€, Cheque Regalo ECI..." required>
            </div>
            <div class="campo">
              <label for="tjr-entidad">Comercio o Entidad Emisora *</label>
              <input id="tjr-entidad" name="entidad" placeholder="Ej. Amazon, El Corte Inglés, Carrefour..." required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label for="tjr-saldo">Saldo Inicial (€) *</label>
              <input id="tjr-saldo" name="saldo_inicial" inputmode="decimal" placeholder="50.00" required>
            </div>
            <div class="campo">
              <label for="tjr-apertura">Fecha de Activación</label>
              <input id="tjr-apertura" name="fecha_apertura" type="date" value="${hoy()}" required>
            </div>
          </div>

          <div id="err-tarjeta-regalo"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Crear Tarjeta Regalo
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
