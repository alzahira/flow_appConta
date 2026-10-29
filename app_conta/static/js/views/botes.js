// Vista de botes: Sobres de ahorro, gastos recurrentes y proyectos con extracto y detalle individual
import { esc, importe, vista, icono, hoy, fechaCorta, subnavAhorro } from "../vistas.js";

let boteSeleccionadoId = null;

export function seleccionarBote(id) {
  boteSeleccionadoId = id ? Number(id) : null;
}

function tarjetaBoteFull(b) {
  const obj = Number(b.objetivo);
  const sal = Number(b.saldo);
  const tieneObj = b.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(200, (sal / obj) * 100)) : 0;
  const conseguido = b.estado === "conseguido";

  return `
    <article class="card-pot-full ${b.tipo}">
      <div class="card-pot-top">
        <div class="card-pot-icon ${b.tipo}">
          ${icono(b.tipo)}
        </div>
        <div class="card-pot-tags">
          <span class="badge-type">${esc(b.tipo)}</span>
          ${
            conseguido
              ? `<span class="badge-tag ok">${icono("check")} Cumplido</span>`
              : `<span class="badge-tag info">En curso</span>`
          }
          <button class="btn-action-icon delete" data-accion="borrar-bote" data-id="${b.id}" data-nombre="${esc(b.nombre)}" title="Eliminar este bote">
            ${icono("borrar")}
          </button>
        </div>
      </div>

      <div class="card-pot-body">
        <h3 class="pot-title">${esc(b.nombre)}</h3>
        ${
          b.objetivo_fecha
            ? `<span class="pot-date">${icono("calendario")} Meta: ${b.objetivo_fecha}</span>`
            : ""
        }
      </div>

      <div class="card-pot-footer">
        <div class="pot-balance-row">
          <span class="balance-sub">Fondos acumulados</span>
          <div class="pot-balance-value">${importe(b.saldo)}</div>
        </div>

        ${
          tieneObj
            ? `
          <div class="progress-wrap-large">
            <div class="progress-bar-large ${pct > 100 ? "over" : ""}">
              <div class="progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
            </div>
            <div class="progress-info-row">
              <span class="progress-pct">${pct.toFixed(0)}%</span>
              <span class="progress-goal">Objetivo: ${b.objetivo} €</span>
            </div>
          </div>
        `
            : `
          <div class="no-goal-info">
            <span>Sin objetivo fijado (fondo libre)</span>
          </div>
        `
        }

        <div class="pot-actions-row">
          <button type="button" class="btn-pot-detail" data-accion="ver-detalle-bote" data-id="${b.id}">
            ${icono("ojo")} Ver movimientos y extracto &rarr;
          </button>
        </div>
      </div>
    </article>
  `;
}

