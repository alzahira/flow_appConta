// Vista de Inversiones y Carteras: Seguimiento de patrimonio, rentabilidad, fondos, ETFs, cripto y renta fija.
import { vista, esc, importe, hoy, fechaCorta, icono, subnavCuentas } from "../vistas.js";

const ICONOS_ACTIVO = {
  fondos: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  acciones_etfs: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
  renta_fija: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>`,
  pensiones: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  cripto: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.5 9h4.5a2 2 0 0 1 0 4H9.5"/><path d="M9.5 13h5a2 2 0 0 1 0 4H9.5"/><line x1="9.5" y1="7" x2="9.5" y2="19"/></svg>`,
  inmobiliario: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  otros: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

const NOMBRES_TIPO = {
  fondos: "Fondos Indexados",
  acciones_etfs: "Acciones & ETFs",
  renta_fija: "Renta Fija / Letras",
  pensiones: "Planes de Pensiones",
  cripto: "Criptoactivos",
  inmobiliario: "Inmobiliario",
  otros: "Otros Activos",
};

let filtroActivo = "todos";

export function fijarFiltroInversion(tipo) {
  filtroActivo = tipo || "todos";
}

function iconoActivo(tipo) {
  return ICONOS_ACTIVO[tipo] || ICONOS_ACTIVO.otros;
}

function tarjetaInversionItem(inv, cuentas) {
  const nombreTipo = NOMBRES_TIPO[inv.tipo_activo] || inv.tipo_activo;
  const cuentaVinculada = cuentas.find((c) => c.id === inv.cuenta_id);
  const opcionesCuentas = cuentas
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === inv.cuenta_id ? "selected" : ""}>${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`
    )
    .join("");

  return `
    <article class="glass-loan-card">
      <div class="loan-card-top">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="acc-card-icon-wrap" style="color: var(--accent); width: 38px; height: 38px;">
            ${iconoActivo(inv.tipo_activo)}
          </div>
          <div class="loan-card-title-group">
            <h3 class="loan-card-title">${esc(inv.nombre)}</h3>
            <span class="loan-card-entity">${esc(inv.entidad)} · ${esc(nombreTipo)}</span>
          </div>
        </div>

        <div class="card-more-menu-wrapper">
          <button type="button" class="btn-card-more" aria-label="Opciones de ${esc(inv.nombre)}" title="Opciones" onclick="this.nextElementSibling.classList.toggle('is-open')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <div class="card-more-dropdown">
            <button type="button" class="dropdown-item-danger" style="color: var(--fg);" data-accion="actualizar-valor-inversion" data-id="${inv.id}" data-nombre="${esc(inv.nombre)}" data-valor="${inv.valor_actual}">
              ${icono("editar")} Actualizar cotización
            </button>
            <button type="button" class="dropdown-item-danger" data-accion="borrar-inversion" data-id="${inv.id}" data-nombre="${esc(inv.nombre)}">
              ${icono("borrar")} Eliminar posición
            </button>
          </div>
        </div>
      </div>

      <div class="loan-pending-block">
        <span class="loan-pending-label">Capital invertido</span>
        <div class="loan-pending-val" style="color: var(--fg);">${importe(inv.capital_aportado)}</div>
      </div>

      <div class="loan-card-bottom-meta">
        <span>Desde ${fechaCorta(inv.fecha_inicio)}</span>
        <span>${cuentaVinculada ? esc(cuentaVinculada.nombre) : "Sin cuenta vinculada"}</span>
      </div>

      <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--divider);">
        <details class="loan-pay-details">
          <summary style="font-size: 0.78rem; color: var(--accent-text); cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 500;">
            ${icono("plus")} Aportar o Reembolsar capital
          </summary>
          <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.85rem;">
            <!-- Form Aportación -->
            <form data-accion="aportar-inversion" data-id="${inv.id}" class="fintech-form" style="display: flex; flex-direction: column; gap: 0.5rem;">
              <span style="font-size: 0.75rem; font-weight: 600; color: var(--pos);">+ Aportar dinero</span>
              <div class="form-grid-2">
                <input name="importe" inputmode="decimal" placeholder="100.00" required style="font-size: 0.82rem; padding: 0.4rem 0.7rem;">
                <select name="cuenta_id" style="font-size: 0.82rem; padding: 0.4rem 0.7rem;">
                  <option value="">— Sin cuenta —</option>
                  ${opcionesCuentas}
                </select>
              </div>
              <button type="submit" class="btn-primary" style="align-self: flex-end; font-size: 0.78rem; padding: 0.35rem 0.85rem;">
                Confirmar aportación
              </button>
            </form>

            <!-- Form Reembolso -->
            <form data-accion="reembolsar-inversion" data-id="${inv.id}" class="fintech-form" style="display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.6rem; border-top: 1px dashed var(--divider);">
              <span style="font-size: 0.75rem; font-weight: 600; color: var(--fg-2);">− Reembolsar / Vender</span>
              <div class="form-grid-2">
                <input name="importe" inputmode="decimal" placeholder="100.00" required style="font-size: 0.82rem; padding: 0.4rem 0.7rem;">
                <select name="cuenta_id" style="font-size: 0.82rem; padding: 0.4rem 0.7rem;">
                  <option value="">— Sin cuenta —</option>
                  ${opcionesCuentas}
                </select>
              </div>
              <button type="submit" class="btn-secondary" style="align-self: flex-end; font-size: 0.78rem; padding: 0.35rem 0.85rem;">
                Confirmar reembolso
              </button>
            </form>
          </div>
        </details>
      </div>
    </article>
  `;
}

export default vista("inversiones", async () => {
  const [data, cuentasData] = await Promise.all([
    API.get("/inversiones"),
    API.get("/cuentas"),
  ]);

  const cuentas = (cuentasData.items || []).filter(
    (c) => c.tipo !== "tarjeta" && !c.nombre.toUpperCase().startsWith("TARJETA")
  );

  const posiciones = data.inversiones || [];
  const posicionesFiltradas =
    filtroActivo === "todos"
      ? posiciones
      : posiciones.filter((p) => p.tipo_activo === filtroActivo);

  const conteos = { todos: posiciones.length };
  for (const p of posiciones) {
    conteos[p.tipo_activo] = (conteos[p.tipo_activo] || 0) + 1;
  }

  const tiposPills = [
    { id: "todos", nombre: "Todas las posiciones" },
    { id: "fondos", nombre: "Fondos Indexados" },
    { id: "acciones_etfs", nombre: "Acciones & ETFs" },
    { id: "renta_fija", nombre: "Renta Fija" },
    { id: "pensiones", nombre: "Pensiones" },
    { id: "cripto", nombre: "Cripto" },
    { id: "inmobiliario", nombre: "Inmobiliario" },
  ];

  setTimeout(() => {
    document.querySelectorAll("[data-filtro-inv]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        fijarFiltroInversion(e.currentTarget.dataset.filtroInv);
        const main = document.getElementById("vista");
        const actual = (await import("./inversiones.js")).default;
        main.innerHTML = await actual.render();
      });
    });
  }, 50);

  return `
  ${subnavCuentas("inversiones")}

  <!-- 1. Total Invertido Arriba -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Capital Total Invertido</span>
    <div class="hero-total-amount text-pos">${importe(data.total_capital_aportado)}</div>
    <span class="hero-total-sub">${posiciones.length} posiciones en cartera patrimonial</span>
  </div>

  <!-- 2. Filtro en Chips -->
  <div class="botes-filter-scroll" role="region" aria-label="Filtro de inversiones">
    ${tiposPills
      .filter((t) => t.id === "todos" || (conteos[t.id] && conteos[t.id] > 0))
      .map(
        (t) => `
      <button type="button" class="glass-filter-chip ${filtroActivo === t.id ? "activo" : ""}" data-filtro-inv="${t.id}">
        <span>${t.nombre}</span>
        <span class="filter-chip-count">${conteos[t.id] || 0}</span>
      </button>
    `
      )
      .join("")}
  </div>

  <!-- 3. Cuadrícula de Posiciones de Inversión -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <div class="loans-grid">
      ${
        posicionesFiltradas.length > 0
          ? posicionesFiltradas.map((inv) => tarjetaInversionItem(inv, cuentas)).join("\n")
          : `
          <div class="glass-card tarjeta-vacia" style="grid-column: 1 / -1;">
            <div class="tarjeta-vacia-icon">${icono("inversion")}</div>
            <h4>No hay posiciones en esta categoría</h4>
            <p>Añade un fondo indexado, acciones, letras o plan de pensiones desde el formulario inferior.</p>
          </div>
          `
      }
    </div>
  </section>

  <!-- 4. Formulario desplegable para nueva inversión -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Dar de Alta Nueva Posición de Inversión
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-inversion" data-err="err-inversion" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Registra un fondo, cartera de inversión o activo para seguir tu patrimonio neto.
          </p>

          <div class="form-grid-3">
            <div class="campo">
              <label for="inv-nombre">Nombre de la inversión *</label>
              <input id="inv-nombre" name="nombre" placeholder="Ej. Indexa Capital RV, MyInvestor S&P500..." required>
            </div>
            <div class="campo">
              <label for="inv-entidad">Entidad o Broker *</label>
              <input id="inv-entidad" name="entidad" placeholder="Ej. Indexa Capital, Trade Republic..." required>
            </div>
            <div class="campo">
              <label for="inv-tipo">Tipo de Activo</label>
              <select id="inv-tipo" name="tipo_activo" required>
                <option value="fondos" selected>Fondos Indexados</option>
                <option value="acciones_etfs">Acciones & ETFs</option>
                <option value="renta_fija">Renta Fija / Letras</option>
                <option value="pensiones">Planes de Pensiones</option>
                <option value="cripto">Criptoactivos</option>
                <option value="inmobiliario">Inmobiliario</option>
                <option value="otros">Otros</option>
              </select>
            </div>
          </div>

          <div class="form-grid-3">
            <div class="campo">
              <label for="inv-aportado">Capital inicial (€) *</label>
              <input id="inv-aportado" name="capital_aportado" inputmode="decimal" placeholder="1000.00" required>
            </div>
            <div class="campo">
              <label for="inv-origen">Descontar de cuenta bancaria</label>
              <select id="inv-origen" name="cuenta_id">
                <option value="">— No registrar movimiento en cuenta —</option>
                ${cuentas.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}
              </select>
            </div>
            <div class="campo">
              <label for="inv-inicio">Fecha de Inicio</label>
              <input id="inv-inicio" name="fecha_inicio" type="date" value="${hoy()}">
            </div>
          </div>

          <div id="err-inversion"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Registrar Inversión
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
