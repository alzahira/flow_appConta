// Modales de Acciones Rápidas (+ Ingreso, − Gasto y Reparto de Nómina)
import { esc, importe, hoy } from "./vistas.js";
import { CATEGORIAS_BOTES } from "./views/botes.js";
import { esTarjetaRegalo } from "./views/tarjetas-regalo.js";

let modalesInstalados = false;

function formatearMoneda(val) {
  return importe(String(val || "0.00").replace(",", "."));
}

function renderOpcionesBotesAgrupados(botes, prefijoValor = "") {
  if (!botes || botes.length === 0) return "";

  // 1. Clasificar botes
  const frecuentesKeywords = ["mes", "ocio", "diario", "semanal", "comida", "super"];
  const botesFrecuentes = [];
  const botesPorCategoria = {};

  botes.forEach((b) => {
    const nombreLower = (b.nombre || "").toLowerCase();
    const esFrecuente = frecuentesKeywords.some((kw) => nombreLower.includes(kw));

    if (esFrecuente) {
      botesFrecuentes.push(b);
    } else {
      const catKey = b.categoria && CATEGORIAS_BOTES[b.categoria] ? b.categoria : "otros";
      if (!botesPorCategoria[catKey]) {
        botesPorCategoria[catKey] = [];
      }
      botesPorCategoria[catKey].push(b);
    }
  });

  let html = "";

  if (botesFrecuentes.length > 0) {
    html += `
      <optgroup label="⭐ Frecuentes / Del Mes">
        ${botesFrecuentes
          .map((b) => {
            const cat = CATEGORIAS_BOTES[b.categoria] || CATEGORIAS_BOTES.otros;
            const emoji = cat.icono || "🐷";
            const val = prefijoValor ? `${prefijoValor}:${b.id}` : b.id;
            return `<option value="${val}">${emoji} ${esc(b.nombre)} (${b.saldo} €)</option>`;
          })
          .join("")}
      </optgroup>
    `;
  }

  const ordenCategorias = [
    "gastos",
    "viajes",
    "mantenimiento",
    "ropa",
    "dentista",
    "fianzas",
    "inversion",
    "gasolina",
    "ocio",
    "reserva",
    "personal",
    "otros",
  ];

  for (const catKey of ordenCategorias) {
    const lista = botesPorCategoria[catKey];
    if (lista && lista.length > 0) {
      const metaCat = CATEGORIAS_BOTES[catKey] || { nombre: "Otros", icono: "📦" };
      html += `
        <optgroup label="${metaCat.icono} ${metaCat.nombre}">
          ${lista
            .map((b) => {
              const val = prefijoValor ? `${prefijoValor}:${b.id}` : b.id;
              return `<option value="${val}">${metaCat.icono} ${esc(b.nombre)} (${b.saldo} €)</option>`;
            })
            .join("")}
        </optgroup>
      `;
    }
  }

  return html;
}

export function cerrarModalActivo() {
  const overlay = document.getElementById("fintech-modal-overlay");
  if (overlay) {
    overlay.classList.remove("abierto");
    setTimeout(() => overlay.remove(), 200);
  }
}

function crearOverlay() {
  cerrarModalActivo();
  const overlay = document.createElement("div");
  overlay.id = "fintech-modal-overlay";
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cerrarModalActivo();
  });
  document.body.appendChild(overlay);
  // Animación de entrada
  setTimeout(() => overlay.classList.add("abierto"), 10);
  return overlay;
}

// --------------------------------------------------------------------------
// 1. MODAL REGISTRAR GASTO
// --------------------------------------------------------------------------
export async function abrirModalGasto() {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando opciones...</div>
    </div>
  `;

  try {
    const [resCuentas, resBotes, resCats, resPrestamos] = await Promise.all([
      API.get("/cuentas"),
      API.get("/botes"),
      API.get("/categorias"),
      API.get("/prestamos"),
    ]);

    const cuentas = resCuentas.items || [];
    const botes = resBotes.items || [];
    const categorias = resCats.items || [];
    const prestamos = (resPrestamos.items || []).filter(
      (p) => p.activo && Number(p.importe_pendiente) > 0
    );
    const hoy = new Date().toISOString().slice(0, 10);

    overlay.innerHTML = `
      <div class="modal-card modal-gasto">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action gasto">− GASTO</span>
            <h3 class="modal-title">Registrar Gasto</h3>
            <p class="modal-subtitle">Indica de qué cuenta sale el dinero y qué sobre/bote descuenta</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal" aria-label="Cerrar">&times;</button>
        </div>

        <form id="form-modal-gasto" class="modal-form">
          <div class="modal-importe-hero gasto">
            <label for="mg-importe" class="modal-importe-label">Importe del gasto</label>
            <div class="modal-input-amount-wrap">
              <span class="modal-amount-symbol">− €</span>
              <input id="mg-importe" name="importe" type="number" step="0.01" min="0.01" placeholder="0.00" required autofocus>
            </div>
          </div>

          <div class="modal-grid-fields">
            <div class="modal-field">
              <label for="mg-cuenta" class="form-label">Cuenta de origen *</label>
              <select id="mg-cuenta" name="cuenta_id" required>
                ${cuentas
                  .map(
                    (c) => `
                  <option value="${c.id}">
                    ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""} — ${c.saldo} €
                  </option>
                `
                  )
                  .join("")}
              </select>
            </div>

            <div class="modal-field">
              <label for="mg-bote" class="form-label">Sobre o destino</label>
              <select id="mg-bote" name="bote_id">
                <optgroup label="General">
                  <option value="">— Gasto general de cuenta —</option>
                  <option value="es_adelanto">🤝 Es un adelanto / Me lo deben (Anotar en Me Deben)</option>
                </optgroup>
                ${renderOpcionesBotesAgrupados(botes)}
                ${
                  prestamos.length > 0
                    ? `
                <optgroup label="💳 Préstamos que debo (Amortizar / Pago de cuota)">
                  ${prestamos
                    .map(
                      (p) => `
                    <option value="prestamo:${p.id}">
                      🚗 ${esc(p.nombre)} (${esc(p.entidad)}) — Pendiente: ${p.importe_pendiente} €
                    </option>
                  `
                    )
                    .join("")}
                </optgroup>`
                    : ""
                }
              </select>
            </div>

            <div id="mg-adelanto-fields" class="modal-span-2" style="display: none; background: rgba(124, 58, 237, 0.06); border: 1px dashed var(--accent); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
              <span style="font-size: 0.78rem; font-weight: 600; color: var(--accent-text); display: block; margin-bottom: 0.45rem;">
                🤝 Datos del apunte que te deben:
              </span>
              <div class="form-grid-2">
                <div class="modal-field" style="margin-bottom: 0;">
                  <label for="mg-deudor" class="form-label" style="font-size: 0.75rem;">¿Quién te lo debe? *</label>
                  <input id="mg-deudor" name="deudor_adelanto" placeholder="Ej. Pedro, Compis, Mamá...">
                </div>
                <div class="modal-field" style="margin-bottom: 0;">
                  <label for="mg-deuda-limite" class="form-label" style="font-size: 0.75rem;">Fecha límite (Opcional)</label>
                  <input id="mg-deuda-limite" name="fecha_limite_adelanto" type="date">
                </div>
              </div>
            </div>

            <div class="modal-field">
              <label for="mg-categoria" class="form-label">Categoría contable</label>
              <select id="mg-categoria" name="categoria_id">
                <option value="">— Sin categoría —</option>
                ${categorias
                  .map(
                    (cat) => `
                  <option value="${cat.id}">${esc(cat.nombre)}</option>
                `
                  )
                  .join("")}
              </select>
            </div>

            <div class="modal-field">
              <label for="mg-fecha" class="form-label">Fecha del gasto *</label>
              <input id="mg-fecha" name="fecha" type="date" value="${hoy}" required>
            </div>

            <div class="modal-field modal-span-2">
              <label for="mg-desc" class="form-label">Concepto o descripción *</label>
              <input id="mg-desc" name="descripcion" placeholder="Ej. Compra Mercadona, Cena viernes, Gasolina..." required>
            </div>
          </div>

          <div id="modal-gasto-err" class="modal-error-box" style="display: none;"></div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="btn-cancelar-modal">Cancelar</button>
            <button type="submit" class="btn-primary danger" id="btn-guardar-gasto">
              <span>− Guardar Gasto</span>
            </button>
          </div>
        </form>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
    overlay.querySelector("#btn-cancelar-modal").addEventListener("click", cerrarModalActivo);

    const selectBote = overlay.querySelector("#mg-bote");
    const wrapAdelanto = overlay.querySelector("#mg-adelanto-fields");
    const inputDeudor = overlay.querySelector("#mg-deudor");

    selectBote.addEventListener("change", () => {
      const esAdelanto = selectBote.value === "es_adelanto";
      wrapAdelanto.style.display = esAdelanto ? "block" : "none";
      if (esAdelanto) {
        inputDeudor.setAttribute("required", "required");
      } else {
        inputDeudor.removeAttribute("required");
      }
    });

    const form = overlay.querySelector("#form-modal-gasto");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errBox = overlay.querySelector("#modal-gasto-err");
      const btnSubmit = overlay.querySelector("#btn-guardar-gasto");
      errBox.style.display = "none";
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Guardando...";

      const fData = new FormData(form);
      const valor = String(fData.get("importe") || "").replace(",", ".").trim();
      const cuentaId = fData.get("cuenta_id");
      const boteId = String(fData.get("bote_id") || "");
      const categoriaId = fData.get("categoria_id");
      const desc = fData.get("descripcion");
      const fecha = fData.get("fecha");
      const deudor = (fData.get("deudor_adelanto") || "").toString().trim();
      const fechaLimite = fData.get("fecha_limite_adelanto") || null;

      try {
        if (boteId === "es_adelanto") {
          // 1. Crear apunte formal en Me Deben
          await API.post("/deudas", {
            deudor: deudor,
            concepto: desc || "Adelanto / Compra compartida",
            importe: valor,
            fecha: fecha,
            fecha_limite: fechaLimite || null,
          });

          // 2. Registrar la salida de dinero en la cuenta
          await API.post("/movimientos", {
            fecha: fecha,
            importe: `-${valor}`,
            descripcion: `Adelanto deuda: ${deudor} — ${desc}`,
            cuenta_id: Number(cuentaId),
            bote_id: null,
            categoria_id: categoriaId ? Number(categoriaId) : null,
          });
        } else if (boteId.startsWith("prestamo:")) {
          const prestamoId = Number(boteId.split(":")[1]);
          await API.post(`/prestamos/${prestamoId}/pagar`, {
            importe: valor,
            cuenta_id: Number(cuentaId),
            concepto: desc || "Pago de cuota de préstamo",
            fecha: fecha,
          });
        } else {
          await API.post("/movimientos", {
            fecha: fecha,
            importe: `-${valor}`,
            descripcion: desc,
            cuenta_id: Number(cuentaId),
            bote_id: boteId ? Number(boteId) : null,
            categoria_id: categoriaId ? Number(categoriaId) : null,
          });
        }
        cerrarModalActivo();
        // Recargar o navegar para refrescar la pantalla
        if (window.irA) {
          window.irA("inicio");
        } else {
          location.pathname = "/inicio";
        }
      } catch (err) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "− Guardar Gasto";
        errBox.textContent = err.message || "Error al registrar el gasto";
        errBox.style.display = "block";
      }
    });
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Error</h3>
          <button type="button" class="modal-btn-close" onclick="document.getElementById('fintech-modal-overlay')?.remove()">&times;</button>
        </div>
        <p style="color: var(--accent-negative); padding: 1rem;">No se pudieron cargar los datos: ${err.message}</p>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// 2. MODAL REGISTRAR INGRESO (Libre y Reparto de Nómina)
