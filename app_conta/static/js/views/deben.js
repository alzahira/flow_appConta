// Vista de Dinero que me deben: Préstamos a terceros, adelantos y cobros pendientes
import { vista, esc, importe, hoy, fechaCorta, icono, subnavAhorro } from "../vistas.js";

const PERFILES_DEUDA = {
  persona: { label: "Persona", iconoKey: "prestamo", color: "#7c3aed" },
  comercio: { label: "Comercio", iconoKey: "carrito", color: "#ea580c" },
  banco: { label: "Banco", iconoKey: "banco", color: "#0284c7" },
  servicio: { label: "Servicio", iconoKey: "prevision", color: "#0d9488" },
  bote: { label: "Bote", iconoKey: "botes", color: "#0d9488" },
  ocio: { label: "Ocio", iconoKey: "ocio", color: "#db2777" },
  tecnologia: { label: "Tecnología", iconoKey: "telefono", color: "#4f46e5" },
  seguro: { label: "Seguro", iconoKey: "seguro", color: "#0f766e" },
  otros: { label: "Otros", iconoKey: "prestamo", color: "#64748b" },
};

function perfilDeuda(d) {
  const nombre = (d.deudor || "").toLowerCase();
  const texto = `${nombre} ${d.concepto || ""}`.toLowerCase();

  if (/(bote|sobre)/.test(nombre)) return PERFILES_DEUDA.bote;
  if (/(banco|bank|exchange|nexo|hipoteca|deutsche)/.test(nombre)) return PERFILES_DEUDA.banco;
  if (/(seguro|ocaso)/.test(nombre)) return PERFILES_DEUDA.seguro;
  if (/(boda|entrada|viaje|fiesta|regalo|ocio|concierto)/.test(nombre)) return PERFILES_DEUDA.ocio;
  if (/(redmi|movil|móvil|galaxy|telefono|teléfono)/.test(nombre)) return PERFILES_DEUDA.tecnologia;
  if (/(mi madre|mi suegra|nerea|pedro|javier|marijose|aitor)/.test(nombre)) return PERFILES_DEUDA.persona;

  if (/(banco|bank|exchange|nexo|hipoteca|caixa|bbva|santander|deutsche)/.test(texto)) return PERFILES_DEUDA.banco;
  if (/(seguro|ocaso|fianza)/.test(texto)) return PERFILES_DEUDA.seguro;
  if (/(aldi|carrefour|pepco|amazon|groupon|mercadona|compra|tienda)/.test(texto)) return PERFILES_DEUDA.comercio;
  if (/(endesa|dazn|agua|luz|recibo|telefon|movistar|vodafone|orange|internet)/.test(texto)) return PERFILES_DEUDA.servicio;
  if (/(redmi|movil|móvil|galaxy|telefono|teléfono|ordenador|portatil)/.test(texto)) return PERFILES_DEUDA.tecnologia;
  if (/(boda|entrada|viaje|fiesta|regalo|ocio|concierto)/.test(texto)) return PERFILES_DEUDA.ocio;
  return PERFILES_DEUDA.persona;
}

