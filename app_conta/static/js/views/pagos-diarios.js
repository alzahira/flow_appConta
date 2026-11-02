// Vista de Pagos Diarios: Gestión ágil de compras cotidianas con Tarjetas (Caixa, Deutsche Bank, Carrefour Pass)
// con descuento automático directo del sobre asignado (Dinero del mes, Bote ocio, etc.)
import { vista, esc, importe, hoy, icono, subnavCuentas } from "../vistas.js";
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
    for (const opt of boteEl.options) {
      if (opt.text.toLowerCase().includes(nombreBote.toLowerCase())) {
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
  const [cuentasData, botesData, categoriasData] = await Promise.all([
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/categorias"),
  ]);

  setGlobalCaches({
    cuentas: cuentasData.items,
    botes: botesData.items,
    categorias: categoriasData.items,
  });

  // Filtramos las tarjetas principales de compras diarias (excluyendo tarjetas regalo / monedero)
  const todasTarjetas = cuentasData.items.filter(
    (c) =>
      c.tipo === "tarjeta" &&
      !c.entidad?.toLowerCase().includes("regalo") &&
      !c.nombre?.toLowerCase().includes("regalo") &&
      !c.nombre?.toLowerCase().includes("couper") &&
      !c.nombre?.toLowerCase().includes("divisa")
  );

  // Orden prioritario Caixa -> Deutsche Bank -> Carrefour Pass
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
      ${subnavCuentas("pagos-diarios")}
      <div class="page-header-row">
        <div>
          <h2 class="page-title">Pagos Diarios (Tarjetas)</h2>
          <p class="page-subtitle">Compras del día a día (pan, comida, gasolina, ocio)</p>
        </div>
      </div>
      <div class="empty-state">
        <span class="empty-icon">${icono("tarjeta")}</span>
        <p>No se encontraron tarjetas de pago diario activas.</p>
        <span class="empty-sub">Crea primero tus tarjetas bancarias (Caixa, Deutsche Bank, Carrefour Pass) en la sección Tarjetas.</span>
        <a href="#/tarjetas" class="btn-primary mini">+ Ir a Tarjetas</a>
      </div>
    `;
  }

  // Tarjeta activa por defecto
  if (!tarjetaSeleccionadaId || !tarjetas.some((t) => t.id === tarjetaSeleccionadaId)) {
    tarjetaSeleccionadaId = tarjetas[0].id;
  }

  const tarjetaActual = tarjetas.find((t) => t.id === tarjetaSeleccionadaId) || tarjetas[0];
  const movsData = await API.get(`/movimientos?cuenta=${tarjetaActual.id}&limit=150`);

  // Botes clave para mostrar en los resúmenes superiores
  const boteMes = botesData.items.find((b) =>
    b.nombre.toLowerCase().includes("mes en curso") || b.nombre.toLowerCase().includes("dinero del mes")
  );
  const boteOcio = botesData.items.find((b) =>
    b.nombre.toLowerCase().includes("ocio")
  );
  const boteEmergencias = botesData.items.find((b) =>
    b.nombre.toLowerCase().includes("emergencia")
  );

  // Selector de tarjetas interactivo tipo tarjetas visuales
  const tabsTarjetasHtml = tarjetas
    .map((t) => {
      const activa = t.id === tarjetaActual.id;
      const ent = (t.entidad || t.nombre).toLowerCase();
      let bancoIcono = icono("tarjeta");
      if (ent.includes("caixa")) bancoIcono = icono("caixa");
      else if (ent.includes("deutsche") || ent.includes("db")) bancoIcono = icono("deutsche");
      else if (ent.includes("carrefour") || ent.includes("pass")) bancoIcono = icono("carrito");

      return `
      <button type="button" class="pd-tarjeta-selector-card ${activa ? "activa" : ""}" data-tarjeta-id="${t.id}">
        <div class="pd-card-header-line">
          <span class="pd-card-bank-icon">${bancoIcono}</span>
          <span class="pd-card-badge">${activa ? "Activa" : "Ver gastos"}</span>
        </div>
        <div class="pd-card-nombre">${esc(t.nombre)}</div>
        <div class="pd-card-entidad">${esc(t.entidad || "Tarjeta Bancaria")}</div>
        <div class="pd-card-saldo">
          <span class="pd-card-saldo-label">Acumulado en tarjeta:</span>
          <span class="pd-card-saldo-val">${importe(t.saldo)}</span>
        </div>
      </button>
    `;
    })
    .join("");

  // Opciones de botes para el selector (priorizando Dinero del mes y Ocio)
  const opcionesBotesList = [...botesData.items].sort((a, b) => {
    const esMesA = a.id === boteMes?.id ? -2 : a.id === boteOcio?.id ? -1 : 0;
    const esMesB = b.id === boteMes?.id ? -2 : b.id === boteOcio?.id ? -1 : 0;
    if (esMesA !== esMesB) return esMesA - esMesB;
    return a.nombre.localeCompare(b.nombre);
  });

  const opcionesBoteHtml = opcionesBotesList
    .map((b) => {
      const selected = b.id === boteMes?.id ? "selected" : "";
      const saldoInfo = Number(b.saldo).toFixed(2);
      return `<option value="${b.id}" ${selected}>${esc(b.nombre)} (Disp: ${saldoInfo} €)</option>`;
    })
    .join("");

  // Opciones de cuentas/tarjetas para el formulario
  const opcionesTarjetasForm = tarjetas
    .map((t) => `<option value="${t.id}" ${t.id === tarjetaActual.id ? "selected" : ""}>${esc(t.nombre)} (${esc(t.entidad)})</option>`)
    .join("");

  // Opciones de categorías
  const opcionesCategoria = [
    `<option value="">— Detectar categoría automáticamente —</option>`,
    ...categoriasData.items.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`),
  ].join("");

  const totalGastosTarjeta = movsData.items.reduce((acc, m) => acc + Number(m.importe), 0);

  // Instalar escucha interactiva de cambio de tarjeta
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
  ${subnavCuentas("pagos-diarios")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Pagos Diarios con Tarjeta</h2>
      <p class="page-subtitle">Anota las compras cotidianas (comida, pan, gasolina, ocio) con tarjetas Caixa, Deutsche Bank y Carrefour Pass. Se acumulan en la tarjeta y se descuentan de tu sobre correspondiente.</p>
    </div>
  </div>

  <!-- SELECTOR DE LAS 3 TARJETAS DIARIAS -->
  <section class="section-block">
    <div class="pd-tarjetas-grid">
      ${tabsTarjetasHtml}
    </div>
  </section>

  <!-- RESUMEN DE FONDOS DISPONIBLES EN SOBRES DEL DÍA A DÍA -->
  <section class="section-block">
    <div class="pd-botes-kpi-grid">
      <div class="pd-bote-kpi-card ${boteMes && Number(boteMes.saldo) < 50 ? 'alerta' : ''}">
        <div class="pd-bote-kpi-header">
          <span class="pd-bote-kpi-icon">🍞</span>
          <span class="pd-bote-kpi-tag">Presupuesto Mes</span>
        </div>
        <div class="pd-bote-kpi-label">Dinero del Mes en Curso</div>
        <div class="pd-bote-kpi-val">${boteMes ? importe(boteMes.saldo) : "0,00 €"}</div>
        <div class="pd-bote-kpi-sub">Compras de alimentación, pan, gastos cotidianos</div>
      </div>

      <div class="pd-bote-kpi-card">
        <div class="pd-bote-kpi-header">
          <span class="pd-bote-kpi-icon">🍹</span>
          <span class="pd-bote-kpi-tag">Libre Ocio</span>
        </div>
        <div class="pd-bote-kpi-label">Dinero de Ocio</div>
        <div class="pd-bote-kpi-val">${boteOcio ? importe(boteOcio.saldo) : "0,00 €"}</div>
        <div class="pd-bote-kpi-sub">Bares, cenas, salidas y disfrute</div>
      </div>

      ${boteEmergencias ? `
      <div class="pd-bote-kpi-card">
        <div class="pd-bote-kpi-header">
          <span class="pd-bote-kpi-icon">🛡️</span>
          <span class="pd-bote-kpi-tag">Respaldo</span>
        </div>
        <div class="pd-bote-kpi-label">Bote Emergencias</div>
        <div class="pd-bote-kpi-val">${importe(boteEmergencias.saldo)}</div>
        <div class="pd-bote-kpi-sub">Fondo de contingencia unificado</div>
      </div>` : ""}
    </div>
  </section>

  <!-- FORMULARIO PLEGADO PARA REGISTRAR PAGO DIARIO -->
  <section class="section-block">
    <details class="form-inversion-details" id="details-nuevo-pago-diario">
      <summary class="btn-nuevo-inversion-trigger">
        ${icono("plus")} Registrar Nuevo Pago Diario (Tarjeta)
      </summary>
      <div class="form-container" style="padding: 0 1.5rem 1.5rem 1.5rem;">
        <p class="form-desc">Registra un pago de hoy con tarjeta para sumarlo a su extracto y descontarlo del sobre correspondiente.</p>

        <!-- Chips de autocompletado rápido -->
        <div class="quick-pills-suggestions" style="margin-bottom: 1.25rem;">
          <span class="suggestions-label">Atajos rápidos:</span>
          <button type="button" class="btn-suggestion" onclick="window.autocompletarPagoDiario('Pan y desayuno', 'mes en curso')">🍞 Pan y Desayuno</button>
          <button type="button" class="btn-suggestion" onclick="window.autocompletarPagoDiario('Supermercado / Comida', 'mes en curso')">🛒 Supermercado</button>
          <button type="button" class="btn-suggestion" onclick="window.autocompletarPagoDiario('Gasolina', 'mes en curso')">⛽ Gasolina</button>
          <button type="button" class="btn-suggestion" onclick="window.autocompletarPagoDiario('Bar / Café / Cena', 'ocio')">🍹 Bar / Ocio</button>
          <button type="button" class="btn-suggestion" onclick="window.autocompletarPagoDiario('Farmacia', 'mes en curso')">💊 Farmacia</button>
        </div>

        <form data-accion="crear-movimiento" data-err="err-pago-diario" class="fintech-form">
          <input type="hidden" name="signo" value="-">

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label for="pd-cuenta-id" class="form-label">Tarjeta con la que pagaste *</label>
              <select id="pd-cuenta-id" name="cuenta_id" required>
                ${opcionesTarjetasForm}
              </select>
            </div>

            <div class="form-group form-span-2">
              <label for="pd-importe" class="form-label">Importe del Pago (€) *</label>
              <input id="pd-importe" name="importe" inputmode="decimal" placeholder="0.00" required>
            </div>
          </div>

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label for="pd-desc" class="form-label">Establecimiento / Concepto *</label>
              <input id="pd-desc" name="descripcion" placeholder="Ej. Panadería, Mercadona, Gasolinera Repsol, Restaurante..." required>
            </div>

            <div class="form-group form-span-2">
              <label for="pd-bote-id" class="form-label">Descontar del Sobre / Bote *</label>
              <select id="pd-bote-id" name="bote_id">
                <option value="">(Opcional) No descontar de ningún bote</option>
                ${opcionesBoteHtml}
              </select>
            </div>
          </div>

          <div class="form-row-grid">
            <div class="form-group form-span-2">
              <label for="pd-fecha" class="form-label">Fecha del Pago</label>
              <input id="pd-fecha" name="fecha" type="date" value="${hoy()}" required>
            </div>

            <div class="form-group form-span-2">
              <label for="pd-cat" class="form-label">Categoría Analítica</label>
              <select id="pd-cat" name="categoria_id">
                ${opcionesCategoria}
              </select>
            </div>
          </div>

          <div id="err-pago-diario"></div>

          <div class="form-actions-right">
            <button type="submit" class="btn-primary">
              ${icono("carrito")} Registrar Pago y Descontar de Sobre
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>

  <!-- LISTADO DE MOVIMIENTOS EN LA TARJETA SELECCIONADA -->
  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Movimientos en ${esc(tarjetaActual.nombre)}</h3>
        <p class="section-desc">${movsData.total} compras registradas &bull; Total acumulado en esta tarjeta: ${importe(totalGastosTarjeta.toFixed(2))}</p>
      </div>
    </div>

    ${
      movsData.items.length === 0
        ? `
      <div class="empty-state">
        <span class="empty-icon">${icono("tarjeta")}</span>
        <p>No hay gastos registrados en ${esc(tarjetaActual.nombre)}.</p>
        <span class="empty-sub">Añade compras diarias con el botón superior para acumular en esta tarjeta.</span>
      </div>
    `
        : `
      <div class="tx-date-items" style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${movsData.items.map(pintarFilaMovimiento).join("\n")}
      </div>
    `
    }
  </section>
  `;
});
