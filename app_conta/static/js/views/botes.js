// Vista de Botes y Sobres de Ahorro: Cuadrícula de tarjetas compactas con anillo circular de progreso y filtros en chips
import { esc, importe, vista, icono, hoy, fechaCorta, subnavAhorro } from "../vistas.js";
import { pintarFilaMovimiento, setGlobalCaches } from "./movimientos.js";

let boteSeleccionadoId = null;
let categoriaSeleccionada = "todas";

export function seleccionarBote(id) {
  boteSeleccionadoId = id ? Number(id) : null;
}

export function establecerCategoriaBote(cat) {
  categoriaSeleccionada = cat || "todas";
}

export const CATEGORIAS_BOTES = {
  viajes: { id: "viajes", nombre: "Viajes", icono: "✈️", color: "#38BDF8" },
  mantenimiento: { id: "mantenimiento", nombre: "Mantenimiento casa", icono: "🏠", color: "#F59E0B" },
  ropa: { id: "ropa", nombre: "Ropa", icono: "👕", color: "#F472B6" },
  dentista: { id: "dentista", nombre: "Dentista y Salud", icono: "🦷", color: "#2DD4BF" },
  fianzas: { id: "fianzas", nombre: "Fianzas", icono: "🔐", color: "#818CF8" },
  inversion: { id: "inversion", nombre: "Inversión", icono: "📈", color: "#34D399" },
  gasolina: { id: "gasolina", nombre: "Gasolina", icono: "⛽", color: "#FB923C" },
  ocio: { id: "ocio", nombre: "Ocio", icono: "🍹", color: "#A78BFA" },
  reserva: { id: "reserva", nombre: "Reserva y Paro", icono: "🛡️", color: "#94A3B8" },
  personal: { id: "personal", nombre: "Personal", icono: "👤", color: "#60A5FA" },
  gastos: { id: "gastos", nombre: "Gastos y Pagos", icono: "🔁", color: "#A1A1AA" },
  otros: { id: "otros", nombre: "Otros", icono: "📦", color: "#CBD5E1" },
};

function renderMiniAnilloBote(pct, colorPastel, esNegativo, iconoEmoji) {
  const r = 21;
  const circ = 2 * Math.PI * r; // ~131.95
  const clampedPct = Math.max(0, Math.min(100, pct));
  const offset = circ - (circ * clampedPct) / 100;
  const strokeColor = esNegativo ? "var(--neg)" : colorPastel;

  return `
    <div class="pot-ring-wrap" aria-hidden="true">
      <svg class="pot-ring-svg" viewBox="0 0 52 52">
        <circle class="pot-ring-track" cx="26" cy="26" r="${r}"/>
        <circle class="pot-ring-bar" cx="26" cy="26" r="${r}"
                stroke="${strokeColor}"
                stroke-dasharray="${circ.toFixed(2)}"
                stroke-dashoffset="${offset.toFixed(2)}"/>
      </svg>
      <span class="pot-ring-center-icon">${iconoEmoji}</span>
    </div>
  `;
}

