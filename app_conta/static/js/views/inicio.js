// Vista de inicio: Dashboard de Control Financiero y Conciliación ("Disponible Real")
import { esc, importe, vista, icono } from "../vistas.js";
import { esTarjetaRegalo } from "./tarjetas-regalo.js";

function badgeEstado(estado) {
  const esCuadrado = estado === "cuadrado";
  return `
    <div class="status-pill ${esCuadrado ? "ok" : "alerta"}">
      <span class="status-dot"></span>
      <span class="status-text">${esCuadrado ? "Contabilidad cuadrada" : "Diferencia pendiente"}</span>
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

  const totalQueMeDeben = deudasData.total_pendiente || "0.00";
  const debeRevisar = conc.estado !== "cuadrado";
  const itemsCuentas = cuentas.items || [];

  // Segregación financiera:
  // - Dinero en caja: estrictamente dinero efectivo físico (tipo === "efectivo")
  // - Dinero en bancos: cuentas corrientes y depósitos bancarios (tipo === "banco")
  // - Dinero disponible: total líquido disponible en el hogar (caja + bancos)
  const centimosCaja = itemsCuentas
    .filter((c) => c.tipo === "efectivo")
    .reduce((acc, c) => acc + Math.round(Number(c.saldo || 0) * 100), 0);
  const dineroCaja = (centimosCaja / 100).toFixed(2);

  const centimosBancos = itemsCuentas
    .filter((c) => c.tipo === "banco")
    .reduce((acc, c) => acc + Math.round(Number(c.saldo || 0) * 100), 0);
  const dineroBancos = (centimosBancos / 100).toFixed(2);

  const centimosRegalo = itemsCuentas
    .filter(esTarjetaRegalo)
    .reduce((acc, c) => acc + Math.round(Number(c.saldo || 0) * 100), 0);
  const dineroRegalo = (centimosRegalo / 100).toFixed(2);

  const centimosDisponible = centimosCaja + centimosBancos;
  const dineroDisponible = (centimosDisponible / 100).toFixed(2);

  // Cuentas y depósitos sin tarjetas (las tarjetas tienen su propia pestaña)
  const cuentasSinTarjetas = itemsCuentas.filter(
    (c) => c.tipo !== "tarjeta" && !c.nombre.toUpperCase().startsWith("TARJETA")
  );

  return `
  <div class="dashboard-hero ${debeRevisar ? "alerta" : "ok"}">
    <div class="hero-header">
      <div class="hero-title-group">
        <div class="hero-badge-container">
          <span class="hero-subtitle">Dinero disponible</span>
          <span class="hero-date">Actualizado ${conc.fecha_calculo}</span>
        </div>
        <h2 class="hero-main-balance">${importe(dineroDisponible, "hero-num")}</h2>
        <span class="hero-desc-sub">Total líquido disponible: Caja (efectivo) + Bancos</span>
      </div>
      <div class="hero-status-container">
        ${badgeEstado(conc.estado)}
      </div>
    </div>

    ${
      debeRevisar
        ? `
      <div class="hero-alert-banner">
        <div class="alert-banner-icon">${icono("alerta")}</div>
        <div class="alert-banner-content">
          <strong>Diferencia de conciliación detectada: ${importe(conc.diferencia)}</strong>
          <p>Existe un desfase entre el dinero en cuentas y los botes asignados. Revisa posibles movimientos no asignados o duplicados.</p>
        </div>
      </div>
    `
        : ""
    }

    <div class="hero-pills-row">
      <div class="hero-stat-pill">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("efectivo")}</span>
          <span class="stat-label">Dinero en caja</span>
        </div>
        <span class="stat-value">${importe(dineroCaja)}</span>
        <span class="stat-sub">Solo dinero efectivo</span>
      </div>

      <div class="hero-stat-pill">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("banco")}</span>
          <span class="stat-label">Dinero en bancos</span>
        </div>
        <span class="stat-value">${importe(dineroBancos)}</span>
        <span class="stat-sub">Cuentas y depósitos</span>
      </div>

      <div class="hero-stat-pill">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("regalo")}</span>
          <span class="stat-label">Tarjetas regalo</span>
        </div>
        <span class="stat-value">${importe(dineroRegalo)}</span>
        <span class="stat-sub">Saldo prepago</span>
      </div>

      <div class="hero-stat-pill">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("botes")}</span>
          <span class="stat-label">Asignado a botes</span>
        </div>
        <span class="stat-value">${importe(conc.saldo_total_botes)}</span>
        <span class="stat-sub">Ahorro y compromisos</span>
      </div>

      <div class="hero-stat-pill">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("check")}</span>
          <span class="stat-label">Libre sin reservar</span>
        </div>
        <span class="stat-value">${importe(conc.sin_asignar)}</span>
        <span class="stat-sub">Disponible sin asignar</span>
      </div>

      <a href="#/deben" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("prestamo")}</span>
          <span class="stat-label">Dinero que me deben</span>
        </div>
        <span class="stat-value positivo">${importe(totalQueMeDeben)}</span>
        <span class="stat-sub">Ver préstamos &rarr;</span>
      </a>

      <a href="#/prevision-gastos" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("prevision")}</span>
          <span class="stat-label">Bote Gastos Anuales</span>
        </div>
        <span class="stat-value ${Number(previsionData?.total_saldo || 0) >= 0 ? "positivo" : "negativo"}">${importe(previsionData?.total_saldo || "0.00")}</span>
        <span class="stat-sub">${previsionData ? `${previsionData.meses_pagados}/12 meses provistos` : "Ver previsión &rarr;"}</span>
      </a>

      <a href="#/inversiones" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("inversion")}</span>
          <span class="stat-label">Patrimonio Invertido</span>
        </div>
        <span class="stat-value ${inversionesData?.total_plusvalia_centimos >= 0 ? "positivo" : "negativo"}">${importe(inversionesData?.total_valor_actual || "0.00")}</span>
        <span class="stat-sub">${inversionesData && inversionesData.total_posiciones > 0 ? `${inversionesData.rentabilidad_global_pct >= 0 ? "+" : ""}${inversionesData.rentabilidad_global_pct}% (${inversionesData.total_posiciones} ${inversionesData.total_posiciones === 1 ? "activo" : "activos"})` : "Ver cartera &rarr;"}</span>
      </a>

      <a href="#/prestamos" class="hero-stat-pill" style="text-decoration: none; cursor: pointer;">
        <div class="stat-pill-header">
          <span class="stat-pill-icon">${icono("coche")}</span>
          <span class="stat-label">Deuda en Préstamos</span>
        </div>
        <span class="stat-value negativo">${prestamosData?.total_deuda_pendiente ? `-${importe(prestamosData.total_deuda_pendiente)}` : "0,00 €"}</span>
        <span class="stat-sub">${prestamosData && prestamosData.total_prestamos > 0 ? `${prestamosData.total_prestamos} ${prestamosData.total_prestamos === 1 ? "préstamo" : "préstamos"} (${prestamosData.progreso_global_pct}% amortizado)` : "Ver préstamos &rarr;"}</span>
      </a>
    </div>

  </div>

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

  ${
    botes.items.length > 0
      ? `
  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Botes y Sobres de Ahorro</h3>
        <p class="section-desc">Total reservado: ${importe(conc.saldo_total_botes)}</p>
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

  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Detalle del Cuadre (Conciliación)</h3>
        <p class="section-desc">Comprobación analítica entre saldo bancario, caja y fondos asignados</p>
      </div>
    </div>
    <div class="card-table-wrap">
      <table class="table-fintech">
        <thead>
          <tr>
            <th>Concepto de Conciliación</th>
            <th class="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>Dinero Disponible (Caja + Bancos)</strong>
                <span class="table-row-sub">Suma de efectivo en caja y saldo bancario</span>
              </div>
            </td>
            <td class="num">${importe(dineroDisponible)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>— Dinero en caja (efectivo)</strong>
                <span class="table-row-sub">Suma de cuentas de efectivo físico</span>
              </div>
            </td>
            <td class="num">${importe(dineroCaja)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>— Dinero en bancos</strong>
                <span class="table-row-sub">Suma de cuentas corrientes y depósitos</span>
              </div>
            </td>
            <td class="num">${importe(dineroBancos)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>Suma de saldos iniciales</strong>
                <span class="table-row-sub">Fondos de partida al abrir las cuentas</span>
              </div>
            </td>
            <td class="num">${importe(conc.saldo_inicial_total)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>Dinero reservado en botes</strong>
                <span class="table-row-sub">Total asignado a gastos recurrentes, proyectos y ahorro</span>
              </div>
            </td>
            <td class="num">${importe(conc.saldo_total_botes)}</td>
          </tr>
          <tr>
            <td>
              <div class="table-row-title">
                <strong>Disponible sin asignar</strong>
                <span class="table-row-sub">Movimientos vivos libres sin destino específico</span>
              </div>
            </td>
            <td class="num">${importe(conc.sin_asignar)}</td>
          </tr>
          <tr class="table-highlight-row">
            <td>
              <div class="table-row-title">
                <strong>Diferencia neta</strong>
                <span class="table-row-sub">Desviación final respecto a la posición contable</span>
              </div>
            </td>
            <td class="num"><strong>${importe(conc.diferencia)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  `;
});
