// Vista de Dinero que me deben: Gestión de préstamos, adelantos y deudas a favor del hogar
import { vista, esc, importe, hoy, fechaCorta, icono, subnavAhorro } from "../vistas.js";

function tarjetaDeudaItem(d, cuentas) {
  const saldada = d.estado === "saldado";
  const parcial = d.estado === "parcial";
  const inicialNum = Number(d.importe_inicial);
  const cobradoNum = Number(d.importe_cobrado);
  const pct = inicialNum > 0 ? Math.min(100, Math.round((cobradoNum / inicialNum) * 100)) : 0;

  const opcionesCuentas = cuentas
    .map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");

  return `
    <article class="card-debt-full ${d.estado}">
      <div class="card-debt-top">
        <div class="card-debt-icon ${d.estado}">
          ${icono("prestamo")}
        </div>
        <div class="card-debt-tags">
          ${
            saldada
              ? `<span class="badge-tag ok">${icono("check")} Saldado</span>`
              : parcial
              ? `<span class="badge-tag info">${pct}% recuperado</span>`
              : `<span class="badge-tag alerta">${icono("alerta")} Pendiente</span>`
          }
          <button class="btn-action-icon delete" data-accion="borrar-deuda" data-id="${d.id}" data-deudor="${esc(d.deudor)}" title="Eliminar este registro">
            ${icono("borrar")}
          </button>
        </div>
      </div>

      <div class="card-debt-body">
        <h3 class="debt-person">${esc(d.deudor)}</h3>
        <p class="debt-concept">${esc(d.concepto)}</p>
        <div class="debt-meta">
          <span class="meta-item">${icono("calendario")} Prestado: ${fechaCorta(d.fecha)}</span>
          ${
            d.fecha_limite
              ? `<span class="meta-item limit">Límite: ${fechaCorta(d.fecha_limite)}</span>`
              : ""
          }
        </div>
        ${d.notas ? `<p class="debt-notes">${esc(d.notas)}</p>` : ""}
      </div>

      <div class="card-debt-footer">
        <div class="debt-balance-row">
          <span class="balance-sub">${saldada ? "Total recuperado" : "Pendiente de cobrar"}</span>
          <div class="debt-balance-value ${saldada ? "saldado" : "pendiente"}">
            ${saldada ? importe(d.importe_inicial) : importe(d.importe_pendiente)}
          </div>
        </div>

        <div class="progress-wrap-large">
          <div class="progress-bar-large ${saldada ? "ok" : ""}">
            <div class="progress-fill" style="width: ${pct}%"></div>
          </div>
          <div class="progress-info-row">
            <span class="progress-pct">${pct}% recuperado (${d.importe_cobrado} €)</span>
            <span class="progress-goal">Total: ${d.importe_inicial} €</span>
          </div>
        </div>

        ${
          !saldada
            ? `
          <div class="debt-cobro-box">
            <details class="cobro-details">
              <summary class="btn-cobro-trigger">
                ${icono("plus")} Registrar devolución / cobro
              </summary>
              <form data-accion="registrar-cobro-deuda" data-deuda-id="${d.id}" class="cobro-form">
                <div class="cobro-inputs-row">
                  <div class="cobro-group">
                    <label class="cobro-label">Importe cobrado (€)</label>
                    <input name="importe" inputmode="decimal" placeholder="${d.importe_pendiente}" max="${d.importe_pendiente}" required>
                  </div>
                  <div class="cobro-group">
                    <label class="cobro-label">Ingresar en cuenta (opcional)</label>
                    <select name="cuenta_id">
                      <option value="">— No crear movimiento —</option>
                      ${opcionesCuentas}
                    </select>
                  </div>
                </div>
                <div class="cobro-actions">
                  <button type="submit" class="btn-primary mini">
                    ${icono("check")} Confirmar cobro
                  </button>
                </div>
              </form>
            </details>
          </div>
        `
            : ""
        }
      </div>
    </article>
  `;
}

