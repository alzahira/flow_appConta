// Vista de movimientos: Gestión y auditoría del flujo de caja con interfaz Fintech ejecutiva
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
} from "../vistas.js?v=33";

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
  <article class="tx-card-item ${esGasto ? "gasto" : "ingreso"}"
           data-id="${m.id}"
           data-fecha="${m.fecha}"
           data-cuenta-id="${m.cuenta_id || ""}"
           data-bote-id="${m.bote_id || ""}"
           data-tipo="${esGasto ? "gasto" : "ingreso"}"
           data-search="${esc(`${m.descripcion} ${cuenta?.nombre || ""} ${bote?.nombre || ""} ${cat?.nombre || ""} ${m.importe}`).toLowerCase()}">
    <div class="tx-card-left">
      <div class="tx-avatar" style="background: ${visual.bg}; color: ${visual.color}; border: 1px solid ${visual.borderColor};" title="${esc(visual.label)}">
        ${visual.icono}
      </div>
      <div class="tx-card-details">
        <div class="tx-card-title-row">
          <h4 class="tx-card-title">${esc(m.descripcion)}</h4>
          <span class="tx-badge-date">${fechaCorta(m.fecha)}</span>
        </div>
        <div class="tx-card-pills-row">
          ${badgeCuenta}
          ${selectorBote(m)}
          ${selectorCategoria(m)}
        </div>
      </div>
    </div>

    <div class="tx-card-right">
      <div class="tx-amount-wrap">
        <span class="tx-amount-val ${esGasto ? "negativo" : "positivo"}">
          <span class="tx-sign">${esGasto ? "−" : "+"}</span> ${absNum}&nbsp;<span class="tx-curr">€</span>
        </span>
        <span class="tx-amount-sub-badge ${esGasto ? "gasto" : "ingreso"}">${esGasto ? "Gasto" : "Ingreso"}</span>
      </div>
      <div class="tx-card-actions">
        <button class="btn-action-icon delete mini" data-accion="borrar-movimiento" data-id="${m.id}" title="Eliminar este movimiento">
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
      <div class="empty-state">
        <span class="empty-icon">${icono("movimientos")}</span>
        <p>No se encontraron movimientos con los filtros aplicados.</p>
        <span class="empty-sub">Prueba a limpiar la búsqueda o cambia de filtro.</span>
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

  // Ordenamos las fechas en orden descendente
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
      const ingStr = (centimosDiaIngresos / 100).toFixed(2);
      const gastStr = (centimosDiaGastos / 100).toFixed(2);

      return `
      <div class="tx-date-group" data-fecha="${fecha}">
        <div class="tx-date-header">
          <div class="tx-date-header-left">
            <span class="tx-date-dot"></span>
            <span class="tx-date-title">${fechaTituloGrupo(fecha)}</span>
            <span class="tx-date-count">${movsDelDia.length} ${movsDelDia.length === 1 ? "operación" : "operaciones"}</span>
          </div>
          <div class="tx-date-header-right">
            <span class="tx-date-breakdown">
              ${centimosDiaIngresos > 0 ? `<span class="breakdown-in">+${ingStr} €</span>` : ""}
              ${centimosDiaGastos > 0 ? `<span class="breakdown-out">−${gastStr} €</span>` : ""}
            </span>
            <span class="tx-date-net ${centimosDiaNeto >= 0 ? "positivo" : "negativo"}">
              Día: ${importe(netoStr)}
            </span>
          </div>
        </div>
        <div class="tx-date-items">
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
    kpiNeto.className = `tx-kpi-val ${centimosNeto >= 0 ? "positivo" : "negativo"}`;
  }
}

function filtrarMovimientosDOM() {
  const query = (document.getElementById("filtro-mov-buscar")?.value || "").toLowerCase().trim();
  const tipoFiltro = document.querySelector(".btn-filtro-tipo.activo")?.dataset.filtro || "todos";
  const cuentaFiltro = document.getElementById("filtro-mov-cuenta")?.value || "";
  const boteFiltro = document.getElementById("filtro-mov-bote")?.value || "";

  const filtrados = movimientosCargados.filter((m) => {
    // 1. Filtro Tipo
    const num = Number(m.importe || 0);
    if (tipoFiltro === "ingresos" && num <= 0) return false;
    if (tipoFiltro === "gastos" && num >= 0) return false;

    // 2. Filtro Cuenta
    if (cuentaFiltro && String(m.cuenta_id) !== cuentaFiltro) return false;

    // 3. Filtro Bote
    if (boteFiltro) {
      if (boteFiltro === "sin-bote" && m.bote_id) return false;
      if (boteFiltro !== "sin-bote" && String(m.bote_id) !== boteFiltro) return false;
    }

    // 4. Búsqueda de texto
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
  const [data, cuentas, botes, categorias] = await Promise.all([
    API.get("/movimientos?limit=100"),
    API.get("/cuentas"),
    API.get("/botes"),
    API.get("/categorias"),
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

  const hayMas = data.offset + data.items.length < data.total;

  // Calculamos KPIs iniciales
  let cIngresos = 0;
  let cGastos = 0;
  for (const m of movimientosCargados) {
    const c = Math.round(Number(m.importe || 0) * 100);
    if (c > 0) cIngresos += c;
    else cGastos += Math.abs(c);
  }
  const cNeto = cIngresos - cGastos;

  setTimeout(() => {
    // Configurar listeners de la barra de filtros interactiva
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

    // Toggle para mostrar/ocultar el panel de nuevo movimiento
    const btnToggleForm = document.getElementById("btn-toggle-nuevo-mov");
    const panelForm = document.getElementById("panel-nuevo-movimiento");
    if (btnToggleForm && panelForm) {
      btnToggleForm.addEventListener("click", () => {
        const visible = panelForm.style.display !== "none";
        panelForm.style.display = visible ? "none" : "block";
        btnToggleForm.classList.toggle("activo", !visible);
        btnToggleForm.innerHTML = !visible
          ? `✕ Ocultar Formulario`
          : `<span>${icono("plus")}</span> Nuevo Movimiento`;
      });
    }
  }, 50);

  return `
  <!-- CABECERA DE MOVIMIENTOS FINTECH -->
  <div class="page-header-row">
    <div>
      <h2 class="page-title">Movimientos y Auditoría</h2>
      <p class="page-subtitle">Registro cronológico inteligente con clasificación semántica, desglose por cuentas y asignación a sobres</p>
    </div>
    <div class="header-actions-group">
      <button type="button" id="btn-toggle-nuevo-mov" class="btn-primary-fintech">
        <span>${icono("plus")}</span>
        <span>Nuevo Movimiento</span>
      </button>
    </div>
  </div>

  <!-- PANEL DESPLEGABLE / FORMULARIO RÁPIDO -->
  <section id="panel-nuevo-movimiento" class="section-block" style="display: none;">
    <div class="form-card-container modern-elevated">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("plus")}</div>
        <div>
          <h3 class="form-card-title">Añadir Operación al Libro Contable</h3>
          <p class="form-card-subtitle">Registra un ingreso o gasto y clasifícalo en su cuenta y sobre</p>
        </div>
      </div>
      <form data-accion="crear-movimiento" data-err="err-movimiento" class="fintech-form">
        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label class="form-label">Tipo de Movimiento</label>
            <div class="segmented-control modern">
              <label class="segment-item">
                <input type="radio" name="signo" value="-" checked>
                <span class="segment-btn out">🔴 Gasto (− Salida de dinero)</span>
              </label>
              <label class="segment-item">
                <input type="radio" name="signo" value="+">
                <span class="segment-btn in">🟢 Ingreso (+ Entrada de dinero)</span>
              </label>
            </div>
          </div>

          <div class="form-group form-span-2">
            <label for="mov-importe" class="form-label">Importe (€)</label>
            <div class="input-currency-wrapper">
              <input id="mov-importe" name="importe" inputmode="decimal" placeholder="0.00" class="input-large" required autofocus>
              <span class="currency-symbol">€</span>
            </div>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="mov-desc" class="form-label">Concepto o Comercio</label>
            <input id="mov-desc" name="descripcion" placeholder="Ej. Compra Mercadona, Nómina Javier, Recibo Vodafone..." required>
          </div>
          <div class="form-group form-span-2">
            <label for="mov-cuenta" class="form-label">Cuenta Bancaria / Tarjeta de Origen</label>
            <select id="mov-cuenta" name="cuenta_id" required>
              ${opcionesCuenta || '<option value="">Crea primero una cuenta</option>'}
            </select>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group">
            <label for="mov-fecha" class="form-label">Fecha</label>
            <input id="mov-fecha" name="fecha" type="date" value="${hoy()}" required>
          </div>
          <div class="form-group">
            <label for="mov-bote" class="form-label">Sobre / Bote (Opcional)</label>
            <select id="mov-bote" name="bote_id">
              <option value="">— Ninguno (Libre en cuenta) —</option>
              ${opcionesBote}
            </select>
          </div>
          <div class="form-group form-span-2">
            <label for="mov-cat" class="form-label">Categoría Analítica (Opcional)</label>
            <select id="mov-cat" name="categoria_id">
              <option value="">— Sin categoría —</option>
              ${opcionesCategoria}
            </select>
          </div>
        </div>

        <div id="err-movimiento"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Guardar Movimiento
          </button>
        </div>
      </form>
    </div>
  </section>

  <!-- BARRA DE KPIS DEL LISTADO -->
  <div class="tx-kpi-bar">
    <div class="tx-kpi-item">
      <span class="tx-kpi-label">Movimientos Cargados</span>
      <span class="tx-kpi-val" id="kpi-mov-count">${movimientosCargados.length}</span>
    </div>
    <div class="tx-kpi-item in">
      <span class="tx-kpi-label">Total Ingresos (+)</span>
      <span class="tx-kpi-val positivo" id="kpi-mov-ingresos">+${(cIngresos / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
    </div>
    <div class="tx-kpi-item out">
      <span class="tx-kpi-label">Total Gastos (−)</span>
      <span class="tx-kpi-val negativo" id="kpi-mov-gastos">−${(cGastos / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
    </div>
    <div class="tx-kpi-item net">
      <span class="tx-kpi-label">Balance Neto</span>
      <span class="tx-kpi-val ${cNeto >= 0 ? "positivo" : "negativo"}" id="kpi-mov-neto">${cNeto >= 0 ? "+" : "−"}${(Math.abs(cNeto) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
    </div>
  </div>

  <!-- TOOLBAR DE BÚSQUEDA Y FILTRADO INTELIGENTE -->
  <div class="tx-toolbar-container">
    <div class="tx-search-box">
      <span class="search-icon">${icono("buscar")}</span>
      <input type="text" id="filtro-mov-buscar" placeholder="Buscar por comercio, concepto, importe, fecha..." aria-label="Buscar movimientos">
    </div>

    <div class="tx-filter-controls">
      <!-- Filtro Tipo de Operación -->
      <div class="segmented-pills">
        <button type="button" class="btn-filtro-tipo activo" data-filtro="todos">Todos</button>
        <button type="button" class="btn-filtro-tipo" data-filtro="ingresos">🟢 Ingresos</button>
        <button type="button" class="btn-filtro-tipo" data-filtro="gastos">🔴 Gastos</button>
      </div>

      <!-- Filtro Cuentas -->
      <select id="filtro-mov-cuenta" class="tx-filter-select" aria-label="Filtrar por cuenta">
        <option value="">🏛️ Todas las cuentas</option>
        ${cuentasCache.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}
      </select>

      <!-- Filtro Botes -->
      <select id="filtro-mov-bote" class="tx-filter-select" aria-label="Filtrar por sobre">
        <option value="">📦 Todos los sobres</option>
        <option value="sin-bote">🏦 Solo en cuenta libre</option>
        ${botesCache.map((b) => `<option value="${b.id}">📦 ${esc(b.nombre)}</option>`).join("")}
      </select>
    </div>
  </div>

  <!-- FEED DE MOVIMIENTOS AGRUPADOS POR DÍA -->
  <section class="section-block">
    <div id="lista-movimientos" class="tx-feed-container">
      ${renderizarGruposMovimientos(movimientosCargados)}
    </div>

    ${
      hayMas
        ? `
      <div class="load-more-row" style="margin-top: 1.5rem;">
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
