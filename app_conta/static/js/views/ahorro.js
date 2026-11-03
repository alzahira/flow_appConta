// Vista de Fondo Ahorro Hipoteca: Previsión futura y amortizaciones
import { esc, importe, vista, icono, hoy, fechaCorta, subnavAhorro } from "../vistas.js";
import { pintarFilaMovimiento, setGlobalCaches } from "./movimientos.js";

let ahorroSeleccionadoId = null;

export function seleccionarFondoAhorro(id) {
  ahorroSeleccionadoId = id ? Number(id) : null;
}

function tarjetaFondoAhorro(b) {
  const obj = Number(b.objetivo);
  const sal = Number(b.saldo);
  const tieneObj = b.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(100, (sal / obj) * 100)) : 0;

  return `
    <article class="glass-loan-card" data-accion="ver-detalle-ahorro" data-id="${b.id}" tabindex="0" role="button" aria-label="Fondo ${esc(b.nombre)}">
      <div class="loan-card-top">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="acc-card-icon-wrap" style="color: var(--accent); width: 38px; height: 38px;">
            ${icono("ahorro")}
          </div>
          <div class="loan-card-title-group">
            <h3 class="loan-card-title">${esc(b.nombre)}</h3>
            <span class="loan-card-entity">${b.objetivo_fecha ? `Meta: ${fechaCorta(b.objetivo_fecha)}` : "Fondo de amortización"}</span>
          </div>
        </div>

        <div class="card-more-menu-wrapper">
          <button type="button" class="btn-card-more" data-accion="toggle-menu-bote" aria-label="Opciones de ${esc(b.nombre)}" title="Opciones">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <div class="card-more-dropdown">
            <button type="button" class="dropdown-item" data-accion="editar-bote" data-id="${b.id}">
              ${icono("editar")} Editar fondo
            </button>
            <button type="button" class="dropdown-item-danger" data-accion="borrar-bote" data-id="${b.id}" data-nombre="${esc(b.nombre)}">
              ${icono("borrar")} Eliminar fondo
            </button>
          </div>
        </div>
      </div>

      <div class="loan-pending-block">
        <span class="loan-pending-label">Ahorro acumulado</span>
        <div class="loan-pending-val" style="color: var(--pos);">${importe(b.saldo)}</div>
      </div>

      ${
        tieneObj
          ? `
        <div class="loan-progress-track">
          <div class="loan-progress-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="loan-card-bottom-meta">
          <span>${pct.toFixed(0)}% completado</span>
          <span>Meta: ${importe(b.objetivo)}</span>
        </div>
      `
          : ""
      }
    </article>
  `;
}

async function renderDetalleFondoAhorro(fondoId, cuentas) {
  const [bote, movsData] = await Promise.all([
    API.get(`/botes/${fondoId}`),
    API.get(`/movimientos?bote=${fondoId}&limit=100&orden=desc`),
  ]);

  const movs = movsData.items || [];
  const obj = Number(bote.objetivo);
  const sal = Number(bote.saldo);
  const tieneObj = bote.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(100, (sal / obj) * 100)) : 0;

  const totalAportaciones = movs
    .filter((m) => Number(m.importe) > 0)
    .reduce((acc, m) => acc + Number(m.importe), 0);
  const totalSalidas = movs
    .filter((m) => Number(m.importe) < 0)
    .reduce((acc, m) => acc + Number(m.importe), 0);

  const opcionesCuentas = cuentas
    .map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");

  return `
    ${subnavAhorro("ahorro")}

    <div style="margin-bottom: 1.25rem;">
      <button type="button" class="btn-subtle" data-accion="cerrar-detalle-ahorro" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--fg-2); background: transparent; border: none; cursor: pointer; padding: 0.4rem 0;">
        ${icono("volver")} &larr; Volver a fondos de ahorro
      </button>
    </div>

    <!-- Hero detalle del fondo -->
    <div class="accounts-hero-total">
      <span class="hero-total-label">${esc(bote.nombre)}</span>
      <div class="hero-total-amount text-pos">${importe(bote.saldo)}</div>
      ${
        tieneObj
          ? `<span class="hero-total-sub">${pct.toFixed(0)}% completado de la meta (${bote.objetivo} €)</span>`
          : `<span class="hero-total-sub">Sin límite de meta prefijado</span>`
      }
    </div>

    <!-- Chips resumen -->
    <section class="glass-summary-chips-row" style="margin-bottom: 1.5rem;">
      <div class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-green"></span>
        <span class="chip-title">Total Aportaciones</span>
        <strong class="chip-val" style="color: var(--pos);">${importe(totalAportaciones.toFixed(2))}</strong>
      </div>
      <div class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-violet"></span>
        <span class="chip-title">Amortizaciones / Salidas</span>
        <strong class="chip-val">${importe(Math.abs(totalSalidas).toFixed(2))}</strong>
      </div>
      <div class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-blue"></span>
        <span class="chip-title">Operaciones</span>
        <strong class="chip-val">${movs.length}</strong>
      </div>
    </section>

    <!-- Formulario meter/sacar -->
    <section class="section-block" style="margin-bottom: 1.5rem;">
      <details class="glass-accordion">
        <summary>
          ${icono("plus")} Aportar o Retirar Dinero de este Fondo
        </summary>
        <div class="accordion-body">
          <form data-accion="crear-movimiento-ahorro" data-bote-id="${bote.id}" class="fintech-form">
            <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
              <label class="glass-filter-chip" style="cursor: pointer;">
                <input type="radio" name="signo" value="+" checked style="margin-right: 0.4rem;">
                <span>+ Aportar dinero al fondo</span>
              </label>
              <label class="glass-filter-chip" style="cursor: pointer;">
                <input type="radio" name="signo" value="-" style="margin-right: 0.4rem;">
                <span>− Retirar para amortizar</span>
              </label>
            </div>

            <div class="form-grid-2">
              <div class="campo">
                <label>Importe (€) *</label>
                <input name="importe" inputmode="decimal" placeholder="0.00" required>
              </div>
              <div class="campo">
                <label>Cuenta Bancaria *</label>
                <select name="cuenta_id" required>
                  ${opcionesCuentas}
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="campo">
                <label>Concepto / Motivo *</label>
                <input name="descripcion" placeholder="Ej. Aportación extraordinaria, Amortización..." required>
              </div>
              <div class="campo">
                <label>Fecha</label>
                <input name="fecha" type="date" value="${hoy()}" required>
              </div>
            </div>

            <div class="form-actions" style="margin-top: 1.25rem;">
              <button type="submit" class="btn-primary">
                ${icono("plus")} Registrar Movimiento
              </button>
            </div>
          </form>
        </div>
      </details>
    </section>

    <!-- Historial de movimientos del fondo -->
    <section class="glass-card latest-transactions-card">
      <div class="transactions-header">
        <h3 class="transactions-title">Historial de este Fondo (${movs.length})</h3>
      </div>
      <div class="transactions-stream">
        ${
          movs.length === 0
            ? `
          <div class="empty-state-stream">
            <span class="empty-stream-icon">${icono("movimientos")}</span>
            <p>No hay movimientos registrados en este fondo todavía</p>
          </div>
          `
            : movs.map(pintarFilaMovimiento).join("\n")
        }
      </div>
    </section>
  `;
}

