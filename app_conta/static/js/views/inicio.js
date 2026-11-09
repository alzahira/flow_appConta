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
    API.get("/movimientos?limit=5&orden=desc").catch(() => ({ items: [] })),
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

  // Tarjetas monedero / prepago con saldo a favor
  const centimosMonederos = itemsCuentas
    .filter((c) => c.tipo === "tarjeta" && Number(c.saldo || 0) >= 0)
    .reduce((acc, c) => acc + Math.round(Number(c.saldo || 0) * 100), 0);
  const dineroMonederos = (centimosMonederos / 100).toFixed(2);

  // Gasto acumulado en tarjetas de crédito (adelanto mensual a pagar en banco)
  const centimosTarjetasDispuesto = itemsCuentas
    .filter((c) => c.tipo === "tarjeta" && Number(c.saldo || 0) < 0)
    .reduce((acc, c) => acc + Math.abs(Math.round(Number(c.saldo || 0) * 100)), 0);
  const dineroTarjetaDispuesto = (centimosTarjetasDispuesto / 100).toFixed(2);

  // Patrimonio neto real (bancos + efectivo + monederos - crédito a liquidar)
  const centimosTotalCuentas = centimosCaja + centimosBancos + centimosMonederos - centimosTarjetasDispuesto;
  const dineroTotalCuentasNum = centimosTotalCuentas / 100;
  const dineroTotalCuentas = dineroTotalCuentasNum.toFixed(2);

  // 2. Componentes de la Fórmula
  const dineroBotes = conc.total_botes_formula || "0.00";
  const dineroPrevision = conc.total_prevision_formula || "0.00";
  const dineroMeDeben = conc.total_me_deben_formula || "0.00";
  const dineroPrestamos = conc.total_prestamos_formula || "0.00";
  const dineroDiferencia = conc.diferencia_formula !== undefined ? conc.diferencia_formula : (conc.diferencia || "0.00");

  const esCuadrado = conc.estado_formula === "cuadrado" && Math.abs(Number(dineroDiferencia)) <= 1.00;

  // Botes clave: Mes y Ocio
  const botesItems = botes.items || [];
  const boteMes = botesItems.find((b) => {
    const nom = (b.nombre || "").toLowerCase().trim();
    return (
      nom.includes("mes en curso") ||
      nom.includes("cash para el mes") ||
      nom === "dinero del mes" ||
      nom === "mes" ||
      nom.startsWith("mes ")
    );
  });
  const dineroMesNum = Number(boteMes?.saldo || 0);
  const dineroMes = dineroMesNum.toFixed(2);

  const boteOcio = botesItems.find((b) =>
    (b.nombre || "").toLowerCase().includes("ocio")
  );
  const dineroOcioNum = Number(boteOcio?.saldo || 0);
  const dineroOcio = dineroOcioNum.toFixed(2);

  // Cálculos para el anillo de progreso circular sobre el total presupuestado (Mes: 400 €, Ocio: 230 €)
  const metaMes = Number(boteMes?.objetivo_centimos ? boteMes.objetivo_centimos / 100 : 400) || 400;
  const pctMes = Math.min(100, Math.max(0, Math.round((dineroMesNum / metaMes) * 100)));
  const circunferenciaMes = 2 * Math.PI * 86; // r=86 -> 540.35
  const offsetMes = circunferenciaMes - (pctMes / 100) * circunferenciaMes;

  const metaOcio = Number(boteOcio?.objetivo_centimos ? boteOcio.objetivo_centimos / 100 : 230) || 230;
  const pctOcio = Math.min(100, Math.max(0, Math.round((dineroOcioNum / metaOcio) * 100)));
  const circunferenciaOcio = 2 * Math.PI * 68; // r=68 -> 427.26
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
          esCuadrado ? "Contabilidad al día" : `⚠️ Descuadre: ${importe(dineroDiferencia, "", false)}`
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
        <span class="breakdown-tag">Monederos <strong>${importe(dineroMonederos, "", false)}</strong></span>
        ${
          centimosTarjetasDispuesto > 0
            ? `<span class="breakdown-dot">·</span>
               <span class="breakdown-tag" title="Gasto con tarjeta a pagar a final de mes">Tarjeta pendiente <strong>${importe(dineroTarjetaDispuesto, "", false)}</strong></span>`
            : ""
        }
      </div>
    </header>

    <!-- 2. Botones de Acción Rápida (Iconos Redondos de Cristal con Etiqueta) -->
    <section class="glass-actions-cluster">
      <button type="button" class="glass-action-circle-btn ingreso" data-accion-fintech="abrir-ingreso" title="Registrar nuevo ingreso o nómina">
        <div class="action-circle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <span class="action-label">Ingreso</span>
      </button>

      <button type="button" class="glass-action-circle-btn gasto" data-accion-fintech="abrir-gasto" title="Registrar salida o gasto">
        <div class="action-circle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <span class="action-label">Gasto</span>
      </button>

      <button type="button" class="glass-action-circle-btn traspaso" data-accion-fintech="abrir-traspaso" title="Mover dinero entre cuentas o recargar Revolut desde tarjeta DB / Carrefour">
        <div class="action-circle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"/></svg>
        </div>
        <span class="action-label">Traspaso / Recarga</span>
      </button>

      <a href="/pagos-diarios" class="glass-action-circle-btn diario" style="text-decoration: none;" title="Ver gastos del día a día">
        <div class="action-circle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>
        <span class="action-label">Pago diario</span>
      </a>
    </section>

    <!-- 3. Anillo de Progreso Único (Mes en centro + Ocio secundario) -->
    <section class="glass-card ring-card-widget">
      <div class="ring-widget-layout">
        <!-- SVG Dual Ring Ampliado y Espacioso -->
        <div class="ring-graphic-container">
          <svg class="ring-svg" viewBox="0 0 220 220">
            <defs>
              <linearGradient id="ringMonthGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#7C3AED"/>
                <stop offset="100%" stop-color="#3B82F6"/>
              </linearGradient>
              <linearGradient id="ringOcioGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0891B2"/>
                <stop offset="100%" stop-color="#22D3EE"/>
              </linearGradient>
            </defs>
            <!-- Anillo Exterior: Mes (Presupuesto) -->
            <circle class="ring-track" cx="110" cy="110" r="86" stroke-width="8"/>
            <circle class="ring-bar ring-bar-mes" cx="110" cy="110" r="86" stroke-width="8"
                    stroke="url(#ringMonthGrad)"
                    stroke-dasharray="540.35"
                    stroke-dashoffset="${offsetMes}"
                    stroke-linecap="round"/>
            
            <!-- Anillo Interior: Ocio (Presupuesto) -->
            <circle class="ring-track-inner" cx="110" cy="110" r="68" stroke-width="7"/>
            <circle class="ring-bar ring-bar-ocio" cx="110" cy="110" r="68" stroke-width="7"
                    stroke="url(#ringOcioGrad)"
                    stroke-dasharray="427.26"
                    stroke-dashoffset="${offsetOcio}"
                    stroke-linecap="round"/>
          </svg>

          <!-- Centro del anillo con Dinero del Mes -->
          <div class="ring-center-info">
            <span class="ring-center-caption">Dinero del mes</span>
            <div class="ring-center-val">${importe(dineroMes, "ring-amount", true)}</div>
            <span class="ring-center-badge">${pctMes}% de ${metaMes} €</span>
          </div>
        </div>

        <!-- Columna de Métricas de Cristal -->
        <div class="ring-metrics-panel">
          <div class="metric-glass-row">
            <div class="glow-indicator-dot dot-violet"></div>
            <div class="metric-info-group">
              <span class="metric-tag">Disponible para el mes · <strong>${pctMes}%</strong></span>
              <div class="metric-amount">
                ${importe(dineroMes, "", false)}
                <span class="metric-total-goal">/ ${importe(metaMes, "", false)}</span>
              </div>
            </div>
          </div>

          <div class="metric-glass-row">
            <div class="glow-indicator-dot dot-cyan"></div>
            <div class="metric-info-group">
              <span class="metric-tag">Ocio libre & caprichos · <strong>${pctOcio}%</strong></span>
              <div class="metric-amount">
                ${importe(dineroOcio, "", false)}
                <span class="metric-total-goal">/ ${importe(metaOcio, "", false)}</span>
              </div>
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
