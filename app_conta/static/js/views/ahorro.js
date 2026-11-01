// Vista de Ahorro: Previsión futura, amortización de hipotecas y fondos de reserva con extracto individual
import { esc, importe, vista, icono, hoy, fechaCorta, subnavAhorro } from "../vistas.js";
import { pintarFilaMovimiento, setGlobalCaches } from "./movimientos.js";

let ahorroSeleccionadoId = null;

export function seleccionarFondoAhorro(id) {
  ahorroSeleccionadoId = id ? Number(id) : null;
}

function tarjetaFondoAhorro(b) {
  const obj = Number(b.objetivo);
  const sal = Number(b.saldo);
  const tieneObj = b.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(200, (sal / obj) * 100)) : 0;
  const conseguido = b.estado === "conseguido";

  return `
    <article class="card-pot-full ahorro">
      <div class="card-pot-header">
        <div class="pot-header-main">
          <div class="card-pot-icon ahorro">
            ${icono("ahorro")}
          </div>
          <div class="pot-header-texts">
            <h3 class="pot-title">${esc(b.nombre)}</h3>
            ${
              b.objetivo_fecha
                ? `<span class="pot-meta-date">${icono("calendario")} Meta: ${fechaCorta(b.objetivo_fecha)}</span>`
                : ""
            }
          </div>
        </div>
        <div class="card-pot-actions">
          ${
            conseguido
              ? `<span class="badge-tag ok">${icono("check")} Cumplido</span>`
              : tieneObj
              ? `<span class="badge-tag info">${pct.toFixed(0)}%</span>`
              : ""
          }
          <button class="btn-action-icon delete" data-accion="borrar-bote" data-id="${b.id}" data-nombre="${esc(b.nombre)}" title="Eliminar este fondo de ahorro">
            ${icono("borrar")}
          </button>
        </div>
      </div>

      <div class="pot-balance-section">
        <span class="balance-sub">Ahorro acumulado</span>
        <div class="pot-balance-value ${sal < 0 ? "negativo" : ""}">${importe(b.saldo)}</div>
      </div>

      ${
        tieneObj
          ? `
        <div class="pot-progress-section">
          <div class="progress-bar-large ${pct >= 100 ? "ok" : ""}">
            <div class="progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
          </div>
          <div class="progress-info-row">
            <span class="progress-pct">${pct.toFixed(0)}% completado</span>
            <span class="progress-goal">Meta: ${b.objetivo} €</span>
          </div>
        </div>
      `
          : ""
      }

      <div class="pot-card-footer">
        <button type="button" class="btn-pot-detail" data-accion="ver-detalle-ahorro" data-id="${b.id}">
          <span>${icono("ojo")} Ver movimientos y extracto</span>
          <span class="btn-arrow">&rarr;</span>
        </button>
      </div>
    </article>
  `;
}