export default vista("ahorro", async () => {
  const [botesData, cuentasData] = await Promise.all([
    API.get("/botes"),
    API.get("/cuentas"),
  ]);

  setGlobalCaches({ cuentas: cuentasData.items, botes: botesData.items });
  const cuentas = cuentasData.items || [];

  if (ahorroSeleccionadoId && botesData.items.some((b) => b.id === ahorroSeleccionadoId)) {
    return await renderDetalleFondoAhorro(ahorroSeleccionadoId, cuentas);
  }
  ahorroSeleccionadoId = null;

  const fondosHipoteca = botesData.items.filter((b) =>
    b.nombre.toLowerCase().includes("hipoteca")
  );
  const totalFondos = fondosHipoteca.reduce((acc, b) => acc + Number(b.saldo), 0);

  return `
  ${subnavAhorro("ahorro")}

  <!-- 1. Total Acumulado Arriba -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Fondo de Ahorro para Amortización</span>
    <div class="hero-total-amount text-pos">${importe(totalFondos.toFixed(2))}</div>
    <span class="hero-total-sub">${fondosHipoteca.length} fondos específicos activos</span>
  </div>

  <!-- 2. Cuadrícula de Fondos -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <div class="loans-grid">
      ${
        fondosHipoteca.length > 0
          ? fondosHipoteca.map(tarjetaFondoAhorro).join("\n")
          : `
          <div class="glass-card tarjeta-vacia" style="grid-column: 1 / -1;">
            <div class="tarjeta-vacia-icon">${icono("ahorro")}</div>
            <h4>No tienes fondos de ahorro creados</h4>
            <p>Crea un fondo destinado a la amortización anticipada de tu hipoteca o reserva de capital.</p>
          </div>
          `
      }
    </div>
  </section>

  <!-- 3. Formulario para nuevo fondo -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Crear Nuevo Fondo de Ahorro Hipoteca
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-bote-ahorro" data-err="err-bote-ahorro" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Crea un sobre específico para acumular fondos destinados a la amortización parcial o cancelación de hipoteca.
          </p>

          <div class="form-grid-3">
            <div class="campo">
              <label for="bah-nombre">Nombre del Fondo *</label>
              <input id="bah-nombre" name="nombre" placeholder="Ej. Ahorro Amortización Hipoteca..." required>
            </div>
            <div class="campo">
              <label for="bah-objetivo">Objetivo (€) (Opcional)</label>
              <input id="bah-objetivo" name="objetivo" inputmode="decimal" placeholder="Ej. 10000.00">
            </div>
            <div class="campo">
              <label for="bah-fecha">Fecha Límite</label>
              <input id="bah-fecha" name="objetivo_fecha" type="date">
            </div>
          </div>

          <div id="err-bote-ahorro"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Crear Fondo de Ahorro
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
