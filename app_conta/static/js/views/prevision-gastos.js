// Vista de Previsión de Gastos y Bote Anual (IBI, Seguros, Basuras, Sellos...)
import { esc, importe, vista, icono, subnavAhorro } from "../vistas.js";

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
      <td style="width: 120px">
        ${badgeEstadoGasto(g.estado)}
      </td>
      <td class="tx-main">
        <div class="table-row-title">
          <strong>${esc(g.concepto)}</strong>
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
    ${subnavAhorro("prevision-gastos")}

    <div class="page-header-row">
      <div>
        <h2 class="page-title">Previsión de Gastos y Bote Anual</h2>
        <p class="page-subtitle">Planificación de recibos periódicos (IBI, basuras, seguros, sellos...) y control de cuotas</p>
      </div>
      <div class="header-total-card">
        <span class="header-total-label">Total a Guardar al Mes</span>
        <span class="header-total-value">${importe(data.total_mensual)} <span style="font-size: 0.9rem; font-weight: 500;">/mes</span></span>
        <span class="header-total-sub">Total anual estimado: ${importe(data.total_anual)}</span>
      </div>
    </div>

    <!-- Stepper de control de meses transcurridos/pagados -->
    <div class="prevision-stepper-card">
      <div class="prevision-stepper-left">
        <div class="prevision-stepper-icon">
          ${icono("calendario")}
        </div>
        <div>
          <h3 class="prevision-stepper-title">Bote de Gastos Anual — Año ${data.anio}</h3>
          <p class="prevision-stepper-sub">Mes de provisión acumulada: <strong>${mesActualNombre}</strong> (${meses} de 12 meses aportados)</p>
        </div>
      </div>

      <div class="prevision-stepper-controls">
        <button type="button" class="btn-stepper" data-accion="ajustar-mes-prevision" data-delta="-1" ${meses <= 0 ? "disabled" : ""} title="Mes anterior">
          &minus;
        </button>
        <div class="stepper-value-wrap">
          <span class="stepper-month-name">${mesActualNombre}</span>
          <span class="stepper-count-tag">${meses} / 12 meses</span>
        </div>
        <button type="button" class="btn-stepper" data-accion="ajustar-mes-prevision" data-delta="1" ${meses >= 12 ? "disabled" : ""} title="Mes siguiente">
          &plus;
        </button>

        <select class="sel-mes-directo" data-accion="cambiar-mes-directo" style="margin-left: 0.5rem; background: var(--surface-card); color: var(--text-main); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.3rem 0.5rem; font-size: 0.82rem;">
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

    <!-- Ecuación Visual de Cuadre del Bote Anual -->
    <div style="background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.9rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
        <div style="text-align: left;">
          <span style="font-size: 0.72rem; color: var(--text-muted); display: block; text-transform: uppercase; font-weight: 600;">Provisión Acumulada (${mesActualNombre})</span>
          <strong style="font-size: 1.15rem; color: var(--accent-positive);">${importe(data.total_provision)}</strong>
        </div>
        <span style="font-size: 1.25rem; color: var(--text-muted); font-weight: 700;">−</span>
        <div style="text-align: left;">
          <span style="font-size: 0.72rem; color: var(--text-muted); display: block; text-transform: uppercase; font-weight: 600;">Facturas Pagadas Reales</span>
          <strong style="font-size: 1.15rem;">${importe(data.total_pagado)}</strong>
        </div>
        <span style="font-size: 1.25rem; color: var(--text-muted); font-weight: 700;">=</span>
        <div style="text-align: left;">
          <span style="font-size: 0.72rem; color: var(--text-muted); display: block; text-transform: uppercase; font-weight: 600;">Saldo Neto del Bote</span>
          <strong style="font-size: 1.25rem;" class="${esSuperavitTotal ? "positivo" : "negativo"}">${importe(data.total_saldo, esSuperavitTotal ? "" : "negativo")}</strong>
        </div>
      </div>
      <div>
        <span class="badge-tag ${esSuperavitTotal ? "ok" : "alerta"}">
          ${esSuperavitTotal ? `${icono("check")} Superávit acumulado` : `${icono("alerta")} Déficit temporal (${meses} de 12 meses)`}
        </span>
      </div>
    </div>

    <!-- Resumen de KPIs / Métricas -->
    <div class="hero-pills-row" style="margin-bottom: 2rem;">
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Total Anual Presupuestado</span>
        <span class="pill-stat-value">${importe(data.total_anual)}</span>
      </div>
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Cuota Mensual Fija</span>
        <span class="pill-stat-value">${importe(data.total_mensual)} <span style="font-size: 0.75rem;">/mes</span></span>
      </div>
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Provisión Acumulada (${mesActualNombre})</span>
        <span class="pill-stat-value ok">${importe(data.total_provision)}</span>
      </div>
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Facturas Pagadas Reales</span>
        <span class="pill-stat-value">${importe(data.total_pagado)}</span>
      </div>
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Saldo Neto del Bote</span>
        <span class="pill-stat-value ${esSuperavitTotal ? "ok" : "negativo"}">
          ${importe(data.total_saldo, esSuperavitTotal ? "" : "negativo")}
        </span>
      </div>
    </div>

    <!-- Tabla de gastos recurrentes -->
    <section class="section-block">
      <div class="section-header">
        <div>
          <h3 class="section-title">Detalle de Recibos y Gastos Anuales (${gastos.length})</h3>
          <p class="section-desc">Comparativa entre provisión guardada mes a mes y facturas realmente cobradas</p>
        </div>
        <div>
          <button type="button" class="btn-subtle mini" data-accion="restablecer-semilla-prevision" title="Cargar los 16 gastos habituales del Excel">
            ${icono("volver")} Restablecer plantilla Excel
          </button>
        </div>
      </div>

      <div class="card-table-wrap">
        <table class="table-fintech table-prevision">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Concepto / Notas</th>
              <th>Cobro Habitual</th>
              <th class="num">Anual (€)</th>
              <th class="num">Cuota/Mes</th>
              <th class="num">Provisión hasta ${mesActualNombre}</th>
              <th class="num">Pagado Real</th>
              <th class="num">Saldo</th>
              <th class="th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${
              gastos.length === 0
                ? `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay gastos registrados. Usa el botón "Restablecer plantilla Excel" o el formulario inferior.</td></tr>`
                : gastos.map((g) => filaGasto(g, mesActualNombre)).join("")
            }
          </tbody>
          ${
            gastos.length > 0
              ? `
            <tfoot>
              <tr style="background: var(--surface-elevated); font-weight: 700;">
                <td colspan="3" style="padding: 1rem 1.15rem;">TOTALES</td>
                <td class="num">${importe(data.total_anual)}</td>
                <td class="num">${importe(data.total_mensual)}</td>
                <td class="num ok">${importe(data.total_provision)}</td>
                <td class="num">${importe(data.total_pagado)}</td>
                <td class="num ${esSuperavitTotal ? "ok" : "negativo"}">${importe(data.total_saldo, esSuperavitTotal ? "" : "negativo")}</td>
                <td></td>
              </tr>
            </tfoot>
          `
              : ""
          }
        </table>
      </div>
    </section>

    <!-- Formulario para dar de alta nuevo gasto periódico -->
    <section class="section-block">
      <div class="form-card-container">
        <div class="form-card-header">
          <div class="form-card-icon">${icono("plus")}</div>
          <div>
            <h3 class="form-card-title">Añadir Nuevo Gasto Anual / Recurrente</h3>
            <p class="form-card-subtitle">Registra un nuevo impuesto, seguro o cuota periódica para integrarlo en la cuota mensual</p>
          </div>
        </div>

        <form data-accion="crear-gasto-recurrente" class="fintech-form">
          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label class="form-label">Concepto del Gasto</label>
              <input name="concepto" placeholder="Ej. Seguro Dental Sanitas, Tasa de Vado..." required>
            </div>
            <div class="form-group form-span-2">
              <label class="form-label">Fecha o Mes de Cobro Habitual</label>
              <input name="fecha_cobro" placeholder="Ej. Octubre, Trimestral, Marzo / Julio..." required>
            </div>
          </div>

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label class="form-label">Importe Anual Estimado (€)</label>
              <input name="importe_anual" inputmode="decimal" placeholder="Ej. 180.00" required>
            </div>
            <div class="form-group form-span-2">
              <label class="form-label">Cuota Mensual a Guardar (€, opcional)</label>
              <input name="cuota_mensual" inputmode="decimal" placeholder="Si se deja vacío, se divide entre 12">
            </div>
          </div>

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label class="form-label">Pagado Real hasta ahora (€, opcional)</label>
              <input name="pagado_real" inputmode="decimal" placeholder="0.00">
            </div>
            <div class="form-group form-span-2">
              <label class="form-label">Notas o Referencia (opcional)</label>
              <input name="notas" placeholder="Ej. Domiciliado en Caixa, póliza 12345...">
            </div>
          </div>

          <div class="form-actions-right">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Guardar Gasto Recurrente
            </button>
          </div>
        </form>
      </div>
    </section>
  `;
});

