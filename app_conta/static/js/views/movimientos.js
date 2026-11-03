// Vista de movimientos: Lista agrupada por día con cabeceras sutiles, buscador y filtros en chips
import {
  vista,
  esc,
  importe,
  fechaCorta,
  hoy,
  icono,
  clasificarMovimientoVisual,
  renderInsigniaCuenta,
  fechaTituloGrupo,
} from "../vistas.js";

let cuentasCache = [];
let botesCache = [];
let categoriasCache = [];
let movimientosCargados = [];

export function setGlobalCaches({ cuentas, botes, categorias } = {}) {
  if (cuentas) cuentasCache = cuentas;
  if (botes) botesCache = botes;
  if (categorias) categoriasCache = categorias;
}

function selectorBote(m) {
  if (botesCache.length === 0) return "";
  const boteActual = botesCache.find((b) => b.id === m.bote_id);
  const nombreBote = boteActual ? esc(boteActual.nombre) : null;
  const tieneBote = Boolean(boteActual);

  return `
    <div class="chip-select-wrapper bote ${tieneBote ? "asignado" : "vacio"}">
      <span class="chip-select-label">${tieneBote ? `📦 ${nombreBote}` : "📦 Sin sobre"}</span>
      <select class="sel-bote sel-bote-chip" data-id="${m.id}" aria-label="Asignar bote">
        <option value="">— Sin sobre (Libre) —</option>
        ${botesCache
          .map(
            (b) =>
              `<option value="${b.id}" ${m.bote_id === b.id ? "selected" : ""}>📦 ${esc(
                b.nombre
              )}</option>`
          )
          .join("")}
      </select>
    </div>
  `;
}

function selectorCategoria(m) {
  if (categoriasCache.length === 0) return "";
  const catActual = categoriasCache.find((c) => c.id === m.categoria_id);
  const nombreCat = catActual ? esc(catActual.nombre) : null;
  const tieneCat = Boolean(catActual);

  return `
    <div class="chip-select-wrapper cat ${tieneCat ? "asignado" : "vacio"}">
      <span class="chip-select-label">${tieneCat ? `🏷️ ${nombreCat}` : "🏷️ Sin categoría"}</span>
      <select class="sel-categoria sel-cat-chip" data-id="${m.id}" aria-label="Asignar categoría">
        <option value="">— Sin categoría —</option>
        ${categoriasCache
          .map(
            (c) =>
              `<option value="${c.id}" ${
                m.categoria_id === c.id ? "selected" : ""
              }>🏷️ ${esc(c.nombre)}</option>`
          )
          .join("")}
      </select>
    </div>
  `;
}

export function pintarFilaMovimiento(m) {
  const numVal = Number(m.importe || 0);
  const esGasto = numVal < 0;
  const absNum = Math.abs(numVal).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const cuenta = cuentasCache.find((c) => c.id === m.cuenta_id);
  const bote = botesCache.find((b) => b.id === m.bote_id);
  const cat = categoriasCache.find((c) => c.id === m.categoria_id);

  const visual = clasificarMovimientoVisual(
    m.descripcion,
    cat?.nombre,
    bote?.nombre,
    !esGasto
  );
  const badgeCuenta = renderInsigniaCuenta(cuenta);

  return `
  <article class="transaction-row glass-card" style="padding: 0.85rem 1.15rem; margin-bottom: 0.45rem; border-radius: var(--radius-lg); gap: 0.95rem;"
           data-id="${m.id}"
           data-fecha="${m.fecha}"
           data-cuenta-id="${m.cuenta_id || ""}"
           data-bote-id="${m.bote_id || ""}"
           data-tipo="${esGasto ? "gasto" : "ingreso"}"
           data-search="${esc(`${m.descripcion} ${cuenta?.nombre || ""} ${bote?.nombre || ""} ${cat?.nombre || ""} ${m.importe}`).toLowerCase()}">
    <div class="tx-icon-wrapper ${esGasto ? "out" : "in"}">
      ${esGasto ? icono("flechaAbajo") : icono("flechaArriba")}
    </div>

    <div class="tx-main-info">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
        <span class="tx-concept">${esc(m.descripcion || "Operación")}</span>
        <div class="tx-amount-col">
          <span class="${esGasto ? "gasto" : "positivo"}">${esGasto ? "−" : "+"}${absNum}&nbsp;€</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
        <span class="tx-meta">${badgeCuenta}</span>
        ${selectorBote(m)}
        ${selectorCategoria(m)}
        <button class="btn-action-icon delete mini" data-accion="borrar-movimiento" data-id="${m.id}" data-concepto="${esc(m.descripcion || '')}" data-importe="${m.importe}" title="Eliminar este movimiento" style="margin-left: auto;">
          ${icono("borrar")}
        </button>
      </div>
    </div>
  </article>
  `;
}

