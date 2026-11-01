// Vista de botes: Sobres de ahorro, gastos recurrentes y proyectos con extracto y detalle individual
import { esc, importe, vista, icono, hoy, fechaCorta, subnavAhorro } from "../vistas.js?v=33";
import { pintarFilaMovimiento, setGlobalCaches } from "./movimientos.js?v=33";

let boteSeleccionadoId = null;
let categoriaSeleccionada = "todas";

export function seleccionarBote(id) {
  boteSeleccionadoId = id ? Number(id) : null;
}

export function establecerCategoriaBote(cat) {
  categoriaSeleccionada = cat || "todas";
}

export const CATEGORIAS_BOTES = {
  viajes: {
    id: "viajes",
    nombre: "Viajes",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>`,
    color: "#0284c7",
    colorBg: "#e0f2fe",
  },
  mantenimiento: {
    id: "mantenimiento",
    nombre: "Mantenimiento casa",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    color: "#d97706",
    colorBg: "#fef3c7",
  },
  ropa: {
    id: "ropa",
    nombre: "Ropa",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>`,
    color: "#db2777",
    colorBg: "#fce7f3",
  },
  dentista: {
    id: "dentista",
    nombre: "Dentista",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 1 3l1 7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2l1-7a5 5 0 0 0 1-3V7a5 5 0 0 0-5-5z"/><path d="M9 10h6"/></svg>`,
    color: "#0891b2",
    colorBg: "#cffafe",
  },
  fianzas: {
    id: "fianzas",
    nombre: "Fianzas",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    color: "#4f46e5",
    colorBg: "#e0e7ff",
  },
  inversion: {
    id: "inversion",
    nombre: "Inversión",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    color: "#059669",
    colorBg: "#d1fae5",
  },
  gasolina: {
    id: "gasolina",
    nombre: "Gasolina",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2.5a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 0 1.5 1.5h0a1.5 1.5 0 0 0 1.5-1.5V9l-3-3"/><path d="M7 10h4"/><path d="M3 22h12"/></svg>`,
    color: "#ea580c",
    colorBg: "#ffedd5",
  },
  ocio: {
    id: "ocio",
    nombre: "Ocio",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 3-7 8-7-8h14Z"/><path d="M12 11v10"/><path d="M8 21h8"/></svg>`,
    color: "#7c3aed",
    colorBg: "#ede9fe",
  },
  reserva: {
    id: "reserva",
    nombre: "Reserva y Paro",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    color: "#334155",
    colorBg: "#f1f5f9",
  },
  personal: {
    id: "personal",
    nombre: "Personal / Familia",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    color: "#0284c7",
    colorBg: "#e0f2fe",
  },
  gastos: {
    id: "gastos",
    nombre: "Gastos y Pagos",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`,
    color: "#64748b",
    colorBg: "#f1f5f9",
  },
  otros: {
    id: "otros",
    nombre: "Otros Botes",
    icono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    color: "#64748b",
    colorBg: "#f1f5f9",
  },
};

function tarjetaBoteFull(b) {
  const obj = Number(b.objetivo);
  const sal = Number(b.saldo);
  const tieneObj = b.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(200, (sal / obj) * 100)) : 0;
  const conseguido = b.estado === "conseguido";

  const cat = CATEGORIAS_BOTES[b.categoria] || CATEGORIAS_BOTES.otros;

  return `
    <article class="card-pot-full ${b.tipo}">
      <div class="card-pot-header">
        <div class="pot-header-main">
          <div class="card-pot-icon" style="background: ${cat.colorBg}; color: ${cat.color}; border: 1px solid ${cat.color}35;">
            ${cat.icono}
          </div>
          <div class="pot-header-texts">
            <h3 class="pot-title">${esc(b.nombre)}</h3>
            <span class="card-pot-category-badge" style="background: ${cat.colorBg}; color: ${cat.color}; border: 1px solid ${cat.color}30;">
              ${cat.nombre}
            </span>
          </div>
        </div>
        <div class="card-pot-actions">
          <span class="badge-type">${esc(b.tipo)}</span>
          ${
            conseguido
              ? `<span class="badge-tag ok">${icono("check")} Cumplido</span>`
              : tieneObj
              ? `<span class="badge-tag info">${pct.toFixed(0)}%</span>`
              : ""
          }
          <button class="btn-action-icon delete" data-accion="borrar-bote" data-id="${b.id}" data-nombre="${esc(b.nombre)}" title="Eliminar este bote">
            ${icono("borrar")}
          </button>
        </div>
      </div>

      <div class="pot-balance-section">
        <span class="balance-sub">Fondos acumulados</span>
        <div class="pot-balance-value ${sal < 0 ? "negativo" : ""}">${sal < 0 ? importe(b.saldo, "negativo") : importe(b.saldo)}</div>
      </div>

      ${
        tieneObj
          ? `
        <div class="pot-progress-section">
          <div class="progress-bar-large ${pct > 100 ? "over" : ""}">
            <div class="progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
          </div>
          <div class="progress-info-row">
            <span class="progress-pct">${pct.toFixed(0)}% del objetivo</span>
            <span class="progress-goal">Límite: ${b.objetivo} €</span>
          </div>
        </div>
      `
          : ""
      }

      <div class="pot-card-footer">
        <button type="button" class="btn-pot-detail" data-accion="ver-detalle-bote" data-id="${b.id}">
          <span>${icono("ojo")} Ver movimientos y extracto</span>
          <span class="btn-arrow">&rarr;</span>
        </button>
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
        <div class="tx-date-items" style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${movs.map(pintarFilaMovimiento).join("\n")}
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

  setGlobalCaches({ cuentas: cuentasData.items, botes: botesData.items });

  const cuentas = cuentasData.items || [];

  // Si hay un bote seleccionado para ver su extracto detallado
  if (boteSeleccionadoId && botesData.items.some((b) => b.id === boteSeleccionadoId)) {
    return await renderDetalleBote(boteSeleccionadoId, cuentas);
  }

  // Si el bote seleccionado ya no existe, reseteamos a vista general
  boteSeleccionadoId = null;

  // En Sobres y Botes dejamos todo excepto Amortización Hipoteca (que queda en Fondo de Ahorro)
  const sobresBotes = botesData.items.filter(
    (b) => !b.nombre.toLowerCase().includes("hipoteca")
  );
  const totalBotes = sobresBotes.reduce((acc, b) => acc + Number(b.saldo), 0);

  // Conteo de botes por categoría
  const conteos = { todas: sobresBotes.length };
  for (const b of sobresBotes) {
    const c = b.categoria || "otros";
    conteos[c] = (conteos[c] || 0) + 1;
  }

  // Filtrado de botes según categoría activa
  const botesFiltrados = categoriaSeleccionada === "todas"
    ? sobresBotes
    : sobresBotes.filter((b) => (b.categoria || "otros") === categoriaSeleccionada);

  const listaCategoriasPills = [
    { id: "todas", nombre: "Todos", icono: icono("botes") },
    { id: "viajes", nombre: "Viajes", icono: CATEGORIAS_BOTES.viajes.icono },
    { id: "mantenimiento", nombre: "Mantenimiento casa", icono: CATEGORIAS_BOTES.mantenimiento.icono },
    { id: "ropa", nombre: "Ropa", icono: CATEGORIAS_BOTES.ropa.icono },
    { id: "dentista", nombre: "Dentista", icono: CATEGORIAS_BOTES.dentista.icono },
    { id: "fianzas", nombre: "Fianzas", icono: CATEGORIAS_BOTES.fianzas.icono },
    { id: "inversion", nombre: "Inversión", icono: CATEGORIAS_BOTES.inversion.icono },
    { id: "gasolina", nombre: "Gasolina", icono: CATEGORIAS_BOTES.gasolina.icono },
    { id: "ocio", nombre: "Ocio", icono: CATEGORIAS_BOTES.ocio.icono },
    { id: "reserva", nombre: "Reserva y Paro", icono: CATEGORIAS_BOTES.reserva.icono },
    { id: "personal", nombre: "Personal y Familia", icono: CATEGORIAS_BOTES.personal.icono },
    { id: "gastos", nombre: "Gastos y Pagos", icono: CATEGORIAS_BOTES.gastos.icono },
    { id: "otros", nombre: "Otros", icono: CATEGORIAS_BOTES.otros.icono },
  ];

  const pillsCategoriasHtml = listaCategoriasPills
    .filter((c) => c.id === "todas" || (conteos[c.id] && conteos[c.id] > 0) || ["viajes", "mantenimiento", "ropa", "dentista", "fianzas", "inversion", "gasolina"].includes(c.id))
    .map((c) => {
      const activo = categoriaSeleccionada === c.id;
      const count = conteos[c.id] || 0;
      return `
        <button type="button" class="btn-cat-filter ${activo ? "activo" : ""}" data-accion="filtrar-categoria-bote" data-categoria="${c.id}">
          <span>${c.icono}</span>
          <span>${esc(c.nombre)}</span>
          <span class="cat-pill-count">${count}</span>
        </button>
      `;
    })
    .join("");

  return `
  ${subnavAhorro("botes")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Botes y Sobres de Ahorro</h2>
      <p class="page-subtitle">Sistema de sobres virtuales categorizados por objetivo con iconos dedicados. Pulsa en un sobre para ver sus movimientos.</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Total en Sobres y Botes</span>
      <span class="header-total-value">${importe(totalBotes.toFixed(2))}</span>
    </div>
  </div>

  <!-- Selector / Filtro de Categorías con Iconos -->
  <div class="botes-cat-filter-bar">
    ${pillsCategoriasHtml}
  </div>

  <section class="section-block">
    <div class="grid-pots-large">
      ${
        botesFiltrados.length > 0
          ? botesFiltrados.map(tarjetaBoteFull).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("botes")}</span>
              <p>No tienes ningún sobre en la categoría seleccionada.</p>
              <span class="empty-sub">Crea un bote o pulsa en "Todos" para ver el resto de tus sobres.</span>
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
          <p class="form-card-subtitle">Define el objetivo, categoría y tipo de sobre para distribuir tu disponible</p>
        </div>
      </div>

      <form data-accion="crear-bote" data-err="err-bote" class="fintech-form">
        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="bo-nombre" class="form-label">Nombre del Bote</label>
            <input id="bo-nombre" name="nombre" placeholder="Ej. Viajes, Ropa, Dentista, Mantenimiento casa..." required>
          </div>
          <div class="form-group">
            <label for="bo-categoria" class="form-label">Categoría e Icono</label>
            <select id="bo-categoria" name="categoria">
              <option value="">— Detección automática según nombre —</option>
              <option value="viajes">✈️ Viajes</option>
              <option value="mantenimiento">🏠 Mantenimiento casa</option>
              <option value="ropa">👕 Ropa</option>
              <option value="dentista">🦷 Dentista y Salud</option>
              <option value="fianzas">🔐 Fianzas</option>
              <option value="inversion">📈 Inversión</option>
              <option value="gasolina">⛽ Gasolina</option>
              <option value="ocio">🍹 Ocio</option>
              <option value="reserva">🛡️ Reserva y Paro</option>
              <option value="personal">👤 Personal y Familia</option>
              <option value="gastos">🔁 Gastos y Pagos</option>
              <option value="otros">📦 Otros</option>
            </select>
          </div>
          <div class="form-group">
            <label for="bo-tipo" class="form-label">Tipo de Sobre</label>
            <select id="bo-tipo" name="tipo" required>
              <option value="ahorro" selected>🐷 Fondo de Ahorro</option>
              <option value="proyecto">🎯 Proyecto / Compra Concreta</option>
              <option value="recurrente">🔁 Gasto Recurrente Anual</option>
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
