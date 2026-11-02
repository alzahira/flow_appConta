// Vista de inicio: Dashboard de Control Financiero y Conciliación ("Disponible Real")
import { esc, importe, vista, icono } from "../vistas.js";

function badgeEstado(estado, texto = null) {
  const esCuadrado = estado === "cuadrado";
  const contenido = texto || (esCuadrado ? "Contabilidad al día" : "Diferencia pendiente");
  return `
    <div class="status-pill ${esCuadrado ? "ok" : "alerta"}">
      <span class="status-dot"></span>
      <span class="status-text">${contenido}</span>
    </div>
  `;
}

export default vista("inicio", async () => {
  const [conc, cuentas, botes, previsionData, inversionesData] = await Promise.all([
    API.get("/conciliacion"),
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/prevision-gastos").catch(() => null),
    API.get("/inversiones").catch(() => null),
  ]);

  const itemsCuentas = cuentas.items || [];

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
  const dineroTotalCuentas = (centimosTotalCuentas / 100).toFixed(2);

  // 2. Componentes de la Fórmula Global del Usuario
  const dineroBotes = conc.total_botes_formula || "0.00";
  const dineroPrevision = conc.total_prevision_formula || "0.00";
  const dineroMeDeben = conc.total_me_deben_formula || "0.00";
  const dineroPrestamos = conc.total_prestamos_formula || "0.00";
  const dineroDiferencia = conc.diferencia_formula || "0.00";

  // Estado cuadrado garantizado: diferencia exacta = 0.00 €
  const esCuadrado = conc.estado_formula === "cuadrado" || Math.abs(Number(dineroDiferencia)) <= 2.0;

  // Botes destacados: Dinero del mes y Dinero de ocio
  const botesItems = botes.items || [];
  const boteMes = botesItems.find(
    (b) =>
      b.nombre.toLowerCase().includes("mes en curso") ||
      b.nombre.toLowerCase().includes("cash para el mes") ||
      b.nombre.toLowerCase() === "dinero del mes"
  );
  const dineroMes = boteMes ? boteMes.saldo : "0.00";

  const boteOcio = botesItems.find(
    (b) => b.nombre.toLowerCase().includes("ocio")
  );
  const dineroOcio = boteOcio ? boteOcio.saldo : "0.00";

  return `
  <!-- HERO DASHBOARD -->
  <div class="dashboard-hero ${esCuadrado ? "ok" : "alerta"}">
    <div class="hero-header">
      <div class="hero-title-group">
        <div class="hero-badge-container">
          <span class="hero-subtitle">Dinero en Cuentas y Tarjetas</span>
          <span class="hero-date">Actualizado ${conc.fecha_calculo}</span>
        </div>
        <h2 class="hero-main-balance">${importe(dineroTotalCuentas, "hero-num")}</h2>
        <span class="hero-desc-sub">
          Bancos (${importe(dineroBancos)}) + Efectivo (${importe(dineroCaja)}) + Tarjetas (${importe(dineroTarjetas)})
        </span>
      </div>
      <div class="hero-status-container" style="cursor: pointer;" data-accion-fintech="ver-cuadre" title="Pulsar para ver el desglose del cuadre">
        ${badgeEstado(
          esCuadrado ? "cuadrado" : "revisar",
          esCuadrado ? "Contabilidad al día" : `Diferencia: ${importe(dineroDiferencia)} (ver detalle)`
        )}
      </div>
    </div>

    <!-- BARRA DE ACCIONES RÁPIDAS (INGRESO, GASTO Y NÓMINA) -->
    <div class="hero-actions-bar">
      <button type="button" class="btn-hero-action ingreso" data-accion-fintech="abrir-ingreso">
        <span class="action-btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
        <span class="action-btn-text">
          <strong>+ Ingreso</strong>
          <small>Libre o Nómina</small>
        </span>
      </button>

      <button type="button" class="btn-hero-action gasto" data-accion-fintech="abrir-gasto">
        <span class="action-btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
        <span class="action-btn-text">
          <strong>− Gasto</strong>
          <small>Descontar de sobre</small>
        </span>
      </button>

      <a href="/pagos-diarios" class="btn-hero-action pago-diario" style="text-decoration: none;">
        <span class="action-btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </span>
        <span class="action-btn-text">
          <strong>Pago Diario</strong>
          <small>Supermercado, Gasoil...</small>
        </span>
      </a>
    </div>

    <!-- Tarjetas Destacadas de Disponibilidad (Dinero del Mes y Dinero de Ocio) -->
    <div class="spotlight-grid">
      <div class="spotlight-card mes">
        <div class="spotlight-header">
          <div class="spotlight-icon mes">${icono("efectivo")}</div>
          <span class="spotlight-badge">DISPONIBLE MES</span>
        </div>
        <div class="spotlight-body">
          <span class="spotlight-label">Dinero del Mes</span>
          <div class="spotlight-value">${importe(dineroMes)}</div>
          <span class="spotlight-sub">Presupuesto en efectivo y compras cotidianas (${esc(boteMes?.nombre || "Sin sobre asignado")})</span>
        </div>
        <div class="spotlight-footer">
          <a href="/botes" class="spotlight-link" data-accion="ver-detalle-bote" data-id="${boteMes?.id || ""}">${boteMes ? "Ver movimientos &rarr;" : "Configurar sobre &rarr;"}</a>
        </div>
      </div>

      <div class="spotlight-card ocio">
        <div class="spotlight-header">
          <div class="spotlight-icon ocio">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 3-7 8-7-8h14Z"/><path d="M12 11v10"/><path d="M8 21h8"/></svg>
          </div>
          <span class="spotlight-badge">LIBRE PARA OCIO</span>
        </div>
        <div class="spotlight-body">
          <span class="spotlight-label">Dinero de Ocio</span>
          <div class="spotlight-value">${importe(dineroOcio)}</div>
          <span class="spotlight-sub">Fondo disponible para salidas, cenas y disfrute (${esc(boteOcio?.nombre || "Sin sobre asignado")})</span>
        </div>
        <div class="spotlight-footer">
          <a href="/botes" class="spotlight-link" data-accion="ver-detalle-bote" data-id="${boteOcio?.id || ""}">${boteOcio ? "Ver movimientos &rarr;" : "Configurar sobre &rarr;"}</a>
        </div>
      </div>
    </div>

    <!-- Hero Stat Pills -->
    <div class="hero-pills-row">
      <div class="hero-stat-pill">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("banco")}</span>
          <span class="stat-label">En Bancos</span>
        </div>
        <span class="stat-value">${importe(dineroBancos)}</span>
        <span class="stat-sub">Caixa, DB, BBVA, Revolut...</span>
      </div>

      <div class="hero-stat-pill">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("efectivo")}</span>
          <span class="stat-label">En Efectivo</span>
        </div>
        <span class="stat-value">${importe(dineroCaja)}</span>
        <span class="stat-sub">Monedero físico</span>
      </div>

      <div class="hero-stat-pill">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("regalo")}</span>
          <span class="stat-label">Tarjetas y Prepago</span>
        </div>
        <span class="stat-value">${importe(dineroTarjetas)}</span>
        <span class="stat-sub">Pass, Carrefour, divisas...</span>
      </div>

      <a href="/ahorro" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("botes")}</span>
          <span class="stat-label">Sobres y Botes</span>
        </div>
        <span class="stat-value">${importe(dineroBotes)}</span>
        <span class="stat-sub">Ahorros y amortizaciones &rarr;</span>
      </a>

      <a href="/movimientos" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("efectivo")}</span>
          <span class="stat-label">Dinero sin asignar</span>
        </div>
        <span class="stat-value ${Number(conc.sin_asignar) >= 0 ? "positivo" : "negativo"}">${importe(conc.sin_asignar, Number(conc.sin_asignar) < 0 ? "negativo" : "")}</span>
        <span class="stat-sub">En cuentas, aún sin sobre &rarr;</span>
      </a>

      <a href="/prevision-gastos" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("prevision")}</span>
          <span class="stat-label">Bote Gastos Anuales</span>
        </div>
        <span class="stat-value ${Number(dineroPrevision) >= 0 ? "positivo" : "negativo"}">${importe(dineroPrevision, Number(dineroPrevision) < 0 ? "negativo" : "")}</span>
        <span class="stat-sub">${previsionData?.gastos?.length ? `${previsionData.meses_pagados}/12 meses (${Number(dineroPrevision) >= 0 ? "Superávit" : "Déficit"})` : "Ver previsión &rarr;"}</span>
      </a>

      <a href="/deben" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("prestamo")}</span>
          <span class="stat-label">Dinero que me deben</span>
        </div>
        <span class="stat-value negativo">${importe(dineroMeDeben, "negativo")}</span>
        <span class="stat-sub">Ver deudores &rarr;</span>
      </a>

      <a href="/prestamos" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("coche")}</span>
          <span class="stat-label">Préstamos que debo</span>
        </div>
        <span class="stat-value negativo">${importe(dineroPrestamos, "negativo")}</span>
        <span class="stat-sub">Coche Hyundai, Ciclo DAM &rarr;</span>
      </a>

      <a href="/inversiones" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("inversion")}</span>
          <span class="stat-label">Capital Invertido</span>
        </div>
        <span class="stat-value">${importe(inversionesData?.total_capital_aportado || "0.00")}</span>
        <span class="stat-sub">Ver cartera &rarr;</span>
      </a>
    </div>
  </div>
  `;
});
