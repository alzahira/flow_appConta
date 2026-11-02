// Vista de Previsión de Gastos y Bote Anual (IBI, Seguros, Basuras, Sellos...)
import { esc, importe, vista, icono } from "../vistas.js";

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function badgeEstadoGasto(estado) {
  if (estado === "superavit") {
    return `<span class="badge-tag ok">${icono("check")} Superávit</span>`;
  }
  if (estado === "deficit") {
    return `<span class="badge-tag alerta">${icono("alerta")} Déficit</span>`;
  }
  if (estado === "inactivo") {
    return `<span class="badge-tag subtle">Inactivo</span>`;
  }
  return `<span class="badge-tag info">Al día</span>`;
}

function filaGasto(g, mesActivoNombre) {
  const saldoNum = Number(g.saldo);
  const claseSaldo = saldoNum > 0 ? "positivo" : saldoNum < 0 ? "negativo" : "neutro";

  return `
    <tr class="tx-row ${g.activo ? "" : "row-inactivo"}">
      <td style="width: 110px">
        ${badgeEstadoGasto(g.estado)}
      </td>
      <td class="tx-main">
        <div class="table-row-title">
          <strong style="color: var(--fg);">${esc(g.concepto)}</strong>
          ${g.notas ? `<span class="table-row-sub">${esc(g.notas)}</span>` : ""}
        </div>
      </td>
      <td>
        <span class="badge-subtle">${esc(g.fecha_cobro)}</span>
      </td>
      <td class="num">
        ${importe(g.importe_anual)}
      </td>
      <td class="num">
        ${importe(g.cuota_mensual)}
        <span class="table-row-sub">/mes</span>
      </td>
      <td class="num" title="Provisión acumulada hasta ${mesActivoNombre}">
        ${importe(g.provision_acumulada)}
      </td>
      <td class="num">
        <div style="display: inline-flex; align-items: center; gap: 0.4rem; justify-content: flex-end;">
          <span>${importe(g.pagado_real)}</span>
          <button type="button" class="btn-action-icon mini" data-accion="pagar-gasto" data-id="${g.id}" data-concepto="${esc(g.concepto)}" data-actual="${g.pagado_real}" title="Registrar factura o cobro">
            ${icono("editar")}
          </button>
        </div>
      </td>
      <td class="num">
        <span class="importe ${claseSaldo}">
          ${importe(g.saldo)}
        </span>
      </td>
      <td class="tx-actions">
        <div class="tx-actions-btns">
          <button type="button" class="btn-action-icon mini" data-accion="editar-gasto" data-id="${g.id}" data-concepto="${esc(g.concepto)}" data-fecha="${esc(g.fecha_cobro)}" data-anual="${g.importe_anual}" data-cuota="${g.cuota_mensual}" data-notas="${esc(g.notas || "")}" title="Editar configuración">
            ${icono("editar")}
          </button>
          <button type="button" class="btn-action-icon delete mini" data-accion="borrar-gasto" data-id="${g.id}" data-concepto="${esc(g.concepto)}" title="Eliminar gasto">
            ${icono("borrar")}
          </button>
        </div>
      </td>
    </tr>
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

  <!-- 2. Stepper de control de meses transcurridos -->
  <section class="glass-card" style="padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 0.85rem;">
        <div class="acc-card-icon-wrap" style="color: var(--accent);">
          ${icono("calendario")}
        </div>
        <div>
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--fg); margin: 0;">Provisión del Bote Anual</h3>
          <p style="font-size: 0.8rem; color: var(--fg-2); margin: 2px 0 0 0;">Mes acumulado: <strong style="color: var(--fg);">${mesActualNombre}</strong> (${meses} de 12 meses guardados)</p>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <button type="button" class="btn-secondary" data-accion="ajustar-mes-prevision" data-delta="-1" ${meses <= 0 ? "disabled" : ""} style="padding: 0.35rem 0.75rem;">
          &minus; Mes
        </button>
        <span class="glass-filter-chip" style="font-weight: 600;">${mesActualNombre}</span>
        <button type="button" class="btn-secondary" data-accion="ajustar-mes-prevision" data-delta="1" ${meses >= 12 ? "disabled" : ""} style="padding: 0.35rem 0.75rem;">
          &plus; Mes
        </button>

        <select class="sel-mes-directo glass-filter-chip" data-accion="cambiar-mes-directo" style="padding: 0.35rem 0.65rem; outline: none; margin-left: 0.5rem;">
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

  <!-- 3. Ecuación Visual y Resumen en Chips -->
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

  <!-- 4. Tabla Detallada de Gastos Periódicos -->
  <section class="glass-card" style="padding: 1.4rem 1.6rem; margin-bottom: 1.5rem;">
    <div class="transactions-header">
      <h3 class="transactions-title">Detalle de Recibos y Gastos Anuales (${gastos.length})</h3>
      <button type="button" class="btn-subtle mini" data-accion="restablecer-semilla-prevision" title="Cargar los gastos habituales" style="background: transparent; border: none; font-size: 0.8rem; color: var(--fg-2); cursor: pointer;">
        ${icono("volver")} Restablecer plantilla
      </button>
    </div>

    <div class="card-table-wrap" style="overflow-x: auto;">
      <table class="table-fintech table-prevision" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--divider); text-align: left; font-size: 0.76rem; color: var(--fg-2); text-transform: uppercase;">
            <th style="padding: 0.75rem 0.5rem;">Estado</th>
            <th style="padding: 0.75rem 0.5rem;">Concepto</th>
            <th style="padding: 0.75rem 0.5rem;">Mes Cobro</th>
            <th class="num" style="padding: 0.75rem 0.5rem; text-align: right;">Anual (€)</th>
            <th class="num" style="padding: 0.75rem 0.5rem; text-align: right;">Cuota/Mes</th>
            <th class="num" style="padding: 0.75rem 0.5rem; text-align: right;">Provisión</th>
            <th class="num" style="padding: 0.75rem 0.5rem; text-align: right;">Pagado</th>
            <th class="num" style="padding: 0.75rem 0.5rem; text-align: right;">Saldo</th>
            <th style="padding: 0.75rem 0.5rem; text-align: right;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${
            gastos.length === 0
              ? `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--fg-2);">No hay gastos registrados. Usa el botón "Restablecer plantilla" o el formulario inferior.</td></tr>`
              : gastos.map((g) => filaGasto(g, mesActualNombre)).join("")
          }
        </tbody>
        ${
          gastos.length > 0
            ? `
          <tfoot>
            <tr style="border-top: 2px solid var(--divider); font-weight: 700; font-variant-numeric: tabular-nums;">
              <td colspan="3" style="padding: 1rem 0.5rem;">TOTALES</td>
              <td class="num" style="text-align: right; padding: 1rem 0.5rem;">${importe(data.total_anual)}</td>
              <td class="num" style="text-align: right; padding: 1rem 0.5rem;">${importe(data.total_mensual)}</td>
              <td class="num ok" style="text-align: right; padding: 1rem 0.5rem; color: var(--pos);">${importe(data.total_provision)}</td>
              <td class="num" style="text-align: right; padding: 1rem 0.5rem;">${importe(data.total_pagado)}</td>
              <td class="num ${esSuperavitTotal ? "ok" : "negativo"}" style="text-align: right; padding: 1rem 0.5rem; color: ${esSuperavitTotal ? 'var(--pos)' : 'var(--neg)'};">${importe(data.total_saldo)}</td>
              <td></td>
            </tr>
          </tfoot>
        `
            : ""
        }
      </table>
    </div>
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
            Registra un impuesto, seguro o recibo periódico para calcular su cuota mensual a guardar.
          </p>

          <div class="form-grid-2">
            <div class="campo">
              <label>Concepto del Gasto *</label>
              <input name="concepto" placeholder="Ej. Seguro Dental, IBI Vivienda..." required>
            </div>
            <div class="campo">
              <label>Mes de Cobro Habitual *</label>
              <input name="fecha_cobro" placeholder="Ej. Octubre, Trimestral..." required>
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