function renderizarGruposMovimientos(items) {
  if (!items || items.length === 0) {
    return `
      <div class="glass-card tarjeta-vacia">
        <div class="tarjeta-vacia-icon">${icono("movimientos")}</div>
        <h4>No se encontraron movimientos</h4>
        <p>Prueba a cambiar o limpiar los filtros de búsqueda.</p>
      </div>
    `;
  }

  // Agrupamos por fecha descendente
  const grupos = new Map();
  for (const m of items) {
    const f = m.fecha;
    if (!grupos.has(f)) {
      grupos.set(f, []);
    }
    grupos.get(f).push(m);
  }

  const fechasOrdenadas = Array.from(grupos.keys()).sort((a, b) => b.localeCompare(a));

  return fechasOrdenadas
    .map((fecha) => {
      const movsDelDia = grupos.get(fecha);
      let centimosDiaNeto = 0;
      let centimosDiaIngresos = 0;
      let centimosDiaGastos = 0;

      for (const m of movsDelDia) {
        const c = Math.round(Number(m.importe || 0) * 100);
        centimosDiaNeto += c;
        if (c > 0) centimosDiaIngresos += c;
        else centimosDiaGastos += Math.abs(c);
      }

      const netoStr = (centimosDiaNeto / 100).toFixed(2);

      return `
      <div class="day-group-section" data-fecha="${fecha}" style="margin-bottom: 1.25rem;">
        <div class="day-group-header">
          <span>${fechaTituloGrupo(fecha)}</span>
          <span class="day-group-total ${centimosDiaNeto >= 0 ? 'text-pos' : ''}">
            Neto del día: ${importe(netoStr)}
          </span>
        </div>
        <div class="day-group-items">
          ${movsDelDia.map(pintarFilaMovimiento).join("\n")}
        </div>
      </div>
    `;
    })
    .join("\n");
}

function actualizarTotalesKPI(itemsFiltrados) {
  let centimosIngresos = 0;
  let centimosGastos = 0;
  for (const m of itemsFiltrados) {
    const c = Math.round(Number(m.importe || 0) * 100);
    if (c > 0) centimosIngresos += c;
    else centimosGastos += Math.abs(c);
  }
  const centimosNeto = centimosIngresos - centimosGastos;

  const kpiCount = document.getElementById("kpi-mov-count");
  const kpiIng = document.getElementById("kpi-mov-ingresos");
  const kpiGast = document.getElementById("kpi-mov-gastos");
  const kpiNeto = document.getElementById("kpi-mov-neto");

  if (kpiCount) kpiCount.textContent = itemsFiltrados.length;
  if (kpiIng) kpiIng.textContent = `+${(centimosIngresos / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`;
  if (kpiGast) kpiGast.textContent = `−${(centimosGastos / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`;
  if (kpiNeto) {
    kpiNeto.textContent = `${centimosNeto >= 0 ? "+" : "−"}${(Math.abs(centimosNeto) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`;
    kpiNeto.className = `chip-val ${centimosNeto >= 0 ? "positivo" : "negativo"}`;
  }
}

function filtrarMovimientosDOM() {
  const query = (document.getElementById("filtro-mov-buscar")?.value || "").toLowerCase().trim();
  const tipoFiltro = document.querySelector(".btn-filtro-tipo.activo")?.dataset.filtro || "todos";
  const cuentaFiltro = document.getElementById("filtro-mov-cuenta")?.value || "";
  const boteFiltro = document.getElementById("filtro-mov-bote")?.value || "";

  const filtrados = movimientosCargados.filter((m) => {
    const num = Number(m.importe || 0);
    if (tipoFiltro === "ingresos" && num <= 0) return false;
    if (tipoFiltro === "gastos" && num >= 0) return false;

    if (cuentaFiltro && String(m.cuenta_id) !== cuentaFiltro) return false;

    if (boteFiltro) {
      if (boteFiltro === "sin-bote" && m.bote_id) return false;
      if (boteFiltro !== "sin-bote" && String(m.bote_id) !== boteFiltro) return false;
    }

    if (query) {
      const cuenta = cuentasCache.find((c) => c.id === m.cuenta_id);
      const bote = botesCache.find((b) => b.id === m.bote_id);
      const cat = categoriasCache.find((c) => c.id === m.categoria_id);
      const searchStr = `${m.descripcion} ${cuenta?.nombre || ""} ${bote?.nombre || ""} ${cat?.nombre || ""} ${m.importe} ${m.fecha}`.toLowerCase();
      if (!searchStr.includes(query)) return false;
    }

    return true;
  });

  const contenedor = document.getElementById("lista-movimientos");
  if (contenedor) {
    contenedor.innerHTML = renderizarGruposMovimientos(filtrados);
  }
  actualizarTotalesKPI(filtrados);
}

