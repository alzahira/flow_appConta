// Modales de Acciones Rápidas (+ Ingreso, − Gasto y Reparto de Nómina)
import { esc, importe } from "./vistas.js";

let modalesInstalados = false;

function formatearMoneda(val) {
  return importe(String(val || "0.00").replace(",", "."));
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
    const [resCuentas, resBotes, resCats] = await Promise.all([
      API.get("/cuentas"),
      API.get("/botes"),
      API.get("/categorias"),
    ]);

    const cuentas = resCuentas.items || [];
    const botes = resBotes.items || [];
    const categorias = resCats.items || [];
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
              <label for="mg-cuenta" class="form-label">¿De qué cuenta sale el dinero?</label>
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
              <label for="mg-bote" class="form-label">¿A qué sobre o bote se descuenta?</label>
              <select id="mg-bote" name="bote_id">
                <option value="">— Ninguno (Gasto general directo de cuenta) —</option>
                ${botes
                  .map(
                    (b) => `
                  <option value="${b.id}">
                    ${esc(b.nombre)} (${b.saldo} € disponible)
                  </option>
                `
                  )
                  .join("")}
              </select>
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
              <label for="mg-fecha" class="form-label">Fecha del gasto</label>
              <input id="mg-fecha" name="fecha" type="date" value="${hoy}" required>
            </div>

            <div class="modal-field modal-span-2">
              <label for="mg-desc" class="form-label">Concepto o Descripción</label>
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
      const boteId = fData.get("bote_id");
      const categoriaId = fData.get("categoria_id");

      try {
        await API.post("/movimientos", {
          fecha: fData.get("fecha"),
          importe: `-${valor}`,
          descripcion: fData.get("descripcion"),
          cuenta_id: Number(cuentaId),
          bote_id: boteId ? Number(boteId) : null,
          categoria_id: categoriaId ? Number(categoriaId) : null,
        });
        cerrarModalActivo();
        // Recargar o navegar para refrescar la pantalla
        if (window.location.hash === "#/inicio" || window.location.hash === "") {
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        } else {
          location.hash = "#/inicio";
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
        <p style="color: #ef4444; padding: 1rem;">No se pudieron cargar los datos: ${err.message}</p>
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
    const [resCuentas, resBotes, resPlantillas] = await Promise.all([
      API.get("/cuentas"),
      API.get("/botes"),
      API.get("/plantillas-reparto"),
    ]);

    const cuentas = resCuentas.items || [];
    const botes = resBotes.items || [];
    const plantillas = resPlantillas || [];
    const hoy = new Date().toISOString().slice(0, 10);

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
                <label for="mi-cuenta" class="form-label">¿En qué cuenta entra el dinero?</label>
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
                <label for="mi-bote" class="form-label">¿Asignar a un sobre/bote? (Opcional)</label>
                <select id="mi-bote" name="bote_id">
                  <option value="">— Dejar en la cuenta corriente (Sin asignar a bote) —</option>
                  ${botes
                    .map(
                      (b) => `
                    <option value="${b.id}">
                      ${esc(b.nombre)} (${b.saldo} € actual)
                    </option>
                  `
                    )
                    .join("")}
                </select>
              </div>

              <div class="modal-field">
                <label for="mi-fecha" class="form-label">Fecha del ingreso</label>
                <input id="mi-fecha" name="fecha" type="date" value="${hoy}" required>
              </div>

              <div class="modal-field">
                <label for="mi-desc" class="form-label">Concepto o Descripción</label>
                <input id="mi-desc" name="descripcion" placeholder="Ej. Nómina, Bizum recibido, Venta, Ingreso extra..." required>
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
              <p>Puedes crear plantillas para repartir automáticamente tu nómina o la de tu mujer entre vuestros botes cada mes.</p>
              <button type="button" class="btn-primary" id="btn-crear-primera-plantilla">+ Crear Primera Plantilla de Nómina</button>
            </div>
            `
              : `
            <form id="form-modal-nomina" class="modal-form">
              <div class="modal-nomina-selector-row">
                <div class="modal-field" style="flex: 1;">
                  <label for="mn-plantilla-sel" class="form-label">Selecciona la Nómina</label>
                  <select id="mn-plantilla-sel" class="select-lg">
                    ${plantillas
                      .map(
                        (p) => `
                      <option value="${p.id}" ${p.id === plantillas[0].id ? "selected" : ""}>
                        ${esc(p.nombre)} (${p.importe_estimado} € habitual)
                      </option>
                    `
                      )
                      .join("")}
                  </select>
                </div>
                <button type="button" class="btn-secondary mini" id="btn-ir-gestor-plantillas" style="align-self: flex-end; margin-bottom: 2px;">
                  ⚙️ Gestionar Plantillas
                </button>
              </div>

              <div class="modal-nomina-params-grid">
                <div class="modal-field">
                  <label for="mn-cuenta" class="form-label">Cuenta donde ingresa</label>
                  <select id="mn-cuenta" name="cuenta_id" required>
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
                  <label for="mn-fecha" class="form-label">Fecha del ingreso</label>
                  <input id="mn-fecha" name="fecha" type="date" value="${hoy}" required>
                </div>
              </div>

              <!-- Desglose de botes a repartir -->
              <div class="modal-reparto-box">
                <div class="reparto-box-header">
                  <span class="reparto-title">Desglose del Reparto por Sobres</span>
                  <span class="reparto-total-sum" id="reparto-total-badge">Total: 0,00 €</span>
                </div>
                <div class="reparto-lines-list" id="reparto-lines-container">
                  <!-- Se rellena dinámicamente con JS -->
                </div>
              </div>

              <div id="modal-nomina-err" class="modal-error-box" style="display: none;"></div>

              <div class="modal-footer">
                <button type="button" class="btn-secondary" id="btn-cancelar-nomina">Cancelar</button>
                <button type="submit" class="btn-primary ok" id="btn-ejecutar-nomina">
                  <span>🚀 Aplicar Reparto de Nómina</span>
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

    // Conmutador de pestañas
    overlay.querySelectorAll(".modal-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        overlay.querySelectorAll(".modal-tab-btn").forEach((b) => b.classList.remove("activo"));
        overlay.querySelectorAll(".modal-tab-content").forEach((c) => c.classList.remove("activo"));
        btn.classList.add("activo");
        overlay.querySelector(`#tab-content-${btn.dataset.tab}`).classList.add("activo");
      });
    });

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
        const boteId = fData.get("bote_id");

        try {
          await API.post("/movimientos", {
            fecha: fData.get("fecha"),
            importe: `+${valor}`,
            descripcion: fData.get("descripcion"),
            cuenta_id: Number(cuentaId),
            bote_id: boteId ? Number(boteId) : null,
          });
          cerrarModalActivo();
          if (window.location.hash === "#/inicio" || window.location.hash === "") {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } else {
            location.hash = "#/inicio";
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

    // Si hay plantillas: lógica de selección y desglose
    const selPlantilla = overlay.querySelector("#mn-plantilla-sel");
    const containerLineas = overlay.querySelector("#reparto-lines-container");
    const totalBadge = overlay.querySelector("#reparto-total-badge");
    const selCuentaNomina = overlay.querySelector("#mn-cuenta");

    function renderizarLineasPlantilla(plantilla) {
      if (!plantilla || !containerLineas) return;
      if (selCuentaNomina && plantilla.cuenta_id) {
        selCuentaNomina.value = String(plantilla.cuenta_id);
      }

      containerLineas.innerHTML = (plantilla.lineas || [])
        .map(
          (l, i) => `
        <div class="reparto-line-row" data-index="${i}" data-bote-id="${l.bote_id || ""}">
          <div class="reparto-line-info">
            <span class="reparto-line-name">${esc(l.concepto || "Sin concepto")}</span>
            <span class="reparto-line-bote">${l.bote_nombre ? `📦 ${esc(l.bote_nombre)}` : "🏦 En cuenta libre"}</span>
          </div>
          <div class="reparto-line-input-wrap">
            <input type="number" step="0.01" min="0" class="reparto-line-amount" value="${l.importe}" data-bote-id="${l.bote_id || ""}" data-concepto="${esc(l.concepto || "")}">
            <span class="reparto-currency">€</span>
          </div>
        </div>
      `
        )
        .join("");

      recalcularSumaReparto();

      containerLineas.querySelectorAll(".reparto-line-amount").forEach((inp) => {
        inp.addEventListener("input", recalcularSumaReparto);
      });
    }

    function recalcularSumaReparto() {
      if (!containerLineas || !totalBadge) return;
      let suma = 0;
      containerLineas.querySelectorAll(".reparto-line-amount").forEach((inp) => {
        const val = parseFloat(inp.value) || 0;
        suma += val;
      });
      totalBadge.textContent = `Total a ingresar: ${suma.toFixed(2)} €`;
    }

    if (selPlantilla) {
      selPlantilla.addEventListener("change", () => {
        const pSel = plantillas.find((p) => String(p.id) === selPlantilla.value);
        if (pSel) renderizarLineasPlantilla(pSel);
      });
      // Inicializar con la primera plantilla
      const primera = plantillas[0];
      if (primera) renderizarLineasPlantilla(primera);
    }

    const btnIrGestor = overlay.querySelector("#btn-ir-gestor-plantillas");
    if (btnIrGestor) {
      btnIrGestor.addEventListener("click", () => {
        cerrarModalActivo();
        abrirModalPlantillasNomina();
      });
    }

    // Envío Ejecutar Nómina
    const formNomina = overlay.querySelector("#form-modal-nomina");
    if (formNomina) {
      formNomina.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBox = overlay.querySelector("#modal-nomina-err");
        const btnSubmit = overlay.querySelector("#btn-ejecutar-nomina");
        errBox.style.display = "none";
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Aplicando reparto...";

        const plantillaId = selPlantilla.value;
        const plantillaObj = plantillas.find((p) => String(p.id) === plantillaId);
        const cuentaId = selCuentaNomina.value;
        const fecha = overlay.querySelector("#mn-fecha").value;

        // Recoger líneas con los valores actuales (ajustados por el usuario si procede)
        const lineasPayload = [];
        containerLineas.querySelectorAll(".reparto-line-amount").forEach((inp) => {
          const val = String(inp.value || "0").replace(",", ".").trim();
          if (parseFloat(val) > 0) {
            lineasPayload.push({
              bote_id: inp.dataset.boteId ? Number(inp.dataset.boteId) : null,
              concepto: inp.dataset.concepto,
              importe: val,
            });
          }
        });

        try {
          await API.post(`/plantillas-reparto/${plantillaId}/ejecutar`, {
            fecha: fecha,
            cuenta_id: Number(cuentaId),
            descripcion_general: plantillaObj?.nombre || "Nómina",
            lineas: lineasPayload,
          });
          cerrarModalActivo();
          if (window.location.hash === "#/inicio" || window.location.hash === "") {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } else {
            location.hash = "#/inicio";
          }
        } catch (err) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "🚀 Aplicar Reparto de Nómina";
          errBox.textContent = err.message || "Error al aplicar el reparto de nómina";
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
        <p style="color: #ef4444; padding: 1rem;">No se pudieron cargar los datos: ${err.message}</p>
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

    const editando = plantillaAEditarId
      ? plantillas.find((p) => p.id === plantillaAEditarId)
      : null;

    overlay.innerHTML = `
      <div class="modal-card modal-gestor-plantillas">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action neutral">CONFIGURACIÓN</span>
            <h3 class="modal-title">${editando ? "Editar Plantilla de Nómina" : "Plantillas de Reparto Mensual"}</h3>
            <p class="modal-subtitle">Define las reglas automáticas de reparto para tu nómina y la de tu pareja</p>
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
                          <span class="badge-subtle">${esc(p.cuenta_nombre || "Cuenta")}</span>
                          ${p.dia_mes ? `<span class="badge-subtle">Día ${p.dia_mes}</span>` : ""}
                        </div>
                        <div class="cpr-sub">
                          Importe habitual: <strong>${p.importe_estimado} €</strong> &bull; ${p.lineas.length} sobres asignados
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
                  <input id="gp-nombre" name="nombre" value="${editando ? esc(editando.nombre) : ""}" placeholder="Ej. Nómina Javier, Nómina Mujer..." required>
                </div>

                <div class="modal-field">
                  <label for="gp-cuenta" class="form-label">Cuenta habitual de cobro</label>
                  <select id="gp-cuenta" name="cuenta_id" required>
                    ${cuentas
                      .map(
                        (c) => `
                      <option value="${c.id}" ${editando && editando.cuenta_id === c.id ? "selected" : ""}>
                        ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""}
                      </option>
                    `
                      )
                      .join("")}
                  </select>
                </div>

                <div class="modal-field">
                  <label for="gp-dia" class="form-label">Día habitual del mes (1 - 31)</label>
                  <input id="gp-dia" name="dia_mes" type="number" min="1" max="31" value="${editando?.dia_mes || 28}" placeholder="Ej. 28">
                </div>
              </div>

              <!-- LÍNEAS DE REPARTO CONFIGURABLES -->
              <div class="reparto-config-box">
                <div class="reparto-box-header">
                  <div>
                    <span class="reparto-title">Reparto entre Sobres y Botes</span>
                    <p style="font-size: 0.78rem; color: var(--text-muted); margin: 2px 0 0;">
                      Añade los botes donde se repartirá el dinero cada mes
                    </p>
                  </div>
                  <button type="button" class="btn-secondary mini" id="btn-add-linea-config">+ Añadir Bote</button>
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

    function agregarFilaConfig(boteId = "", concepto = "", importeVal = "0.00") {
      const fila = document.createElement("div");
      fila.className = "fila-config-reparto";
      fila.innerHTML = `
        <div class="fcr-col fcr-bote">
          <select class="fcr-select-bote">
            <option value="">— Dejar en cuenta (Sin bote) —</option>
            ${botes
              .map(
                (b) => `
              <option value="${b.id}" ${String(b.id) === String(boteId) ? "selected" : ""}>
                ${esc(b.nombre)}
              </option>
            `
              )
              .join("")}
          </select>
        </div>
        <div class="fcr-col fcr-concepto">
          <input type="text" class="fcr-input-concepto" placeholder="Concepto (ej. Ocio, Mes...)" value="${esc(concepto)}">
        </div>
        <div class="fcr-col fcr-importe">
          <input type="number" step="0.01" min="0" class="fcr-input-importe" placeholder="0.00" value="${importeVal}">
          <span>€</span>
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
        agregarFilaConfig(l.bote_id, l.concepto, l.importe);
      });
    } else {
      // Filas iniciales sugeridas para nómina
      const boteMes = botes.find((b) => b.nombre.toLowerCase().includes("mes"));
      const boteOcio = botes.find((b) => b.nombre.toLowerCase().includes("ocio"));
      const boteHipoteca = botes.find((b) => b.nombre.toLowerCase().includes("hipoteca"));

      if (boteMes) agregarFilaConfig(boteMes.id, "Dinero del mes", "400.00");
      if (boteOcio) agregarFilaConfig(boteOcio.id, "Bote ocio", "200.00");
      if (boteHipoteca) agregarFilaConfig(boteHipoteca.id, "Amortización hipoteca", "600.00");
      agregarFilaConfig("", "Remanente en cuenta", "800.00");
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
          const concepto = fila.querySelector(".fcr-input-concepto").value.trim();
          const importeStr = fila.querySelector(".fcr-input-importe").value.trim();
          const num = parseFloat(importeStr) || 0;
          totalEstimado += num;

          lineas.push({
            bote_id: boteId ? Number(boteId) : null,
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
        <p style="color: #ef4444; padding: 1rem;">No se pudieron cargar los datos: ${err.message}</p>
      </div>
    `;
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
    }
  });
}