async function renderDetalleFondoAhorro(fondoId, cuentas) {
  const [bote, movsData] = await Promise.all([
    API.get(`/botes/${fondoId}`),
    API.get(`/movimientos?bote=${fondoId}&limit=100`),
  ]);

  const movs = movsData.items || [];
  const obj = Number(bote.objetivo);
  const sal = Number(bote.saldo);
  const tieneObj = bote.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(200, (sal / obj) * 100)) : 0;

  const totalAportaciones = movs
    .filter((m) => Number(m.importe) > 0)
    .reduce((acc, m) => acc + Number(m.importe), 0);
  const totalSalidas = movs
    .filter((m) => Number(m.importe) < 0)
    .reduce((acc, m) => acc + Number(m.importe), 0);

  const opcionesCuentas = cuentas
    .map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");

  return `
    ${subnavAhorro("ahorro")}

    <div class="detail-back-wrap">
      <button type="button" class="btn-subtle" data-accion="cerrar-detalle-ahorro">
        ${icono("volver")} &larr; Volver a todos los fondos de ahorro
      </button>
    </div>

    <div class="page-header-row">
      <div class="detail-header-flex">
        <span class="bank-group-icon ahorro">${icono("ahorro")}</span>
        <div>
          <h2 class="page-title">${esc(bote.nombre)}</h2>
          <p class="page-subtitle">Extracto individual de ahorro y previsión futura</p>
        </div>
      </div>
      <div class="header-total-card">
        <span class="header-total-label">Total Ahorrado en este Fondo</span>
        <span class="header-total-value">${importe(bote.saldo)}</span>
        ${
          tieneObj
            ? `<span class="header-total-sub">${pct.toFixed(0)}% del objetivo (${bote.objetivo} €)</span>`
            : ""
        }
      </div>
    </div>

    <div class="hero-pills-row">
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Saldo Acumulado en el Fondo</span>
        <span class="pill-stat-value">${importe(bote.saldo)}</span>
      </div>
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Total Aportaciones Guardadas (+)</span>
        <span class="pill-stat-value ok">${importe(totalAportaciones.toFixed(2))}</span>
      </div>
      <div class="hero-pill-stat">
        <span class="pill-stat-label">Salidas / Aplicado a Hipoteca (−)</span>
        <span class="pill-stat-value alert">${importe(totalSalidas.toFixed(2))}</span>
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
            <span class="progress-pct">${pct.toFixed(0)}% conseguido</span>
            <span class="progress-goal">Meta: ${bote.objetivo} € ${bote.objetivo_fecha ? `(Fecha límite: ${bote.objetivo_fecha})` : ""}</span>
          </div>
        </div>
      </div>`
        : ""
    }

    <!-- Formulario para meter ahorro o registrar amortización -->
    <section class="section-block">
      <div class="form-card-container">
        <div class="form-card-header">
          <div class="form-card-icon">${icono("plus")}</div>
          <div>
            <h3 class="form-card-title">Añadir Dinero o Salida a este Fondo</h3>
            <p class="form-card-subtitle">Registra una aportación de ahorro o aplica fondos a pagar cuota/hipoteca</p>
          </div>
        </div>

        <form data-accion="crear-movimiento-ahorro" data-bote-id="${bote.id}" class="fintech-form">
          <div class="sign-selector-row">
            <label class="sign-option in">
              <input type="radio" name="signo" value="+" checked>
              <span class="sign-btn">🟢 Guardar dinero (+ Aportación al fondo)</span>
            </label>
            <label class="sign-option out">
              <input type="radio" name="signo" value="-">
              <span class="sign-btn">🔴 Disponer de dinero (− Amortización / Gasto)</span>
            </label>
          </div>

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label class="form-label">Importe (€)</label>
              <input name="importe" inputmode="decimal" placeholder="0.00" required>
            </div>
            <div class="form-group form-span-2">
              <label class="form-label">Cuenta de Origen / Destino</label>
              <select name="cuenta_id" required>
                ${opcionesCuentas}
              </select>
            </div>
          </div>

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label class="form-label">Concepto / Motivo</label>
              <input name="descripcion" placeholder="Ej. Ahorro para hipoteca mes actual, Pago amortización anticipada..." required>
            </div>
            <div class="form-group form-span-2">
              <label class="form-label">Fecha</label>
              <input name="fecha" type="date" value="${hoy()}" required>
            </div>
          </div>

          <div class="form-actions-right">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Guardar en este Fondo
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- Listado separado de movimientos de este fondo -->
    <section class="section-block">
      <div class="section-header">
        <div>
          <h3 class="section-title">Movimientos Registrados en este Fondo (${movs.length})</h3>
          <p class="section-desc">Historial exclusivo de aportaciones y disposiciones de este fondo</p>
        </div>
      </div>

      ${
        movs.length === 0
          ? `
        <div class="empty-state">
          <span class="empty-icon">${icono("ahorro")}</span>
          <p>Este fondo de ahorro no tiene movimientos asignados todavía.</p>
          <span class="empty-sub">Usa el formulario superior para añadir la primera aportación.</span>
        </div>
      `
          : `
        <div class="tx-date-items" style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${movs.map(pintarFilaMovimiento).join("\n")}
        </div>
      `
      }
    </section>
  `;
}

export default vista("ahorro", async () => {
  const [data, cuentasData] = await Promise.all([
    API.get("/botes"),
    API.get("/cuentas"),
  ]);

  setGlobalCaches({ cuentas: cuentasData.items, botes: data.items });
  
  const fondosAhorro = data.items.filter(
    (b) => b.nombre.toLowerCase().includes("hipoteca")
  );

  const cuentas = cuentasData.items || [];

  if (ahorroSeleccionadoId && fondosAhorro.some((b) => b.id === ahorroSeleccionadoId)) {
    return await renderDetalleFondoAhorro(ahorroSeleccionadoId, cuentas);
  }

  ahorroSeleccionadoId = null;

  const totalAhorrado = fondosAhorro.reduce((acc, b) => acc + Number(b.saldo), 0);
  const totalMetas = fondosAhorro.reduce((acc, b) => acc + (b.objetivo ? Number(b.objetivo) : 0), 0);
  const pctGlobal = totalMetas > 0 ? Math.min(100, Math.round((totalAhorrado / totalMetas) * 100)) : null;

  return `
  ${subnavAhorro("ahorro")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Ahorro y Previsión Futura</h2>
      <p class="page-subtitle">Reserva de capital para pagar hipotecas a futuro, amortizaciones de préstamo y fondos estratégicos. Pulsa en un fondo para ver sus movimientos.</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Total Ahorro Acumulado</span>
      <span class="header-total-value">${importe(totalAhorrado.toFixed(2))}</span>
      ${pctGlobal !== null ? `<span class="header-total-sub">${pctGlobal}% de las metas fijadas (${totalMetas.toFixed(2)} €)</span>` : ""}
    </div>
  </div>

  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Fondos de Ahorro e Hipotecas</h3>
        <p class="section-desc">Sobres independientes para blindar el pago futuro de cuotas o amortizaciones</p>
      </div>
    </div>

    <div class="grid-pots-large">
      ${
        fondosAhorro.length > 0
          ? fondosAhorro.map(tarjetaFondoAhorro).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("ahorro")}</span>
              <p>No tienes ningún fondo de ahorro registrado todavía.</p>
              <span class="empty-sub">Crea un fondo para amortización de hipoteca o colchón de seguridad con el formulario inferior.</span>
            </div>`
      }
    </div>
  </section>

  <section class="section-block">
    <div class="form-card-container">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("plus")}</div>
        <div>
          <h3 class="form-card-title">Crear Nuevo Fondo de Ahorro</h3>
          <p class="form-card-subtitle">Asigna fondos para amortizar hipoteca a futuro o reservas estratégicas</p>
        </div>
      </div>

      <div class="quick-pills-suggestions">
        <span class="suggestions-label">Sugerencias rápidas:</span>
        <button type="button" class="btn-suggestion" onclick="document.getElementById('ah-nombre').value='Amortización Hipoteca'; document.getElementById('ah-obj').focus();">+ Amortización Hipoteca</button>
        <button type="button" class="btn-suggestion" onclick="document.getElementById('ah-nombre').value='Reserva Cuotas Hipoteca'; document.getElementById('ah-obj').focus();">+ Reserva Cuotas Hipoteca</button>
        <button type="button" class="btn-suggestion" onclick="document.getElementById('ah-nombre').value='Colchón de Emergencia (6 meses)'; document.getElementById('ah-obj').focus();">+ Colchón de Emergencia</button>
      </div>

      <form data-accion="crear-bote-ahorro" data-err="err-ahorro" class="fintech-form">
        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="ah-nombre" class="form-label">Nombre del Fondo</label>
            <input id="ah-nombre" name="nombre" placeholder="Ej. Amortización Hipoteca, Reserva Cuotas, IBI..." required>
          </div>
          <div class="form-group">
            <label for="ah-obj" class="form-label">Objetivo de Ahorro (€) (Opcional)</label>
            <input id="ah-obj" name="objetivo" inputmode="decimal" placeholder="Ej. 10000.00">
          </div>
          <div class="form-group">
            <label for="ah-fecha" class="form-label">Fecha Límite (Opcional)</label>
            <input id="ah-fecha" name="objetivo_fecha" type="date">
          </div>
        </div>

        <div id="err-ahorro"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Crear Fondo de Ahorro
          </button>
        </div>
      </form>
    </div>
  </section>
  `;
});