async function renderDetalleBote(boteId, cuentas) {
  const [bote, movsData] = await Promise.all([
    API.get(`/botes/${boteId}`),
    API.get(`/movimientos?bote=${boteId}&limit=100`),
  ]);

  const movs = movsData.items || [];
  const obj = Number(bote.objetivo);
  const sal = Number(bote.saldo);
  const tieneObj = bote.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(200, (sal / obj) * 100)) : 0;

  const totalAportaciones = movs
    .filter((m) => Number(m.importe) > 0)
    .reduce((acc, m) => acc + Number(m.importe), 0);
  const totalGastos = movs
    .filter((m) => Number(m.importe) < 0)
    .reduce((acc, m) => acc + Number(m.importe), 0);

  const opcionesCuentas = cuentas
    .map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");

  return `
    ${subnavAhorro("botes")}

    <div class="detail-back-wrap">
      <button type="button" class="btn-subtle" data-accion="cerrar-detalle-bote">
        ${icono("volver")} &larr; Volver al listado de botes
      </button>
    </div>

    <div class="page-header-row">
      <div class="detail-header-flex">
        <span class="bank-group-icon ${bote.tipo}">${icono(bote.tipo)}</span>
        <div>
          <h2 class="page-title">${esc(bote.nombre)}</h2>
          <p class="page-subtitle">Extracto y movimientos separados del sobre (${esc(bote.tipo)})</p>
        </div>
      </div>
      <div class="header-total-card">
        <span class="header-total-label">Saldo Acumulado en el Bote</span>
        <span class="header-total-value">${importe(bote.saldo)}</span>
        ${
          tieneObj
            ? `<span class="header-total-sub">${pct.toFixed(0)}% de la meta (${bote.objetivo} €)</span>`
            : ""
        }
      </div>
    </div>

    <div class="hero-pills-row">
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Saldo Disponible en este Sobre</span>
        <span class="pill-stat-value">${importe(bote.saldo)}</span>
      </div>
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Total Aportaciones (+)</span>
        <span class="pill-stat-value ok">${importe(totalAportaciones.toFixed(2))}</span>
      </div>
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Total Gastos Imputados (−)</span>
        <span class="pill-stat-value alert">${importe(totalGastos.toFixed(2))}</span>
      </div>
    </div>

    ${
      tieneObj
        ? `
      <div class="card-pot-full" style="margin-bottom: 1.5rem">
        <div class="progress-wrap-large">
          <div class="progress-bar-large ${pct >= 100 ? "ok" : ""}">
            <div class="progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
          </div>
          <div class="progress-info-row">
            <span class="progress-pct">${pct.toFixed(0)}% completado</span>
            <span class="progress-goal">Meta: ${bote.objetivo} € ${bote.objetivo_fecha ? `(Fecha límite: ${bote.objetivo_fecha})` : ""}</span>
          </div>
        </div>
      </div>`
        : ""
    }

    <!-- Formulario para meter o sacar dinero directamente de este bote -->
    <section class="section-block">
      <div class="form-card-container">
        <div class="form-card-header">
          <div class="form-card-icon">${icono("plus")}</div>
          <div>
            <h3 class="form-card-title">Añadir Dinero o Gasto a este Bote</h3>
            <p class="form-card-subtitle">Registra una aportación o descuenta un gasto asignado directamente a este sobre</p>
          </div>
        </div>

        <form data-accion="crear-movimiento-bote" data-bote-id="${bote.id}" class="fintech-form">
          <div class="sign-selector-row">
            <label class="sign-option in">
              <input type="radio" name="signo" value="+" checked>
              <span class="sign-btn">🟢 Meter dinero (+ Aportación)</span>
            </label>
            <label class="sign-option out">
              <input type="radio" name="signo" value="-">
              <span class="sign-btn">🔴 Sacar dinero (− Gasto del sobre)</span>
            </label>
          </div>

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label class="form-label">Importe (€)</label>
              <input name="importe" inputmode="decimal" placeholder="0.00" required>
            </div>
            <div class="form-group form-span-2">
              <label class="form-label">Cuenta Bancaria o Efectivo de Origen / Destino</label>
              <select name="cuenta_id" required>
                ${opcionesCuentas}
              </select>
            </div>
          </div>

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label class="form-label">Concepto / Motivo</label>
              <input name="descripcion" placeholder="Ej. Aportación de ahorro, Factura de seguro..." required>
            </div>
            <div class="form-group form-span-2">
              <label class="form-label">Fecha</label>
              <input name="fecha" type="date" value="${hoy()}" required>
            </div>
          </div>

          <div class="form-actions-right">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Guardar Movimiento en este Bote
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- Listado separado de movimientos de este bote -->
    <section class="section-block">
      <div class="section-header">
        <div>
          <h3 class="section-title">Movimientos Separados de este Bote (${movs.length})</h3>
          <p class="section-desc">Historial exclusivo de entradas y salidas registradas en este sobre</p>
        </div>
      </div>

      ${
        movs.length === 0
          ? `
        <div class="empty-state">
          <span class="empty-icon">${icono("movimientos")}</span>
          <p>Este bote no tiene movimientos asignados todavía.</p>
          <span class="empty-sub">Usa el formulario superior para añadir la primera aportación de fondos.</span>
        </div>
      `
          : `
        <div class="card-table-wrap">
          <table class="table-fintech">
            <thead>
              <tr>
                <th style="width: 130px">Fecha</th>
                <th>Concepto</th>
                <th class="num" style="width: 140px">Importe</th>
                <th style="width: 44px"></th>
              </tr>
            </thead>
            <tbody>
              ${movs
                .map((m) => {
                  const esGasto = Number(m.importe) < 0;
                  return `
                  <tr class="tx-row">
                    <td class="tx-date">
                      <span class="date-badge">${fechaCorta(m.fecha)}</span>
                    </td>
                    <td class="tx-main">
                      <div class="tx-concept">
                        <span class="tx-direction-icon ${esGasto ? "out" : "in"}">
                          ${esGasto ? "&darr;" : "&uarr;"}
                        </span>
                        <span class="tx-desc">${esc(m.descripcion)}</span>
                      </div>
                    </td>
                    <td class="num tx-amount">
                      ${importe(m.importe)}
                    </td>
                    <td class="tx-actions">
                      <button class="btn-action-icon delete mini" data-accion="borrar-movimiento" data-id="${m.id}" title="Eliminar este movimiento">
                        ${icono("borrar")}
                      </button>
                    </td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `
      }
    </section>
  `;
}

export default vista("botes", async () => {
  const [botesData, cuentasData] = await Promise.all([
    API.get("/botes"),
    API.get("/cuentas"),
  ]);

  const cuentas = cuentasData.items || [];

  // Si hay un bote seleccionado para ver su extracto detallado
  if (boteSeleccionadoId && botesData.items.some((b) => b.id === boteSeleccionadoId)) {
    return await renderDetalleBote(boteSeleccionadoId, cuentas);
  }

  // Si el bote seleccionado ya no existe, reseteamos a vista general
  boteSeleccionadoId = null;

  const totalBotes = botesData.items.reduce((acc, b) => acc + Number(b.saldo), 0);

  return `
  ${subnavAhorro("botes")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Botes y Sobres de Ahorro</h2>
      <p class="page-subtitle">Sistema de sobres virtuales para reservar dinero con un fin concreto. Pulsa en un sobre para ver sus movimientos.</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Total en Botes</span>
      <span class="header-total-value">${importe(totalBotes.toFixed(2))}</span>
    </div>
  </div>

  <section class="section-block">
    <div class="grid-pots-large">
      ${
        botesData.items.length > 0
          ? botesData.items.map(tarjetaBoteFull).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("botes")}</span>
              <p>No tienes ningún bote creado aún.</p>
              <span class="empty-sub">Crea un bote de ahorro, gastos recurrentes o proyecto para apartar dinero.</span>
            </div>`
      }
    </div>
  </section>

  <section class="section-block">
    <div class="form-card-container">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("plus")}</div>
        <div>
          <h3 class="form-card-title">Crear Nuevo Bote</h3>
          <p class="form-card-subtitle">Define el objetivo y tipo de sobre para distribuir tu disponible</p>
        </div>
      </div>

      <form data-accion="crear-bote" data-err="err-bote" class="fintech-form">
        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="bo-nombre" class="form-label">Nombre del Bote</label>
            <input id="bo-nombre" name="nombre" placeholder="Ej. Vacaciones de verano, IBI y seguros, Fondo hipotecas..." required>
          </div>
          <div class="form-group form-span-2">
            <label for="bo-tipo" class="form-label">Tipo de Sobre</label>
            <select id="bo-tipo" name="tipo" required>
              <option value="recurrente">🔁 Gasto Recurrente Anual</option>
              <option value="ahorro">🐷 Fondo de Ahorro</option>
              <option value="proyecto">🎯 Proyecto / Compra Concreta</option>
              <option value="ajeno">👥 Dinero Ajeno (Fianzas / Terceros)</option>
            </select>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="bo-objetivo" class="form-label">Meta / Objetivo (€) (Opcional)</label>
            <input id="bo-objetivo" name="objetivo" inputmode="decimal" placeholder="Ej. 1200.00 (positivo) o -500.00 (presupuesto)">
          </div>
          <div class="form-group form-span-2">
            <label for="bo-fecha" class="form-label">Fecha Límite (Opcional)</label>
            <input id="bo-fecha" name="objetivo_fecha" type="date">
          </div>
        </div>

        <div id="err-bote"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Crear Bote
          </button>
        </div>
      </form>
    </div>
  </section>
  `;
});
