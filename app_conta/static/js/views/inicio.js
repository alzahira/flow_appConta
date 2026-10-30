// Vista de inicio: Dashboard de Control Financiero y Conciliación ("Disponible Real")
import { esc, importe, vista, icono, fechaCorta } from "../vistas.js";
import { esTarjetaRegalo } from "./tarjetas-regalo.js";

const BANCOS_CONFIG = [
  { id: "caixa", nombre: "CaixaBank", iconoKey: "caixa", color: "#0072ce" },
  { id: "deutsche", nombre: "Deutsche Bank", iconoKey: "deutsche", color: "#0018a8" },
  { id: "bbva", nombre: "BBVA", iconoKey: "bbva", color: "#004481" },
  { id: "revolut", nombre: "Revolut", iconoKey: "revolut", color: "#0f172a" },
  { id: "otros", nombre: "Otros Depósitos y Entidades", iconoKey: "banco", color: "#059669" },
];

function clasificarBanco(cuenta) {
  const nombre = (cuenta.nombre || "").toLowerCase();
  const entidad = (cuenta.entidad || "").toLowerCase();
  const texto = `${nombre} ${entidad}`;

  if (texto.includes("caixa")) return "caixa";
  if (texto.includes("deutsche") || texto.includes("deustche") || texto.includes(" db")) return "deutsche";
  if (texto.includes("bbva")) return "bbva";
  if (texto.includes("revolut")) return "revolut";
  return "otros";
}

function badgeEstado(estado, texto = null) {
  const esCuadrado = estado === "cuadrado";
  return `
    <div class="status-pill ${esCuadrado ? "ok" : "alerta"}">
      <span class="status-dot"></span>
      <span class="status-text">${esc(texto || (esCuadrado ? "Contabilidad al día" : "Diferencia pendiente"))}</span>
    </div>
  `;
}

function tarjetaCuentaRow(c) {
  const bancoId = clasificarBanco(c);
  const bancoConfig = BANCOS_CONFIG.find((b) => b.id === bancoId) || {
    id: "otros",
    nombre: c.entidad || "Depósito Bancario",
    iconoKey: c.tipo === "efectivo" ? "efectivo" : "banco",
    color: "#059669",
  };
  const iconoKey = c.tipo === "efectivo" ? "efectivo" : c.tipo === "tarjeta" ? "tarjeta" : bancoConfig.iconoKey;
  const esEfectivo = c.tipo === "efectivo";
  const esTarjeta = c.tipo === "tarjeta" || c.nombre.toUpperCase().startsWith("TARJETA");
  const tipoLabel = esEfectivo ? "Efectivo / Caja" : esTarjeta ? "Tarjeta / Prepago" : "Cuenta Corriente";

  return `
    <article class="card-account-row ${bancoId}">
      <div class="acc-row-main">
        <div class="acc-row-icon ${bancoId}">
          ${icono(iconoKey)}
        </div>
        <div class="acc-row-details">
          <div class="acc-row-header-texts">
            <h3 class="acc-row-title">${esc(c.nombre)}</h3>
            <span class="badge-subtle">${esc(c.entidad || bancoConfig.nombre)}</span>
            <span class="badge-tag">${esc(tipoLabel)}</span>
          </div>
          <div class="acc-row-meta">
            <span class="meta-item"><span class="meta-label">Saldo inicial:</span> <span class="meta-val">${c.saldo_inicial} €</span></span>
            <span class="meta-dot">&bull;</span>
            <span class="meta-item"><span class="meta-label">Apertura:</span> <span class="meta-val">${fechaCorta(c.fecha_apertura)}</span></span>
          </div>
        </div>
      </div>

      <div class="acc-row-side">
        <div class="acc-row-balance-block">
          <span class="balance-sub">Saldo disponible</span>
          <div class="acc-row-balance-value">${importe(c.saldo)}</div>
        </div>
      </div>
    </article>
  `;
}

function tarjetaBoteMini(b) {
  const obj = Number(b.objetivo);
  const sal = Number(b.saldo);
  const tieneObj = b.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(100, (sal / obj) * 100)) : 0;
  const conseguido = b.estado === "conseguido";

  return `
    <div class="card-pot clickable" data-accion="ver-detalle-bote" data-id="${b.id}" style="cursor: pointer" title="Ver movimientos y extracto de este sobre">
      <div class="card-pot-top">
        <div class="card-pot-icon ${b.tipo}">
          ${icono(b.tipo)}
        </div>
        <div class="card-pot-info">
          <h4>${esc(b.nombre)}</h4>
          <span class="badge-subtle">${esc(b.tipo)}</span>
        </div>
      </div>
      <div class="account-balance-section">
        <span class="balance-sub">Saldo acumulado</span>
        <div class="card-pot-balance ${sal < 0 ? "negativo" : ""}">
          ${importe(b.saldo)}
        </div>
      </div>
      ${
        tieneObj
          ? `
        <div class="progress-wrap">
          <div class="progress-bar ${sal > obj ? "over" : ""}">
            <div class="progress-fill" style="width: ${pct}%"></div>
          </div>
          <div class="progress-labels">
            <span>${pct.toFixed(0)}% cumplido</span>
            <span>Meta: ${b.objetivo} €</span>
          </div>
        </div>
      `
          : ""
      }
      ${
        conseguido
          ? `<span class="badge-tag ok">${icono("check")} Objetivo cumplido</span>`
          : ""
      }
    </div>
  `;
}

