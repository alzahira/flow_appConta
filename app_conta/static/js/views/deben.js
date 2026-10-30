// Vista de Dinero que me deben: Gestión de préstamos, adelantos y deudas a favor del hogar
import { vista, esc, importe, hoy, fechaCorta, icono, subnavAhorro } from "../vistas.js";

function tarjetaDeudaItem(d, cuentas) {
  const saldada = d.estado === "saldado";

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
              : ""
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
          <span class="meta-item">${icono("calendario")} Fecha: ${fechaCorta(d.fecha)}</span>
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
          <div class="debt-balance-value ${saldada ? "saldado" : "negativo"}">
            ${saldada ? "0,00 €" : importe(d.importe_pendiente, "negativo")}
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
                    <label class="cobro-label">Importe devuelto (€)</label>
                    <input name="importe" inputmode="decimal" placeholder="${d.importe_pendiente}" max="${d.importe_pendiente}" required>
                  </div>
                  <div class="cobro-group">
                    <label class="cobro-label">Ingresar en cuenta bancaria</label>
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
  const numPendientes = deudas.filter((d) => d.estado !== "saldado").length;

  return `
  ${subnavAhorro("deben")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Dinero que me deben</h2>
      <p class="page-subtitle">Seguimiento de dinero prestado o adelantado pendiente de que me lo devuelvan</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Total que me deben</span>
      <span class="header-total-value negativo">${importe(totalPendiente, "negativo")}</span>
      <span class="header-total-sub">${numPendientes} registros pendientes</span>
    </div>
  </div>

  <div class="hero-pills-row">
    <div class="hero-pill-stat">
      <span class="pill-stat-label">Total que me deben</span>
      <span class="pill-stat-value negativo">${importe(totalPendiente, "negativo")}</span>
    </div>
    <div class="hero-pill-stat">
      <span class="pill-stat-label">Personas / Deudas</span>
      <span class="pill-stat-value">${numPendientes} pendientes</span>
    </div>
  </div>

  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Listado de Dinero que me Deben</h3>
        <p class="section-desc">Detalle de personas y deudas pendientes</p>
      </div>
    </div>

    <div class="grid-pots-large">
      ${
        deudas.length > 0
          ? deudas.map((d) => tarjetaDeudaItem(d, cuentas)).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("prestamo")}</span>
              <p>No tienes ningún dinero prestado registrado.</p>
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
