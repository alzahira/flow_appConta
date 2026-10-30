// Vista de Préstamos y Deudas a Devolver (Vehículos, Personales, Hipotecas, Financiaciones)
import { vista, esc, importe, hoy, fechaCorta, icono } from "../vistas.js";

const ICONOS_TIPO = {
  coche: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.8 2 11v5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
  personal: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`,
  hipoteca: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
  consumo: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><path d="M6 15h2"/></svg>`,
  otro: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

const NOMBRES_TIPO = {
  coche: "Vehículo / Coche",
  personal: "Préstamo Personal",
  hipoteca: "Hipoteca",
  consumo: "Consumo / Compra Financiada",
  otro: "Otros Pasivos",
};

const COLORES_TIPO = {
  coche: "#0284c7",
  personal: "#d97706",
  hipoteca: "#0f766e",
  consumo: "#7c3aed",
  otro: "#64748b",
};

function iconoTipo(tipo) {
  return ICONOS_TIPO[tipo] || ICONOS_TIPO.otro;
}

function tarjetaPrestamo(p, cuentas) {
  const colorTipo = COLORES_TIPO[p.tipo] || "#0284c7";
  const nombreTipo = NOMBRES_TIPO[p.tipo] || p.tipo;
  const pagadoCompletamente = p.importe_pendiente_centimos === 0;
  const cuentaVinculada = cuentas.find((c) => c.id === p.cuenta_id);

  const opcionesCuentas = cuentas
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === p.cuenta_id ? "selected" : ""}>${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`
    )
    .join("");

  return `
    <article class="card-loan-full" style="--accent-color: ${colorTipo}">
      <div class="card-loan-top">
        <div class="loan-icon-wrap" style="background: ${colorTipo}18; color: ${colorTipo};">
          ${iconoTipo(p.tipo)}
        </div>
        <div class="loan-tags-wrap">
          <span class="badge-tag" style="background: ${colorTipo}18; color: ${colorTipo}; border-color: ${colorTipo}35;">
            ${esc(nombreTipo)}
          </span>
          <span class="badge-subtle">${esc(p.entidad)}</span>
          ${
            pagadoCompletamente
              ? `<span class="badge-tag ok">${icono("check")} Amortizado 100%</span>`
              : `<span class="badge-tag neutral">${p.progreso_amortizado_pct}% amortizado</span>`
          }
          <div class="loan-card-actions">
            <button class="btn-action-icon" data-accion="editar-prestamo" data-id="${p.id}" data-nombre="${esc(p.nombre)}" data-pendiente="${p.importe_pendiente}" data-cuota="${p.cuota_mensual || ""}" title="Editar capital pendiente o cuota">
              ${icono("editar")}
            </button>
            <button class="btn-action-icon delete" data-accion="borrar-prestamo" data-id="${p.id}" data-nombre="${esc(p.nombre)}" title="Eliminar préstamo">
              ${icono("borrar")}
            </button>
          </div>
        </div>
      </div>

      <div class="card-loan-body">
        <h3 class="loan-title">${esc(p.nombre)}</h3>
        <div class="loan-meta">
          <span class="meta-item">${icono("calendario")} Inicio: ${fechaCorta(p.fecha_inicio)}</span>
          ${
            p.fecha_fin
              ? `<span class="meta-item">${icono("calendario")} Vencimiento: ${fechaCorta(p.fecha_fin)}</span>`
              : ""
          }
          ${
            cuentaVinculada
              ? `<span class="meta-item">${icono("banco")} Cargo habitual: ${esc(cuentaVinculada.nombre)}</span>`
              : ""
          }
        </div>
        ${p.notas ? `<p class="loan-notes">${esc(p.notas)}</p>` : ""}
      </div>

      <!-- Métricas Clave del Préstamo -->
      <div class="card-loan-metrics">
        <div class="metric-box primary">
          <span class="metric-label">Capital Pendiente de Devolver</span>
          <div class="metric-value-huge ${pagadoCompletamente ? "ok" : "negativo"}">
            ${pagadoCompletamente ? "0,00 €" : importe(p.importe_pendiente, "negativo")}
          </div>
        </div>
        <div class="metric-box">
          <span class="metric-label">Financiado Inicial</span>
          <div class="metric-value">${importe(p.importe_inicial)}</div>
        </div>
        <div class="metric-box">
          <span class="metric-label">Amortizado Acumulado</span>
          <div class="metric-value positivo">${importe(p.amortizado)}</div>
        </div>
        <div class="metric-box">
          <span class="metric-label">Cuota Mensual</span>
          <div class="metric-value">
            ${p.cuota_mensual ? `${importe(p.cuota_mensual)} <span class="cuota-sub">/ mes</span>` : "—"}
          </div>
        </div>
      </div>

      <!-- Barra de Progreso de Amortización -->
      <div class="loan-progress-wrap">
        <div class="progress-bar ${pagadoCompletamente ? "over" : ""}">
          <div class="progress-fill" style="width: ${Math.min(100, p.progreso_amortizado_pct)}%; background: ${pagadoCompletamente ? "var(--accent-positive)" : colorTipo};"></div>
        </div>
        <div class="progress-labels">
          <span class="progreso-txt">${p.progreso_amortizado_pct}% pagado (${p.amortizado} € de ${p.importe_inicial} €)</span>
          <span class="pendiente-txt ${pagadoCompletamente ? "ok" : "negativo"}">${pagadoCompletamente ? "Deuda saldada" : `Resta: ${importe(p.importe_pendiente, "negativo")}`}</span>
        </div>
      </div>

      <!-- Acciones de Pago / Amortización -->
      ${
        !pagadoCompletamente
          ? `
      <div class="card-loan-footer">
        <details class="loan-operar-details">
          <summary class="btn-operar-trigger">
            ${icono("plus")} Amortizar o Registrar Pago de Cuota
          </summary>
          <div class="loan-form-container">
            <form data-accion="pagar-prestamo" data-id="${p.id}" class="loan-mini-form">
              <h5 class="mini-form-title">Registrar pago parcial o cuota mensual</h5>
              <div class="loan-form-row">
                <div class="loan-field">
                  <label>Importe a descontar de la deuda (€)</label>
                  <input name="importe" inputmode="decimal" value="${p.cuota_mensual || ""}" placeholder="250.00" required>
                </div>
                <div class="loan-field">
                  <label>Descontar de cuenta bancaria</label>
                  <select name="cuenta_id">
                    <option value="">— No crear apunte contable en banco —</option>
                    ${opcionesCuentas}
                  </select>
                </div>
              </div>
              <div class="loan-form-row">
                <div class="loan-field">
                  <label>Concepto en el movimiento</label>
                  <input name="concepto" value="Cuota mensual ${esc(p.nombre)}" placeholder="Ej: Cuota coche">
                </div>
                <div class="loan-field">
                  <label>Fecha de pago</label>
                  <input type="date" name="fecha" value="${hoy()}">
                </div>
              </div>
              <button type="submit" class="btn-primary mini">Confirmar pago y amortizar</button>
            </form>
          </div>
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

  const cuentas = (cuentasData.items || []).filter(
    (c) => c.tipo !== "tarjeta" && !c.nombre.toUpperCase().startsWith("TARJETA")
  );

  const opcionesCuentas = cuentas
    .map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");

  const items = data.items || [];

  return `
    <div class="page-header-row">
      <div>
        <h2 class="page-title">Préstamos y Financiaciones</h2>
        <p class="page-subtitle">Control de vehículos, deudas personales, hipotecas y compras financiadas</p>
      </div>
      <div class="header-total-card">
        <span class="header-total-label">Deuda Pendiente Total</span>
        <span class="header-total-value negativo">${importe(data.total_deuda_pendiente, "negativo")}</span>
      </div>
    </div>

    <!-- Hero KPIs de Pasivos -->
    <div class="loan-hero-grid">
      <div class="loan-kpi-card">
        <span class="kpi-label">Deuda Total Pendiente</span>
        <span class="kpi-value-main negativo">${importe(data.total_deuda_pendiente, "negativo")}</span>
        <span class="kpi-sub">Total pendiente de devolver hoy</span>
      </div>

      <div class="loan-kpi-card">
        <span class="kpi-label">Capital Financiado Inicial</span>
        <span class="kpi-value">${importe(data.total_financiado)}</span>
        <span class="kpi-sub">Préstamos originales acumulados</span>
      </div>

      <div class="loan-kpi-card">
        <span class="kpi-label">Amortizado Acumulado</span>
        <span class="kpi-value positivo">${importe(data.total_amortizado)}</span>
        <span class="kpi-sub">Capital ya devuelto con éxito</span>
      </div>

      <div class="loan-kpi-card">
        <span class="kpi-label">Progreso de Amortización</span>
        <div class="kpi-roi-pill positivo">
          ${data.progreso_global_pct}% devuelto
        </div>
        <span class="kpi-sub">Cuota total: ${importe(data.cuota_mensual_total)} / mes</span>
      </div>
    </div>

    <!-- Listado de Préstamos -->
    <section class="section-block">
      <div class="section-title-row">
        <h3 class="section-title">Préstamos y Deudas Activas</h3>
        <span class="section-meta">${items.length} ${items.length === 1 ? "préstamo registrado" : "préstamos registrados"}</span>
      </div>

      ${
        items.length > 0
          ? `<div class="loans-grid">${items.map((p) => tarjetaPrestamo(p, cuentas)).join("")}</div>`
          : `
          <div class="empty-state">
            <span class="empty-icon">${icono("coche")}</span>
            <h4>No tienes préstamos registrados</h4>
            <p>Registra deudas a devolver (por ejemplo, lo que debes del coche, préstamos personales o hipotecas) para ver el progreso de amortización y las cuotas mensuales.</p>
          </div>
          `
      }
    </section>

    <!-- Acordeón para Alta de Nuevo Préstamo -->
    <section class="section-block">
      <details class="accordion-panel" id="panel-nuevo-prestamo">
        <summary class="accordion-summary">
          <span class="accordion-title">${icono("plus")} Dar de alta un nuevo préstamo o financiación</span>
          <span class="accordion-hint">Coche, préstamo personal, hipoteca o consumo</span>
        </summary>
        <div class="accordion-body">
          <form data-accion="crear-prestamo" class="form-fintech">
            <div class="form-grid-3">
              <div class="form-field">
                <label>Concepto o Nombre *</label>
                <input name="nombre" placeholder="Ej: Coche Peugeot, Moto, Reforma" required>
              </div>

              <div class="form-field">
                <label>Entidad Prestamista / Financiera *</label>
                <input name="entidad" placeholder="Ej: Stellantis, Santander, BBVA" required>
              </div>

              <div class="form-field">
                <label>Tipo de Préstamo *</label>
                <select name="tipo" required>
                  <option value="coche" selected>🚗 Vehículo / Coche</option>
                  <option value="personal">👤 Préstamo Personal</option>
                  <option value="hipoteca">🏠 Hipoteca Inmobiliaria</option>
                  <option value="consumo">💳 Consumo / Tarjeta Financiada</option>
                  <option value="otro">📦 Otro</option>
                </select>
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-field">
                <label>Capital Financiado Inicial (€) *</label>
                <input name="importe_inicial" inputmode="decimal" placeholder="18500.00" required>
              </div>

              <div class="form-field">
                <label>Capital Pendiente Actual (€)</label>
                <input name="importe_pendiente" inputmode="decimal" placeholder="Si es nuevo, dejar vacío">
                <span class="field-hint">Si ya llevas un tiempo pagándolo, indica la deuda restante hoy.</span>
              </div>

              <div class="form-field">
                <label>Cuota Mensual (€)</label>
                <input name="cuota_mensual" inputmode="decimal" placeholder="245.50">
                <span class="field-hint">Opcional. Para prever el compromiso mensual.</span>
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-field">
                <label>Cuenta Bancaria Habitual de Cargo</label>
                <select name="cuenta_id">
                  <option value="">— Ninguna o sin asociar —</option>
                  ${opcionesCuentas}
                </select>
              </div>

              <div class="form-field">
                <label>Fecha de Inicio *</label>
                <input type="date" name="fecha_inicio" value="${hoy()}" required>
              </div>

              <div class="form-field">
                <label>Fecha Estimada de Fin / Vencimiento</label>
                <input type="date" name="fecha_fin">
              </div>
            </div>

            <div class="form-grid-1">
              <div class="form-field">
                <label>Notas u Observaciones</label>
                <textarea name="notas" rows="2" placeholder="Detalles de la financiación, TIN, número de contrato, etc."></textarea>
              </div>
            </div>

            <div class="form-actions-row">
              <button type="submit" class="btn-primary">Registrar Préstamo</button>
            </div>
          </form>
        </div>
      </details>
    </section>
  `;
});

