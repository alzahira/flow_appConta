// Vista de Previsión de Gastos y Bote Anual (IBI, Seguros, Basuras, Sellos...)
import { esc, importe, vista, icono } from "../vistas.js";

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function badgeEstadoGasto(g) {
  const saldoNum = Number(g.saldo);
  if (g.estado === "superavit" || saldoNum > 0) {
    return `<span class="badge-tag ok">${icono("check")} Superávit</span>`;
  }
  if (g.estado === "deficit" || saldoNum < 0) {
    return `<span class="badge-tag alerta">${icono("alerta")} Déficit</span>`;
  }
  if (g.estado === "inactivo") {
    return `<span class="badge-tag subtle">Inactivo</span>`;
  }
  return `<span class="badge-tag info">${icono("check")} Al día</span>`;
}

function tarjetaGastoAnual(g, mesActivoNombre) {
  const saldoNum = Number(g.saldo);
  const esSuperavit = saldoNum > 0;
  const esDeficit = saldoNum < 0;
  const claseColorSaldo = esSuperavit ? "text-pos" : esDeficit ? "text-neg" : "";
  const pctGuardado = Math.min(100, Math.max(0, Math.round((Number(g.provision_acumulada) / (Number(g.importe_anual) || 1)) * 100)));

  return `
    <article class="glass-account-card ${g.activo ? '' : 'row-inactivo'}" style="min-height: auto; padding: 1.25rem 1.4rem;">
      <div class="acc-card-top">
        <div class="acc-card-brand-group">
          <div class="acc-card-icon-wrap" style="color: var(--accent); background: rgba(124, 92, 255, 0.1);">
            ${icono("calendario")}
          </div>
          <div class="acc-card-name-group">
            <h3 class="acc-card-name" title="${esc(g.concepto)}">${esc(g.concepto)}</h3>
            <span class="acc-card-badge">Mes de cobro: <strong>${esc(g.fecha_cobro)}</strong></span>
          </div>
        </div>

        <div class="card-more-menu-wrapper">
          <button type="button" class="btn-card-more" aria-label="Opciones de ${esc(g.concepto)}" title="Opciones" onclick="this.nextElementSibling.classList.toggle('is-open')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <div class="card-more-dropdown">
            <button type="button" class="dropdown-item-danger" style="color: var(--fg);" data-accion="editar-gasto" data-id="${g.id}" data-concepto="${esc(g.concepto)}" data-fecha="${esc(g.fecha_cobro)}" data-anual="${g.importe_anual}" data-cuota="${g.cuota_mensual}" data-notas="${esc(g.notas || "")}">
              ${icono("editar")} Modificar gasto
            </button>
            <button type="button" class="dropdown-item-danger" data-accion="borrar-gasto" data-id="${g.id}" data-concepto="${esc(g.concepto)}">
              ${icono("borrar")} Eliminar gasto
            </button>
          </div>
        </div>
      </div>

      ${g.notas ? `<p style="font-size: 0.76rem; color: var(--fg-2); margin: 0.4rem 0 0.6rem 0; line-height: 1.4;">${esc(g.notas)}</p>` : ""}

      <!-- Saldo en Bote y Badge de Estado -->
      <div class="acc-card-balance-block" style="margin: 0.85rem 0 0.6rem 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
          <span class="acc-card-balance-label">Saldo en Bote</span>
          ${badgeEstadoGasto(g)}
        </div>
        <div class="acc-card-balance-val ${claseColorSaldo}" style="font-size: 1.75rem;">${importe(g.saldo)}</div>
      </div>

      <!-- Barra de progreso fina (4px) -->
      <div class="loan-progress-track" style="margin-bottom: 0.85rem;" title="${pctGuardado}% presupuestado">
        <div class="loan-progress-fill" style="width: ${pctGuardado}%; background: ${esDeficit ? 'var(--neg)' : 'var(--accent)'};"></div>
      </div>

      <!-- Métricas en rejilla limpia -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; padding: 0.65rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); font-size: 0.8rem;">
        <div>
          <span style="color: var(--fg-2); font-size: 0.72rem; display: block;">Cuota mensual</span>
          <strong style="color: var(--fg); font-variant-numeric: tabular-nums;">${importe(g.cuota_mensual)}/mes</strong>
          <span style="color: var(--fg-2); font-size: 0.7rem; display: block;">Anual: ${importe(g.importe_anual)}</span>
        </div>
        <div>
          <span style="color: var(--fg-2); font-size: 0.72rem; display: block;">Provisión (${mesActivoNombre})</span>
          <strong style="color: var(--pos); font-variant-numeric: tabular-nums;">${importe(g.provision_acumulada)}</strong>
          <span style="color: var(--fg-2); font-size: 0.7rem; display: block;">${pctGuardado}% del coste anual</span>
        </div>
      </div>

      <!-- Factura Pagada Real y Botón Registrar Cobro -->
      <div style="margin-top: 0.8rem; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span style="color: var(--fg-2); font-size: 0.72rem; display: block;">Factura pagada</span>
          <strong style="color: var(--fg); font-variant-numeric: tabular-nums; font-size: 0.92rem;">${importe(g.pagado_real)}</strong>
        </div>
        <button type="button" class="btn-secondary mini" data-accion="pagar-gasto" data-id="${g.id}" data-concepto="${esc(g.concepto)}" data-actual="${g.pagado_real}" style="font-size: 0.75rem; padding: 0.35rem 0.7rem; border-radius: 8px;">
          ${icono("plus")} Factura / Recibo
        </button>
      </div>
    </article>
  `;
}