// --------------------------------------------------------------------------
export async function abrirModalIngreso(pestañaInicial = "libre") {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando opciones...</div>
    </div>
  `;

  try {
    const [resCuentas, resBotes, resPlantillas, resPagos, resPrestamos, resCats] = await Promise.all([
      API.get("/cuentas"),
      API.get("/botes"),
      API.get("/plantillas-reparto"),
      API.get("/pagos-recurrentes"),
      API.get("/prestamos"),
      API.get("/categorias"),
    ]);

    const cuentas = resCuentas.items || [];
    const botes = resBotes.items || [];
    const plantillas = resPlantillas || [];
    const categorias = resCats.items || [];
    const prestamos = (resPrestamos.items || []).filter(
      (p) => p.activo && Number(p.importe_pendiente) > 0
    );
    const datosRecibos = resPagos || {
      por_cuenta: [],
      total_general: "0.00",
      total_general_centimos: 0,
    };
    const hoy = new Date().toISOString().slice(0, 10);

    const cuentasBancos = cuentas.filter(
      (c) => c.tipo === "banco" || c.tipo === "efectivo" || !c.tipo
    );
    const cuentasParaReparto = cuentasBancos.length > 0 ? cuentasBancos : cuentas;

    const plantillaMJ =
      plantillas.find((p) => (p.nombre || "").toLowerCase().includes("mj")) ||
      (plantillas.length > 1 ? plantillas[1] : null);
    const plantillaHogar =
      plantillas.find((p) => p.id !== (plantillaMJ ? plantillaMJ.id : -1)) ||
      plantillas[0] ||
      null;

    const totalRecibosCount = datosRecibos.por_cuenta
      ? datosRecibos.por_cuenta.reduce((acc, g) => acc + (g.items || []).length, 0)
      : 0;
    const totalRecibosVal = datosRecibos.total_general || "1074.00";

    const recibosCaixaObj = datosRecibos.por_cuenta
      ? datosRecibos.por_cuenta.find((g) =>
          (g.cuenta_nombre || "").toLowerCase().includes("caixa")
        )
      : null;
    const recibosCaixaTotal = recibosCaixaObj ? recibosCaixaObj.total : "526.00";
    const recibosCaixaCount = recibosCaixaObj?.items?.length ?? 9;

    const recibosDBObj = datosRecibos.por_cuenta
      ? datosRecibos.por_cuenta.find(
          (g) =>
            (g.cuenta_nombre || "").toLowerCase().includes("deutsche") ||
            (g.cuenta_nombre || "").toLowerCase().includes("db")
        )
      : null;
    const recibosDBTotal = recibosDBObj ? recibosDBObj.total : "548.00";
    const recibosDBCount = recibosDBObj?.items?.length ?? 3;

    const impHogarNum = parseFloat(plantillaHogar?.importe_estimado || "2323.00") || 2323;
    const impRecibosNum = parseFloat(totalRecibosVal) || 1074;
    const netoHogar = (impHogarNum - impRecibosNum).toFixed(2);
    const impMJNum = parseFloat(plantillaMJ?.importe_estimado || "731.00") || 731;
    const netoMJ = impMJNum.toFixed(2);

    overlay.innerHTML = `
      <div class="modal-card modal-ingreso">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action ingreso">+ INGRESO</span>
            <h3 class="modal-title">Registrar Ingreso</h3>
            <p class="modal-subtitle">Añade dinero libremente a un banco o reparte tu nómina mensual</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal" aria-label="Cerrar">&times;</button>
        </div>

        <!-- Pestañas de modo -->
        <div class="modal-tabs">
          <button type="button" class="modal-tab-btn ${pestañaInicial === "libre" ? "activo" : ""}" data-tab="libre">
            ⚡ Ingreso Libre / Extra
          </button>
          <button type="button" class="modal-tab-btn ${pestañaInicial === "nomina" ? "activo" : ""}" data-tab="nomina">
            💼 Reparto de Nómina (${plantillas.length})
          </button>
        </div>

        <!-- Banner directo para recargas desde tarjetas -->
        <div class="modal-traspaso-tip-banner" style="background: rgba(99, 102, 241, 0.09); border: 1px solid rgba(99, 102, 241, 0.28); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; margin: 0 1rem 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
          <div style="font-size: 0.8rem; color: var(--fg-1); line-height: 1.35;">
            <strong>💡 ¿Quieres recargar Revolut o Caixa desde tus tarjetas?</strong>
            <span style="display: block; color: var(--fg-2); font-size: 0.74rem;">Meter dinero desde Carrefour Pass o Tarjeta DB se hace mediante Traspaso.</span>
          </div>
          <button type="button" class="btn-primary mini" id="btn-switch-modal-traspaso" style="white-space: nowrap; font-size: 0.78rem; padding: 0.35rem 0.75rem;">
            ⇄ Ir a Traspaso / Recarga
          </button>
        </div>

        <!-- CONTENIDO PESTAÑA 1: INGRESO LIBRE -->
        <div id="tab-content-libre" class="modal-tab-content ${pestañaInicial === "libre" ? "activo" : ""}">
          <form id="form-modal-ingreso-libre" class="modal-form">
            <div class="modal-importe-hero ingreso">
              <label for="mi-importe" class="modal-importe-label">Importe del ingreso</label>
              <div class="modal-input-amount-wrap">
                <span class="modal-amount-symbol">+ €</span>
                <input id="mi-importe" name="importe" type="number" step="0.01" min="0.01" placeholder="0.00" required autofocus>
              </div>
            </div>

            <div class="modal-grid-fields">
              <div class="modal-field">
                <label for="mi-cuenta" class="form-label">Cuenta bancaria *</label>
                <select id="mi-cuenta" name="cuenta_id" required>
                  ${cuentas
                    .map(
                      (c) => `
                    <option value="${c.id}">
                      ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""} — ${c.saldo} €
                    </option>
                  `
                    )
                    .join("")}
                </select>
              </div>

              <div class="modal-field">
                <label for="mi-categoria" class="form-label">Categoría contable</label>
                <select id="mi-categoria" name="categoria_id">
                  <option value="">— Sin categoría (General) —</option>
                  ${categorias
                    .map(
                      (cat) => `
                    <option value="${cat.id}">${esc(cat.nombre)}</option>
                  `
                    )
                    .join("")}
                </select>
              </div>

              <div class="modal-field">
                <label for="mi-destino" class="form-label">Sobre o destino *</label>
                <select id="mi-destino" name="destino">
                  <optgroup label="General">
                    <option value="cuenta" selected>— Dejar libre en la cuenta corriente (Sin sobre) —</option>
                  </optgroup>
                  ${renderOpcionesBotesAgrupados(botes, "bote")}
                  ${
                    prestamos.length > 0
                      ? `
                  <optgroup label="💳 Préstamos y Financiaciones (Amortizar / Ingresar)">
                    ${prestamos
                      .map(
                        (p) => `
                      <option value="prestamo:${p.id}">
                        🚗 Ingresar en préstamo ${esc(p.nombre)} (${esc(p.entidad)}) — Deuda: ${p.importe_pendiente} €
                      </option>
                    `
                      )
                      .join("")}
                  </optgroup>`
                      : ""
                  }
                </select>
              </div>

              <div class="modal-field">
                <label for="mi-fecha" class="form-label">Fecha de ingreso *</label>
                <input id="mi-fecha" name="fecha" type="date" value="${hoy}" required>
              </div>

              <div class="modal-field modal-span-2">
                <label for="mi-desc" class="form-label">Concepto o descripción *</label>
                <input id="mi-desc" name="descripcion" placeholder="Ej. Nómina, Bizum recibido, Venta, Ingreso extra..." required>
              </div>

              <div class="modal-span-2">
                <div id="mi-destino-info" class="dest-info-pill">
                  🏦 El dinero quedará como saldo libre en la cuenta seleccionada.
                </div>
              </div>
            </div>

            <div id="modal-ingreso-err" class="modal-error-box" style="display: none;"></div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" id="btn-cancelar-libre">Cancelar</button>
              <button type="submit" class="btn-primary ok" id="btn-guardar-ingreso">
                <span>+ Guardar Ingreso</span>
              </button>
            </div>
          </form>
        </div>

        <!-- CONTENIDO PESTAÑA 2: REPARTO DE NÓMINA -->
        <div id="tab-content-nomina" class="modal-tab-content ${pestañaInicial === "nomina" ? "activo" : ""}">
          ${
            plantillas.length === 0
              ? `
            <div class="modal-empty-nomina">
              <div class="empty-icon-lg">💼</div>
              <h4>No tienes plantillas de nómina todavía</h4>
              <p>Puedes crear plantillas para repartir automáticamente tu nómina mensual o la de MJ.</p>
              <button type="button" class="btn-primary" id="btn-crear-primera-plantilla">+ Crear Primera Plantilla de Nómina</button>
            </div>
            `
              : `
            <form id="form-modal-nomina" class="modal-form">
              <div class="modal-nomina-visual">
                <div style="margin-bottom: 0.25rem;">
                  <label class="form-label" style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);">
                    Elige qué nómina o reparto quieres aplicar:
                  </label>
                </div>

                <!-- TARJETAS DE SELECCIÓN EXCLUSIVA (Hogar o Nómina MJ) -->
                <div class="nomina-cards-selector">
                  <button type="button" class="card-nomina-selector seleccionada" data-tipo-nomina="hogar">
                    <div class="card-nomina-radio-chip">
                      <span class="card-nomina-check">✓</span>
                    </div>
                    <div class="card-nomina-body">
                      <div class="card-nomina-badge">OPCIÓN 1</div>
                      <div class="card-nomina-titulo">🏡 ${esc(plantillaHogar?.nombre || "Reparto Mensual Hogar")}</div>
                      <div class="card-nomina-sub">Alquileres + Nómina Javier</div>
                      <div class="card-nomina-cifra">+${plantillaHogar?.importe_estimado || "2323.00"} €</div>
                      <div class="card-nomina-tags">
                        <span class="tag-recibos">⚡ Incluye ${totalRecibosCount} recibos (−${totalRecibosVal} €)</span>
                        <span class="tag-bancos">Caixa + DB</span>
                      </div>
                    </div>
                  </button>

                  ${
                    plantillaMJ
                      ? `
                  <button type="button" class="card-nomina-selector" data-tipo-nomina="mj">
                    <div class="card-nomina-radio-chip">
                      <span class="card-nomina-check">✓</span>
                    </div>
                    <div class="card-nomina-body">
                      <div class="card-nomina-badge">OPCIÓN 2</div>
                      <div class="card-nomina-titulo">💼 ${esc(plantillaMJ.nombre)}</div>
                      <div class="card-nomina-sub">Cobro íntegro en La Caixa</div>
                      <div class="card-nomina-cifra">+${plantillaMJ.importe_estimado} €</div>
                      <div class="card-nomina-tags">
                        <span class="tag-simple">📦 5 Botes + Amortización Coche</span>
                        <span class="tag-bancos">La Caixa</span>
                      </div>
                    </div>
                  </button>
                  `
                      : ""
                  }
                </div>

                <!-- PANEL DE DETALLE VISUAL REACTIVO (Sin tablas pesadas ni desgloses aburridos) -->
                <div id="nomina-panel-detalle"></div>

                <!-- FECHA DEL REPARTO -->
                <div class="nomina-fecha-wrap">
                  <label for="mn-fecha" class="form-label" style="font-weight: 600; margin-bottom: 0;">📅 Fecha del reparto:</label>
                  <input id="mn-fecha" name="fecha" type="date" value="${hoy}" required class="nomina-input-fecha">
                </div>

                <!-- GESTIÓN AVANZADA (SECUNDARIO) -->
                <div style="display: flex; justify-content: flex-end; margin-top: -0.25rem;">
                  <button type="button" class="btn-link mini" id="btn-ir-gestor-plantillas" style="color: var(--text-muted); font-size: 0.78rem; text-decoration: underline; background: none; border: none; cursor: pointer;">
                    ⚙️ Configuración avanzada de plantillas
                  </button>
                </div>
              </div>

              <div id="modal-nomina-err" class="modal-error-box" style="display: none; margin-top: 1rem;"></div>

              <div class="modal-footer" style="margin-top: 1rem;">
                <button type="button" class="btn-secondary" id="btn-cancelar-nomina">Cancelar</button>
                <button type="submit" class="btn-primary ok" id="btn-ejecutar-nomina">
                  <span>🚀 Aplicar Reparto</span>
                </button>
              </div>
            </form>
          `
          }
        </div>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
    const btnCancelLibre = overlay.querySelector("#btn-cancelar-libre");
    if (btnCancelLibre) btnCancelLibre.addEventListener("click", cerrarModalActivo);
    const btnCancelNomina = overlay.querySelector("#btn-cancelar-nomina");
    if (btnCancelNomina) btnCancelNomina.addEventListener("click", cerrarModalActivo);

    overlay.querySelector("#btn-switch-modal-traspaso")?.addEventListener("click", () => {
      cerrarModalActivo();
      abrirModalTraspaso();
    });

    // Conmutador de pestañas
    overlay.querySelectorAll(".modal-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        overlay.querySelectorAll(".modal-tab-btn").forEach((b) => b.classList.remove("activo"));
        overlay.querySelectorAll(".modal-tab-content").forEach((c) => c.classList.remove("activo"));
        btn.classList.add("activo");
        overlay.querySelector(`#tab-content-${btn.dataset.tab}`).classList.add("activo");
      });
    });

    // Escucha de cambio de destino para actualizar ayuda visual
    const selectDestino = overlay.querySelector("#mi-destino");
    const infoDestino = overlay.querySelector("#mi-destino-info");
    if (selectDestino && infoDestino) {
      selectDestino.addEventListener("change", () => {
        const val = selectDestino.value;
        if (val.startsWith("prestamo:")) {
          infoDestino.innerHTML = `🚗 <strong>Ingreso destinado a Préstamo:</strong> Se registrará la entrada del dinero y se amortizará automáticamente la deuda del préstamo seleccionado.`;
          infoDestino.style.color = "#0284c7";
        } else if (val.startsWith("bote:")) {
          infoDestino.innerHTML = `🐷 <strong>Ingreso en Sobre:</strong> El dinero se asignará directamente a este sobre de ahorro.`;
          infoDestino.style.color = "var(--accent-positive)";
        } else {
          infoDestino.innerHTML = `🏦 El dinero quedará como saldo libre en la cuenta seleccionada.`;
          infoDestino.style.color = "var(--text-muted)";
        }
      });
    }

    // Envío Ingreso Libre
    const formLibre = overlay.querySelector("#form-modal-ingreso-libre");
    if (formLibre) {
      formLibre.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBox = overlay.querySelector("#modal-ingreso-err");
        const btnSubmit = overlay.querySelector("#btn-guardar-ingreso");
        errBox.style.display = "none";
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando...";

        const fData = new FormData(formLibre);
        const valor = String(fData.get("importe") || "").replace(",", ".").trim();
        const cuentaId = fData.get("cuenta_id");
        const destino = String(fData.get("destino") || fData.get("bote_id") || "");
        const fecha = fData.get("fecha");
        const descripcion = fData.get("descripcion");
        const categoriaId = fData.get("categoria_id") ? Number(fData.get("categoria_id")) : null;

        try {
          if (destino.startsWith("prestamo:")) {
            const prestamoId = Number(destino.split(":")[1]);
            // 1. Registramos la entrada del dinero en la cuenta elegida
            await API.post("/movimientos", {
              fecha: fecha,
              importe: `+${valor}`,
              descripcion: descripcion,
              cuenta_id: Number(cuentaId),
              categoria_id: categoriaId,
            });
            // 2. Destinamos y amortizamos el dinero en el préstamo
            await API.post(`/prestamos/${prestamoId}/pagar`, {
              importe: valor,
              cuenta_id: Number(cuentaId),
              concepto: `Amortización préstamo: ${descripcion}`,
              fecha: fecha,
            });
          } else if (destino.startsWith("bote:")) {
            const boteId = Number(destino.split(":")[1]);
            await API.post("/movimientos", {
              fecha: fecha,
              importe: `+${valor}`,
              descripcion: descripcion,
              cuenta_id: Number(cuentaId),
              categoria_id: categoriaId,
              bote_id: boteId,
            });
          } else {
            const boteId = destino && destino !== "cuenta" ? Number(destino) : null;
            await API.post("/movimientos", {
              fecha: fecha,
              importe: `+${valor}`,
              descripcion: descripcion,
              cuenta_id: Number(cuentaId),
              categoria_id: categoriaId,
              bote_id: boteId,
            });
          }
          cerrarModalActivo();
          if (window.irA) {
            window.irA("inicio");
          } else {
            location.pathname = "/inicio";
          }
        } catch (err) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "+ Guardar Ingreso";
          errBox.textContent = err.message || "Error al registrar el ingreso";
          errBox.style.display = "block";
        }
      });
    }

    // Si no hay plantillas, botón de crear primera
    const btnCrearPrim = overlay.querySelector("#btn-crear-primera-plantilla");
    if (btnCrearPrim) {
      btnCrearPrim.addEventListener("click", () => {
        cerrarModalActivo();
        abrirModalPlantillasNomina();
      });
    }

    // LÓGICA DE REPARTO DE NÓMINA SIMPLIFICADO Y VISUAL
    let tipoSeleccionado = "hogar";

    function renderizarPanelDetalle(tipo) {
      const panelDetalle = overlay.querySelector("#nomina-panel-detalle");
      const btnSubmit = overlay.querySelector("#btn-ejecutar-nomina");
      if (!panelDetalle) return;

      // Actualizar estilo de selección de tarjetas
      overlay.querySelectorAll(".card-nomina-selector").forEach((card) => {
        if (card.dataset.tipoNomina === tipo) {
          card.classList.add("seleccionada");
        } else {
          card.classList.remove("seleccionada");
        }
      });

      if (tipo === "hogar") {
        const ctaCaixaNeto = (860 - parseFloat(recibosCaixaTotal || "0")).toFixed(2);
        const ctaDBNeto = (1463 - parseFloat(recibosDBTotal || "0")).toFixed(2);

        panelDetalle.innerHTML = `
          <div class="nomina-resumen-box">
            <div class="nomina-resumen-header">
              <span class="resumen-titulo">📊 Movimiento de Dinero en Cuentas</span>
              <span class="badge-recibos-status">⚡ ${totalRecibosCount} Recibos fijos domiciliados incluidos</span>
            </div>

            <div class="nomina-bancos-grid">
              <div class="nomina-banco-card">
                <div class="banco-card-title">🏛️ La Caixa</div>
                <div class="banco-card-item">
                  <span class="bci-label">Ingresos alquileres:</span>
                  <span class="bci-val pos">+860,00 €</span>
                </div>
                <div class="banco-card-item">
                  <span class="bci-label">${recibosCaixaCount} Recibos fijos:</span>
                  <span class="bci-val neg">−${recibosCaixaTotal} €</span>
                </div>
                <div class="banco-card-item total">
                  <span class="bci-label">Neto en Caixa:</span>
                  <span class="bci-val">+${ctaCaixaNeto} €</span>
                </div>
              </div>

              <div class="nomina-banco-card">
                <div class="banco-card-title">🏛️ Deutsche Bank</div>
                <div class="banco-card-item">
                  <span class="bci-label">Ingreso nómina + estudio:</span>
                  <span class="bci-val pos">+1.463,00 €</span>
                </div>
                <div class="banco-card-item">
                  <span class="bci-label">${recibosDBCount} Recibos fijos:</span>
                  <span class="bci-val neg">−${recibosDBTotal} €</span>
                </div>
                <div class="banco-card-item total">
                  <span class="bci-label">Neto en Deutsche Bank:</span>
                  <span class="bci-val">+${ctaDBNeto} €</span>
                </div>
              </div>
            </div>

            <div class="nomina-balance-summary-strip">
              <div class="strip-item">
                <span class="strip-label">Total Ingresos</span>
                <span class="strip-val pos">+${plantillaHogar?.importe_estimado || "2323.00"} €</span>
              </div>
              <div class="strip-operator">−</div>
              <div class="strip-item">
                <span class="strip-label">${totalRecibosCount} Recibos Pagados</span>
                <span class="strip-val neg">−${totalRecibosVal} €</span>
              </div>
              <div class="strip-operator">=</div>
              <div class="strip-item highlight">
                <span class="strip-label">Saldo Neto Resultante</span>
                <span class="strip-val neto">+${netoHogar} €</span>
              </div>
            </div>

            <div class="nomina-info-alert">
              <span class="alert-icon">🛡️</span>
              <span class="alert-text">
                Al confirmar, el sistema registra el ingreso (+${plantillaHogar?.importe_estimado || "2323.00"} €) y <strong>paga automáticamente todos los recibos fijos domiciliados (−${totalRecibosVal} €)</strong>.
              </span>
            </div>
          </div>
        `;
        if (btnSubmit) {
          btnSubmit.innerHTML = `<span>🚀 Aplicar Reparto Hogar y Pagar Recibos (+${netoHogar} € neto)</span>`;
        }
      } else {
        panelDetalle.innerHTML = `
          <div class="nomina-resumen-box">
            <div class="nomina-resumen-header">
              <span class="resumen-titulo">📊 Movimiento de Dinero de Nómina MJ</span>
              <span class="badge-recibos-status sin-recibos">💼 Nómina personal (Sin recibos)</span>
            </div>

            <div class="nomina-bancos-grid single">
              <div class="nomina-banco-card">
                <div class="banco-card-title">🏛️ La Caixa</div>
                <div class="banco-card-item">
                  <span class="bci-label">Abono íntegro en cuenta:</span>
                  <span class="bci-val pos">+${plantillaMJ?.importe_estimado || "731.00"} €</span>
                </div>
                <div class="banco-card-item">
                  <span class="bci-label">Recibos domiciliados:</span>
                  <span class="bci-val neutro">0,00 € (ninguno)</span>
                </div>
                <div class="banco-card-item total">
                  <span class="bci-label">Neto en Caixa:</span>
                  <span class="bci-val">+${plantillaMJ?.importe_estimado || "731.00"} €</span>
                </div>
              </div>
            </div>

            <div class="nomina-balance-summary-strip">
              <div class="strip-item">
                <span class="strip-label">Total Ingreso</span>
                <span class="strip-val pos">+${plantillaMJ?.importe_estimado || "731.00"} €</span>
              </div>
              <div class="strip-operator">=</div>
              <div class="strip-item highlight">
                <span class="strip-label">Repartido en Sobres</span>
                <span class="strip-val neto">+${plantillaMJ?.importe_estimado || "731.00"} €</span>
              </div>
            </div>

            <div class="nomina-info-alert info">
              <span class="alert-icon">ℹ️</span>
              <span class="alert-text">
                Se reparte en La Caixa: Gasolina (40 €), IRPF (27,64 €), Paro (199,01 €), Ocio (132,67 €), Mejoras (132,67 €) y amortiza directamente −199,01 € del préstamo del coche.
              </span>
            </div>
          </div>
        `;
        if (btnSubmit) {
          btnSubmit.innerHTML = `<span>🚀 Aplicar Nómina MJ (+${netoMJ} €)</span>`;
        }
      }
    }

    // Inicializar panel de detalle
    renderizarPanelDetalle(tipoSeleccionado);

    // Eventos al hacer clic en las tarjetas de nómina
    overlay.querySelectorAll(".card-nomina-selector").forEach((card) => {
      card.addEventListener("click", () => {
        tipoSeleccionado = card.dataset.tipoNomina;
        renderizarPanelDetalle(tipoSeleccionado);
      });
    });

    const btnIrGestor = overlay.querySelector("#btn-ir-gestor-plantillas");
    if (btnIrGestor) {
      btnIrGestor.addEventListener("click", () => {
        cerrarModalActivo();
        abrirModalPlantillasNomina();
      });
    }

    // Envío del Formulario de Nómina
    const formNomina = overlay.querySelector("#form-modal-nomina");
    if (formNomina) {
      formNomina.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBox = overlay.querySelector("#modal-nomina-err");
        const btnSubmit = overlay.querySelector("#btn-ejecutar-nomina");
        errBox.style.display = "none";
        btnSubmit.disabled = true;

        const fecha = overlay.querySelector("#mn-fecha").value;
        const esHogar = tipoSeleccionado === "hogar";
        const plantillaActiva = esHogar ? plantillaHogar : plantillaMJ;

        if (!plantillaActiva) {
          errBox.textContent = "No se ha encontrado la plantilla de nómina seleccionada.";
          errBox.style.display = "block";
          btnSubmit.disabled = false;
          return;
        }

        btnSubmit.textContent = esHogar
          ? "Aplicando reparto y pagando recibos..."
          : "Aplicando nómina...";

        try {
          // 1. Ejecutar plantilla de nómina
          let resReparto = null;
          try {
            resReparto = await API.post(
              `/plantillas-reparto/${plantillaActiva.id}/ejecutar`,
              {
                fecha: fecha,
                cuenta_id: plantillaActiva.cuenta_id,
                descripcion_general: plantillaActiva.nombre,
              }
            );
          } catch (errReparto) {
            if (errReparto.status !== 409) throw errReparto;
            const repetir = confirm(
              `${errReparto.message}\n\n¿Quieres ejecutar el reparto de nuevo?`
            );
            if (!repetir) {
              btnSubmit.disabled = false;
              renderizarPanelDetalle(tipoSeleccionado);
              return;
            }
            resReparto = await API.post(
              `/plantillas-reparto/${plantillaActiva.id}/ejecutar`,
              {
                fecha: fecha,
                cuenta_id: plantillaActiva.cuenta_id,
                descripcion_general: plantillaActiva.nombre,
                confirmar_repetido: true,
              }
            );
          }

          if (
            resReparto &&
            Array.isArray(resReparto.avisos) &&
            resReparto.avisos.length > 0
          ) {
            alert(
              "⚠️ Aviso del reparto:\n\n" +
                resReparto.avisos.map((a) => `• ${a.mensaje}`).join("\n")
            );
          }

          // 2. Si es reparto del hogar, pagar obligatoria y automáticamente los recibos domiciliados
          if (esHogar && datosRecibos.por_cuenta && datosRecibos.por_cuenta.length > 0) {
            await API.post("/pagos-recurrentes/ejecutar", {
              fecha: fecha,
            });
          }

          cerrarModalActivo();
          if (window.irA) {
            window.irA("inicio");
          } else {
            location.pathname = "/inicio";
          }
        } catch (err) {
          btnSubmit.disabled = false;
          renderizarPanelDetalle(tipoSeleccionado);
          errBox.textContent =
            err.message || "Error al aplicar el reparto de nómina y recibos";
          errBox.style.display = "block";
        }
      });
    }
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Error</h3>
          <button type="button" class="modal-btn-close" onclick="document.getElementById('fintech-modal-overlay')?.remove()">&times;</button>
        </div>
        <p style="color: var(--accent-negative); padding: 1rem;">No se pudieron cargar los datos: ${err.message}</p>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// 3. GESTOR DE PLANTILLAS DE NÓMINA (Crear, Editar, Eliminar y Programar)
