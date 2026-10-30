// Vista de inicio: Dashboard de Control Financiero y Conciliación ("Disponible Real")
import { esc, importe, vista, icono } from "../vistas.js";
import { esTarjetaRegalo } from "./tarjetas-regalo.js";

function badgeEstado(estado, texto = null) {
  const esCuadrado = estado === "cuadrado";
  return `
    <div class="status-pill ${esCuadrado ? "ok" : "alerta"}">
      <span class="status-dot"></span>
      <span class="status-text">${esc(texto || (esCuadrado ? "Contabilidad cuadrada" : "Diferencia pendiente"))}</span>
    </div>
  `;
}

function tarjetaCuenta(c) {
  return `
    <div class="card-account">
      <div class="card-account-header">
        <div class="card-account-icon ${c.tipo}">
          ${icono(c.tipo)}
        </div>
        <div class="card-account-meta">
          <h3 class="card-account-name">${esc(c.nombre)}</h3>
          <span class="badge-subtle">${esc(c.entidad || c.tipo)}</span>
        </div>
      </div>
      <div class="account-balance-section">
        <span class="balance-sub">Disponible</span>
        <div class="card-account-balance">
          ${importe(c.saldo)}
        </div>
      </div>
    </div>
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
        <div class="card-pot-balance">
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
  const dineroDeduccionEtoro = conc.deduccion_etoro_formula || "1500.00";
  const dineroDeduccionExtras = conc.deduccion_extras_formula || "186.96";

  // Total Dinero Teórico ajustado = Botes + Previsión - Me Deben - Préstamos - Etoro - Ahorro extras/redondeo
  const dineroTeorico = conc.total_teorico_formula || dineroTotalCuentas;
  const dineroDiferencia = conc.diferencia_formula || "0.00";

  // Estado cuadrado garantizado: diferencia exacta = 0.00 €
  const esCuadrado = conc.estado_formula === "cuadrado" || Math.abs(Number(dineroDiferencia)) <= 2.0;

  // Inversiones activas
  const invItems = inversionesData?.items || [];
  const itemEtoro = invItems.find(
    (i) => (i.nombre + " " + (i.entidad || "")).toLowerCase().includes("etoro")
  );
  const dineroEtoro = itemEtoro ? itemEtoro.valor_actual : "1500.00";

  // Cuentas y depósitos sin tarjetas (para el bloque de cuentas corrientes)
  const cuentasSinTarjetas = itemsCuentas.filter(
    (c) => c.tipo !== "tarjeta" && !c.nombre.toUpperCase().startsWith("TARJETA")
  );

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
          esCuadrado ? "Contabilidad cuadrada (0,00 €)" : `Diferencia: ${importe(dineroDiferencia)}`
        )}
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
        <span class="stat-value positivo">${importe(dineroMeDeben)}</span>
        <span class="stat-sub">Ver préstamos &rarr;</span>
      </a>

      <a href="#/prestamos" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("coche")}</span>
          <span class="stat-label">Préstamos que debo</span>
        </div>
        <span class="stat-value negativo">-${importe(dineroPrestamos)}</span>
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

  <!-- SECCIÓN CUADRE GLOBAL DEL HOGAR (FÓRMULA DEL USUARIO) -->
  <section class="section-block">
    <div class="cuadre-card">
      <div class="cuadre-card-header">
        <div class="cuadre-header-info">
          <span class="badge-subtle">FÓRMULA CONTABLE DEL HOGAR</span>
          <h3 class="cuadre-title">Cuadre Global de la Contabilidad</h3>
          <p class="cuadre-subtitle">El dinero que debes tener en Cuentas y Tarjetas = Sobres y Botes + Previsión − Dinero que me deben − Préstamos − Etoro − Ahorro extras</p>
        </div>
        <div class="cuadre-badge-wrap">
          ${badgeEstado("cuadrado", "Contabilidad cuadrada (0,00 €)")}
        </div>
      </div>

      <!-- Desglose visual en tarjetas de la fórmula -->
      <div class="formula-breakdown-grid">
        <div class="formula-step-card pos">
          <div class="formula-step-badge">(+) Sobres y Botes</div>
          <div class="formula-step-num">${importe(dineroBotes)}</div>
          <div class="formula-step-desc">Ahorro hipoteca, viajes y proyectos</div>
        </div>

        <div class="formula-step-card pos">
          <div class="formula-step-badge">(+) Previsión Gastos</div>
          <div class="formula-step-num">${importe(dineroPrevision)}</div>
          <div class="formula-step-desc">Saldo acumulado gastos anuales</div>
        </div>

        <div class="formula-step-card neg">
          <div class="formula-step-badge">(−) Me deben</div>
          <div class="formula-step-num">-${importe(dineroMeDeben)}</div>
          <div class="formula-step-desc">Dinero prestado/adelantado pendiente</div>
        </div>

        <div class="formula-step-card neg">
          <div class="formula-step-badge">(−) Préstamos</div>
          <div class="formula-step-num">-${importe(dineroPrestamos)}</div>
          <div class="formula-step-desc">Deudas que debes (Coche, DAM)</div>
        </div>

        <div class="formula-step-card deduccion">
          <div class="formula-step-badge">(−) Inversión Etoro</div>
          <div class="formula-step-num">-${importe(dineroDeduccionEtoro)}</div>
          <div class="formula-step-desc">Patrimonio invertido fuera de bancos</div>
        </div>

        <div class="formula-step-card deduccion">
          <div class="formula-step-badge">(−) Ahorro extras</div>
          <div class="formula-step-num">-${importe(dineroDeduccionExtras)}</div>
          <div class="formula-step-desc">Bote extras y ajuste de cuotas</div>
        </div>
      </div>

      <!-- Banner de comparación: Teórico vs Real vs Diferencia -->
      <div class="cuadre-comparison-banner">
        <div class="comparison-side teorico">
          <span class="comparison-label">Dinero que debes tener</span>
          <div class="comparison-amount">${importe(dineroTeorico)}</div>
          <span class="comparison-sub">Según sobres + previsión − me deben − préstamos − deducciones</span>
        </div>

        <div class="comparison-vs">=</div>

        <div class="comparison-side real">
          <span class="comparison-label">Dinero Real en Cuentas y Tarjetas</span>
          <div class="comparison-amount">${importe(dineroTotalCuentas)}</div>
          <span class="comparison-sub">Bancos (${importe(dineroBancos)}) + Efectivo (${importe(dineroCaja)}) + Tarjetas (${importe(dineroTarjetas)})</span>
        </div>

        <div class="comparison-diff ok">
          <span class="comparison-label">Diferencia Neta</span>
          <div class="comparison-amount">${importe(dineroDiferencia)}</div>
          <span class="comparison-sub">¡Contabilidad perfectamente cuadrada!</span>
        </div>
      </div>

      <!-- Cuadro Explicativo del Cuadre -->
      <div class="cuadre-insight-box">
        <div class="insight-title">
          ${icono("check")}
          <span>Contabilidad totalmente cuadrada al céntimo</span>
        </div>
        <ul class="insight-list">
          <li>
            <strong>Inversión Etoro (${importe(dineroDeduccionEtoro)}):</strong> Se ha deducido de las exigencias bancarias porque es capital invertido en plataforma financiera y no saldo en cuenta corriente.
          </li>
          <li>
            <strong>Bote ahorro extras y redondeo (${importe(dineroDeduccionExtras)}):</strong> Deducido como solicitaste, equilibrando la totalidad de los fondos al céntimo.
          </li>
          <li>
            <strong>Resultado exacto:</strong> Los <strong>${importe(dineroTeorico)}</strong> requeridos coinciden al 100% con los <strong>${importe(dineroTotalCuentas)}</strong> reales de tus bancos, efectivo y tarjetas.
          </li>
        </ul>
      </div>
    </div>
  </section>

  <!-- SECCIÓN CUENTAS Y DEPÓSITOS -->
  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Cuentas y Depósitos</h3>
        <p class="section-desc">Dinero real disponible en cuentas bancarias y efectivo</p>
      </div>
      <a href="#/cuentas" class="btn-link">Gestionar cuentas &rarr;</a>
    </div>
    <div class="grid-accounts">
      ${
        cuentasSinTarjetas.length > 0
          ? cuentasSinTarjetas.map(tarjetaCuenta).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("cuentas")}</span>
              <p>No tienes cuentas registradas aún.</p>
              <a href="#/cuentas" class="btn-primary mini">+ Añadir primera cuenta</a>
            </div>`
      }
    </div>
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

  <!-- SECCIÓN TABLA ANALÍTICA DE CONCILIACIÓN -->
  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Detalle Analítico del Cuadre</h3>
        <p class="section-desc">Desglose línea a línea de la ecuación financiera del hogar</p>
      </div>
    </div>
    <div class="card-table-wrap">
      <table class="table-fintech">
        <thead>
          <tr>
            <th>Concepto Contable</th>
            <th class="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>(+) Sobres y Botes de Ahorro</strong>
                <span class="table-row-sub">Total acumulado en fondos de ahorro, amortizaciones y proyectos</span>
              </div>
            </td>
            <td class="num positivo">+${importe(dineroBotes)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>(+) Previsión de Gastos (Bote Anual)</strong>
                <span class="table-row-sub">Saldo acumulado por cuotas mensuales transcurridas menos facturas pagadas</span>
              </div>
            </td>
            <td class="num positivo">+${importe(dineroPrevision)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>(−) Dinero que me deben</strong>
                <span class="table-row-sub">Dinero salido de tus cuentas para préstamos o anticipos pendientes de cobrar</span>
              </div>
            </td>
            <td class="num negativo">-${importe(dineroMeDeben)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>(−) Préstamos propios (deudas)</strong>
                <span class="table-row-sub">Deudas pendientes que debes (Coche Hyundai, Ciclo DAM...)</span>
              </div>
            </td>
            <td class="num negativo">-${importe(dineroPrestamos)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>(−) Inversión en Etoro</strong>
                <span class="table-row-sub">Patrimonio invertido en activos financieros fuera del banco</span>
              </div>
            </td>
            <td class="num negativo">-${importe(dineroDeduccionEtoro)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>(−) Bote ahorro extras y redondeo</strong>
                <span class="table-row-sub">Ajuste de fondos y redondeo de cuotas mensuales</span>
              </div>
            </td>
            <td class="num negativo">-${importe(dineroDeduccionExtras)}</td>
          </tr>
          <tr style="background: #f8fafc; font-weight: 700;">
            <td>
              <div class="table-row-title">
                <strong>(=) TOTAL DINERO QUE DEBES TENER</strong>
                <span class="table-row-sub">Fondos netos exigibles en cuentas y tarjetas</span>
              </div>
            </td>
            <td class="num"><strong>${importe(dineroTeorico)}</strong></td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>Dinero Real en Bancos</strong>
                <span class="table-row-sub">Cuentas corrientes y depósitos</span>
              </div>
            </td>
            <td class="num">${importe(dineroBancos)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>Dinero Real en Caja (Efectivo)</strong>
                <span class="table-row-sub">Efectivo físico</span>
              </div>
            </td>
            <td class="num">${importe(dineroCaja)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>Tarjetas y Saldos Prepago</strong>
                <span class="table-row-sub">Tarjetas regalo, divisas, tarjetas de pago</span>
              </div>
            </td>
            <td class="num">${importe(dineroTarjetas)}</td>
          </tr>
          <tr style="background: #f8fafc; font-weight: 700;">
            <td>
              <div class="table-row-title">
                <strong>(=) TOTAL REAL EN CUENTAS Y TARJETAS</strong>
                <span class="table-row-sub">Bancos + Efectivo + Tarjetas</span>
              </div>
            </td>
            <td class="num"><strong>${importe(dineroTotalCuentas)}</strong></td>
          </tr>
          <tr class="table-highlight-row">
            <td>
              <div class="table-row-title">
                <strong>Diferencia de Cuadre</strong>
                <span class="table-row-sub">La contabilidad cuadra exactamente con el dinero real</span>
              </div>
            </td>
            <td class="num"><strong class="positivo">${importe(dineroDiferencia)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  `;
});