export default vista("prevision-gastos", async () => {
  const data = await API.get("/prevision-gastos");

  const meses = data.meses_pagados || 0;
  const mesActualNombre = meses > 0 && meses <= 12 ? MESES_NOMBRES[meses - 1] : `Mes ${meses}`;
  const gastos = data.gastos || [];

  const saldoTotalNum = Number(data.total_saldo || 0);
  const esSuperavitTotal = saldoTotalNum >= 0;

  return `
  <!-- 1. Hero Total -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Total a Guardar al Mes para Bote Anual</span>
    <div class="hero-total-amount text-pos">${importe(data.total_mensual)} <span style="font-size: 0.5em; color: var(--fg-2);">/mes</span></div>
    <span class="hero-total-sub">Total anual presupuestado: ${importe(data.total_anual)} · Año ${data.anio}</span>
  </div>

  <!-- 2. Control del Mes Acumulado en Cristal -->
  <section class="glass-card" style="padding: 1.15rem 1.4rem; margin-bottom: 1.25rem;">
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 0.85rem;">
        <div class="acc-card-icon-wrap" style="color: var(--accent); background: rgba(124, 92, 255, 0.1);">
          ${icono("calendario")}
        </div>
        <div>
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--fg); margin: 0;">Provisión Acumulada del Bote</h3>
          <p style="font-size: 0.8rem; color: var(--fg-2); margin: 2px 0 0 0;">
            Mes activo: <strong style="color: var(--accent);">${mesActualNombre}</strong> (${meses} de 12 meses guardados)
          </p>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <button type="button" class="btn-secondary mini" data-accion="ajustar-mes-prevision" data-delta="-1" ${meses <= 0 ? "disabled" : ""} style="padding: 0.4rem 0.8rem; border-radius: 8px;">
          &minus; Mes
        </button>
        <span class="glass-filter-chip" style="font-weight: 600; padding: 0.4rem 0.85rem;">${mesActualNombre}</span>
        <button type="button" class="btn-secondary mini" data-accion="ajustar-mes-prevision" data-delta="1" ${meses >= 12 ? "disabled" : ""} style="padding: 0.4rem 0.8rem; border-radius: 8px;">
          &plus; Mes
        </button>

        <select class="sel-mes-directo glass-filter-chip" data-accion="cambiar-mes-directo" style="padding: 0.4rem 0.75rem; outline: none; border-radius: 8px; cursor: pointer;">
          <option value="0" ${meses === 0 ? "selected" : ""}>0. Sin provisión acumulada</option>
          ${MESES_NOMBRES.map(
            (m, idx) => `
            <option value="${idx + 1}" ${meses === idx + 1 ? "selected" : ""}>
              ${idx + 1}. ${m}
            </option>`
          ).join("")}
        </select>
      </div>
    </div>
  </section>

  <!-- 3. Ecuación Visual y Resumen en Chips de Cristal -->
  <section class="glass-summary-chips-row" style="margin-bottom: 1.5rem;">
    <div class="glass-capsule-chip">
      <span class="chip-glow-bullet dot-cyan"></span>
      <span class="chip-title">Provisión (${mesActualNombre})</span>
      <strong class="chip-val" style="color: var(--pos);">${importe(data.total_provision)}</strong>
    </div>
    <div class="glass-capsule-chip">
      <span class="chip-glow-bullet dot-violet"></span>
      <span class="chip-title">Facturas Pagadas</span>
      <strong class="chip-val">${importe(data.total_pagado)}</strong>
    </div>
    <div class="glass-capsule-chip">
      <span class="chip-glow-bullet dot-blue"></span>
      <span class="chip-title">Saldo Neto Bote</span>
      <strong class="chip-val ${esSuperavitTotal ? 'text-pos' : 'text-neg'}">${importe(data.total_saldo)}</strong>
    </div>
  </section>

  <!-- 4. Rejilla de Tarjetas de Gastos Periódicos -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <div class="carousel-section-header" style="margin-bottom: 1rem;">
      <div>
        <h3 class="carousel-title">Recibos y Gastos Anuales</h3>
        <p style="font-size: 0.8rem; color: var(--fg-2); margin: 2px 0 0 0;">
          Seguimiento de provisiones y pagos reales de impuestos, seguros y suministros
        </p>
      </div>
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="carousel-counter">${gastos.length} gastos</span>
        <button type="button" class="btn-subtle mini" data-accion="restablecer-semilla-prevision" title="Cargar los 16 gastos habituales del hogar" style="background: transparent; border: none; font-size: 0.8rem; color: var(--fg-2); cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;">
          ${icono("volver")} Plantilla inicial
        </button>
      </div>
    </div>

    ${
      gastos.length === 0
        ? `
        <div class="glass-card tarjeta-vacia">
          <div class="tarjeta-vacia-icon">${icono("calendario")}</div>
          <h4>No hay gastos anuales registrados</h4>
          <p>Pulsa en "Plantilla inicial" para cargar los recibos habituales o añade uno nuevo en el formulario inferior.</p>
        </div>
        `
        : `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 1.25rem;">
          ${gastos.map((g) => tarjetaGastoAnual(g, mesActualNombre)).join("\n")}
        </div>
        `
    }
  </section>

  <!-- 5. Formulario desplegable para nuevo gasto periódico -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Añadir Nuevo Gasto Anual / Periódico
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-gasto-recurrente" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Registra un impuesto, seguro o recibo periódico para calcular automáticamente su cuota mensual a guardar.
          </p>

          <div class="form-grid-2">
            <div class="campo">
              <label>Concepto del Gasto *</label>
              <input name="concepto" placeholder="Ej. Seguro Dental, IBI Vivienda, Basuras..." required>
            </div>
            <div class="campo">
              <label>Mes de Cobro Habitual *</label>
              <input name="fecha_cobro" placeholder="Ej. Octubre, Trimestral, Diciembre..." required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label>Importe Anual Estimado (€) *</label>
              <input name="importe_anual" inputmode="decimal" placeholder="180.00" required>
            </div>
            <div class="campo">
              <label>Cuota Mensual (Opcional, se calcula automáticamente)</label>
              <input name="cuota_mensual" inputmode="decimal" placeholder="Dejar vacío para dividir entre 12">
            </div>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label>Pagado Real hasta ahora (€)</label>
              <input name="pagado_real" inputmode="decimal" placeholder="0.00">
            </div>
            <div class="campo">
              <label>Notas</label>
              <input name="notas" placeholder="Ej. Domiciliado en CaixaBank...">
            </div>
          </div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Guardar Gasto
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