function tarjetaBoteCompacta(b) {
  const obj = Number(b.objetivo);
  const sal = Number(b.saldo);
  const esNegativo = sal < 0;
  const tieneObj = b.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(200, (sal / obj) * 100)) : 0;

  const cat = CATEGORIAS_BOTES[b.categoria] || CATEGORIAS_BOTES.otros;
  const colorPastel = cat.color;

  return `
    <article class="glass-pot-card" data-accion="ver-detalle-bote" data-id="${b.id}" tabindex="0" role="button" aria-label="Bote ${esc(b.nombre)}">
      <div class="pot-card-header">
        <div class="pot-header-title-wrap">
          <span class="pot-color-dot" style="background: ${colorPastel}; box-shadow: 0 0 8px ${colorPastel}99;"></span>
          <h4 class="pot-compact-name" title="${esc(b.nombre)}">${esc(b.nombre)}</h4>
        </div>

        <div class="card-more-menu-wrapper">
          <button type="button" class="btn-card-more" data-accion="toggle-menu-bote" aria-label="Opciones de ${esc(b.nombre)}" title="Opciones">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <div class="card-more-dropdown">
            <button type="button" class="dropdown-item" data-accion-fintech="abrir-traspaso-botes" data-bote-id="${b.id}">
              ⇄ Mover dinero de este sobre
            </button>
            <button type="button" class="dropdown-item" data-accion="editar-bote" data-id="${b.id}">
              ${icono("editar")} Editar sobre
            </button>
            <button type="button" class="dropdown-item-danger" data-accion="borrar-bote" data-id="${b.id}" data-nombre="${esc(b.nombre)}">
              ${icono("borrar")} Eliminar sobre
            </button>
          </div>
        </div>
      </div>

      <div class="pot-card-body">
        ${renderMiniAnilloBote(tieneObj ? pct : (sal > 0 ? 100 : 0), colorPastel, esNegativo, cat.icono)}

        <div class="pot-data-col">
          <div class="pot-compact-amount ${esNegativo ? 'is-negativo' : ''}">${importe(b.saldo)}</div>
          ${
            esNegativo
              ? `<span class="pot-badge-neg">${icono("alerta")} En descubierto</span>`
              : tieneObj
              ? `<span class="pot-compact-meta">${pct.toFixed(0)}% de ${b.objetivo} €</span>`
              : `<span class="pot-compact-meta">${esc(cat.nombre)}</span>`
          }
        </div>
      </div>
    </article>
  `;
}