function tarjetaDeudaItem(d, cuentas, botes) {
  const saldada = d.estado === "saldado";
  const perfil = perfilDeuda(d);

  const conceptoLower = (d.concepto || "").toLowerCase();
  const deudorLower = (d.deudor || "").toLowerCase();
  const opcionesBotes = (botes || [])
    .filter((b) => !b.archivado && Number(b.saldo || 0) > 0)
    .sort((a, b) => {
      const nomA = (a.nombre || "").toLowerCase();
      const nomB = (b.nombre || "").toLowerCase();
      const matchA = conceptoLower.includes(nomA) || (nomA.includes("mantecado") && (conceptoLower.includes("mantecado") || deudorLower.includes("mantecado")));
      const matchB = conceptoLower.includes(nomB) || (nomB.includes("mantecado") && (conceptoLower.includes("mantecado") || deudorLower.includes("mantecado")));
      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
      return 0;
    })
    .map((b) => `<option value="bote:${b.id}">🐷 ${esc(b.nombre)} (${b.saldo} €)</option>`)
    .join("");

  const opcionesCuentas = (cuentas || [])
    .filter((c) => !c.archivada)
    .map((c) => `<option value="cuenta:${c.id}">${c.tipo === "efectivo" ? "💵" : "🏦"} ${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");

  return `
    <article class="glass-account-card fintech-debt-card">
      <div class="acc-card-top">
        <div class="acc-card-brand-group">
          <div class="acc-card-icon-wrap" style="color: ${perfil.color}; background: ${perfil.color}15;">
            ${icono(perfil.iconoKey)}
          </div>
          <div class="acc-card-name-group">
            <h3 class="acc-card-name" title="${esc(d.deudor)}">${esc(d.deudor)}</h3>
            <span class="acc-card-badge">${esc(d.concepto)} · ${perfil.label}</span>
          </div>
        </div>

        <div class="card-more-menu-wrapper">
          <button type="button" class="btn-card-more" aria-label="Opciones de deuda de ${esc(d.deudor)}" title="Opciones" onclick="this.nextElementSibling.classList.toggle('is-open')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <div class="card-more-dropdown">
            <button type="button" class="dropdown-item" data-accion="editar-deuda" data-id="${d.id}">
              ${icono("editar")} Editar apunte
            </button>
            <button type="button" class="dropdown-item-danger" data-accion="borrar-deuda" data-id="${d.id}" data-deudor="${esc(d.deudor)}">
              ${icono("borrar")} Eliminar apunte
            </button>
          </div>
        </div>
      </div>

      <div class="acc-card-balance-block" style="margin-top: 1.1rem;">
        <span class="acc-card-balance-label">Importe pendiente de cobro</span>
        <div class="acc-card-balance-val ${saldada ? 'text-pos' : 'text-pos'}">
          ${saldada ? "0,00 € (Saldado)" : importe(d.importe_pendiente)}
        </div>
      </div>

      ${
        saldada
          ? `
        <div style="margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px solid var(--divider); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span style="font-size: 0.78rem; color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem;">
            ✓ Totalmente cobrado
          </span>
          <button type="button" class="btn-secondary mini" data-accion="borrar-deuda" data-id="${d.id}" data-deudor="${esc(d.deudor)}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; gap: 0.35rem; color: var(--fg-2);">
            ${icono("borrar")} Archivar apunte
          </button>
        </div>
      `
          : `
        <div style="margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px solid var(--divider);">
          <details class="loan-pay-details">
            <summary style="font-size: 0.78rem; color: var(--accent-text); cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 500;">
              ${icono("plus")} Registrar devolución o cobro
            </summary>
            <form data-accion="registrar-cobro-deuda" data-deuda-id="${d.id}" class="fintech-form" style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem;">
              <div class="form-grid-2">
                <input name="importe" inputmode="decimal" placeholder="Importe (€)" value="${d.importe_pendiente}" required style="font-size: 0.82rem; padding: 0.4rem 0.7rem;">
                <select name="destino_cobro" style="font-size: 0.82rem; padding: 0.4rem 0.7rem;">
                  ${opcionesBotes ? `<optgroup label="🐷 Saldar con Sobre / Bote de ahorro">${opcionesBotes}</optgroup>` : ""}
                  <optgroup label="🏦 Ingresar en Banco / Efectivo">
                    ${opcionesCuentas}
                  </optgroup>
                  <option value="">— Sin ingresar en cuenta (solo saldar apunte) —</option>
                </select>
              </div>
              <button type="submit" class="btn-primary" style="align-self: flex-end; font-size: 0.78rem; padding: 0.35rem 0.85rem;">
                Confirmar cobro
              </button>
            </form>
          </details>
        </div>
      `
      }
    </article>
  `;
}

export default vista("deben", async () => {
  const [data, cuentasData, botesData] = await Promise.all([
    API.get("/deudas"),
    API.get("/cuentas"),
    API.get("/botes"),
  ]);

  const items = data.items || [];
  const cuentas = cuentasData.items || [];
  const botes = botesData.items || [];
  const pendientes = items.filter((d) => d.estado !== "saldado");
  const saldadas = items.filter((d) => d.estado === "saldado");

  return `
  ${subnavAhorro("deben")}

  <!-- 1. Total que me deben Arriba -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Total Dinero que me Deben</span>
    <div class="hero-total-amount text-pos">${importe(data.total_pendiente)}</div>
    <span class="hero-total-sub">${pendientes.length} préstamos pendientes de cobro</span>
  </div>

  <!-- 2. Deudas Pendientes de Cobro -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <h3 class="section-title" style="margin-bottom: 0.85rem; font-size: 0.95rem; font-weight: 600;">
      ⏳ Pendientes de cobro (${pendientes.length})
    </h3>
    <div class="debts-grid">
      ${
        pendientes.length > 0
          ? pendientes.map((d) => tarjetaDeudaItem(d, cuentas, botes)).join("\n")
          : `
          <div class="glass-card tarjeta-vacia" style="grid-column: 1 / -1;">
            <div class="tarjeta-vacia-icon">${icono("prestamo")}</div>
            <h4>No tienes deudas pendientes a tu favor</h4>
            <p>¡Estás al día! Nadie te debe dinero actualmente.</p>
          </div>
          `
      }
    </div>
  </section>

  <!-- 2b. Deudas ya Saldadas (Historial) -->
  ${
    saldadas.length > 0
      ? `
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <details class="glass-accordion" open>
      <summary style="display: flex; justify-content: space-between; align-items: center; width: 100%; cursor: pointer;">
        <span style="font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 0.4rem;">
          ✓ Apuntes cobrados y saldados (${saldadas.length})
        </span>
        <button type="button" class="btn-secondary mini" data-accion="archivar-todas-saldadas" style="font-size: 0.75rem; padding: 0.3rem 0.75rem; gap: 0.35rem;">
          ${icono("borrar")} Archivar todos los saldados
        </button>
      </summary>
      <div class="accordion-body">
        <p style="font-size: 0.78rem; color: var(--fg-2); margin-bottom: 0.85rem;">
          Estos apuntes ya fueron cobrados en su totalidad. Puedes archivarlos para limpiar la vista. Los movimientos bancarios y de sobres permanecen guardados en tu historial.
        </p>
        <div class="debts-grid">
          ${saldadas.map((d) => tarjetaDeudaItem(d, cuentas, botes)).join("\n")}
        </div>
      </div>
    </details>
  </section>
  `
      : ""
  }

  <!-- 3. Formulario para nuevo apunte -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Registrar Nuevo Dinero que me Deben
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-deuda" data-err="err-deuda" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Anota una cantidad prestada o dinero adelantado a una persona o entidad.
          </p>

          <div class="form-grid-3">
            <div class="campo">
              <label for="de-deudor">¿Quién te debe el dinero? *</label>
              <input id="de-deudor" name="deudor" placeholder="Ej. Pedro, Mi madre, Carrefour..." required>
            </div>
            <div class="campo">
              <label for="de-concepto">Concepto / Motivo *</label>
              <input id="de-concepto" name="concepto" placeholder="Ej. Cena cumpleaños, Compra compartida..." required>
            </div>
            <div class="campo">
              <label for="de-importe">Importe (€) *</label>
              <input id="de-importe" name="importe" inputmode="decimal" placeholder="50.00" required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label for="de-fecha">Fecha del préstamo</label>
              <input id="de-fecha" name="fecha" type="date" value="${hoy()}" required>
            </div>
            <div class="campo">
              <label for="de-limite">Fecha límite prevista (Opcional)</label>
              <input id="de-limite" name="fecha_limite" type="date">
            </div>
          </div>

          <div id="err-deuda"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Guardar Registro
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