export default vista("movimientos", async () => {
  const [data, cuentas, botes, categorias, prestamos] = await Promise.all([
    API.get("/movimientos?limit=100"),
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/categorias"),
    API.get("/prestamos"),
  ]);

  cuentasCache = cuentas.items || [];
  botesCache = botes.items || [];
  categoriasCache = categorias.items || [];
  movimientosCargados = data.items || [];

  const opcionesCuenta = cuentasCache
    .map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`)
    .join("");
  const opcionesBote = botesCache
    .map((b) => `<option value="${b.id}">📦 ${esc(b.nombre)}</option>`)
    .join("");
  const opcionesCategoria = categoriasCache
    .map((c) => `<option value="${c.id}">🏷️ ${esc(c.nombre)}</option>`)
    .join("");
  const opcionesPrestamos = (prestamos.items || [])
    .filter((p) => p.activo && Number(p.importe_pendiente) > 0)
    .map((p) => `<option value="prestamo:${p.id}">🚗 Amortizar ${esc(p.nombre)} (${esc(p.entidad)}) — Pendiente: ${p.importe_pendiente} €</option>`)
    .join("");

  const hayMas = data.offset + data.items.length < data.total;

  let cIngresos = 0;
  let cGastos = 0;
  for (const m of movimientosCargados) {
    const c = Math.round(Number(m.importe || 0) * 100);
    if (c > 0) cIngresos += c;
    else cGastos += Math.abs(c);
  }
  const cNeto = cIngresos - cGastos;

  setTimeout(() => {
    const inputBuscar = document.getElementById("filtro-mov-buscar");
    if (inputBuscar) {
      inputBuscar.addEventListener("input", filtrarMovimientosDOM);
    }

    document.querySelectorAll(".btn-filtro-tipo").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-filtro-tipo").forEach((b) => b.classList.remove("activo"));
        btn.classList.add("activo");
        filtrarMovimientosDOM();
      });
    });

    const selectCuenta = document.getElementById("filtro-mov-cuenta");
    if (selectCuenta) {
      selectCuenta.addEventListener("change", filtrarMovimientosDOM);
    }

    const selectBote = document.getElementById("filtro-mov-bote");
    if (selectBote) {
      selectBote.addEventListener("change", filtrarMovimientosDOM);
    }
  }, 50);

  return `
  <!-- 1. Cabecera y Resumen en Chips -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Flujo de Operaciones</span>
    <div class="hero-total-amount ${cNeto >= 0 ? '' : 'text-neg'}">${cNeto >= 0 ? '+' : '−'}${importe((Math.abs(cNeto) / 100).toFixed(2))}</div>
    <span class="hero-total-sub">${movimientosCargados.length} movimientos en este periodo</span>
  </div>

  <section class="glass-summary-chips-row" style="margin-bottom: 1.5rem;">
    <div class="glass-capsule-chip">
      <span class="chip-glow-bullet dot-green"></span>
      <span class="chip-title">Total Ingresos</span>
      <strong class="chip-val" id="kpi-mov-ingresos" style="color: var(--pos);">+${(cIngresos / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong>
    </div>
    <div class="glass-capsule-chip">
      <span class="chip-glow-bullet dot-violet"></span>
      <span class="chip-title">Total Gastos</span>
      <strong class="chip-val" id="kpi-mov-gastos">−${(cGastos / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong>
    </div>
    <div class="glass-capsule-chip">
      <span class="chip-glow-bullet dot-blue"></span>
      <span class="chip-title">Operaciones</span>
      <strong class="chip-val" id="kpi-mov-count">${movimientosCargados.length}</strong>
    </div>
  </section>

  <!-- 2. Buscador y Filtros en Chips -->
  <div class="mov-search-bar-wrap">
    <span class="mov-search-icon">${icono("buscar")}</span>
    <input type="text" id="filtro-mov-buscar" class="mov-search-input" placeholder="Buscar por concepto, comercio, importe o fecha..." aria-label="Buscar movimientos">
  </div>

  <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem;">
    <!-- Selector Tipo en Chips -->
    <div class="segmented-control">
      <button type="button" class="segmented-control-btn btn-filtro-tipo activo" data-filtro="todos">Todos</button>
      <button type="button" class="segmented-control-btn btn-filtro-tipo" data-filtro="ingresos">🟢 Ingresos</button>
      <button type="button" class="segmented-control-btn btn-filtro-tipo" data-filtro="gastos">Gastos</button>
    </div>

    <!-- Filtro de Cuenta -->
    <select id="filtro-mov-cuenta" class="glass-filter-chip" style="outline: none; padding: 0.45rem 0.85rem;" aria-label="Filtrar por cuenta">
      <option value="">🏛️ Todas las cuentas</option>
      ${cuentasCache.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}
    </select>

    <!-- Filtro de Sobre -->
    <select id="filtro-mov-bote" class="glass-filter-chip" style="outline: none; padding: 0.45rem 0.85rem;" aria-label="Filtrar por sobre">
      <option value="">📦 Todos los sobres</option>
      <option value="sin-bote">🏦 Libre en cuenta</option>
      ${botesCache.map((b) => `<option value="${b.id}">📦 ${esc(b.nombre)}</option>`).join("")}
    </select>
  </div>

  <!-- 3. Formulario desplegable para nuevo movimiento -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Registrar Nuevo Movimiento Contable
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-movimiento" data-err="err-movimiento" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Anota una entrada o salida y asígnala opcionalmente a un sobre de ahorro o amortización de préstamo.
          </p>

          <div class="segmented-control" style="max-width: 400px; margin-bottom: 1.25rem;">
            <label class="seg-btn activo" style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
              <input type="radio" name="signo" value="-" checked style="display: none;" onchange="this.closest('.segmented-control').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('activo')); this.closest('.seg-btn').classList.add('activo');">
              <span>− Gasto (Salida de dinero)</span>
            </label>
            <label class="seg-btn" style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
              <input type="radio" name="signo" value="+" style="display: none;" onchange="this.closest('.segmented-control').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('activo')); this.closest('.seg-btn').classList.add('activo');">
              <span style="color: var(--pos); font-weight: 600;">+ Ingreso (Entrada)</span>
            </label>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label for="mov-importe">Importe (€) *</label>
              <input id="mov-importe" name="importe" inputmode="decimal" placeholder="0.00" required>
            </div>
            <div class="campo">
              <label for="mov-desc">Concepto o Comercio *</label>
              <input id="mov-desc" name="descripcion" placeholder="Ej. Compra Mercadona, Nómina, Recibo..." required>
            </div>
          </div>

          <div class="form-grid-3">
            <div class="campo">
              <label for="mov-cuenta">Cuenta / Tarjeta *</label>
              <select id="mov-cuenta" name="cuenta_id" required>
                ${opcionesCuenta || '<option value="">Crea primero una cuenta</option>'}
              </select>
            </div>
            <div class="campo">
              <label for="mov-bote">Sobre o Préstamo</label>
              <select id="mov-bote" name="bote_id">
                <optgroup label="Cuenta Corriente">
                  <option value="">— Sin sobre (Libre) —</option>
                </optgroup>
                <optgroup label="Sobres y Botes">
                  ${opcionesBote}
                </optgroup>
                ${
                  opcionesPrestamos
                    ? `
                <optgroup label="Amortización Préstamo">
                  ${opcionesPrestamos}
                </optgroup>`
                    : ""
                }
              </select>
            </div>
            <div class="campo">
              <label for="mov-fecha">Fecha</label>
              <input id="mov-fecha" name="fecha" type="date" value="${hoy()}" required>
            </div>
          </div>

          <div id="err-movimiento"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Guardar Movimiento
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>

  <!-- 4. Lista Agrupada por Día -->
  <section class="section-block">
    <div id="lista-movimientos">
      ${renderizarGruposMovimientos(movimientosCargados)}
    </div>

    ${
      hayMas
        ? `
      <div style="text-align: center; margin-top: 1.5rem;">
        <button class="btn-secondary" data-accion="mas-movimientos"
          data-limit="50" data-offset="${data.offset + data.items.length}">
          Cargar más movimientos (${data.total - (data.offset + data.items.length)} restantes)
        </button>
      </div>
    `
        : ""
    }
  </section>
  `;
});
