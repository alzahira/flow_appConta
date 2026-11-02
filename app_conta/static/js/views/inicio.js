// Vista de Inicio Fintech Glassmorphism (Revolut / Linear Style)
import { esc, importe, vista, icono, fechaCorta } from "../vistas.js";

function animarCountUp(el, valorFinal, duracion = 850) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = 0;
  const startTime = performance.now();
  const format = (v) => {
    const s = Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const cIdx = s.lastIndexOf(",");
    return `${s.slice(0, cIdx)}<small class="centimos">${s.slice(cIdx)}&nbsp;€</small>`;
  };
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duracion, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = start + (valorFinal - start) * ease;
    el.innerHTML = format(current);
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.innerHTML = format(valorFinal);
    }
  }
  requestAnimationFrame(update);
}

function badgeEstado(estado, texto = null) {
  const esCuadrado = estado === "cuadrado";
  const contenido = texto || (esCuadrado ? "Contabilidad al día" : "Diferencia pendiente");
  return `
    <div class="glass-status-pill ${esCuadrado ? "ok" : "alerta"}">
      <span class="status-pulse-dot"></span>
      <span class="status-text">${contenido}</span>
    </div>
  `;
}

export default vista("inicio", async () => {
  const [conc, cuentas, botes, previsionData, inversionesData, movimientosData] = await Promise.all([
    API.get("/conciliacion"),
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/prevision-gastos").catch(() => null),
    API.get("/inversiones").catch(() => null),
    API.get("/movimientos?limit=5").catch(() => ({ items: [] })),
  ]);

  const itemsCuentas = cuentas.items || [];
  const itemsMovimientos = (movimientosData.items || []).slice(0, 5);

  // 1. Cuentas reales
  const centimosCaja = itemsCuentas
    .filter((c) => c.tipo === "efectivo")
    .reduce((acc, c) => acc + Math.round(Number(c.saldo || 0) * 100), 0);
  const dineroCaja = (centimosCaja / 100).toFixed(2);

  const centimosBancos = itemsCuentas
    .filter((c) => c.tipo === "banco")
    .reduce((acc, c) => acc + Math.round(Number(c.saldo || 0) * 100), 0);
  const dineroBancos = (centimosBancos / 100).toFixed(2);

  const centimosTarjetas = itemsCuentas
    .filter((c) => c.tipo === "tarjeta")
    .reduce((acc, c) => acc + Math.round(Number(c.saldo || 0) * 100), 0);
  const dineroTarjetas = (centimosTarjetas / 100).toFixed(2);

  const centimosTotalCuentas = centimosCaja + centimosBancos + centimosTarjetas;
  const dineroTotalCuentasNum = centimosTotalCuentas / 100;
  const dineroTotalCuentas = dineroTotalCuentasNum.toFixed(2);

  // 2. Componentes de la Fórmula
  const dineroBotes = conc.total_botes_formula || "0.00";
  const dineroPrevision = conc.total_prevision_formula || "0.00";
  const dineroMeDeben = conc.total_me_deben_formula || "0.00";
  const dineroPrestamos = conc.total_prestamos_formula || "0.00";
  const dineroDiferencia = conc.diferencia_formula || "0.00";

  const esCuadrado = conc.estado_formula === "cuadrado" || Math.abs(Number(dineroDiferencia)) <= 2.0;

  // Botes clave: Mes y Ocio
  const botesItems = botes.items || [];
  const boteMes = botesItems.find(
    (b) =>
      b.nombre.toLowerCase().includes("mes en curso") ||
      b.nombre.toLowerCase().includes("cash para el mes") ||
      b.nombre.toLowerCase() === "dinero del mes"
  );
  const dineroMesNum = Number(boteMes?.saldo || 0);
  const dineroMes = dineroMesNum.toFixed(2);

  const boteOcio = botesItems.find(
    (b) => b.nombre.toLowerCase().includes("ocio")
  );
  const dineroOcioNum = Number(boteOcio?.saldo || 0);
  const dineroOcio = dineroOcioNum.toFixed(2);

  // Cálculos para el anillo de progreso circular
  const metaMes = Number(boteMes?.objetivo_centimos ? boteMes.objetivo_centimos / 100 : (boteMes?.meta || 1200));
  const pctMes = Math.min(100, Math.max(0, Math.round((dineroMesNum / (metaMes > 0 ? metaMes : 1200)) * 100)));
  const circunferenciaMes = 2 * Math.PI * 72; // r=72 -> 452.39
  const offsetMes = circunferenciaMes - (pctMes / 100) * circunferenciaMes;

  const metaOcio = Number(boteOcio?.objetivo_centimos ? boteOcio.objetivo_centimos / 100 : 400);
  const pctOcio = Math.min(100, Math.max(0, Math.round((dineroOcioNum / (metaOcio > 0 ? metaOcio : 400)) * 100)));
  const circunferenciaOcio = 2 * Math.PI * 56; // r=56 -> 351.86
  const offsetOcio = circunferenciaOcio - (pctOcio / 100) * circunferenciaOcio;

  // Ejecución asíncrona tras inserción en el DOM
  setTimeout(() => {
    const elHero = document.getElementById("hero-countup-target");
    if (elHero) {
      animarCountUp(elHero, dineroTotalCuentasNum);
    }
  }, 40);

  return `
  <div class="fintech-home-screen">
    <!-- 1. Hero Saldo Total -->
    <header class="home-hero-balance-wrap">
      <div class="hero-status-pill-container" data-accion-fintech="ver-cuadre" style="cursor: pointer;" title="Ver diagnóstico de cuadre">
        ${badgeEstado(
          esCuadrado ? "cuadrado" : "revisar",
          esCuadrado ? "Contabilidad al día" : `Diferencia: ${importe(dineroDiferencia, "", false)}`
        )}
      </div>

      <span class="hero-balance-caption">Patrimonio disponible</span>
      
      <div class="hero-huge-balance" id="hero-countup-target" data-final="${dineroTotalCuentas}">
        ${importe(dineroTotalCuentas, "hero-tabular", true)}
      </div>

      <div class="hero-sub-breakdown">
        <span class="breakdown-tag">Bancos <strong>${importe(dineroBancos, "", false)}</strong></span>
        <span class="breakdown-dot">·</span>
        <span class="breakdown-tag">Efectivo <strong>${importe(dineroCaja, "", false)}</strong></span>
        <span class="breakdown-dot">·</span>
        <span class="breakdown-tag">Tarjetas <strong>${importe(dineroTarjetas, "", false)}</strong></span>
      </div>
    </header>

    <!-- 2. 3 Botones de Acción (Iconos Redondos de Cristal con Etiqueta) -->
    <section class="glass-actions-cluster">
      <button type="button" class="glass-action-circle-btn ingreso" data-accion-fintech="abrir-ingreso">
        <div class="action-circle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <span class="action-label">Ingreso</span>
      </button>

      <button type="button" class="glass-action-circle-btn gasto" data-accion-fintech="abrir-gasto">
        <div class="action-circle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <span class="action-label">Gasto</span>
      </button>

      <a href="/pagos-diarios" class="glass-action-circle-btn diario" style="text-decoration: none;">
        <div class="action-circle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>
        <span class="action-label">Pago diario</span>
      </a>
    </section>

    <!-- 3. Anillo de Progreso Único (Mes en centro + Ocio secundario) -->
    <section class="glass-card ring-card-widget">
      <div class="ring-widget-layout">
        <!-- SVG Dual Ring -->
        <div class="ring-graphic-container">
          <svg class="ring-svg" viewBox="0 0 180 180">
            <defs>
              <linearGradient id="ringMonthGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#6A4DF0"/>
                <stop offset="100%" stop-color="#0891B2"/>
              </linearGradient>
              <linearGradient id="ringOcioGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0891B2"/>
                <stop offset="100%" stop-color="#A5D8FF"/>
              </linearGradient>
            </defs>
            <!-- Anillo Exterior: Mes -->
            <circle class="ring-track" cx="90" cy="90" r="72" stroke-width="8"/>
            <circle class="ring-bar ring-bar-mes" cx="90" cy="90" r="72" stroke-width="8"
                    stroke="url(#ringMonthGrad)"
                    stroke-dasharray="452.39"
                    stroke-dashoffset="${offsetMes}"
                    stroke-linecap="round"/>
            
            <!-- Anillo Interior: Ocio -->
            <circle class="ring-track-inner" cx="90" cy="90" r="56" stroke-width="6"/>
            <circle class="ring-bar ring-bar-ocio" cx="90" cy="90" r="56" stroke-width="6"
                    stroke="url(#ringOcioGrad)"
                    stroke-dasharray="351.86"
                    stroke-dashoffset="${offsetOcio}"
                    stroke-linecap="round"/>
          </svg>

          <!-- Centro del anillo con Dinero del Mes -->
          <div class="ring-center-info">
            <span class="ring-center-caption">Dinero del mes</span>
            <div class="ring-center-val">${importe(dineroMes, "ring-amount", true)}</div>
            <span class="ring-center-badge">${pctMes}% asignado</span>
          </div>
        </div>

        <!-- Columna de Métricas de Cristal -->
        <div class="ring-metrics-panel">
          <div class="metric-glass-row">
            <div class="glow-indicator-dot dot-cyan"></div>
            <div class="metric-info-group">
              <span class="metric-tag">Disponible para el mes</span>
              <div class="metric-amount">${importe(dineroMes, "", false)}</div>
            </div>
          </div>

          <div class="metric-glass-row">
            <div class="glow-indicator-dot dot-coral"></div>
            <div class="metric-info-group">
              <span class="metric-tag">Ocio libre & caprichos</span>
              <div class="metric-amount">${importe(dineroOcio, "", false)}</div>
            </div>
          </div>

          <a href="/botes" class="glass-widget-action-link">
            <span>Ver botes de ahorro</span>
            <span class="arrow">&rarr;</span>
          </a>
        </div>
      </div>
    </section>

    <!-- 4. Resumen Compacto en Chips -->
    <section class="glass-summary-chips-row">
      <a href="/botes" class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-violet"></span>
        <span class="chip-title">Sobres y botes</span>
        <strong class="chip-val">${importe(dineroBotes, "", false)}</strong>
      </a>

      <a href="/prestamos" class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-coral"></span>
        <span class="chip-title">Deudas activas</span>
        <strong class="chip-val">${importe(Math.abs(Number(dineroPrestamos) || 0).toFixed(2), "", false)}</strong>
      </a>

      <a href="/inversiones" class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-green"></span>
        <span class="chip-title">Inversiones</span>
        <strong class="chip-val">${importe(inversionesData?.total_capital_aportado || "0.00", "", false)}</strong>
      </a>

      <a href="/deben" class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-blue"></span>
        <span class="chip-title">Me deben</span>
        <strong class="chip-val">${importe(dineroMeDeben, "", false)}</strong>
      </a>
    </section>

    <!-- 5. Lista Limpia de Últimos Movimientos -->
    <section class="glass-card latest-transactions-card">
      <div class="transactions-header">
        <h3 class="transactions-title">Últimos movimientos</h3>
        <a href="/movimientos" class="transactions-view-all">Ver todos</a>
      </div>

      <div class="transactions-stream">
        ${itemsMovimientos.length === 0 ? `
          <div class="empty-state-stream">
            <span class="empty-stream-icon">${icono("movimientos")}</span>
            <p>No hay movimientos registrados este mes</p>
          </div>
        ` : itemsMovimientos.map((m) => {
          const esPositivo = Number(m.importe) >= 0;
          return `
            <div class="transaction-row">
              <div class="tx-icon-wrapper ${esPositivo ? "in" : "out"}">
                ${esPositivo ? icono("flechaArriba") : icono("flechaAbajo")}
              </div>
              <div class="tx-main-info">
                <span class="tx-concept">${esc(m.descripcion || m.concepto || "Sin concepto")}</span>
                <span class="tx-meta">${fechaCorta(m.fecha)} · ${esc(m.cuenta_nombre || "Cuenta")}</span>
              </div>
              <div class="tx-amount-col">
                ${importe(m.importe, esPositivo ? "positivo" : "gasto", true)}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  </div>
  `;
});