async function renderDetalleBote(boteId, cuentas) {
  const [bote, movsData] = await Promise.all([
    API.get(`/botes/${boteId}`),
    API.get(`/movimientos?bote=${boteId}&limit=100&orden=desc`),
  ]);

  const movs = movsData.items || [];
  const obj = Number(bote.objetivo);
  const sal = Number(bote.saldo);
  const esNegativo = sal < 0;
  const tieneObj = bote.objetivo !== null && obj !== 0;
  const pct = tieneObj ? Math.max(0, Math.min(200, (sal / obj) * 100)) : 0;
  const cat = CATEGORIAS_BOTES[bote.categoria] || CATEGORIAS_BOTES.otros;

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

    <div style="margin-bottom: 1.25rem;">
      <button type="button" class="btn-subtle" data-accion="cerrar-detalle-bote" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--fg-2); background: transparent; border: none; cursor: pointer; padding: 0.4rem 0;">
        ${icono("volver")} &larr; Volver a todos los botes
      </button>
    </div>

    <!-- Hero detalle del sobre -->
    <div class="accounts-hero-total">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
        <span class="pot-color-dot" style="background: ${cat.color};"></span>
        <span class="hero-total-label">${esc(bote.nombre)}</span>
      </div>
      <div class="hero-total-amount ${esNegativo ? 'text-neg' : ''}">${importe(bote.saldo)}</div>
      ${
        tieneObj
          ? `<span class="hero-total-sub">${pct.toFixed(0)}% del objetivo (${bote.objetivo} €)</span>`
          : `<span class="hero-total-sub">Sobre sin límite prefijado</span>`
      }
      <div style="margin-top: 0.85rem; display: flex; justify-content: center; gap: 0.5rem;">
        <button type="button" class="btn-primary mini" data-accion-fintech="abrir-traspaso-botes" data-bote-id="${bote.id}" style="font-size: 0.82rem; padding: 0.45rem 1.15rem; border-radius: var(--radius-pill); box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">
          ⇄ Mover Saldo a Otro Bote
        </button>
      </div>
    </div>

    <!-- Chips resumen aportaciones y gastos -->
    <section class="glass-summary-chips-row" style="margin-bottom: 1.5rem;">
      <div class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-green"></span>
        <span class="chip-title">Aportaciones (+)</span>
        <strong class="chip-val" style="color: var(--pos);">${importe(totalAportaciones.toFixed(2))}</strong>
      </div>
      <div class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-violet"></span>
        <span class="chip-title">Gastos del sobre (−)</span>
        <strong class="chip-val">${importe(Math.abs(totalGastos).toFixed(2))}</strong>
      </div>
      <div class="glass-capsule-chip">
        <span class="chip-glow-bullet dot-blue"></span>
        <span class="chip-title">Movimientos</span>
        <strong class="chip-val">${movs.length}</strong>
      </div>
    </section>

    <!-- Formulario para meter o sacar dinero de este sobre -->
    <section class="section-block" style="margin-bottom: 1.5rem;">
      <details class="glass-accordion">
        <summary>
          ${icono("plus")} Meter o Sacar Dinero de este Bote
        </summary>
        <div class="accordion-body">
          <form data-accion="crear-movimiento-bote" data-bote-id="${bote.id}" class="fintech-form">
            <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
              <label class="glass-filter-chip" style="cursor: pointer;">
                <input type="radio" name="signo" value="+" checked style="margin-right: 0.4rem;">
                <span>+ Meter dinero (Aportación)</span>
              </label>
              <label class="glass-filter-chip" style="cursor: pointer;">
                <input type="radio" name="signo" value="-" style="margin-right: 0.4rem;">
                <span>− Sacar dinero (Gasto del bote)</span>
              </label>
            </div>

            <div class="form-grid-2">
              <div class="campo">
                <label>Importe (€) *</label>
                <input name="importe" inputmode="decimal" placeholder="0.00" required>
              </div>
              <div class="campo">
                <label>Cuenta de Origen / Destino *</label>
                <select name="cuenta_id" required>
                  ${opcionesCuentas}
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="campo">
                <label>Concepto / Motivo *</label>
                <input name="descripcion" placeholder="Ej. Ahorro quincenal, Factura..." required>
              </div>
              <div class="campo">
                <label>Fecha</label>
                <input name="fecha" type="date" value="${hoy()}" required>
              </div>
            </div>

            <div class="form-actions" style="margin-top: 1.25rem;">
              <button type="submit" class="btn-primary">
                ${icono("plus")} Guardar Movimiento
              </button>
            </div>
          </form>
        </div>
      </details>
    </section>

    <!-- Extracto de movimientos de este sobre -->
    <section class="glass-card latest-transactions-card">
      <div class="transactions-header">
        <h3 class="transactions-title">Movimientos de este Bote (${movs.length})</h3>
      </div>
      <div class="transactions-stream">
        ${
          movs.length === 0
            ? `
          <div class="empty-state-stream">
            <span class="empty-stream-icon">${icono("movimientos")}</span>
            <p>Este bote no tiene movimientos registrados aún</p>
          </div>
          `
            : movs.map(pintarFilaMovimiento).join("\n")
        }
      </div>
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

  if (boteSeleccionadoId && botesData.items.some((b) => b.id === boteSeleccionadoId)) {
    return await renderDetalleBote(boteSeleccionadoId, cuentas);
  }
  boteSeleccionadoId = null;

  const sobresBotes = botesData.items.filter(
    (b) => !b.nombre.toLowerCase().includes("hipoteca")
  );
  const totalBotes = sobresBotes.reduce((acc, b) => acc + Number(b.saldo), 0);

  const conteos = { todas: sobresBotes.length };
  for (const b of sobresBotes) {
    const c = b.categoria || "otros";
    conteos[c] = (conteos[c] || 0) + 1;
  }

  const botesFiltrados =
    categoriaSeleccionada === "todas"
      ? sobresBotes
      : sobresBotes.filter((b) => (b.categoria || "otros") === categoriaSeleccionada);

  const listaCategoriasPills = [
    { id: "todas", nombre: "Todos", icono: "✨" },
    { id: "viajes", nombre: "Viajes", icono: "✈️" },
    { id: "mantenimiento", nombre: "Mantenimiento casa", icono: "🏠" },
    { id: "ropa", nombre: "Ropa", icono: "👕" },
    { id: "dentista", nombre: "Dentista", icono: "🦷" },
    { id: "fianzas", nombre: "Fianzas", icono: "🔐" },
    { id: "inversion", nombre: "Inversión", icono: "📈" },
    { id: "gasolina", nombre: "Gasolina", icono: "⛽" },
    { id: "ocio", nombre: "Ocio", icono: "🍹" },
    { id: "reserva", nombre: "Reserva y Paro", icono: "🛡️" },
    { id: "personal", nombre: "Personal", icono: "👤" },
    { id: "gastos", nombre: "Gastos", icono: "🔁" },
    { id: "otros", nombre: "Otros", icono: "📦" },
  ];

  const pillsCategoriasHtml = listaCategoriasPills
    .filter(
      (c) =>
        c.id === "todas" ||
        (conteos[c.id] && conteos[c.id] > 0) ||
        ["viajes", "mantenimiento", "ropa", "dentista", "fianzas", "inversion", "gasolina"].includes(c.id)
    )
    .map((c) => {
      const activo = categoriaSeleccionada === c.id;
      const count = conteos[c.id] || 0;
      return `
        <button type="button" class="glass-filter-chip ${activo ? "activo" : ""}" data-accion="filtrar-categoria-bote" data-categoria="${c.id}">
          <span>${c.icono}</span>
          <span>${esc(c.nombre)}</span>
          <span class="filter-chip-count">${count}</span>
        </button>
      `;
    })
    .join("");

  return `
  ${subnavAhorro("botes")}

  <!-- 1. Total en Sobres Arriba -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Total en Botes y Sobres</span>
    <div class="hero-total-amount">${importe(totalBotes.toFixed(2))}</div>
    <span class="hero-total-sub">${sobresBotes.length} sobres y botes activos</span>
    <div style="margin-top: 0.95rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
      <button type="button" class="btn-primary mini" data-accion-fintech="abrir-traspaso-botes" style="gap: 0.45rem; padding: 0.5rem 1.25rem; border-radius: var(--radius-pill); box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35); font-size: 0.85rem;">
        ⇄ Mover Dinero entre Botes
      </button>
    </div>
  </div>

  <!-- 2. Filtros por Categoría como Chips Horizontales con Scroll -->
  <div class="botes-filter-scroll" role="region" aria-label="Filtro de categorías">
    ${pillsCategoriasHtml}
  </div>

  <!-- 3. Cuadrícula de Tarjetas Pequeñas con Anillo de Progreso -->
  <section class="section-block" style="margin-bottom: 1.5rem;">
    <div class="pots-grid-compact">
      ${
        botesFiltrados.length > 0
          ? botesFiltrados.map(tarjetaBoteCompacta).join("\n")
          : `
          <div class="glass-card tarjeta-vacia" style="grid-column: 1 / -1;">
            <div class="tarjeta-vacia-icon">${icono("botes")}</div>
            <h4>No hay sobres en esta categoría</h4>
            <p>Selecciona otra categoría o crea un nuevo sobre para esta sección.</p>
          </div>
          `
      }
    </div>
  </section>

  <!-- 4. Formulario desplegable para dar de alta nuevo sobre -->
  <section class="section-block">
    <details class="glass-accordion">
      <summary>
        ${icono("plus")} Crear Nuevo Sobre o Bote de Ahorro
      </summary>
      <div class="accordion-body">
        <form data-accion="crear-bote" data-err="err-bote" class="fintech-form">
          <p class="form-desc" style="margin-bottom: 1rem; color: var(--fg-2); font-size: 0.85rem;">
            Define la meta, categoría y tipo de sobre para distribuir tu disponible mensual.
          </p>

          <div class="form-grid-3">
            <div class="campo">
              <label for="bo-nombre">Nombre del Bote *</label>
              <input id="bo-nombre" name="nombre" placeholder="Ej. Viajes, Ropa, Dentista..." required>
            </div>
            <div class="campo">
              <label for="bo-categoria">Categoría</label>
              <select id="bo-categoria" name="categoria">
                <option value="">— Selección —</option>
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
            <div class="campo">
              <label for="bo-tipo">Tipo de Sobre</label>
              <select id="bo-tipo" name="tipo" required>
                <option value="ahorro" selected>🐷 Fondo de Ahorro</option>
                <option value="proyecto">🎯 Proyecto Concreto</option>
                <option value="recurrente">🔁 Gasto Recurrente Anual</option>
                <option value="ajeno">👥 Dinero Ajeno</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label for="bo-objetivo">Meta / Objetivo (€) (Opcional)</label>
              <input id="bo-objetivo" name="objetivo" inputmode="decimal" placeholder="Ej. 1200.00">
            </div>
            <div class="campo">
              <label for="bo-fecha">Fecha Límite (Opcional)</label>
              <input id="bo-fecha" name="objetivo_fecha" type="date">
            </div>
          </div>

          <div id="err-bote"></div>

          <div class="form-actions" style="margin-top: 1.25rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Crear Bote de Ahorro
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