// --------------------------------------------------------------------------
export async function abrirModalPlantillasNomina(plantillaAEditarId = null) {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando gestor de nóminas...</div>
    </div>
  `;

  try {
    const [resPlantillas, resCuentas, resBotes] = await Promise.all([
      API.get("/plantillas-reparto"),
      API.get("/cuentas"),
      API.get("/botes"),
    ]);

    const plantillas = resPlantillas || [];
    const cuentas = resCuentas.items || [];
    const botes = resBotes.items || [];

    const cuentasBancos = cuentas.filter(
      (c) => c.tipo === "banco" || c.tipo === "efectivo" || !c.tipo
    );
    const cuentasParaReparto = cuentasBancos.length > 0 ? cuentasBancos : cuentas;

    const editando = plantillaAEditarId
      ? plantillas.find((p) => p.id === plantillaAEditarId)
      : null;

    overlay.innerHTML = `
      <div class="modal-card modal-gestor-plantillas">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action neutral">CONFIGURACIÓN</span>
            <h3 class="modal-title">${editando ? "Editar Plantilla de Nómina" : "Plantillas de Reparto Mensual"}</h3>
            <p class="modal-subtitle">Define las reglas automáticas de reparto para tu nómina y la de tu pareja entre diferentes bancos y sobres</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-gestor">&times;</button>
        </div>

        <div class="gestor-plantillas-body">
          ${
            !editando
              ? `
            <!-- LISTADO DE PLANTILLAS EXISTENTES -->
            <div class="gestor-seccion">
              <div class="gestor-header-row">
                <h4 class="gestor-section-title">Plantillas Guardadas (${plantillas.length})</h4>
                <button type="button" class="btn-primary mini" id="btn-nueva-plantilla">+ Nueva Plantilla</button>
              </div>

              <div class="plantillas-cards-list">
                ${
                  plantillas.length === 0
                    ? `<div class="empty-state mini"><p>Aún no has creado ninguna plantilla de nómina.</p></div>`
                    : plantillas
                        .map(
                          (p) => `
                    <div class="card-plantilla-row">
                      <div class="cpr-info">
                        <div class="cpr-title-row">
                          <strong class="cpr-name">${esc(p.nombre)}</strong>
                          <span class="badge-subtle badge-multi-banco" style="color: #4f46e5; background: #eef2ff; font-weight: 600;">
                            🏛️ ${esc(
                              Array.from(
                                new Set(
                                  [p.cuenta_nombre]
                                    .concat((p.lineas || []).map((l) => l.cuenta_nombre))
                                    .filter(Boolean)
                                )
                              ).join(" + ") || p.cuenta_nombre || "Banco"
                            )}
                          </span>
                          ${p.dia_mes ? `<span class="badge-subtle">Día ${p.dia_mes}</span>` : ""}
                        </div>
                        <div class="cpr-sub">
                          Importe habitual: <strong>${p.importe_estimado} €</strong> &bull; ${p.lineas.length} líneas de reparto
                        </div>
                        <div class="cpr-desglose-lineas" style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
                          ${(p.lineas || [])
                            .map(
                              (l) => `
                            <span style="font-size: 0.73rem; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 2px 6px; color: var(--text-main);">
                              ${l.importe}€ ➔ <strong>${esc(l.cuenta_nombre || p.cuenta_nombre || "Banco")}</strong> ${l.bote_nombre ? `(📦 ${esc(l.bote_nombre)})` : ""}
                            </span>
                          `
                            )
                            .join("")}
                        </div>
                      </div>
                      <div class="cpr-actions">
                        <button type="button" class="btn-secondary mini btn-editar-p" data-id="${p.id}">Editar</button>
                        <button type="button" class="btn-secondary mini danger btn-borrar-p" data-id="${p.id}">Eliminar</button>
                      </div>
                    </div>
                  `
                        )
                        .join("")
                }
              </div>
            </div>
            `
              : ""
          }

          <!-- FORMULARIO DE EDICIÓN O CREACIÓN -->
          <div class="gestor-seccion form-plantilla-wrap" style="${!editando && plantillas.length > 0 ? "display: none;" : ""}" id="wrap-form-plantilla">
            <h4 class="gestor-section-title" id="titulo-form-plantilla">
              ${editando ? `Editar: ${esc(editando.nombre)}` : "Crear Nueva Plantilla de Nómina"}
            </h4>

            <form id="form-guardar-plantilla" class="modal-form">
              <input type="hidden" id="gp-id" value="${editando ? editando.id : ""}">

              <div class="modal-grid-fields">
                <div class="modal-field modal-span-2">
                  <label for="gp-nombre" class="form-label">Nombre de la Plantilla</label>
                  <input id="gp-nombre" name="nombre" value="${editando ? esc(editando.nombre) : ""}" placeholder="Ej. Mi Nómina, Nómina Mujer, Ingreso mensual..." required>
                </div>

                <div class="modal-field">
                  <label for="gp-cuenta" class="form-label">🏛️ Banco principal de cobro (por defecto)</label>
                  <select id="gp-cuenta" name="cuenta_id" required>
                    ${cuentasParaReparto
                      .map(
                        (c) => `
                      <option value="${c.id}" ${editando && editando.cuenta_id === c.id ? "selected" : ""}>
                        🏛️ ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""}
                      </option>
                    `
                      )
                      .join("")}
                  </select>
                  <p style="font-size: 0.74rem; color: var(--text-muted); margin: 3px 0 0;">
                    Cuenta donde tu empresa te paga. Se usará si una línea no indica otro banco.
                  </p>
                </div>

                <div class="modal-field">
                  <label for="gp-dia" class="form-label">Día habitual del mes (1 - 31)</label>
                  <input id="gp-dia" name="dia_mes" type="number" min="1" max="31" value="${editando?.dia_mes || 28}" placeholder="Ej. 28">
                  <p style="font-size: 0.74rem; color: var(--text-muted); margin: 3px 0 0;">
                    Día aproximado en que cobras cada mes.
                  </p>
                </div>
              </div>

              <!-- LÍNEAS DE REPARTO MULTI-BANCO Y SOBRES -->
              <div class="reparto-config-box">
                <div class="reparto-box-header">
                  <div>
                    <span class="reparto-title">💰 Reparto a Diferentes Bancos y Sobres</span>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 0;">
                      Elige en cada fila el <strong>Banco Destino</strong> y opcionalmente el <strong>Sobre</strong> donde repartir el dinero
                    </p>
                  </div>
                  <button type="button" class="btn-primary mini" id="btn-add-linea-config">+ Añadir Fila (Banco / Sobre)</button>
                </div>

                <div class="callout-multi-banco" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; font-size: 0.82rem; color: #166534; display: flex; align-items: flex-start; gap: 0.5rem;">
                  <span style="font-size: 1.1rem; line-height: 1;">💡</span>
                  <div>
                    <strong>Libertad Multi-Banco:</strong> Puedes destinar cada parte del sueldo a un banco distinto (ej. Caixa, BBVA, Revolut...) y guardarlo en un sobre o dejarlo como saldo libre en la cuenta.
                  </div>
                </div>

                <div class="fcr-table-header">
                  <span class="fcr-th fcr-th-cuenta">🏛️ Banco Destino</span>
                  <span class="fcr-th fcr-th-bote">📦 Sobre / Bote</span>
                  <span class="fcr-th fcr-th-concepto">Concepto</span>
                  <span class="fcr-th fcr-th-importe">Importe (€)</span>
                  <span class="fcr-th fcr-th-action"></span>
                </div>

                <div id="lineas-config-container" class="lineas-config-container">
                  <!-- Se insertan filas -->
                </div>
              </div>

              <div id="gestor-err-box" class="modal-error-box" style="display: none;"></div>

              <div class="modal-footer">
                ${
                  editando || plantillas.length > 0
                    ? `<button type="button" class="btn-secondary" id="btn-cancelar-edicion">Volver a la lista</button>`
                    : ""
                }
                <button type="submit" class="btn-primary ok" id="btn-submit-plantilla">
                  Guardar Plantilla
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-gestor").addEventListener("click", cerrarModalActivo);

    // Líneas dinámicas del formulario de configuración
    const containerConfig = overlay.querySelector("#lineas-config-container");
    const btnAddLinea = overlay.querySelector("#btn-add-linea-config");

    function agregarFilaConfig(boteId = "", cuentaId = "", concepto = "", importeVal = "0.00") {
      const fila = document.createElement("div");
      fila.className = "fila-config-reparto";
      fila.innerHTML = `
        <div class="fcr-col fcr-cuenta">
          <label class="fcr-mobile-label">🏛️ Banco Destino</label>
          <select class="fcr-select-cuenta">
            <option value="">— Banco principal de cobro —</option>
            ${cuentasParaReparto
              .map(
                (c) => `
              <option value="${c.id}" ${String(c.id) === String(cuentaId) ? "selected" : ""}>
                🏛️ ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""}
              </option>
            `
              )
              .join("")}
          </select>
        </div>
        <div class="fcr-col fcr-bote">
          <label class="fcr-mobile-label">📦 Sobre / Bote</label>
          <select class="fcr-select-bote">
            <option value="">— Sin sobre (Libre en cuenta) —</option>
            ${botes
              .map(
                (b) => `
              <option value="${b.id}" ${String(b.id) === String(boteId) ? "selected" : ""}>
                📦 ${esc(b.nombre)}
              </option>
            `
              )
              .join("")}
          </select>
        </div>
        <div class="fcr-col fcr-concepto">
          <label class="fcr-mobile-label">Concepto</label>
          <input type="text" class="fcr-input-concepto" placeholder="Ej. Ocio, Gastos mes, Ahorro..." value="${esc(concepto)}">
        </div>
        <div class="fcr-col fcr-importe">
          <label class="fcr-mobile-label">Importe</label>
          <div style="display: flex; align-items: center; gap: 4px;">
            <input type="number" step="0.01" class="fcr-input-importe" placeholder="0.00" value="${importeVal}">
            <span>€</span>
          </div>
        </div>
        <button type="button" class="btn-icon danger fcr-btn-delete" title="Eliminar fila">&times;</button>
      `;

      fila.querySelector(".fcr-btn-delete").addEventListener("click", () => fila.remove());
      // Auto-rellenar concepto al elegir bote si estaba vacío
      fila.querySelector(".fcr-select-bote").addEventListener("change", (e) => {
        const inpConc = fila.querySelector(".fcr-input-concepto");
        if (!inpConc.value.trim() && e.target.value) {
          const bSel = botes.find((b) => String(b.id) === e.target.value);
          if (bSel) inpConc.value = bSel.nombre;
        }
      });

      containerConfig.appendChild(fila);
    }

    if (btnAddLinea) {
      btnAddLinea.addEventListener("click", () => agregarFilaConfig());
    }

    // Inicializar líneas si estamos editando
    if (editando && editando.lineas && editando.lineas.length > 0) {
      editando.lineas.forEach((l) => {
        agregarFilaConfig(l.bote_id, l.cuenta_id, l.concepto, l.importe);
      });
    } else {
      // Filas iniciales sugeridas para nómina
      const boteMes = botes.find((b) => b.nombre.toLowerCase().includes("mes"));
      const boteOcio = botes.find((b) => b.nombre.toLowerCase().includes("ocio"));
      const boteHipoteca = botes.find((b) => b.nombre.toLowerCase().includes("hipoteca"));

      if (boteMes) agregarFilaConfig(boteMes.id, "", "Dinero del mes", "400.00");
      if (boteOcio) agregarFilaConfig(boteOcio.id, "", "Bote ocio", "200.00");
      if (boteHipoteca) agregarFilaConfig(boteHipoteca.id, "", "Amortización hipoteca", "600.00");
      agregarFilaConfig("", "", "Remanente en cuenta", "800.00");
    }

    // Botones de la lista: Editar y Eliminar
    overlay.querySelectorAll(".btn-editar-p").forEach((b) => {
      b.addEventListener("click", () => {
        cerrarModalActivo();
        abrirModalPlantillasNomina(Number(b.dataset.id));
      });
    });

    overlay.querySelectorAll(".btn-borrar-p").forEach((b) => {
      b.addEventListener("click", async () => {
        if (confirm("¿Seguro que quieres eliminar esta plantilla de nómina?")) {
          try {
            await API.del(`/plantillas-reparto/${b.dataset.id}`);
            cerrarModalActivo();
            abrirModalPlantillasNomina();
          } catch (err) {
            alert(err.message || "Error al eliminar plantilla");
          }
        }
      });
    });

    const btnNueva = overlay.querySelector("#btn-nueva-plantilla");
    const wrapForm = overlay.querySelector("#wrap-form-plantilla");
    if (btnNueva && wrapForm) {
      btnNueva.addEventListener("click", () => {
        wrapForm.style.display = "block";
        wrapForm.scrollIntoView({ behavior: "smooth" });
      });
    }

    const btnCancelarEd = overlay.querySelector("#btn-cancelar-edicion");
    if (btnCancelarEd) {
      btnCancelarEd.addEventListener("click", () => {
        cerrarModalActivo();
        abrirModalPlantillasNomina();
      });
    }

    // Submit Guardar Plantilla (Crear o Actualizar)
    const formGuardar = overlay.querySelector("#form-guardar-plantilla");
    if (formGuardar) {
      formGuardar.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBox = overlay.querySelector("#gestor-err-box");
        const btnSub = overlay.querySelector("#btn-submit-plantilla");
        errBox.style.display = "none";
        btnSub.disabled = true;
        btnSub.textContent = "Guardando...";

        const idExistente = overlay.querySelector("#gp-id").value;
        const nombre = overlay.querySelector("#gp-nombre").value.trim();
        const cuentaId = overlay.querySelector("#gp-cuenta").value;
        const diaMes = overlay.querySelector("#gp-dia").value;

        // Recoger líneas
        const lineas = [];
        let totalEstimado = 0;
        containerConfig.querySelectorAll(".fila-config-reparto").forEach((fila) => {
          const boteId = fila.querySelector(".fcr-select-bote").value;
          const cuentaLineaId = fila.querySelector(".fcr-select-cuenta")?.value || "";
          const concepto = fila.querySelector(".fcr-input-concepto").value.trim();
          const importeStr = fila.querySelector(".fcr-input-importe").value.trim();
          const num = parseFloat(importeStr) || 0;
          totalEstimado += num;

          lineas.push({
            bote_id: boteId ? Number(boteId) : null,
            cuenta_id: cuentaLineaId ? Number(cuentaLineaId) : null,
            concepto: concepto || "Reparto",
            importe: importeStr || "0.00",
          });
        });

        const payload = {
          nombre: nombre,
          cuenta_id: Number(cuentaId),
          importe_estimado: totalEstimado.toFixed(2),
          dia_mes: diaMes ? Number(diaMes) : null,
          lineas: lineas,
        };

        try {
          if (idExistente) {
            await API.put(`/plantillas-reparto/${idExistente}`, payload);
          } else {
            await API.post("/plantillas-reparto", payload);
          }
          cerrarModalActivo();
          // Abrir modal de ingreso en pestaña de nómina para que la vean lista
          abrirModalIngreso("nomina");
        } catch (err) {
          btnSub.disabled = false;
          btnSub.textContent = "Guardar Plantilla";
          errBox.textContent = err.message || "Error al guardar la plantilla";
          errBox.style.display = "block";
        }
      });
    }
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Error</h3>
          <button type="button" class="modal-btn-close" onclick="document.getElementById('fintech-modal-overlay')?.remove()">&times;</button>
        </div>
        <p style="color: var(--accent-negative); padding: 1rem;">No se pudieron cargar los datos: ${err.message}</p>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// 4. MODAL DESGLOSE DEL CUADRE / CONCILIACIÓN
