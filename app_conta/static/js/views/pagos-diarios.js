// Vista de Pagos Diarios: Gestión ágil de compras cotidianas con Tarjetas y descuento directo de sobre
import { vista, esc, importe, hoy, icono } from "../vistas.js";
import { pintarFilaMovimiento, setGlobalCaches } from "./movimientos.js";

let tarjetaSeleccionadaId = null;

// Helper global para los chips de sugerencia rápida
window.autocompletarPagoDiario = function (concepto, nombreBote) {
  const descEl = document.getElementById("pd-desc");
  const boteEl = document.getElementById("pd-bote-id");
  const importeEl = document.getElementById("pd-importe");
  const detailsEl = document.getElementById("details-nuevo-pago-diario");

  if (detailsEl && !detailsEl.open) {
    detailsEl.open = true;
  }
  if (descEl) descEl.value = concepto;
  if (boteEl && nombreBote) {
    const term = nombreBote.toLowerCase().trim();
    for (const opt of boteEl.options) {
      const txt = opt.text.toLowerCase();
      if (
        term === "mes" &&
        (txt.includes("mes en curso") || txt.includes("dinero del mes") || txt.includes("bote mes"))
      ) {
        boteEl.value = opt.value;
        break;
      } else if (term === "ocio" && txt.includes("ocio")) {
        boteEl.value = opt.value;
        break;
      } else if (
        (term === "casa" || term === "mejoras") &&
        (txt.includes("mejoras") || txt.includes("hogar") || txt.includes("casa"))
      ) {
        boteEl.value = opt.value;
        break;
      } else if (txt.includes(term)) {
        boteEl.value = opt.value;
        break;
      }
    }
  }
  if (importeEl) {
    importeEl.focus();
    importeEl.select?.();
  }
};

