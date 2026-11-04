// Vista de Préstamos: Tarjetas panorámicas de anchura completa con gráfico de amortización y métricas consolidadas
import { vista, esc, importe, hoy, fechaCorta, icono } from "../vistas.js";

const ICONOS_TIPO = {
  coche: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.8 2 11v5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
  personal: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`,
  hipoteca: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
  consumo: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><path d="M6 15h2"/></svg>`,
  otro: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

const NOMBRES_TIPO = {
  coche: "Vehículo",
  personal: "Personal",
  hipoteca: "Hipoteca",
  consumo: "Consumo",
  otro: "Otros",
};

function tarjetaPrestamoCompleta(p, cuentas) {
  const pagado = p.importe_pendiente_centimos === 0;
  const pct = Math.min(100, Math.max(0, p.progreso_amortizado_pct || 0));
  const pctRestante = (100 - pct).toFixed(1);

  // Circunferencia para el mini donut SVG (r=38 -> 2 * PI * 38 = 238.76)
  const circunferencia = 238.76;
  const offset = circunferencia - (pct / 100) * circunferencia;

  // Estimación de cuotas restantes si hay cuota fija
  let mesesRestantesText = "";
  if (p.cuota_mensual_centimos && p.cuota_mensual_centimos > 0 && !pagado) {
    const meses = Math.ceil(p.importe_pendiente_centimos / p.cuota_mensual_centimos);
    mesesRestantesText = `~${meses} meses restantes`;
  }

  const opcionesCuentas = cuentas
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === p.cuenta_id ? "selected" : ""}>${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`
    )
    .join("");

  return `
    <article class="glass-loan-card loan-card-fullwidth">
      <!-- 1. Cabecera de la Tarjeta -->
      <div class="loan-card-top">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div class="acc-card-icon-wrap" style="color: var(--accent); width: 44px; height: 44px; font-size: 1.25rem;">
            ${ICONOS_TIPO[p.tipo] || ICONOS_TIPO.otro}
          </div>
          <div class="loan-card-title-group">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h3 class="loan-card-title">${esc(p.nombre)}</h3>
              ${pagado ? '<span class="badge badge-success" style="font-size: 0.72rem;">Saldado</span>' : ""}
            </div>
            <span class="loan-card-entity">${esc(p.entidad)} · ${NOMBRES_TIPO[p.tipo] || p.tipo}</span>
          </div>
        </div>

        <div class="card-more-menu-wrapper">
          <button type="button" class="btn-card-more" aria-label="Opciones de ${esc(p.nombre)}" title="Opciones" onclick="this.nextElementSibling.classList.toggle('is-open')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <div class="card-more-dropdown">
            <button type="button" class="dropdown-item-danger" style="color: var(--fg);" data-accion="editar-prestamo" data-id="${p.id}" data-nombre="${esc(p.nombre)}" data-pendiente="${p.importe_pendiente}" data-cuota="${p.cuota_mensual || ""}">
              ${icono("editar")} Ajustar capital / cuota
            </button>
            <button type="button" class="dropdown-item-danger" data-accion="borrar-prestamo" data-id="${p.id}" data-nombre="${esc(p.nombre)}">
              ${icono("borrar")} Eliminar préstamo
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Cuerpo Panorámico: Cifras Financieras + Gráfico de Amortización -->
      <div class="loan-card-body-fullwidth">
        <!-- Columna Datos -->
        <div class="loan-metrics-col">
          <div class="loan-pending-highlight">
            <span class="loan-pending-label">Capital pendiente de pago</span>
            <div class="loan-pending-val">${pagado ? "0,00 €" : importe(p.importe_pendiente)}</div>
          </div>

          <div class="loan-details-pills-row">
            <div class="loan-detail-pill">
              <span class="pill-label">Financiado Inicial</span>
              <strong class="pill-value">${importe(p.importe_inicial)}</strong>
            </div>
            <div class="loan-detail-pill">
              <span class="pill-label">Ya Amortizado</span>
              <strong class="pill-value text-pos">${importe(p.amortizado)}</strong>
            </div>
            <div class="loan-detail-pill">
              <span class="pill-label">Cuota Mensual</span>
              <strong class="pill-value">${p.cuota_mensual ? `${importe(p.cuota_mensual)} / mes` : "Sin cuota fija"}</strong>
            </div>
            ${
              mesesRestantesText
                ? `
            <div class="loan-detail-pill">
              <span class="pill-label">Plazo Estimado</span>
              <strong class="pill-value">${mesesRestantesText}</strong>
            </div>`
                : ""
            }
          </div>
        </div>

        <!-- Columna Gráfico de Amortización Dinámico -->
        <div class="loan-chart-col">
          <div class="loan-chart-wrap">
            <!-- Anillo Donut SVG de Progreso -->
            <div class="loan-ring-chart">
              <svg class="loan-donut-svg" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="loanGrad-${p.id}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#7C3AED"/>
                    <stop offset="100%" stop-color="#3B82F6"/>
                  </linearGradient>
                </defs>
                <circle class="donut-track" cx="50" cy="50" r="38" stroke-width="8"/>
                <circle class="donut-fill" cx="50" cy="50" r="38" stroke-width="8"
                        stroke="url(#loanGrad-${p.id})"
                        stroke-dasharray="238.76"
                        stroke-dashoffset="${offset}"
                        stroke-linecap="round"/>
              </svg>
              <div class="loan-donut-center">
                <span class="donut-pct">${pct}%</span>
                <span class="donut-label">amortizado</span>
              </div>
            </div>

            <!-- Barra Segmentada de Amortización con Leyenda -->
            <div class="loan-bar-progress-container">
              <div class="loan-bar-legend">
                <span class="legend-item legend-amortizado">
                  <span class="dot-legend dot-amortizado"></span> Pagado: <strong>${pct}%</strong> (${importe(p.amortizado)})
                </span>
                <span class="legend-item legend-pendiente">
                  <span class="dot-legend dot-pendiente"></span> Pendiente: <strong>${pctRestante}%</strong>
                </span>
              </div>
              <div class="loan-segmented-bar">
                <div class="loan-bar-segment-paid" style="width: ${pct}%;"></div>
                <div class="loan-bar-segment-remain" style="width: ${100 - pct}%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Desplegable para amortizar cuota -->
      ${
        !pagado
          ? `
        <div class="loan-pay-accordion-wrap">
          <details class="loan-pay-details">
            <summary class="loan-pay-summary">
              ${icono("plus")} Amortizar cuota o realizar pago parcial
            </summary>
            <form data-accion="pagar-prestamo" data-id="${p.id}" class="fintech-form" style="margin-top: 0.85rem; display: flex; flex-direction: column; gap: 0.75rem;">
              <div class="form-grid-3">
                <div class="campo">
                  <label style="font-size: 0.74rem;">Importe a amortizar (€) *</label>
                  <input name="importe" inputmode="decimal" value="${p.cuota_mensual || ""}" placeholder="200.00" required style="font-size: 0.84rem; padding: 0.45rem 0.75rem;">
                </div>
                <div class="campo">
                  <label style="font-size: 0.74rem;">Descontar de la cuenta</label>
                  <select name="cuenta_id" style="font-size: 0.84rem; padding: 0.45rem 0.75rem;">
                    <option value="">— Sin apunte en cuenta —</option>
                    ${opcionesCuentas}
                  </select>
                </div>
                <div class="campo">
                  <label style="font-size: 0.74rem;">Concepto del apunte</label>
                  <input name="concepto" value="Cuota mensual ${esc(p.nombre)}" style="font-size: 0.84rem; padding: 0.45rem 0.75rem;">
                </div>
              </div>
              <button type="submit" class="btn-primary" style="align-self: flex-end; font-size: 0.82rem; padding: 0.45rem 1rem;">
                Confirmar amortización
              </button>
            </form>
          </details>
        </div>
      `
          : ""
      }
    </article>
  `;
}

export default vista("prestamos", async () => {
  const [data, cuentasData] = await Promise.all([
    API.get("/prestamos"),
    API.get("/cuentas"),
  ]);

  const items = data.items || [];
  const cuentas = cuentasData.items || [];

  // Corrección del total pendiente y cuota consolidada
  const totalPendiente = data.total_deuda_pendiente || data.total_pendiente || "0.00";
  const cuotaMensual = data.cuota_mensual_total || data.total_cuotas_mensuales || "0.00";
  const totalFinanciado = data.total_financiado || "0.00";
  const totalAmortizado = data.total_amortizado || "0.00";
  const progresoGlobal = data.progreso_global_pct || 0;

  return `
  <!-- 1. Hero Consolidado Superior -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Deuda Total Pendiente en Préstamos</span>
    <div class="hero-total-amount text-neg">${importe(totalPendiente)}</div>
    
    <div class="hero-loan-submetrics">
      <span><strong>${items.length}</strong> préstamos activos</span>
      <span class="dot-sep">·</span>
      <span>Total financiado: <strong>${importe(totalFinanciado)}</strong></span>
      <span class="dot-sep">·</span>
      <span>Amortizado global: <strong>${progresoGlobal}%</strong> (${importe(totalAmortizado)})</span>
      <span class="dot-sep">·</span>
      <span>Cuota mensual: <strong>${importe(cuotaMensual)}</strong></span>
    </div>

    <!-- Barra de progreso global del hogar -->
    <div class="hero-global-progress-wrap">
      <div class="loan-segmented-bar" style="height: 6px;">
        <div class="loan-bar-segment-paid" style="width: ${progresoGlobal}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--fg-2); margin-top: 0.35rem;">
        <span>${progresoGlobal}% amortizado en total</span>
        <span>${importe(totalPendiente)} pendiente</span>
      </div>
    </div>
  </div>

  <!-- 2. Lista de Tarjetas a Anchura Completa con Gráficos -->
  <section class="section-block" style="margin-bottom: 1.75rem;">
    <div class="loans-grid-fullwidth">
      ${
        items.length > 0
          ? items.map((p) => tarjetaPrestamoCompleta(p, cuentas)).join("\n")
          : `
          <div class="glass-card tarjeta-vacia" style="width: 100%;">
            <div class="tarjeta-vacia-icon">${icono("prestamo")}</div>
            <h4>No tienes préstamos registrados</h4>
            <p>No hay deudas ni pasivos pendientes. Añade un préstamo si financias un vehículo, hipoteca o compra a plazos.</p>
          </div>
          `
      }
    </div>
  </section>

  <!-- 3. Formulario desplegable para nuevo préstamo -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Dar de Alta Nuevo Préstamo o Financiación
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-prestamo" data-err="err-prestamo" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Registra una deuda bancaria, financiación de vehículo, hipoteca o compra financiada.
          </p>

          <div class="form-grid-3">
            <div class="campo">
              <label for="pr-nombre">Nombre del Préstamo *</label>
              <input id="pr-nombre" name="nombre" placeholder="Ej. Financiación Coche, Préstamo Reforma..." required>
            </div>
            <div class="campo">
              <label for="pr-entidad">Entidad Financiera *</label>
              <input id="pr-entidad" name="entidad" placeholder="Ej. Santander Consumer, CaixaBank..." required>
            </div>
            <div class="campo">
              <label for="pr-tipo">Tipo de Préstamo</label>
              <select id="pr-tipo" name="tipo" required>
                <option value="coche" selected>🚗 Vehículo / Coche</option>
                <option value="personal">👤 Personal</option>
                <option value="hipoteca">🏠 Hipoteca</option>
                <option value="consumo">🛍️ Compra Financiada</option>
                <option value="otro">📦 Otro</option>
              </select>
            </div>
          </div>

          <div class="form-grid-3">
            <div class="campo">
              <label for="pr-inicial">Importe Financiado Inicial (€) *</label>
              <input id="pr-inicial" name="importe_inicial" inputmode="decimal" placeholder="15000.00" required>
            </div>
            <div class="campo">
              <label for="pr-pendiente">Capital Pendiente Actual (€)</label>
              <input id="pr-pendiente" name="importe_pendiente" inputmode="decimal" placeholder="Dejar vacío si es igual al inicial">
            </div>
            <div class="campo">
              <label for="pr-cuota">Cuota Mensual (€)</label>
              <input id="pr-cuota" name="cuota_mensual" inputmode="decimal" placeholder="250.00">
            </div>
          </div>

          <div class="form-grid-3">
            <div class="campo">
              <label for="pr-cuenta">Cuenta habitual de cargo</label>
              <select id="pr-cuenta" name="cuenta_id">
                <option value="">— Ninguna vinculada —</option>
                ${cuentas.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}
              </select>
            </div>
            <div class="campo">
              <label for="pr-inicio">Fecha de Inicio</label>
              <input id="pr-inicio" name="fecha_inicio" type="date" value="${hoy()}">
            </div>
            <div class="campo">
              <label for="pr-fin">Fecha de Vencimiento (Opcional)</label>
              <input id="pr-fin" name="fecha_fin" type="date">
            </div>
          </div>

          <div id="err-prestamo"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Crear Préstamo
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