// --------------------------------------------------------------------------
export async function abrirModalDesgloseCuadre() {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Calculando balance de cuadre...</div>
    </div>
  `;

  try {
    const conc = await API.get("/conciliacion");
    const difStr = conc.diferencia_formula !== undefined ? conc.diferencia_formula : (conc.diferencia || "0.00");
    const difNum = Number(difStr);
    const esCuadrado = conc.estado_formula
      ? conc.estado_formula === "cuadrado"
      : (conc.estado === "cuadrado" || Math.abs(difNum) <= 0.05);

    overlay.innerHTML = `
      <div class="modal-card modal-card-wide">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-badge ${esCuadrado ? "ok" : "alerta"}">
              ${esCuadrado ? "CONTABILIDAD AL DÍA" : "DESCUADRE DETECTADO"}
            </span>
            <h3 class="modal-title">¿Por qué hay Diferencia en la Contabilidad?</h3>
            <p class="modal-subtitle">
              Comparativa entre el dinero real que tienes en el banco y el dinero asignado en tus botes y previsión.
            </p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-cuadre">&times;</button>
        </div>

        <div class="modal-body" style="padding: 1.25rem 1.75rem;">
          <!-- Resumen principal de la diferencia -->
          <div style="background: ${esCuadrado ? "var(--surface-elevated)" : "rgba(239, 68, 68, 0.08)"}; border: 1px solid ${esCuadrado ? "var(--border-subtle)" : "rgba(239, 68, 68, 0.3)"}; border-radius: var(--radius-md); padding: 1.15rem 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block;">
                Diferencia Actual
              </span>
              <strong style="font-size: 1.65rem;" class="${esCuadrado ? "positivo" : "negativo"}">
                ${importe(difStr, esCuadrado ? "" : "negativo")}
              </strong>
            </div>
            <div style="max-width: 420px; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.4;">
              ${
                esCuadrado
                  ? "🎉 <strong>Perfecto:</strong> Todo el dinero físico y bancario coincide con la suma de tus botes, sobres y previsiones."
                  : `⚠️ <strong>Desfase de ${importe(difStr, "negativo")}:</strong> Tus cuentas bancarias no coinciden con la suma de tus botes y recibos de previsión.`
              }
            </div>
          </div>

          <!-- Desglose de los Dos Grupos -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
            <!-- GRUPO 1: Dinero que debería tener -->
            <div style="background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
                <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--fg); margin: 0;">
                  🟢 1. Lo que Debería Tener
                </h4>
                <strong style="color: #10b981; font-size: 1.05rem;">
                  ${importe(conc.total_teorico_formula)}
                </strong>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.55rem; font-size: 0.86rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span>📦 Botes de ahorro y gastos</span>
                  <strong>${importe(conc.botes_generales_formula || conc.total_botes_formula)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>🏠 Guardado Hipoteca</span>
                  <strong>${importe(conc.guardado_hipoteca_formula || "0.00")}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>💳 Tarjetas (pendiente pagar)</span>
                  <strong>${importe(conc.total_tarjetas_formula || "0.00")}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>📅 Saldo previsión anual</span>
                  <strong class="${Number(conc.total_prevision_formula) < 0 ? 'negativo' : ''}">${importe(conc.total_prevision_formula)}</strong>
                </div>
              </div>
            </div>

            <!-- GRUPO 2: Lo que tengo real -->
            <div style="background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
                <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--fg); margin: 0;">
                  🔵 2. Lo que Tengo Real
                </h4>
                <strong style="color: #3b82f6; font-size: 1.05rem;">
                  ${importe(conc.total_real_formula || conc.total_cuentas_formula)}
                </strong>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.55rem; font-size: 0.86rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span>🏛️ Bancos y Efectivo</span>
                  <strong>${importe(conc.total_bancos_formula || conc.total_cuentas_formula)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>🤝 Me deben</span>
                  <strong>${importe(conc.total_me_deben_formula)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>🚗 Préstamos (asumidos)</span>
                  <strong>${importe(conc.total_prestamos_formula)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>📈 Inversiones (eToro / CRO)</span>
                  <strong>${importe(conc.total_inversiones_formula)}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Explicación de por qué sale esta cifra concreta -->
          <div style="background: var(--surface-card); border-left: 3px solid #6366f1; border-radius: var(--radius-sm); padding: 0.85rem 1.15rem; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.5rem;">
            💡 <strong>Ecuación de cuadre del hogar:</strong> <em>(Botes + Guardado Hipoteca + Tarjetas + Previsión) − (Bancos + Me deben + Préstamos + Inversiones) = 0 €</em>.<br>
            Tus fondos asignados tienen su respaldo íntegro en dinero líquido, inversiones, adelantos pendientes y préstamos asumidos.
          </div>

          <div class="modal-footer" style="padding: 0; display: flex; justify-content: flex-end; gap: 0.75rem;">
            <a href="/copia-seguridad" class="btn-secondary" onclick="document.getElementById('fintech-modal-overlay')?.remove()">
              Restaurar Copia de Seguridad
            </a>
            <a href="/prevision-gastos" class="btn-secondary" onclick="document.getElementById('fintech-modal-overlay')?.remove()">
              Ajustar Previsión de Gastos
            </a>
            <button type="button" class="btn-primary" id="btn-entendido-cuadre">
              Entendido
            </button>
          </div>
        </div>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-cuadre").addEventListener("click", cerrarModalActivo);
    overlay.querySelector("#btn-entendido-cuadre").addEventListener("click", cerrarModalActivo);
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Error</h3>
          <button type="button" class="modal-btn-close" onclick="document.getElementById('fintech-modal-overlay')?.remove()">&times;</button>
        </div>
        <p style="color: var(--accent-negative); padding: 1rem;">No se pudo calcular la conciliación: ${err.message}</p>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// 5. MODAL LIQUIDAR RECIBO DE TARJETA EN BANCO
// --------------------------------------------------------------------------
export async function abrirModalLiquidarTarjeta(tarjetaIdPorDefecto = null) {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando cuentas para liquidación...</div>
    </div>
  `;

  try {
    const dataCuentas = await API.get("/cuentas");
    const items = dataCuentas.items || [];

    // Tarjetas bancarias (excluyendo regalo)
    const tarjetas = items.filter(
      (c) =>
        (c.tipo === "tarjeta" || (c.nombre || "").toUpperCase().startsWith("TARJETA")) &&
        !c.entidad?.toLowerCase().includes("regalo") &&
        !c.nombre?.toLowerCase().includes("regalo")
    );

    // Cuentas de cargo (bancos o efectivo)
    const cuentasBanco = items.filter(
      (c) => c.tipo === "banco" || c.tipo === "efectivo"
    );

    if (tarjetas.length === 0) {
      overlay.innerHTML = `
        <div class="modal-card">
          <div class="modal-header">
            <h3>Liquidar Recibo de Tarjeta</h3>
            <button type="button" class="modal-btn-close" id="btn-cerrar-liq">&times;</button>
          </div>
          <p style="padding: 1.5rem; color: var(--text-secondary);">No tienes tarjetas bancarias registradas.</p>
        </div>
      `;
      overlay.querySelector("#btn-cerrar-liq")?.addEventListener("click", cerrarModalActivo);
      return;
    }

    let tarjetaSel = tarjetas.find((t) => t.id === Number(tarjetaIdPorDefecto)) || tarjetas[0];

    function generarHtmlForm(tarjetaActual) {
      const saldoAbs = Math.abs(Number(tarjetaActual.saldo || 0)).toFixed(2);
      const opcionesTarjetas = tarjetas
        .map(
          (t) =>
            `<option value="${t.id}" ${t.id === tarjetaActual.id ? "selected" : ""}>${esc(t.nombre)} (Gastado: ${importe(t.saldo)})</option>`
        )
        .join("");

      const opcionesBancos = cuentasBanco
        .map(
          (b) =>
            `<option value="${b.id}">${esc(b.nombre)} (${esc(b.entidad || "Banco")}) — Saldo: ${importe(b.saldo)}</option>`
        )
        .join("");

      return `
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <span class="modal-badge ok">💳 LIQUIDACIÓN BANCARIA</span>
              <h3 class="modal-title">Liquidar Recibo de ${esc(tarjetaActual.nombre)}</h3>
              <p class="modal-subtitle">
                Abona la deuda acumulada de la tarjeta descontando el cargo de tu cuenta bancaria.
              </p>
            </div>
            <button type="button" class="modal-btn-close" id="btn-cerrar-liq">&times;</button>
          </div>

          <form id="form-liquidar-tarjeta" class="fintech-form" style="padding: 1.25rem 1.75rem;">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" for="liq-tarjeta-id">Tarjeta a liquidar</label>
              <select id="liq-tarjeta-id" name="tarjeta_id" required>
                ${opcionesTarjetas}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" for="liq-cuenta-origen">Cuenta bancaria de cobro (de donde sale el dinero)</label>
              <select id="liq-cuenta-origen" name="cuenta_origen_id" required>
                ${opcionesBancos}
              </select>
            </div>

            <div class="form-row-grid" style="margin-bottom: 1rem;">
              <div class="form-group form-span-2">
                <label class="form-label" for="liq-importe">Importe exacto a liquidar (€)</label>
                <input id="liq-importe" name="importe" type="text" inputmode="decimal" value="${saldoAbs}" required>
                <small style="color: var(--text-muted); font-size: 0.78rem; margin-top: 0.25rem; display: block;">
                  💡 Modifica este importe si tu banco te cobra una cantidad distinta (compras después de corte que quedan para el mes que viene).
                </small>
              </div>

              <div class="form-group form-span-2">
                <label class="form-label" for="liq-fecha">Fecha del cargo bancario</label>
                <input id="liq-fecha" name="fecha" type="date" value="${hoy()}" required>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" for="liq-concepto">Concepto en extracto bancario</label>
              <input id="liq-concepto" name="concepto" type="text" value="Liquidación recibo ${esc(tarjetaActual.nombre)}">
            </div>

            <div style="background: rgba(99, 102, 241, 0.08); border-left: 3px solid #6366f1; border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.84rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 1.25rem;">
              💡 <strong>Sin doble gasto:</strong> Los gastos individuales ya se descontaron de sus sobres al hacer las compras diarias. Esta liquidación solo traslada los fondos del banco a la tarjeta para saldar la deuda.
            </div>

            <div id="liq-err" style="color: var(--accent-negative); font-size: 0.85rem; margin-bottom: 1rem; display: none;"></div>

            <div class="modal-footer" style="padding: 0; display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" class="btn-secondary" id="btn-cancelar-liq">Cancelar</button>
              <button type="submit" class="btn-primary" id="btn-submit-liq">
                💳 Confirmar Pago del Recibo
              </button>
            </div>
          </form>
        </div>
      `;
    }

    function renderizarForm() {
      overlay.innerHTML = generarHtmlForm(tarjetaSel);

      overlay.querySelector("#btn-cerrar-liq")?.addEventListener("click", cerrarModalActivo);
      overlay.querySelector("#btn-cancelar-liq")?.addEventListener("click", cerrarModalActivo);

      const selTarjeta = overlay.querySelector("#liq-tarjeta-id");
      selTarjeta?.addEventListener("change", (e) => {
        const id = Number(e.target.value);
        tarjetaSel = tarjetas.find((t) => t.id === id) || tarjetaSel;
        renderizarForm();
      });

      const form = overlay.querySelector("#form-liquidar-tarjeta");
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBox = overlay.querySelector("#liq-err");
        const btnSub = overlay.querySelector("#btn-submit-liq");
        errBox.style.display = "none";
        btnSub.disabled = true;
        btnSub.textContent = "Procesando liquidación...";

        const formData = new FormData(form);
        const tarjetaId = Number(formData.get("tarjeta_id"));
        const payload = {
          cuenta_origen_id: Number(formData.get("cuenta_origen_id")),
          importe: formData.get("importe"),
          fecha: formData.get("fecha"),
          concepto: formData.get("concepto"),
        };

        try {
          await API.post(`/cuentas/${tarjetaId}/liquidar`, payload);
          cerrarModalActivo();
          window.dispatchEvent(new CustomEvent("hashchange"));
        } catch (err) {
          btnSub.disabled = false;
          btnSub.textContent = "💳 Confirmar Pago del Recibo";
          errBox.textContent = err.message || "Error al procesar la liquidación.";
          errBox.style.display = "block";
        }
      });
    }

    renderizarForm();
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Error</h3>
          <button type="button" class="modal-btn-close" onclick="document.getElementById('fintech-modal-overlay')?.remove()">&times;</button>
        </div>
        <p style="color: var(--accent-negative); padding: 1rem;">No se pudieron cargar las tarjetas: ${err.message}</p>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// 6. MODAL EDITAR MOVIMIENTO SEGURO
// --------------------------------------------------------------------------
export async function abrirModalEditarMovimiento(movimientoId) {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando datos del movimiento...</div>
    </div>
  `;

  try {
    const [mov, resCuentas, resBotes, resCats] = await Promise.all([
      API.get(`/movimientos/${movimientoId}`),
      API.get("/cuentas"),
      API.get("/botes"),
      API.get("/categorias"),
    ]);

    const cuentas = resCuentas.items || [];
    const botes = resBotes.items || [];
    const cats = resCats.items || [];
    const numVal = Number(mov.importe || 0);
    const esGasto = numVal < 0;
    const absVal = Math.abs(numVal).toFixed(2);

    overlay.innerHTML = `
      <div class="modal-card modal-card-form">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-badge-action neutral">MODIFICAR MOVIMIENTO</span>
            <h3 class="modal-title">Editar Operación</h3>
            <p class="modal-subtitle">Modifica de forma deliberada el importe, la cuenta, el sobre de ahorro o la categoría</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal">&times;</button>
        </div>

        <form id="form-editar-movimiento" class="modal-form">
          <div class="modal-amount-hero">
            <span class="modal-amount-currency">€</span>
            <input type="number" step="0.01" min="0.01" class="modal-amount-input ${esGasto ? 'text-neg' : 'text-pos'}" id="edit-mov-importe" value="${absVal}" required>
          </div>

          <!-- Selector de Signo (Gasto / Ingreso) -->
          <div class="segmented-control pill-control" style="margin-bottom: 1.25rem;">
            <button type="button" class="segmented-control-btn btn-tipo-signo ${esGasto ? 'activo' : ''}" data-signo="-">
              − Gasto
            </button>
            <button type="button" class="segmented-control-btn btn-tipo-signo ${!esGasto ? 'activo' : ''}" data-signo="+">
              + Ingreso
            </button>
          </div>

          <div class="modal-grid-fields">
            <div class="modal-field modal-span-2">
              <label for="edit-mov-concepto" class="form-label">Concepto / Descripción *</label>
              <input type="text" id="edit-mov-concepto" value="${esc(mov.descripcion || '')}" placeholder="Ej. Compra supermercado, Nómina, Recibo..." required>
            </div>

            <div class="modal-field">
              <label for="edit-mov-cuenta" class="form-label">🏛️ Cuenta bancaria *</label>
              <select id="edit-mov-cuenta" required>
                ${cuentas.map(c => `<option value="${c.id}" ${c.id === mov.cuenta_id ? 'selected' : ''}>🏛️ ${esc(c.nombre)} (${esc(c.entidad || c.tipo)})</option>`).join("")}
              </select>
            </div>

            <div class="modal-field">
              <label for="edit-mov-fecha" class="form-label">📅 Fecha de operación *</label>
              <input type="date" id="edit-mov-fecha" value="${mov.fecha}" required>
            </div>

            <div class="modal-field">
              <label for="edit-mov-bote" class="form-label">📦 Sobre o bote</label>
              <select id="edit-mov-bote">
                <option value="">— Sin sobre asignado (Libre en cuenta) —</option>
                ${botes.map(b => `<option value="${b.id}" ${b.id === mov.bote_id ? 'selected' : ''}>📦 ${esc(b.nombre)}</option>`).join("")}
              </select>
            </div>

            <div class="modal-field">
              <label for="edit-mov-categoria" class="form-label">🏷️ Categoría contable</label>
              <select id="edit-mov-categoria">
                <option value="">— Sin categoría —</option>
                ${cats.map(c => `<option value="${c.id}" ${c.id === mov.categoria_id ? 'selected' : ''}>🏷️ ${esc(c.nombre)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div id="edit-mov-err" class="modal-error-box" style="display: none;"></div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="btn-cancelar-edit">Cancelar</button>
            <button type="submit" class="btn-primary ok" id="btn-guardar-edit">Guardar Cambios</button>
          </div>
        </form>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
    overlay.querySelector("#btn-cancelar-edit").addEventListener("click", cerrarModalActivo);

    let signoActual = esGasto ? "-" : "+";
    const btnsSigno = overlay.querySelectorAll(".btn-tipo-signo");
    const inputImp = overlay.querySelector("#edit-mov-importe");
    btnsSigno.forEach(btn => {
      btn.addEventListener("click", () => {
        btnsSigno.forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");
        signoActual = btn.dataset.signo;
        if (signoActual === "-") {
          inputImp.classList.add("text-neg");
          inputImp.classList.remove("text-pos");
        } else {
          inputImp.classList.add("text-pos");
          inputImp.classList.remove("text-neg");
        }
      });
    });

    const form = overlay.querySelector("#form-editar-movimiento");
    const errBox = overlay.querySelector("#edit-mov-err");
    const btnSubmit = overlay.querySelector("#btn-guardar-edit");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errBox.style.display = "none";
      btnSubmit.disabled = true;

      try {
        const rawImp = parseFloat(inputImp.value || "0");
        if (isNaN(rawImp) || rawImp <= 0) {
          throw new Error("El importe debe ser mayor a 0 €.");
        }
        const importeFinal = (signoActual === "-" ? -rawImp : rawImp).toFixed(2);
        const descripcion = overlay.querySelector("#edit-mov-concepto").value.trim();
        const cuenta_id = Number(overlay.querySelector("#edit-mov-cuenta").value);
        const fecha = overlay.querySelector("#edit-mov-fecha").value;
        const boteVal = overlay.querySelector("#edit-mov-bote").value;
        const bote_id = boteVal === "" ? null : Number(boteVal);
        const catVal = overlay.querySelector("#edit-mov-categoria").value;
        const categoria_id = catVal === "" ? null : Number(catVal);

        // 1. Patch datos generales
        await API.patch(`/movimientos/${mov.id}`, {
          descripcion,
          fecha,
          importe: importeFinal,
          cuenta_id,
          categoria_id,
        });

        // 2. Patch bote si ha cambiado
        if (bote_id !== mov.bote_id) {
          await API.patch(`/movimientos/${mov.id}/bote`, { bote_id });
        }

        cerrarModalActivo();
        if (window.navegar) await window.navegar();
      } catch (err) {
        errBox.textContent = err.message || "Error al actualizar el movimiento";
        errBox.style.display = "block";
        btnSubmit.disabled = false;
      }
    });
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Error</h3>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal">&times;</button>
        </div>
        <div class="modal-body"><p>${esc(err.message)}</p></div>
      </div>
    `;
    overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
  }
}

// --------------------------------------------------------------------------
// 10. MODAL PAPELERA DE SEGURIDAD (Restaurar movimientos eliminados)
// --------------------------------------------------------------------------
export async function abrirModalPapelera() {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card modal-lg">
      <div class="modal-loading">Cargando papelera de seguridad...</div>
    </div>
  `;

  try {
    const res = await API.get("/movimientos/eliminados?limit=50");
    const eliminados = res.items || [];

    function renderLista() {
      if (eliminados.length === 0) {
        return `
          <div class="tarjeta-vacia" style="padding: 2.5rem 1rem;">
            <div class="tarjeta-vacia-icon">🗑️</div>
            <h4>La papelera está vacía</h4>
            <p style="color: var(--fg-2); font-size: 0.9rem;">No hay ningún movimiento eliminado recientemente.</p>
          </div>
        `;
      }

      return `
        <div style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 60vh; overflow-y: auto; padding-right: 0.25rem;">
          ${eliminados
            .map((m) => {
              const num = Number(m.importe || 0);
              const esGasto = num < 0;
              const absNum = Math.abs(num).toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

              return `
              <div class="glass-card" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-radius: var(--radius-md); gap: 0.75rem;">
                <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="font-weight: 600; font-size: 0.92rem; color: var(--fg);">${esc(m.descripcion || "Operación")}</span>
                    <span class="badge ${esGasto ? "negativo" : "positivo"}" style="font-size: 0.82rem; font-weight: 700;">
                      ${esGasto ? "−" : "+"}${absNum}&nbsp;€
                    </span>
                  </div>
                  <div style="font-size: 0.8rem; color: var(--fg-2); margin-top: 0.2rem; display: flex; gap: 0.6rem; flex-wrap: wrap;">
                    <span>📅 ${m.fecha}</span>
                    <span>🏛️ Cuenta #${m.cuenta_id}</span>
                    ${m.bote_id ? `<span>📦 Sobre #${m.bote_id}</span>` : `<span>🏦 Sin sobre</span>`}
                  </div>
                </div>
                <button type="button" class="btn-primary mini" data-accion="restaurar-mov-id" data-id="${m.id}" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;">
                  ♻️ Restaurar
                </button>
              </div>
            `;
            })
            .join("\n")}
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="modal-card modal-lg">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">🗑️ Papelera de Seguridad</h3>
            <p class="modal-sub">Si eliminaste un movimiento por error o falta dinero en un bote, recupéralo aquí.</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-papelera">&times;</button>
        </div>
        <div class="modal-body" id="papelera-lista-container">
          ${renderLista()}
        </div>
        <div class="modal-actions" style="margin-top: 1rem; border-top: 1px solid var(--border-soft); padding-top: 0.8rem;">
          <button type="button" class="btn-secondary" id="btn-cerrar-papelera-pie">Cerrar</button>
        </div>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-papelera")?.addEventListener("click", cerrarModalActivo);
    overlay.querySelector("#btn-cerrar-papelera-pie")?.addEventListener("click", cerrarModalActivo);

    const container = overlay.querySelector("#papelera-lista-container");
    container?.addEventListener("click", async (e) => {
      const btnRestaurar = e.target.closest('[data-accion="restaurar-mov-id"]');
      if (!btnRestaurar) return;

      const id = Number(btnRestaurar.dataset.id);
      btnRestaurar.disabled = true;
      btnRestaurar.textContent = "Restaurando...";

      try {
        await API.post(`/movimientos/${id}/restaurar`);
        // Quitar de la lista local
        const idx = eliminados.findIndex((m) => m.id === id);
        if (idx !== -1) eliminados.splice(idx, 1);
        container.innerHTML = renderLista();
        if (window.navegar) await window.navegar();
      } catch (err) {
        alert(`No se pudo restaurar el movimiento: ${err.message}`);
        btnRestaurar.disabled = false;
        btnRestaurar.textContent = "♻️ Restaurar";
      }
    });
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Error</h3>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal">&times;</button>
        </div>
        <div class="modal-body"><p>${esc(err.message)}</p></div>
      </div>
    `;
    overlay.querySelector("#btn-cerrar-modal")?.addEventListener("click", cerrarModalActivo);
  }
}

// --------------------------------------------------------------------------
// 11. MODAL TRASPASO ENTRE CUENTAS (Mover dinero de efectivo a banco o entre cuentas)
// --------------------------------------------------------------------------
export async function abrirModalTraspaso(cuentaOrigenDefecto = null, cuentaDestinoDefecto = null) {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando cuentas para traspaso...</div>
    </div>
  `;

  try {
    const [resCuentas, resBotes] = await Promise.all([
      API.get("/cuentas"),
      API.get("/botes"),
    ]);

    const items = resCuentas.items || [];
    // Incluimos todas las cuentas activas (bancos, efectivo y tarjetas para recargas/traspasos)
    const cuentas = items;
    const botes = resBotes.items || [];

    if (cuentas.length < 2) {
      overlay.innerHTML = `
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title">Traspaso no disponible</h3>
            <button type="button" class="modal-btn-close" id="btn-cerrar-modal">&times;</button>
          </div>
          <div class="modal-body"><p>Necesitas al menos 2 cuentas para realizar traspasos entre ellas.</p></div>
        </div>
      `;
      overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
      return;
    }

    let cOrigenId = Number(cuentaOrigenDefecto);
    let cDestinoId = Number(cuentaDestinoDefecto);

    // Búsqueda inteligente de cuentas clave para recargas frecuentes
    const passCard = cuentas.find((c) => (c.nombre || "").toLowerCase().includes("pass"));
    const dbCard = cuentas.find((c) => (c.nombre || "").toLowerCase().includes("tarjeta") && ((c.nombre || "").toLowerCase().includes("deustche") || (c.nombre || "").toLowerCase().includes("deutsche") || (c.entidad || "").toLowerCase().includes("deutsche")));
    const revBank = cuentas.find((c) => (c.nombre || "").toLowerCase().includes("revolut"));
    const caiBank = cuentas.find((c) => (c.nombre || "").toLowerCase().includes("caixa") && c.tipo === "banco");

    if (!cOrigenId && !cDestinoId) {
      cOrigenId = passCard?.id || dbCard?.id || cuentas[0].id;
      cDestinoId = revBank?.id || caiBank?.id || (cuentas.find((c) => c.id !== cOrigenId)?.id || cuentas[1].id);
    } else if (cOrigenId && !cDestinoId) {
      cDestinoId = (revBank && revBank.id !== cOrigenId) ? revBank.id : ((caiBank && caiBank.id !== cOrigenId) ? caiBank.id : (cuentas.find((c) => c.id !== cOrigenId)?.id || cuentas[0].id));
    } else if (!cOrigenId && cDestinoId) {
      cOrigenId = (passCard && passCard.id !== cDestinoId) ? passCard.id : ((dbCard && dbCard.id !== cDestinoId) ? dbCard.id : (cuentas.find((c) => c.id !== cDestinoId)?.id || cuentas[0].id));
    }

    function renderOpcionesCuentas(idSeleccionada) {
      // 1. Tarjetas bancarias crédito / débito (las que usa habitualmente para recargar o pagar compras)
      const tarjetasCredito = cuentas.filter(
        (c) => c.tipo === "tarjeta" && !esTarjetaRegalo(c)
      );
      // 2. Cuentas bancarias y efectivo
      const cuentasBancarias = cuentas.filter(
        (c) => c.tipo === "banco" || c.tipo === "efectivo"
      );
      // 3. Tarjetas regalo y otros monederos
      const tarjetasRegalo = cuentas.filter(
        (c) => c.tipo === "tarjeta" && esTarjetaRegalo(c)
      );
      const otras = cuentas.filter(
        (c) => c.tipo !== "banco" && c.tipo !== "efectivo" && c.tipo !== "tarjeta"
      );

      let html = "";
      if (tarjetasCredito.length > 0) {
        html += `<optgroup label="💳 Tarjetas de Crédito / Débito (Carrefour Pass, DB...)">`;
        html += tarjetasCredito
          .map(
            (c) => `
          <option value="${c.id}" ${c.id === idSeleccionada ? "selected" : ""}>
            💳 ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""} — Saldo: ${c.saldo} €
          </option>`
          )
          .join("");
        html += `</optgroup>`;
      }
      if (cuentasBancarias.length > 0) {
        html += `<optgroup label="🏛️ Cuentas Bancarias y Efectivo">`;
        html += cuentasBancarias
          .map(
            (c) => `
          <option value="${c.id}" ${c.id === idSeleccionada ? "selected" : ""}>
            ${c.tipo === "efectivo" ? "💵" : "🏛️"} ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""} — Saldo: ${c.saldo} €
          </option>`
          )
          .join("");
        html += `</optgroup>`;
      }
      if (tarjetasRegalo.length > 0) {
        html += `<optgroup label="🎁 Tarjetas Regalo y Prepago">`;
        html += tarjetasRegalo
          .map(
            (c) => `
          <option value="${c.id}" ${c.id === idSeleccionada ? "selected" : ""}>
            🎁 ${esc(c.nombre)} — Saldo: ${c.saldo} €
          </option>`
          )
          .join("");
        html += `</optgroup>`;
      }
      if (otras.length > 0) {
        html += `<optgroup label="📦 Otras Cuentas">`;
        html += otras
          .map(
            (c) => `
          <option value="${c.id}" ${c.id === idSeleccionada ? "selected" : ""}>
            📦 ${esc(c.nombre)} — Saldo: ${c.saldo} €
          </option>`
          )
          .join("");
        html += `</optgroup>`;
      }
      return html;
    }

    overlay.innerHTML = `
      <div class="modal-card modal-traspaso">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action neutral">⇄ TRASPASO ENTRE CUENTAS</span>
            <h3 class="modal-title">Recargas y Traspasos</h3>
            <p class="modal-subtitle">Pasa fondos fácilmente entre tus cuentas y tarjetas (ej. Recargar Revolut desde Carrefour Pass o Tarjeta DB, traspaso de efectivo, etc.)</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal" aria-label="Cerrar">&times;</button>
        </div>

        <form id="form-modal-traspaso" class="modal-form">
          <!-- Atajos Rápidos de 1 Clic -->
          <div class="traspaso-chips-container" style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; margin-bottom: 0.85rem;">
            <span style="display: block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); margin-bottom: 0.45rem;">
              ⚡ Atajos frecuentes de recarga:
            </span>
            <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
              <button type="button" class="btn-chip-traspaso" data-origen="pass" data-destino="revolut" style="background: rgba(99, 102, 241, 0.14); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 20px; font-size: 0.77rem; font-weight: 600; padding: 0.3rem 0.75rem; color: var(--fg-1); cursor: pointer;">
                💳 Carrefour Pass ➔ 🏛️ Revolut
              </button>
              <button type="button" class="btn-chip-traspaso" data-origen="deutsche" data-destino="revolut" style="background: rgba(99, 102, 241, 0.14); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 20px; font-size: 0.77rem; font-weight: 600; padding: 0.3rem 0.75rem; color: var(--fg-1); cursor: pointer;">
                💳 Tarjeta DB ➔ 🏛️ Revolut
              </button>
              <button type="button" class="btn-chip-traspaso" data-origen="pass" data-destino="caixa" style="background: rgba(99, 102, 241, 0.08); border: 1px solid var(--border-glass); border-radius: 20px; font-size: 0.77rem; font-weight: 500; padding: 0.3rem 0.75rem; color: var(--fg-1); cursor: pointer;">
                💳 Carrefour Pass ➔ 🏛️ Caixa
              </button>
              <button type="button" class="btn-chip-traspaso" data-origen="deutsche" data-destino="caixa" style="background: rgba(99, 102, 241, 0.08); border: 1px solid var(--border-glass); border-radius: 20px; font-size: 0.77rem; font-weight: 500; padding: 0.3rem 0.75rem; color: var(--fg-1); cursor: pointer;">
                💳 Tarjeta DB ➔ 🏛️ Caixa
              </button>
            </div>
          </div>

          <div class="modal-importe-hero neutral">
            <label for="mt-importe" class="modal-importe-label">Importe a traspasar / recargar</label>
            <div class="modal-input-amount-wrap">
              <span class="modal-amount-symbol">€</span>
              <input id="mt-importe" name="importe" type="number" step="0.01" min="0.01" placeholder="0.00" required autofocus>
            </div>
          </div>

          <div class="modal-grid-fields">
            <div class="modal-field">
              <label for="mt-origen" class="form-label">Cuenta o tarjeta de origen (Sale) *</label>
              <select id="mt-origen" name="cuenta_origen_id" required>
                ${renderOpcionesCuentas(cOrigenId)}
              </select>
            </div>

            <div class="modal-field">
              <label for="mt-destino" class="form-label">Cuenta o tarjeta de destino (Entra) *</label>
              <select id="mt-destino" name="cuenta_destino_id" required>
                ${renderOpcionesCuentas(cDestinoId)}
              </select>
            </div>

            <div class="modal-field">
              <label for="mt-fecha" class="form-label">Fecha de operación *</label>
              <input id="mt-fecha" name="fecha" type="date" value="${hoy}" required>
            </div>

            <div class="modal-field">
              <label for="mt-bote" class="form-label">Sobre o bote asociado</label>
              <select id="mt-bote" name="bote_id">
                <option value="">— Ninguno (Libre en cuenta) —</option>
                ${botes
                  .map(
                    (b) => `
                  <option value="${b.id}">
                    📦 ${esc(b.nombre)}
                  </option>
                `
                  )
                  .join("")}
              </select>
            </div>

            <div class="modal-field modal-span-2">
              <label for="mt-concepto" class="form-label">Concepto o nota (Opcional)</label>
              <input id="mt-concepto" name="concepto" placeholder="Ej. Recarga Revolut con Carrefour Pass...">
            </div>
          </div>

          <div style="background: rgba(99, 102, 241, 0.08); border-left: 3px solid #6366f1; border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.82rem; color: var(--fg-2); line-height: 1.45;">
            💡 <strong>Sin descuadres:</strong> El dinero se traslada de una tarjeta/cuenta a otra en una sola operación atómica. Tu contabilidad y la conciliación del hogar permanecen siempre cuadradas al 100%.
          </div>

          <div id="modal-traspaso-err" class="modal-error-box" style="display: none;"></div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="btn-cancelar-modal">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-ejecutar-traspaso">
              ⇄ Realizar Traspaso / Recarga
            </button>
          </div>
        </form>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
    overlay.querySelector("#btn-cancelar-modal").addEventListener("click", cerrarModalActivo);

    // Eventos de atajos de 1 clic
    overlay.querySelectorAll(".btn-chip-traspaso").forEach((chip) => {
      chip.addEventListener("click", () => {
        const origKw = chip.dataset.origen;
        const destKw = chip.dataset.destino;
        const cOrig = cuentas.find((c) => (c.nombre || "").toLowerCase().includes(origKw));
        const cDest = cuentas.find((c) => (c.nombre || "").toLowerCase().includes(destKw));
        const selOrig = overlay.querySelector("#mt-origen");
        const selDest = overlay.querySelector("#mt-destino");
        if (cOrig && selOrig) selOrig.value = cOrig.id;
        if (cDest && selDest) selDest.value = cDest.id;
        overlay.querySelector("#mt-importe")?.focus();
      });
    });

    const form = overlay.querySelector("#form-modal-traspaso");
    const errBox = overlay.querySelector("#modal-traspaso-err");
    const btnSubmit = overlay.querySelector("#btn-ejecutar-traspaso");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errBox.style.display = "none";

      const origenId = Number(overlay.querySelector("#mt-origen").value);
      const destinoId = Number(overlay.querySelector("#mt-destino").value);
      const rawImp = parseFloat(overlay.querySelector("#mt-importe").value || "0");
      const fecha = overlay.querySelector("#mt-fecha").value;
      const boteVal = overlay.querySelector("#mt-bote").value;
      const boteId = boteVal ? Number(boteVal) : null;
      const concepto = overlay.querySelector("#mt-concepto").value.trim() || null;

      if (origenId === destinoId) {
        errBox.textContent = "La cuenta de origen y de destino no pueden ser la misma.";
        errBox.style.display = "block";
        return;
      }
      if (isNaN(rawImp) || rawImp <= 0) {
        errBox.textContent = "El importe debe ser estrictamente mayor a 0 €.";
        errBox.style.display = "block";
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Procesando...";

      try {
        await API.post("/cuentas/traspaso", {
          cuenta_origen_id: origenId,
          cuenta_destino_id: destinoId,
          importe: rawImp.toFixed(2),
          fecha: fecha,
          bote_id: boteId,
          concepto: concepto,
        });

        cerrarModalActivo();
        if (window.navegar) await window.navegar();
        else location.reload();
      } catch (err) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "⇄ Realizar Traspaso";
        errBox.textContent = err.message || "Error al realizar el traspaso";
        errBox.style.display = "block";
      }
    });
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Error</h3>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal">&times;</button>
        </div>
        <div class="modal-body"><p>${esc(err.message)}</p></div>
      </div>
    `;
    overlay.querySelector("#btn-cerrar-modal")?.addEventListener("click", cerrarModalActivo);
  }
}

// --------------------------------------------------------------------------
// 12. MODAL EDITAR BOTE / SOBRE
// --------------------------------------------------------------------------
export async function abrirModalEditarBote(boteId) {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando datos del sobre...</div>
    </div>
  `;

  try {
    const bote = await API.get(`/botes/${boteId}`);
    const catsBote = [
      { id: "ahorro", nombre: "🐷 Ahorro general" },
      { id: "vacaciones", nombre: "✈️ Vacaciones y viajes" },
      { id: "casa", nombre: "🏠 Casa y mantenimiento" },
      { id: "salud", nombre: "💊 Salud y bienestar" },
      { id: "ocio", nombre: "🎉 Ocio y entretenimiento" },
      { id: "vehiculo", nombre: "🚗 Coche y transporte" },
      { id: "impuestos", nombre: "🏛️ Impuestos e IRPF" },
      { id: "otros", nombre: "📦 Otros fines" },
    ];

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action neutral">✏️ EDITAR SOBRE</span>
            <h3 class="modal-title">Editar Sobre o Bote</h3>
            <p class="modal-subtitle">Cambia el nombre, la categoría o la meta de ahorro</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal" aria-label="Cerrar">&times;</button>
        </div>

        <form id="form-editar-bote" class="modal-form">
          <div class="modal-grid-fields">
            <div class="modal-field modal-span-2">
              <label for="eb-nombre" class="form-label">Nombre del sobre *</label>
              <input id="eb-nombre" name="nombre" value="${esc(bote.nombre || '')}" required>
            </div>

            <div class="modal-field">
              <label for="eb-cat" class="form-label">Categoría temática</label>
              <select id="eb-cat" name="categoria">
                ${catsBote
                  .map(
                    (c) => `<option value="${c.id}" ${bote.categoria === c.id ? "selected" : ""}>${c.nombre}</option>`
                  )
                  .join("")}
              </select>
            </div>

            <div class="modal-field">
              <label for="eb-objetivo" class="form-label">Meta de ahorro (€)</label>
              <input id="eb-objetivo" name="objetivo" type="number" step="0.01" min="0" placeholder="0.00" value="${bote.objetivo || ''}">
            </div>
          </div>

          <div id="eb-err" class="modal-error-box" style="display: none;"></div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="btn-cancelar-modal">Cancelar</button>
            <button type="submit" class="btn-primary ok" id="btn-guardar-bote">Guardar Cambios</button>
          </div>
        </form>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
    overlay.querySelector("#btn-cancelar-modal").addEventListener("click", cerrarModalActivo);

    const form = overlay.querySelector("#form-editar-bote");
    const errBox = overlay.querySelector("#eb-err");
    const btnSubmit = overlay.querySelector("#btn-guardar-bote");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errBox.style.display = "none";
      btnSubmit.disabled = true;

      const nombre = overlay.querySelector("#eb-nombre").value.trim();
      const categoria = overlay.querySelector("#eb-cat").value;
      const rawObj = overlay.querySelector("#eb-objetivo").value.trim();
      const objetivo = rawObj === "" ? null : parseFloat(rawObj).toFixed(2);

      try {
        await API.patch(`/botes/${bote.id}`, {
          nombre,
          categoria,
          objetivo,
        });

        cerrarModalActivo();
        if (window.navegar) await window.navegar();
        else location.reload();
      } catch (err) {
        btnSubmit.disabled = false;
        errBox.textContent = err.message || "Error al actualizar el sobre";
        errBox.style.display = "block";
      }
    });
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Error</h3>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal">&times;</button>
        </div>
        <div class="modal-body"><p>${esc(err.message)}</p></div>
      </div>
    `;
    overlay.querySelector("#btn-cerrar-modal")?.addEventListener("click", cerrarModalActivo);
  }
}

// --------------------------------------------------------------------------
// 13. MODAL EDITAR DEUDA / LO QUE ME DEBEN
// --------------------------------------------------------------------------
export async function abrirModalEditarDeuda(deudaId) {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando apunte...</div>
    </div>
  `;

  try {
    const data = await API.get("/deudas");
    const deudas = data.items || [];
    const deuda = deudas.find((d) => d.id === Number(deudaId));
    if (!deuda) throw new Error("Apunte de deuda no encontrado");

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action neutral">✏️ EDITAR APUNTE</span>
            <h3 class="modal-title">Editar Dinero que me Deben</h3>
            <p class="modal-subtitle">Modifica la persona, el concepto o el importe</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal" aria-label="Cerrar">&times;</button>
        </div>

        <form id="form-editar-deuda" class="modal-form">
          <div class="modal-grid-fields">
            <div class="modal-field">
              <label for="ed-deudor" class="form-label">¿Quién te lo debe? *</label>
              <input id="ed-deudor" name="deudor" value="${esc(deuda.deudor || '')}" required>
            </div>

            <div class="modal-field">
              <label for="ed-concepto" class="form-label">Concepto o motivo *</label>
              <input id="ed-concepto" name="concepto" value="${esc(deuda.concepto || '')}" required>
            </div>

            <div class="modal-field">
              <label for="ed-importe" class="form-label">Importe total original (€) *</label>
              <input id="ed-importe" name="importe_total" type="number" step="0.01" min="0.01" value="${deuda.importe_total || ''}" required>
            </div>

            <div class="modal-field">
              <label for="ed-fecha" class="form-label">Fecha del apunte *</label>
              <input id="ed-fecha" name="fecha" type="date" value="${deuda.fecha}" required>
            </div>
          </div>

          <div id="ed-err" class="modal-error-box" style="display: none;"></div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="btn-cancelar-modal">Cancelar</button>
            <button type="submit" class="btn-primary ok" id="btn-guardar-deuda">Guardar Cambios</button>
          </div>
        </form>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
    overlay.querySelector("#btn-cancelar-modal").addEventListener("click", cerrarModalActivo);

    const form = overlay.querySelector("#form-editar-deuda");
    const errBox = overlay.querySelector("#ed-err");
    const btnSubmit = overlay.querySelector("#btn-guardar-deuda");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errBox.style.display = "none";
      btnSubmit.disabled = true;

      const deudor = overlay.querySelector("#ed-deudor").value.trim();
      const concepto = overlay.querySelector("#ed-concepto").value.trim();
      const rawImp = parseFloat(overlay.querySelector("#ed-importe").value || "0");
      const fecha = overlay.querySelector("#ed-fecha").value;

      if (isNaN(rawImp) || rawImp <= 0) {
        errBox.textContent = "El importe debe ser mayor que 0.";
        errBox.style.display = "block";
        btnSubmit.disabled = false;
        return;
      }

      try {
        await API.patch(`/deudas/${deuda.id}`, {
          deudor,
          concepto,
          importe_total: rawImp.toFixed(2),
          fecha,
        });

        cerrarModalActivo();
        if (window.navegar) await window.navegar();
        else location.reload();
      } catch (err) {
        btnSubmit.disabled = false;
        errBox.textContent = err.message || "Error al actualizar el apunte";
        errBox.style.display = "block";
      }
    });
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Error</h3>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal">&times;</button>
        </div>
        <div class="modal-body"><p>${esc(err.message)}</p></div>
      </div>
    `;
    overlay.querySelector("#btn-cerrar-modal")?.addEventListener("click", cerrarModalActivo);
  }
}

// --------------------------------------------------------------------------
// 14. MODAL EDITAR CUENTA BANCARIA
// --------------------------------------------------------------------------
export async function abrirModalEditarCuenta(cuentaId) {
  const overlay = crearOverlay();
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-loading">Cargando cuenta...</div>
    </div>
  `;

  try {
    const cuenta = await API.get(`/cuentas/${cuentaId}`);

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action neutral">✏️ EDITAR CUENTA</span>
            <h3 class="modal-title">Editar Cuenta o Depósito</h3>
            <p class="modal-subtitle">Modifica el nombre o la entidad de la cuenta</p>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal" aria-label="Cerrar">&times;</button>
        </div>

        <form id="form-editar-cuenta" class="modal-form">
          <div class="modal-grid-fields">
            <div class="modal-field modal-span-2">
              <label for="ec-nombre" class="form-label">Nombre de la cuenta *</label>
              <input id="ec-nombre" name="nombre" value="${esc(cuenta.nombre || '')}" required>
            </div>

            <div class="modal-field">
              <label for="ec-entidad" class="form-label">Entidad bancaria</label>
              <input id="ec-entidad" name="entidad" value="${esc(cuenta.entidad || '')}" placeholder="Ej. Caixa, BBVA, Efectivo...">
            </div>

            <div class="modal-field">
              <label for="ec-tipo" class="form-label">Tipo de cuenta *</label>
              <select id="ec-tipo" name="tipo">
                <option value="banco" ${cuenta.tipo === "banco" ? "selected" : ""}>🏛️ Cuenta bancaria</option>
                <option value="efectivo" ${cuenta.tipo === "efectivo" ? "selected" : ""}>💵 Dinero en efectivo</option>
                <option value="inversion" ${cuenta.tipo === "inversion" ? "selected" : ""}>📈 Depósito / Inversión</option>
              </select>
            </div>
          </div>

          <div id="ec-err" class="modal-error-box" style="display: none;"></div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="btn-cancelar-modal">Cancelar</button>
            <button type="submit" class="btn-primary ok" id="btn-guardar-cuenta">Guardar Cambios</button>
          </div>
        </form>
      </div>
    `;

    overlay.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModalActivo);
    overlay.querySelector("#btn-cancelar-modal").addEventListener("click", cerrarModalActivo);

    const form = overlay.querySelector("#form-editar-cuenta");
    const errBox = overlay.querySelector("#ec-err");
    const btnSubmit = overlay.querySelector("#btn-guardar-cuenta");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errBox.style.display = "none";
      btnSubmit.disabled = true;

      const nombre = overlay.querySelector("#ec-nombre").value.trim();
      const entidad = overlay.querySelector("#ec-entidad").value.trim() || null;
      const tipo = overlay.querySelector("#ec-tipo").value;

      try {
        await API.patch(`/cuentas/${cuenta.id}`, {
          nombre,
          entidad,
          tipo,
        });

        cerrarModalActivo();
        if (window.navegar) await window.navegar();
        else location.reload();
      } catch (err) {
        btnSubmit.disabled = false;
        errBox.textContent = err.message || "Error al actualizar la cuenta";
        errBox.style.display = "block";
      }
    });
  } catch (err) {
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Error</h3>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal">&times;</button>
        </div>
        <div class="modal-body"><p>${esc(err.message)}</p></div>
      </div>
    `;
    overlay.querySelector("#btn-cerrar-modal")?.addEventListener("click", cerrarModalActivo);
  }
}