export default vista("pagos-diarios", async () => {
  const [cuentasData, botesData, categoriasData, prestamosData] = await Promise.all([
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/categorias"),
    API.get("/prestamos"),
  ]);

  setGlobalCaches({
    cuentas: cuentasData.items,
    botes: botesData.items,
    categorias: categoriasData.items,
  });

  const prestamosActivos = (prestamosData.items || []).filter(
    (p) => p.activo && Number(p.importe_pendiente) > 0
  );

  const todasTarjetas = cuentasData.items.filter(
    (c) =>
      c.tipo === "tarjeta" &&
      !c.entidad?.toLowerCase().includes("regalo") &&
      !c.nombre?.toLowerCase().includes("regalo") &&
      !c.nombre?.toLowerCase().includes("couper") &&
      !c.nombre?.toLowerCase().includes("divisa")
  );

  const tarjetas = todasTarjetas.sort((a, b) => {
    const orden = (t) => {
      const ent = (t.entidad || t.nombre || "").toLowerCase();
      if (ent.includes("caixa")) return 1;
      if (ent.includes("deutsche") || ent.includes("db")) return 2;
      if (ent.includes("carrefour") || ent.includes("pass")) return 3;
      return 4;
    };
    return orden(a) - orden(b);
  });

  if (tarjetas.length === 0) {
    return `
      <div class="accounts-hero-total">
        <span class="hero-total-label">Pagos Diarios</span>
        <div class="hero-total-amount">0,00 €</div>
      </div>
      <div class="glass-card tarjeta-vacia">
        <div class="tarjeta-vacia-icon">${icono("tarjetas")}</div>
        <h4>No se encontraron tarjetas de pago diario</h4>
        <p>Registra primero tus tarjetas bancarias en la sección de Cuentas para gestionar compras cotidianas.</p>
        <a href="/tarjetas" class="btn-primary mini">+ Ir a Tarjetas</a>
      </div>
    `;
  }

  if (!tarjetaSeleccionadaId || !tarjetas.some((t) => t.id === tarjetaSeleccionadaId)) {
    tarjetaSeleccionadaId = tarjetas[0].id;
  }

  const tarjetaActual = tarjetas.find((t) => t.id === tarjetaSeleccionadaId) || tarjetas[0];
  const movsData = await API.get(`/movimientos?cuenta=${tarjetaActual.id}&limit=150`);

  const boteMes = botesData.items.find((b) =>
    b.nombre.toLowerCase().includes("mes en curso") || b.nombre.toLowerCase().includes("dinero del mes")
  );
  const boteOcio = botesData.items.find((b) =>
    b.nombre.toLowerCase().includes("ocio")
  );
  const boteEmergencias = botesData.items.find((b) =>
    b.nombre.toLowerCase().includes("emergencia")
  );

  const tabsTarjetasHtml = tarjetas
    .map((t) => {
      const activa = t.id === tarjetaActual.id;
      const ent = (t.entidad || t.nombre).toLowerCase();
      let bancoIcono = icono("tarjetas");
      if (ent.includes("caixa")) bancoIcono = icono("caixa");
      else if (ent.includes("deutsche") || ent.includes("db")) bancoIcono = icono("deutsche");
      else if (ent.includes("carrefour") || ent.includes("pass")) bancoIcono = icono("carrito");

      return `
      <button type="button" class="glass-account-card ${activa ? "activo" : ""}" data-tarjeta-id="${t.id}" style="cursor: pointer; text-align: left; border: ${activa ? '2px solid var(--accent)' : '1px solid var(--line)'};">
        <div class="acc-card-top">
          <div class="acc-card-brand-group">
            <div class="acc-card-icon-wrap" style="color: var(--accent);">
              ${bancoIcono}
            </div>
            <div class="acc-card-name-group">
              <h3 class="acc-card-name">${esc(t.nombre)}</h3>
              <span class="acc-card-badge">${esc(t.entidad || "Tarjeta")} · ${activa ? "Seleccionada" : "Ver compras"}</span>
            </div>
          </div>
        </div>
        <div class="acc-card-balance-block">
          <span class="acc-card-balance-label">Dispuesto en tarjeta</span>
          <div class="acc-card-balance-val text-neg">${importe(t.saldo)}</div>
        </div>
      </button>
    `;
    })
    .join("");

  const opcionesBotesList = [...botesData.items].sort((a, b) => {
    const esMesA = a.id === boteMes?.id ? -2 : a.id === boteOcio?.id ? -1 : 0;
    const esMesB = b.id === boteMes?.id ? -2 : b.id === boteOcio?.id ? -1 : 0;
    if (esMesA !== esMesB) return esMesA - esMesB;
    return a.nombre.localeCompare(b.nombre);
  });

  const opcionesPrestamosHtml = prestamosActivos
    .map(
      (p) => `<option value="prestamo:${p.id}">🚗 ${esc(p.nombre)} (${esc(p.entidad)}) — Pendiente: ${p.importe_pendiente} €</option>`
    )
    .join("");

  const opcionesBoteHtml = opcionesBotesList
    .map((b) => {
      const selected = b.id === boteMes?.id ? "selected" : "";
      const saldoInfo = Number(b.saldo).toFixed(2);
      return `<option value="${b.id}" ${selected}>${esc(b.nombre)} (Disp: ${saldoInfo} €)</option>`;
    })
    .join("");

  const opcionesTarjetasForm = tarjetas
    .map((t) => `<option value="${t.id}" ${t.id === tarjetaActual.id ? "selected" : ""}>${esc(t.nombre)} (${esc(t.entidad)})</option>`)
    .join("");

  const totalGastosTarjeta = movsData.items.reduce((acc, m) => acc + Number(m.importe), 0);

  setTimeout(() => {
    document.querySelectorAll("[data-tarjeta-id]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = Number(e.currentTarget.dataset.tarjetaId);
        if (id && id !== tarjetaSeleccionadaId) {
          tarjetaSeleccionadaId = id;
          const main = document.getElementById("vista");
          const actual = (await import("./pagos-diarios.js")).default;
          main.innerHTML = await actual.render();
        }
      });
    });
  }, 0);

  return `
  <!-- 1. Hero Total -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Compras en ${esc(tarjetaActual.nombre)}</span>
    <div class="hero-total-amount text-neg">−${importe(Math.abs(totalGastosTarjeta).toFixed(2))}</div>
    <span class="hero-total-sub">${movsData.total} operaciones cotidianas registradas</span>
  </div>

  <!-- 2. Carrusel de Tarjetas Diarias -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <div class="carousel-section-header">
      <h3 class="carousel-title">Seleccionar Tarjeta</h3>
      <span class="carousel-counter">${tarjetas.length} tarjetas</span>
    </div>
    <div class="accounts-carousel" role="region" aria-label="Tarjetas diarias">
      ${tabsTarjetasHtml}
    </div>
  </section>

  <!-- 3. Resumen de Disponibilidad en Sobres -->
  <section class="glass-summary-chips-row" style="margin-bottom: 1.5rem;">
    <div class="glass-capsule-chip">
      <span class="chip-glow-bullet dot-cyan"></span>
      <span class="chip-title">Dinero del Mes</span>
      <strong class="chip-val">${boteMes ? importe(boteMes.saldo) : "0,00 €"}</strong>
    </div>
    <div class="glass-capsule-chip">
      <span class="chip-glow-bullet dot-violet"></span>
      <span class="chip-title">Dinero de Ocio</span>
      <strong class="chip-val">${boteOcio ? importe(boteOcio.saldo) : "0,00 €"}</strong>
    </div>
    ${
      boteEmergencias
        ? `
      <div class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-blue"></span>
        <span class="chip-title">Emergencias</span>
        <strong class="chip-val">${importe(boteEmergencias.saldo)}</strong>
      </div>
    `
        : ""
    }
  </section>

  <!-- 4. Formulario Desplegable para Registrar Pago Diario -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <details class="glass-accordion" id="details-nuevo-pago-diario">
      <summary>
        ${icono("plus")} Registrar Nuevo Pago Diario con Tarjeta
      </summary>
      <div class="accordion-body">
        <!-- Atajos Rápidos en Chips -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <span style="font-size: 0.78rem; color: var(--fg-2); align-self: center;">Atajos:</span>
          <button type="button" class="glass-filter-chip" onclick="window.autocompletarPagoDiario('Supermercado', 'mes')">🛒 Supermercado</button>
          <button type="button" class="glass-filter-chip" onclick="window.autocompletarPagoDiario('Gasoil', 'mes')">⛽ Gasoil</button>
          <button type="button" class="glass-filter-chip" onclick="window.autocompletarPagoDiario('Ocio', 'ocio')">🍹 Ocio</button>
          <button type="button" class="glass-filter-chip" onclick="window.autocompletarPagoDiario('Casa', 'casa')">🏠 Casa</button>
        </div>

        <form data-accion="crear-movimiento" data-err="err-pago-diario" class="fintech-form">
          <input type="hidden" name="signo" value="-">

          <div class="form-grid-2">
            <div class="campo">
              <label for="pd-cuenta-id">Tarjeta empleada *</label>
              <select id="pd-cuenta-id" name="cuenta_id" required>
                ${opcionesTarjetasForm}
              </select>
            </div>
            <div class="campo">
              <label for="pd-importe">Importe del pago (€) *</label>
              <input id="pd-importe" name="importe" inputmode="decimal" placeholder="0.00" required>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label for="pd-desc">Establecimiento / Concepto *</label>
              <input id="pd-desc" name="descripcion" placeholder="Ej. Mercadona, Gasolinera Repsol..." required>
            </div>
            <div class="campo">
              <label for="pd-bote-id">Descontar de Sobre / Bote</label>
              <select id="pd-bote-id" name="bote_id">
                <option value="">(Opcional) No descontar de ningún bote</option>
                <optgroup label="Sobres y Botes">
                  ${opcionesBoteHtml}
                </optgroup>
                ${
                  opcionesPrestamosHtml
                    ? `
                <optgroup label="Amortizar Préstamo">
                  ${opcionesPrestamosHtml}
                </optgroup>`
                    : ""
                }
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label for="pd-fecha">Fecha</label>
              <input id="pd-fecha" name="fecha" type="date" value="${hoy()}" required>
            </div>
          </div>

          <div id="err-pago-diario"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("carrito")} Registrar Pago Diario
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>

  <!-- 5. Listado de Compras en la Tarjeta Seleccionada -->
  <section class="glass-card latest-transactions-card">
    <div class="transactions-header">
      <h3 class="transactions-title">Compras con ${esc(tarjetaActual.nombre)} (${movsData.total})</h3>
      <button type="button" class="btn-secondary" data-accion-fintech="liquidar-tarjeta" data-tarjeta-id="${tarjetaActual.id}" style="font-size: 0.78rem; padding: 0.35rem 0.85rem;">
        💳 Liquidar en Banco
      </button>
    </div>
    <div class="transactions-stream">
      ${
        movsData.items.length === 0
          ? `
        <div class="empty-state-stream">
          <span class="empty-stream-icon">${icono("movimientos")}</span>
          <p>No hay compras registradas en esta tarjeta</p>
        </div>
        `
          : movsData.items.map(pintarFilaMovimiento).join("\n")
      }
    </div>
  </section>
  `;
});