export default vista("deben", async () => {
  const [deudasData, cuentasData] = await Promise.all([
    API.get("/deudas"),
    API.get("/cuentas"),
  ]);

  const deudas = deudasData.items || [];
  const cuentas = cuentasData.items || [];
  const totalPendiente = deudasData.total_pendiente || "0.00";
  const totalCobrado = deudasData.total_cobrado || "0.00";
  const totalInicial = deudasData.total_inicial || "0.00";
  const numPendientes = deudas.filter((d) => d.estado !== "saldado").length;

  return `
  ${subnavAhorro("deben")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Dinero que me deben</h2>
      <p class="page-subtitle">Seguimiento de dinero prestado, adelantos a amigos o familiares y cuentas pendientes de cobro</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Total Pendiente de Cobro</span>
      <span class="header-total-value positivo">${importe(totalPendiente)}</span>
      <span class="header-total-sub">${numPendientes} cobro(s) pendiente(s)</span>
    </div>
  </div>

  <div class="hero-pills-row">
    <div class="hero-pill-stat">
      <span class="pill-stat-label">Total Prestado</span>
      <span class="pill-stat-value">${importe(totalInicial)}</span>
    </div>
    <div class="hero-pill-stat">
      <span class="pill-stat-label">Total Recuperado</span>
      <span class="pill-stat-value ok">${importe(totalCobrado)}</span>
    </div>
    <div class="hero-pill-stat">
      <span class="pill-stat-label">Pendiente de Devolución</span>
      <span class="pill-stat-value alert">${importe(totalPendiente)}</span>
    </div>
  </div>

  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Listado de Personas y Deudas</h3>
        <p class="section-desc">Registros de personas que te deben dinero y su evolución</p>
      </div>
    </div>

    <div class="grid-pots-large">
      ${
        deudas.length > 0
          ? deudas.map((d) => tarjetaDeudaItem(d, cuentas)).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("prestamo")}</span>
              <p>No tienes ningún préstamo o deuda registrada.</p>
              <span class="empty-sub">Usa el formulario inferior para anotar dinero que te deben amigos, familiares o empresas.</span>
            </div>`
      }
    </div>
  </section>

  <section class="section-block">
    <div class="form-card-container">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("plus")}</div>
        <div>
          <h3 class="form-card-title">Añadir Dinero que te Deben</h3>
          <p class="form-card-subtitle">Registra un nuevo préstamo, fianza o dinero adelantado</p>
        </div>
      </div>

      <form data-accion="crear-deuda" data-err="err-deuda" class="fintech-form">
        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="deu-persona" class="form-label">¿Quién te debe el dinero? (Nombre de la persona o entidad)</label>
            <input id="deu-persona" name="deudor" placeholder="Ej. Juan García, Hermano, Inquilino, Amigos cena..." required>
          </div>
          <div class="form-group form-span-2">
            <label for="deu-concepto" class="form-label">Concepto o Motivo</label>
            <input id="deu-concepto" name="concepto" placeholder="Ej. Préstamo personal, Adelanto viaje, Fianza alquiler..." required>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="deu-importe" class="form-label">Importe que te deben (€)</label>
            <input id="deu-importe" name="importe" inputmode="decimal" placeholder="Ej. 150.00" required>
          </div>
          <div class="form-group">
            <label for="deu-fecha" class="form-label">Fecha del Préstamo</label>
            <input id="deu-fecha" name="fecha" type="date" value="${hoy()}" required>
          </div>
          <div class="form-group">
            <label for="deu-limite" class="form-label">Fecha Límite Estimada (Opcional)</label>
            <input id="deu-limite" name="fecha_limite" type="date">
          </div>
        </div>

        <div class="form-group">
          <label for="deu-notas" class="form-label">Notas Adicionales (Opcional)</label>
          <input id="deu-notas" name="notas" placeholder="Ej. Me dijo que me lo paga a final de mes por Bizum">
        </div>

        <div id="err-deuda"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Guardar Deuda
          </button>
        </div>
      </form>
    </div>
  </section>
  `;
});