// --------------------------------------------------------------------------
// DELEGACIÓN GLOBAL DE BOTONES DE ACCIÓN RÁPIDA
// --------------------------------------------------------------------------
export function iniciarModalesAcciones() {
  if (modalesInstalados) return;
  modalesInstalados = true;

  document.addEventListener("click", (e) => {
    const btnAccion = e.target.closest("[data-accion-fintech]");
    if (!btnAccion) return;

    const accion = btnAccion.dataset.accionFintech;
    if (accion === "abrir-ingreso") {
      abrirModalIngreso("libre");
    } else if (accion === "abrir-gasto") {
      abrirModalGasto();
    } else if (accion === "abrir-nomina") {
      abrirModalIngreso("nomina");
    } else if (accion === "gestor-plantillas") {
      abrirModalPlantillasNomina();
    } else if (accion === "ver-cuadre") {
      abrirModalDesgloseCuadre();
    } else if (accion === "liquidar-tarjeta") {
      const tarjetaId = btnAccion.dataset.tarjetaId ? Number(btnAccion.dataset.tarjetaId) : null;
      abrirModalLiquidarTarjeta(tarjetaId);
    } else if (accion === "abrir-traspaso") {
      const cuentaOrigenId = btnAccion.dataset.cuentaOrigenId || btnAccion.dataset.cuentaId || null;
      const cuentaDestinoId = btnAccion.dataset.cuentaDestinoId || null;
      abrirModalTraspaso(cuentaOrigenId, cuentaDestinoId);
    }
  });
}