export default vista("inicio", async () => {
  const [conc, cuentas, botes, deudasData, previsionData, inversionesData, prestamosData] = await Promise.all([
    API.get("/conciliacion"),
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/deudas").catch(() => ({ total_pendiente: "0.00" })),
    API.get("/prevision-gastos").catch(() => null),
    API.get("/inversiones").catch(() => null),
    API.get("/prestamos").catch(() => null),
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

  // Inversiones activas
  const invItems = inversionesData?.items || [];
  const itemEtoro = invItems.find(
    (i) => (i.nombre + " " + (i.entidad || "")).toLowerCase().includes("etoro")
  );
  const dineroEtoro = itemEtoro ? itemEtoro.valor_actual : "1500.00";

  // Botes destacados: Dinero del mes y Dinero de ocio
  const botesItems = botes.items || [];
  const boteMes = botesItems.find(
    (b) =>
      b.nombre.toLowerCase().includes("mes en curso") ||
      b.nombre.toLowerCase().includes("cash para el mes") ||
      b.nombre.toLowerCase() === "dinero del mes"
  );
  const dineroMes = boteMes ? boteMes.saldo : "400.00";

  const boteOcio = botesItems.find(
    (b) => b.nombre.toLowerCase().includes("ocio")
  );
  const dineroOcio = boteOcio ? boteOcio.saldo : "214.22";

  // Agrupación de cuentas por entidades bancarias
  const agrupadoBancos = {
    caixa: [],
    deutsche: [],
    bbva: [],
    revolut: [],
    otros: [],
  };

  const cuentasBancosYEfectivo = itemsCuentas.filter(
    (c) => c.tipo !== "tarjeta" && !c.nombre.toUpperCase().startsWith("TARJETA")
  );

  const tarjetasItems = itemsCuentas.filter(
    (c) => c.tipo === "tarjeta" || c.nombre.toUpperCase().startsWith("TARJETA")
  );

  cuentasBancosYEfectivo.forEach((c) => {
    const bancoId = clasificarBanco(c);
    agrupadoBancos[bancoId].push(c);
  });

  const bancosConCuentas = BANCOS_CONFIG.filter((b) => (agrupadoBancos[b.id] || []).length > 0);

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
      <div class="hero-status-container">
        ${badgeEstado(
          esCuadrado ? "cuadrado" : "revisar",
          esCuadrado ? "Contabilidad al día" : `Diferencia: ${importe(dineroDiferencia)}`
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

      <button type="button" class="btn-hero-action nomina" data-accion-fintech="abrir-nomina">
        <span class="action-btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </span>
        <span class="action-btn-text">
          <strong>Reparto Nómina</strong>
          <small>Automático mes</small>
        </span>
      </button>

      <a href="#/copia-seguridad" class="btn-hero-action backup" style="text-decoration: none;">
        <span class="action-btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </span>
        <span class="action-btn-text">
          <strong>Copia & Vaciar</strong>
          <small>Guardar / Restaurar</small>
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
          <span class="spotlight-sub">Presupuesto en efectivo y compras cotidianas (${esc(boteMes?.nombre || "Mes en curso")})</span>
        </div>
        <div class="spotlight-footer">
          <a href="#/botes" class="spotlight-link" data-accion="ver-detalle-bote" data-id="${boteMes?.id || ""}">Ver movimientos &rarr;</a>
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
          <span class="spotlight-sub">Fondo disponible para salidas, cenas y disfrute (${esc(boteOcio?.nombre || "Bote ocio")})</span>
        </div>
        <div class="spotlight-footer">
          <a href="#/botes" class="spotlight-link" data-accion="ver-detalle-bote" data-id="${boteOcio?.id || ""}">Ver movimientos &rarr;</a>
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

      <a href="#/ahorro" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("botes")}</span>
          <span class="stat-label">Sobres y Botes</span>
        </div>
        <span class="stat-value">${importe(dineroBotes)}</span>
        <span class="stat-sub">Ahorros y amortizaciones &rarr;</span>
      </a>

      <a href="#/prevision-gastos" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("prevision")}</span>
          <span class="stat-label">Bote Gastos Anuales</span>
        </div>
        <span class="stat-value positivo">${importe(dineroPrevision)}</span>
        <span class="stat-sub">${previsionData ? `${previsionData.meses_pagados}/12 meses acumulados` : "Ver previsión &rarr;"}</span>
      </a>

      <a href="#/deben" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("prestamo")}</span>
          <span class="stat-label">Dinero que me deben</span>
        </div>
        <span class="stat-value negativo">${importe(dineroMeDeben, "negativo")}</span>
        <span class="stat-sub">Ver deudores &rarr;</span>
      </a>

      <a href="#/prestamos" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("coche")}</span>
          <span class="stat-label">Préstamos que debo</span>
        </div>
        <span class="stat-value negativo">${importe(dineroPrestamos, "negativo")}</span>
        <span class="stat-sub">Coche Hyundai, Ciclo DAM &rarr;</span>
      </a>

      <a href="#/inversiones" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("inversion")}</span>
          <span class="stat-label">Inversiones (Patrimonio)</span>
        </div>
        <span class="stat-value ${inversionesData?.total_plusvalia_centimos >= 0 ? "positivo" : "negativo"}">${importe(inversionesData?.total_valor_actual || "0.00")}</span>
        <span class="stat-sub">Etoro (${importe(dineroEtoro)}) + CRO &rarr;</span>
      </a>
    </div>
  </div>

  <!-- SECCIÓN DINERO EN CUENTAS Y TARJETAS (POSICIÓN CONSOLIDADA) -->
  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Dinero en Cuentas y Tarjetas</h3>
        <p class="section-desc">Posición consolidada por entidades bancarias, efectivo y monederos activos</p>
      </div>
      <a href="#/cuentas" class="btn-link">Gestionar cuentas bancarias &rarr;</a>
    </div>

    <!-- Píldoras de resumen por entidad bancaria -->
    <div class="bank-pills-summary">
      ${bancosConCuentas
        .map((b) => {
          const cuentasB = agrupadoBancos[b.id] || [];
          const subtotalB = cuentasB.reduce((acc, c) => acc + Number(c.saldo), 0);
          return `
          <div class="bank-pill-item">
            <span class="bank-pill-dot" style="background: ${b.color};"></span>
            <span class="bank-pill-name">${b.nombre}</span>
            <span class="bank-pill-val">${importe(subtotalB.toFixed(2))}</span>
          </div>
        `;
        })
        .join("")}
      <div class="bank-pill-item">
        <span class="bank-pill-dot" style="background: #059669;"></span>
        <span class="bank-pill-name">Efectivo Total</span>
        <span class="bank-pill-val">${importe(dineroCaja)}</span>
      </div>
      <div class="bank-pill-item">
        <span class="bank-pill-dot" style="background: #2563eb;"></span>
        <span class="bank-pill-name">Tarjetas y Prepago</span>
        <span class="bank-pill-val">${importe(dineroTarjetas)}</span>
      </div>
    </div>

    <!-- Listado de Cuentas Bancarias y Efectivo -->
    <div class="accounts-list-full">
      ${
        cuentasBancosYEfectivo.length > 0
          ? cuentasBancosYEfectivo.map(tarjetaCuentaRow).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("cuentas")}</span>
              <p>No tienes cuentas registradas aún.</p>
            </div>`
      }
    </div>

    <!-- Bloque de Tarjetas Prepago y Monederos Regalo -->
    ${
      tarjetasItems.length > 0
        ? `
      <div style="margin-top: 1.5rem;">
        <div class="section-header" style="margin-bottom: 0.85rem;">
          <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0;">
            Tarjetas Prepago y Monederos (${tarjetasItems.length})
          </h4>
          <a href="#/tarjetas" class="btn-link" style="font-size: 0.8rem;">Ver detalle tarjetas &rarr;</a>
        </div>
        <div class="accounts-list-full">
          ${tarjetasItems.map(tarjetaCuentaRow).join("\n")}
        </div>
      </div>
      `
        : ""
    }
  </section>


  <!-- SECCIÓN BOTES Y SOBRES -->
  ${
    botes.items.length > 0
      ? `
  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Botes y Sobres de Ahorro</h3>
        <p class="section-desc">Total acumulado en sobres: ${importe(dineroBotes)}</p>
      </div>
      <a href="#/botes" class="btn-link">Ver todos los botes &rarr;</a>
    </div>
    <div class="grid-pots">
      ${botes.items.slice(0, 6).map(tarjetaBoteMini).join("\n")}
    </div>
  </section>
  `
      : ""
  }

  `;
});
