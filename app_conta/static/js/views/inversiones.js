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

const COLORES_TIPO = {
  fondos: "#0284c7",
  acciones_etfs: "#6366f1",
  renta_fija: "#d97706",
  pensiones: "#059669",
  cripto: "#db2777",
  inmobiliario: "#ea580c",
  otros: "#64748b",
};

let filtroActivo = "todos";

export function fijarFiltroInversion(tipo) {
  filtroActivo = tipo || "todos";
}

function iconoActivo(tipo) {
  return ICONOS_ACTIVO[tipo] || ICONOS_ACTIVO.otros;
}

function tarjetaInversionItem(inv, cuentas) {
  const roi = inv.rentabilidad_pct || 0;
  const esPositivo = roi >= 0;
  const signo = esPositivo ? "+" : "";
  const colorTipo = COLORES_TIPO[inv.tipo_activo] || "#6366f1";
  const nombreTipo = NOMBRES_TIPO[inv.tipo_activo] || inv.tipo_activo;

  const cuentaVinculada = cuentas.find((c) => c.id === inv.cuenta_id);
  const opcionesCuentas = cuentas
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === inv.cuenta_id ? "selected" : ""}>${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`
    )
    .join("");

  return `
    <article class="card-investment-full" data-tipo="${esc(inv.tipo_activo)}" style="--accent-color: ${colorTipo}">
      <div class="card-investment-top">
        <div class="investment-icon-wrap" style="background: ${colorTipo}18; color: ${colorTipo};">
          ${iconoActivo(inv.tipo_activo)}
        </div>
        <div class="investment-tags-wrap">
          <span class="badge-tag" style="background: ${colorTipo}20; color: ${colorTipo}; border-color: ${colorTipo}40;">
            ${esc(nombreTipo)}
          </span>
          <span class="badge-subtle">${esc(inv.entidad)}</span>
          <div class="investment-card-actions">
            <button class="btn-action-icon" data-accion="actualizar-valor-inversion" data-id="${inv.id}" data-nombre="${esc(inv.nombre)}" data-valor="${inv.valor_actual}" title="Actualizar cotización / valor de mercado">
              ${icono("editar")}
            </button>
            <button class="btn-action-icon delete" data-accion="borrar-inversion" data-id="${inv.id}" data-nombre="${esc(inv.nombre)}" title="Eliminar posición">
              ${icono("borrar")}
            </button>
          </div>
        </div>
      </div>

      <div class="card-investment-body">
        <h3 class="investment-title">${esc(inv.nombre)}</h3>
        <div class="investment-meta">
          <span class="meta-item">${icono("calendario")} Desde ${fechaCorta(inv.fecha_inicio)}</span>
          ${
            cuentaVinculada
              ? `<span class="meta-item">${icono("banco")} Vinculada: ${esc(cuentaVinculada.nombre)}</span>`
              : ""
          }
        </div>
        ${inv.notas ? `<p class="investment-notes">${esc(inv.notas)}</p>` : ""}
      </div>

      <div class="card-investment-metrics">
        <div class="metric-box primary">
          <span class="metric-label">Valor de mercado actual</span>
          <div class="metric-value-huge">${importe(inv.valor_actual)}</div>
        </div>
        <div class="metric-box">
          <span class="metric-label">Capital invertido</span>
          <div class="metric-value">${importe(inv.capital_aportado)}</div>
        </div>
        <div class="metric-box">
          <span class="metric-label">Ganancia / Plusvalía</span>
          <div class="metric-value ${esPositivo ? "positivo" : "negativo"}">${importe(inv.plusvalia)}</div>
        </div>
        <div class="metric-box">
          <span class="metric-label">Rentabilidad</span>
          <div class="metric-badge-roi ${esPositivo ? "positivo" : "negativo"}">
            ${signo}${roi.toFixed(2)}%
          </div>
        </div>
      </div>

      <div class="card-investment-footer">
        <div class="inv-quick-actions">
          <button class="btn-secondary mini" data-accion="actualizar-valor-inversion" data-id="${inv.id}" data-nombre="${esc(inv.nombre)}" data-valor="${inv.valor_actual}">
            📊 Actualizar cotización
          </button>
        </div>

        <details class="inv-operar-details">
          <summary class="btn-operar-trigger">
            ${icono("plus")} Aportar o Reembolsar capital
          </summary>
          <div class="inv-forms-container">
            <!-- Form Aportación -->
            <form data-accion="aportar-inversion" data-id="${inv.id}" class="inv-mini-form">
              <h5 class="mini-form-title">➕ Aportar dinero a la inversión</h5>
              <div class="inv-form-row">
                <div class="inv-field">
                  <label>Importe a aportar (€)</label>
                  <input name="importe" inputmode="decimal" placeholder="100.00" required>
                </div>
                <div class="inv-field">
                  <label>Descontar de cuenta bancaria</label>
                  <select name="cuenta_id">
                    <option value="">— No descontar de ninguna cuenta —</option>
                    ${opcionesCuentas}
                  </select>
                </div>
              </div>
              <button type="submit" class="btn-primary mini">Confirmar aportación</button>
            </form>

            <!-- Form Reembolso -->
            <form data-accion="reembolsar-inversion" data-id="${inv.id}" class="inv-mini-form">
              <h5 class="mini-form-title">➖ Reembolsar / Vender parte o total</h5>
              <div class="inv-form-row">
                <div class="inv-field">
                  <label>Importe a retirar (€)</label>
                  <input name="importe" inputmode="decimal" placeholder="100.00" required>
                </div>
                <div class="inv-field">
                  <label>Ingresar en cuenta bancaria</label>
                  <select name="cuenta_id">
                    <option value="">— No ingresar en ninguna cuenta —</option>
                    ${opcionesCuentas}
                  </select>
                </div>
              </div>
              <button type="submit" class="btn-primary mini">Confirmar reembolso</button>
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

  const opcionesCuentas = cuentas
    .map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");

  const posiciones = data.inversiones || [];
  const posicionesFiltradas =
    filtroActivo === "todos"
      ? posiciones
      : posiciones.filter((p) => p.tipo_activo === filtroActivo);

  const roiGlobal = data.rentabilidad_global_pct || 0;
  const esRoiPositivo = roiGlobal >= 0;
  const signoRoi = esRoiPositivo ? "+" : "";

  const distribucion = data.distribucion_tipo || [];

  return `
    ${subnavCuentas("inversiones")}

    <div class="page-header-row">
      <div>
        <h2 class="page-title">Carteras de Inversión y Patrimonio</h2>
        <p class="page-subtitle">Seguimiento de fondos indexados, acciones/ETFs, renta fija/letras, pensiones y criptoactivos</p>
      </div>
      <div class="header-total-card">
        <span class="header-total-label">Patrimonio Invertido Total</span>
        <span class="header-total-value">${importe(data.total_valor_actual)}</span>
      </div>
    </div>

    <!-- Hero KPIs de Cartera -->
    <div class="inv-hero-grid">
      <div class="inv-kpi-card">
        <span class="kpi-label">Valor de Mercado Total</span>
        <span class="kpi-value-main">${importe(data.total_valor_actual)}</span>
        <span class="kpi-sub">Valoración actual en tiempo real</span>
      </div>

      <div class="inv-kpi-card">
        <span class="kpi-label">Capital Total Aportado</span>
        <span class="kpi-value">${importe(data.total_capital_aportado)}</span>
        <span class="kpi-sub">Coste base invertido de tu bolsillo</span>
      </div>

      <div class="inv-kpi-card">
        <span class="kpi-label">Plusvalía Neta</span>
        <span class="kpi-value ${data.total_plusvalia_centimos >= 0 ? "positivo" : "negativo"}">
          ${importe(data.total_plusvalia)}
        </span>
        <span class="kpi-sub">${data.total_plusvalia_centimos >= 0 ? "Beneficio latente acumulado" : "Minusvalía latente"}</span>
      </div>

      <div class="inv-kpi-card">
        <span class="kpi-label">Rentabilidad Ponderada (ROI)</span>
        <div class="kpi-roi-pill ${esRoiPositivo ? "positivo" : "negativo"}">
          ${signoRoi}${roiGlobal.toFixed(2)} %
        </div>
        <span class="kpi-sub">Rendimiento global de la cartera</span>
      </div>
    </div>

    <!-- Barra de Distribución de Activos -->
    ${
      distribucion.length > 0
        ? `
      <section class="section-block inv-allocation-section">
        <div class="section-title-row">
          <h3 class="section-title">Distribución por Tipo de Activo</h3>
          <span class="section-meta">${posiciones.length} ${posiciones.length === 1 ? "posición activa" : "posiciones activas"}</span>
        </div>

        <div class="inv-allocation-bar">
          ${distribucion
            .map((d) => {
              const col = COLORES_TIPO[d.tipo] || "#64748b";
              return `<div class="inv-bar-segment" style="width: ${d.pct}%; background: ${col};" title="${NOMBRES_TIPO[d.tipo] || d.tipo}: ${d.pct}% (${d.valor} €)"></div>`;
            })
            .join("")}
        </div>

        <div class="inv-allocation-legend">
          ${distribucion
            .map((d) => {
              const col = COLORES_TIPO[d.tipo] || "#64748b";
              const nom = NOMBRES_TIPO[d.tipo] || d.tipo;
              return `
              <div class="legend-item">
                <span class="legend-dot" style="background: ${col};"></span>
                <span class="legend-name">${esc(nom)}</span>
                <span class="legend-pct">${d.pct}%</span>
                <span class="legend-val">(${d.valor}&nbsp;€)</span>
              </div>
            `;
            })
            .join("")}
        </div>
      </section>
    `
        : ""
    }

    <!-- Filtros por tipo de activo -->
    <div class="inv-filters-row">
      <div class="inv-filter-group">
        <button class="inv-filter-pill ${filtroActivo === "todos" ? "activa" : ""}" data-accion="filtrar-inversiones" data-tipo="todos">
          Todos (${posiciones.length})
        </button>
        ${Object.keys(NOMBRES_TIPO)
          .filter((t) => posiciones.some((p) => p.tipo_activo === t))
          .map((t) => {
            const count = posiciones.filter((p) => p.tipo_activo === t).length;
            return `
            <button class="inv-filter-pill ${filtroActivo === t ? "activa" : ""}" data-accion="filtrar-inversiones" data-tipo="${t}">
              <span class="pill-dot" style="background: ${COLORES_TIPO[t]};"></span>
              ${NOMBRES_TIPO[t]} (${count})
            </button>
          `;
          })
          .join("")}
      </div>
    </div>

    <!-- Lista de Posiciones -->
    <section class="section-block">
      <div class="section-title-row">
        <h3 class="section-title">Posiciones en Cartera</h3>
        <span class="section-meta">${posicionesFiltradas.length} visibles</span>
      </div>

      ${
        posicionesFiltradas.length === 0
          ? `
        <div class="tarjeta-vacia">
          <div class="tarjeta-vacia-icon">${icono("inversion")}</div>
          <h4>No hay inversiones registradas en este filtro</h4>
          <p>Añade fondos indexados, ETFs, letras del tesoro, acciones o criptoactivos en el formulario inferior para seguir tu patrimonio neto y rentabilidad.</p>
        </div>
      `
          : `
        <div class="grid-investments">
          ${posicionesFiltradas.map((inv) => tarjetaInversionItem(inv, cuentas)).join("")}
        </div>
      `
      }
    </section>

    <!-- Formulario para dar de alta nueva posición de inversión -->
    <section class="section-block">
      <details class="form-inversion-details">
        <summary class="btn-nuevo-inversion-trigger">
          ${icono("plus")} Dar de alta nueva inversión o activo
        </summary>
        <div class="form-container">
          <form data-accion="crear-inversion" class="formulario-inversion">
            <h3 class="form-title">Nueva Inversión / Posición en Cartera</h3>
            <p class="form-desc">Registra un activo financiero. Puedes vincular una cuenta bancaria de origen para que el capital aportado se descuente automáticamente de tu saldo contable.</p>

            <div class="form-grid-2">
              <div class="campo">
                <label for="inv-nombre">Nombre de la inversión o activo *</label>
                <input id="inv-nombre" name="nombre" placeholder="Ej: Vanguard Global Stock Index Fund EUR Acc" required>
              </div>

              <div class="campo">
                <label for="inv-entidad">Entidad / Broker / Plataforma *</label>
                <input id="inv-entidad" name="entidad" placeholder="Ej: MyInvestor, Trade Republic, Indexa Capital, Tesoro..." required>
              </div>
            </div>

            <div class="form-grid-3">
              <div class="campo">
                <label for="inv-tipo">Tipo de activo</label>
                <select id="inv-tipo" name="tipo_activo">
                  <option value="fondos">Fondo Indexado / Inversión</option>
                  <option value="acciones_etfs">Acción / ETF</option>
                  <option value="renta_fija">Renta Fija / Letras del Tesoro</option>
                  <option value="pensiones">Plan de Pensiones</option>
                  <option value="cripto">Criptoactivo</option>
                  <option value="inmobiliario">Inmobiliario / Crowdfunding</option>
                  <option value="otros">Otro activo</option>
                </select>
              </div>

              <div class="campo">
                <label for="inv-capital">Capital aportado inicial (€) *</label>
                <input id="inv-capital" name="capital_aportado" inputmode="decimal" placeholder="1000.00" required>
              </div>

              <div class="campo">
                <label for="inv-valor">Valor actual de mercado (€)</label>
                <input id="inv-valor" name="valor_actual" inputmode="decimal" placeholder="Igual al aportado si está vacío">
              </div>
            </div>

            <div class="form-grid-2">
              <div class="campo">
                <label for="inv-cuenta">Cuenta bancaria de origen (opcional)</label>
                <select id="inv-cuenta" name="cuenta_id">
                  <option value="">— Ninguna cuenta bancaria vinculada —</option>
                  ${opcionesCuentas}
                </select>
              </div>

              <div class="campo">
                <label for="inv-fecha">Fecha de inicio</label>
                <input id="inv-fecha" name="fecha_inicio" type="date" value="${hoy()}">
              </div>
            </div>

            <div class="campo-checkbox">
              <label>
                <input type="checkbox" name="crear_movimiento_inicial" value="true">
                <span>Registrar aportación inicial como movimiento de salida en la cuenta bancaria seleccionada</span>
              </label>
            </div>

            <div class="campo">
              <label for="inv-notas">Notas / ISIN / Ticker (opcional)</label>
              <input id="inv-notas" name="notas" placeholder="Ej: ISIN: IE00B03HD191 / Objetivo largo plazo">
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary">
                ${icono("check")} Crear Inversión
              </button>
            </div>
          </form>
        </div>
      </details>
    </section>
  `;
});

