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
    const [resCuentas, resBotes, resPlantillas, resPagos] = await Promise.all([
      API.get("/cuentas"),
      API.get("/botes"),
      API.get("/plantillas-reparto"),
      API.get("/pagos-recurrentes"),
    ]);

    const cuentas = resCuentas.items || [];
    const botes = resBotes.items || [];
    const plantillas = resPlantillas || [];
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
                  <span class="reparto-title">💼 Desglose del Reparto por Sobres y Bancos</span>
                  <span class="reparto-total-sum" id="reparto-total-badge">Total: 0,00 €</span>
                </div>
                <div class="reparto-lines-list" id="reparto-lines-container">
                  <!-- Se rellena dinámicamente con JS -->
                </div>
              </div>

              ${
                datosRecibos.por_cuenta && datosRecibos.por_cuenta.length > 0
                  ? `
              <!-- SECCIÓN INTEGRADA: RECIBOS FIJOS DEL MES -->
              <div class="modal-reparto-box box-recibos-fijos-integrados" style="margin-top: 1rem; border: 1.5px solid var(--border-medium); border-radius: var(--radius-md, 8px); background: var(--surface-card, #ffffff); overflow: hidden;">
                <div class="reparto-box-header" style="padding: 0.75rem 1rem; background: var(--surface-ground, #f8fafc); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="mn-chk-aplicar-recibos" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--color-primary, #6366f1);">
                    <label for="mn-chk-aplicar-recibos" style="font-weight: 700; cursor: pointer; font-size: 0.88rem; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                      ⚡ Aplicar también los Recibos Fijos domiciliados
                      <span class="badge-recibos-total" style="font-size: 0.76rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: rgba(239, 68, 68, 0.12); color: #ef4444;">
                        −<span id="mn-recibos-total-label">${datosRecibos.total_general}</span> €
                      </span>
                    </label>
                  </div>
                  <button type="button" class="btn-link mini" id="btn-toggle-detalle-recibos" style="font-size: 0.76rem; color: var(--color-primary, #6366f1); cursor: pointer; background: none; border: none; font-weight: 600; padding: 2px 4px;">
                    Ver / Editar recibos (${datosRecibos.por_cuenta.reduce((acc, g) => acc + (g.items || []).length, 0)}) ▼
                  </button>
                </div>

                <div id="mn-detalle-recibos-wrapper" style="display: none; padding: 0.85rem 1rem; background: var(--surface-bg, #ffffff); border-top: 1px solid var(--border-subtle);">
                  <p style="font-size: 0.76rem; color: var(--text-muted); margin: 0 0 0.75rem 0;">
                    💡 Al guardar, se crearán los cargos correspondientes en cada banco. Puedes desmarcar o cambiar el importe de cualquier recibo que haya variado este mes (ej. luz).
                  </p>
                  <div id="mn-lista-recibos-por-banco" style="display: flex; flex-direction: column; gap: 0.85rem;">
                    ${datosRecibos.por_cuenta
                      .map(
                        (g) => `
                      <div class="mn-recibos-banco-group" style="border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.65rem 0.8rem; background: var(--surface-card, #fafafa);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px dashed var(--border-subtle); padding-bottom: 0.35rem;">
                          <span style="font-weight: 700; font-size: 0.82rem; color: var(--text-main);">
                            🏛️ ${esc(g.cuenta_nombre)} ${g.cuenta_entidad ? `(${esc(g.cuenta_entidad)})` : ""}
                          </span>
                          <span style="font-weight: 700; font-size: 0.8rem; color: #ef4444;" class="mn-banco-subtotal" data-cuenta-id="${g.cuenta_id}">
                            Subtotal: −${g.total} €
                          </span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                          ${(g.items || [])
                            .map(
                              (pago) => `
                            <div class="mn-pago-item-row" data-pago-id="${pago.id}" data-cuenta-id="${g.cuenta_id}" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.8rem;">
                              <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                                <input type="checkbox" class="mn-chk-pago" data-pago-id="${pago.id}" ${pago.activo ? "checked" : ""} style="cursor: pointer;">
                                <span style="color: var(--text-main); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                  ${esc(pago.concepto)}
                                </span>
                              </div>
                              <div style="display: flex; align-items: center; gap: 3px;">
                                <span style="color: #ef4444; font-weight: 700;">−</span>
                                <input type="number" step="0.01" min="0" class="mn-pago-amount" data-pago-id="${pago.id}" value="${pago.importe.replace(",", ".")}" style="width: 75px; text-align: right; padding: 2px 4px; font-size: 0.78rem; border: 1px solid var(--border-medium); border-radius: 4px; font-family: var(--font-mono);">
                                <span style="color: var(--text-muted); font-size: 0.75rem;">€</span>
                              </div>
                            </div>
                          `
                            )
                            .join("")}
                        </div>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                </div>
              </div>

              <!-- RESUMEN NETO FINAL -->
              <div class="modal-balance-resumen" style="margin-top: 1rem; padding: 0.85rem 1.15rem; border-radius: var(--radius-md, 8px); background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                  <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">
                    Balance del Mes (Reparto Nómina + Recibos)
                  </div>
                  <div style="display: flex; gap: 0.85rem; align-items: center; margin-top: 4px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.8rem;">
                    <span style="color: #34d399;">+<span id="mn-sum-ingresos-label">0.00</span> € ingresos</span>
                    <span style="color: #f87171;" id="mn-sum-gastos-label">−<span id="mn-sum-gastos-val">${datosRecibos.total_general}</span> € recibos</span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Neto resultante a favor:</span>
                  <span id="mn-sum-neto-total" style="font-size: 1.25rem; font-weight: 800; color: #34d399; font-family: var(--font-mono);">
                    +0.00 €
                  </span>
                </div>
              </div>
              `
                  : ""
              }

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

    function recalcularTotales() {
      if (!containerLineas || !totalBadge) return;

      // 1. Suma de ingresos a repartir
      let sumaIngresos = 0;
      containerLineas.querySelectorAll(".reparto-line-amount").forEach((inp) => {
        const val = parseFloat(inp.value) || 0;
        sumaIngresos += val;
      });
      totalBadge.textContent = `Total a ingresar: ${sumaIngresos.toFixed(2)} €`;

      const sumIngresosLabel = overlay.querySelector("#mn-sum-ingresos-label");
      if (sumIngresosLabel) sumIngresosLabel.textContent = sumaIngresos.toFixed(2);

      // 2. Suma de recibos fijos
      const boxRecibos = overlay.querySelector(".box-recibos-fijos-integrados");
      const boxVisible = boxRecibos && boxRecibos.style.display !== "none";
      const chkMaster = overlay.querySelector("#mn-chk-aplicar-recibos");
      const aplicarRecibos = boxVisible && chkMaster ? chkMaster.checked : false;
      let sumaRecibos = 0;

      overlay.querySelectorAll(".mn-recibos-banco-group").forEach((group) => {
        let subtotalBanco = 0;
        group.querySelectorAll(".mn-pago-item-row").forEach((row) => {
          const chk = row.querySelector(".mn-chk-pago");
          const inp = row.querySelector(".mn-pago-amount");
          const val = parseFloat(inp?.value || "0") || 0;
          if (chk && chk.checked) {
            subtotalBanco += val;
            if (aplicarRecibos) {
              sumaRecibos += val;
            }
          }
        });
        const subtotalEl = group.querySelector(".mn-banco-subtotal");
        if (subtotalEl) {
          subtotalEl.textContent = `Subtotal: −${subtotalBanco.toFixed(2)} €`;
        }
      });

      const totalRecibosLabel = overlay.querySelector("#mn-recibos-total-label");
      if (totalRecibosLabel) totalRecibosLabel.textContent = sumaRecibos.toFixed(2);

      const sumGastosVal = overlay.querySelector("#mn-sum-gastos-val");
      if (sumGastosVal) sumGastosVal.textContent = sumaRecibos.toFixed(2);

      const sumGastosLabel = overlay.querySelector("#mn-sum-gastos-label");
      if (sumGastosLabel) {
        sumGastosLabel.style.display = aplicarRecibos ? "inline" : "none";
      }

      // 3. Balance neto
      const neto = sumaIngresos - sumaRecibos;
      const netoLabel = overlay.querySelector("#mn-sum-neto-total");
      if (netoLabel) {
        const signo = neto >= 0 ? "+" : "−";
        netoLabel.textContent = `${signo}${Math.abs(neto).toFixed(2)} €`;
        netoLabel.style.color = neto >= 0 ? "#34d399" : "#f87171";
      }

      // 4. Texto del botón principal
      const btnSubmit = overlay.querySelector("#btn-ejecutar-nomina");
      if (btnSubmit) {
        if (aplicarRecibos && sumaRecibos > 0) {
          btnSubmit.innerHTML = `<span>🚀 Aplicar Reparto y Pagar Recibos (Neto: ${neto >= 0 ? "+" : "−"}${Math.abs(neto).toFixed(2)} €)</span>`;
        } else {
          btnSubmit.innerHTML = `<span>🚀 Aplicar Reparto de Nómina (+${sumaIngresos.toFixed(2)} €)</span>`;
        }
      }
    }

    function renderizarLineasPlantilla(plantilla) {
      if (!plantilla || !containerLineas) return;
      if (selCuentaNomina && plantilla.cuenta_id) {
        selCuentaNomina.value = String(plantilla.cuenta_id);
      }

      containerLineas.innerHTML = (plantilla.lineas || [])
        .map((l, i) => {
          const esNegativo = parseFloat(l.importe) < 0;
          return `
        <div class="reparto-line-row ${esNegativo ? "fila-descuento" : ""}" data-index="${i}" style="${esNegativo ? "background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.3);" : ""}">
          <div class="reparto-line-info">
            <span class="reparto-line-name" style="${esNegativo ? "color: #ef4444; font-weight: 700;" : ""}">
              ${esNegativo ? "📤 " : ""}${esc(l.concepto || "Sin concepto")}
            </span>
            <div style="display: flex; gap: 0.65rem; align-items: center; margin-top: 5px; flex-wrap: wrap;">
              <span class="reparto-line-bote" style="${esNegativo ? "color: #ef4444; font-weight: 600;" : ""}">
                ${l.bote_nombre ? (esNegativo ? `📤 Descuenta del sobre: ${esc(l.bote_nombre)}` : `📦 ${esc(l.bote_nombre)}`) : "🏦 En cuenta libre"}
              </span>
              <label style="font-size: 0.74rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;">
                <span>🏛️ Destino:</span>
                <select class="reparto-line-bank-select" style="font-size: 0.78rem; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-medium); background: var(--surface-card); color: var(--text-main); font-weight: 500;">
                  <option value="">— Banco principal (${esc(plantilla.cuenta_nombre || "Cuenta")}) —</option>
                  ${cuentasParaReparto
                    .map(
                      (c) => `
                    <option value="${c.id}" ${(l.cuenta_id && l.cuenta_id === c.id) || (!l.cuenta_id && plantilla.cuenta_id === c.id) ? "selected" : ""}>
                      🏛️ ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""}
                    </option>
                  `
                    )
                    .join("")}
                </select>
              </label>
            </div>
          </div>
          <div class="reparto-line-input-wrap">
            <input type="number" step="0.01" class="reparto-line-amount" value="${l.importe}" data-bote-id="${l.bote_id || ""}" data-concepto="${esc(l.concepto || "")}" style="${esNegativo ? "color: #ef4444; font-weight: 800;" : ""}">
            <span class="reparto-currency" style="${esNegativo ? "color: #ef4444; font-weight: 700;" : ""}">€</span>
          </div>
        </div>
      `;
        })
        .join("");

      const boxRecibos = overlay.querySelector(".box-recibos-fijos-integrados");
      const esNominaMJ = (plantilla.nombre || "").toLowerCase().includes("mj");
      if (boxRecibos) {
        const chkMaster = overlay.querySelector("#mn-chk-aplicar-recibos");
        if (esNominaMJ) {
          boxRecibos.style.display = "none";
          if (chkMaster) chkMaster.checked = false;
        } else {
          boxRecibos.style.display = "block";
          if (chkMaster) chkMaster.checked = false;
        }
      }

      recalcularTotales();

      containerLineas.querySelectorAll(".reparto-line-amount").forEach((inp) => {
        inp.addEventListener("input", recalcularTotales);
      });
    }

    // Toggle de detalle de recibos
    const btnToggleRecibos = overlay.querySelector("#btn-toggle-detalle-recibos");
    const wrapDetalleRecibos = overlay.querySelector("#mn-detalle-recibos-wrapper");
    if (btnToggleRecibos && wrapDetalleRecibos) {
      btnToggleRecibos.addEventListener("click", () => {
        const visible = wrapDetalleRecibos.style.display !== "none";
        wrapDetalleRecibos.style.display = visible ? "none" : "block";
        const count = overlay.querySelectorAll(".mn-chk-pago").length;
        btnToggleRecibos.textContent = visible
          ? `Ver / Editar recibos (${count}) ▼`
          : "Ocultar detalle ▲";
      });
    }

    const chkMasterRecibos = overlay.querySelector("#mn-chk-aplicar-recibos");
    if (chkMasterRecibos) {
      chkMasterRecibos.addEventListener("change", () => {
        recalcularTotales();
      });
    }

    overlay.querySelectorAll(".mn-chk-pago, .mn-pago-amount").forEach((el) => {
      el.addEventListener("input", recalcularTotales);
      el.addEventListener("change", recalcularTotales);
    });

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
      // Si el reparto ya se aplicó y fallaron los recibos, reintentar solo los recibos.
      let repartoYaAplicado = false;

      formNomina.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBox = overlay.querySelector("#modal-nomina-err");
        const btnSubmit = overlay.querySelector("#btn-ejecutar-nomina");
        errBox.style.display = "none";
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Aplicando reparto y recibos...";

        const plantillaId = selPlantilla.value;
        const plantillaObj = plantillas.find((p) => String(p.id) === plantillaId);
        const cuentaId = selCuentaNomina.value;
        const fecha = overlay.querySelector("#mn-fecha").value;

        // Recoger líneas de reparto
        const lineasPayload = [];
        containerLineas.querySelectorAll(".reparto-line-row").forEach((row) => {
          const inp = row.querySelector(".reparto-line-amount");
          const selBank = row.querySelector(".reparto-line-bank-select");
          const val = String(inp?.value || "0").replace(",", ".").trim();
          if (parseFloat(val) !== 0) {
            lineasPayload.push({
              bote_id: inp.dataset.boteId ? Number(inp.dataset.boteId) : null,
              cuenta_id: selBank?.value ? Number(selBank.value) : null,
              concepto: inp.dataset.concepto,
              importe: val,
            });
          }
        });

        // Recoger recibos fijos seleccionados si el master checkbox está activo y visible
        const boxRecibos = overlay.querySelector(".box-recibos-fijos-integrados");
        const boxVisible = boxRecibos && boxRecibos.style.display !== "none";
        const chkMaster = overlay.querySelector("#mn-chk-aplicar-recibos");
        const aplicarRecibos = boxVisible && chkMaster ? chkMaster.checked : false;
        const pagosPayload = [];
        if (aplicarRecibos) {
          overlay.querySelectorAll(".mn-pago-item-row").forEach((row) => {
            const chk = row.querySelector(".mn-chk-pago");
            const inp = row.querySelector(".mn-pago-amount");
            if (chk && chk.checked) {
              const val = String(inp?.value || "0").replace(",", ".").trim();
              if (parseFloat(val) > 0) {
                pagosPayload.push({
                  id: Number(chk.dataset.pagoId),
                  importe: val,
                });
              }
            }
          });
        }

        // Aviso previo: líneas negativas que dejarían un bote en negativo
        const saldosBote = new Map(
          botes.map((b) => [Number(b.id), Math.round(Number(b.saldo || 0) * 100)])
        );
        const variacionBote = new Map();
        for (const l of lineasPayload) {
          if (!l.bote_id) continue;
          const centimos = Math.round(
            parseFloat(String(l.importe).replace(",", ".")) * 100
          );
          variacionBote.set(
            l.bote_id,
            (variacionBote.get(l.bote_id) || 0) + centimos
          );
        }
        const avisosPrevios = [];
        for (const [boteId, variacion] of variacionBote.entries()) {
          if (variacion >= 0) continue;
          const actual = saldosBote.get(boteId) ?? 0;
          const proyectado = actual + variacion;
          if (proyectado < 0) {
            const bote = botes.find((b) => Number(b.id) === boteId);
            avisosPrevios.push(
              `• ${bote?.nombre || `Bote #${boteId}`}: quedará en ` +
                `${(proyectado / 100).toFixed(2)} € (ahora ${(actual / 100).toFixed(2)} €)`
            );
          }
        }
        if (avisosPrevios.length > 0) {
          const seguir = confirm(
            "⚠️ Aviso: este reparto dejará algún bote en negativo:\n\n" +
              avisosPrevios.join("\n") +
              "\n\n¿Quieres aplicarlo igualmente?"
          );
          if (!seguir) {
            btnSubmit.disabled = false;
            recalcularTotales();
            return;
          }
        }

        const cuerpoReparto = {
          fecha: fecha,
          cuenta_id: Number(cuentaId),
          descripcion_general: plantillaObj?.nombre || "Nómina",
          lineas: lineasPayload,
        };

        try {
          // 1. Ejecutar reparto de nómina (con reintento si ya existe en el mes)
          let resReparto = null;
          if (!repartoYaAplicado) {
            try {
              resReparto = await API.post(
                `/plantillas-reparto/${plantillaId}/ejecutar`,
                cuerpoReparto
              );
            } catch (errReparto) {
              if (errReparto.status !== 409) throw errReparto;
              const repetir = confirm(
                `${errReparto.message}\n\n¿Quieres ejecutar el reparto de nuevo?`
              );
              if (!repetir) {
                btnSubmit.disabled = false;
                recalcularTotales();
                return;
              }
              resReparto = await API.post(
                `/plantillas-reparto/${plantillaId}/ejecutar`,
                { ...cuerpoReparto, confirmar_repetido: true }
              );
            }
            repartoYaAplicado = true;
          }

          // Avisos que solo conoce el servidor (p. ej. bote borrado entre medias)
          if (
            resReparto &&
            avisosPrevios.length === 0 &&
            Array.isArray(resReparto.avisos) &&
            resReparto.avisos.length > 0
          ) {
            alert(
              "⚠️ Aviso del reparto:\n\n" +
                resReparto.avisos.map((a) => `• ${a.mensaje}`).join("\n")
            );
          }

          // 2. Ejecutar recibos fijos si procede
          if (aplicarRecibos && pagosPayload.length > 0) {
            await API.post("/pagos-recurrentes/ejecutar", {
              fecha: fecha,
              pagos: pagosPayload,
            });
          }

          cerrarModalActivo();
          if (window.location.hash === "#/inicio" || window.location.hash === "") {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } else {
            location.hash = "#/inicio";
          }
        } catch (err) {
          btnSubmit.disabled = false;
          recalcularTotales();
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
        <p style="color: #ef4444; padding: 1rem;">No se pudieron cargar los datos: ${err.message}</p>
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
    const esCuadrado = conc.estado_formula === "cuadrado" || Math.abs(Number(conc.diferencia_formula || 0)) <= 2.0;
    const difNum = Number(conc.diferencia_formula || 0);

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
                ${importe(conc.diferencia_formula, esCuadrado ? "" : "negativo")}
              </strong>
            </div>
            <div style="max-width: 420px; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.4;">
              ${
                esCuadrado
                  ? "🎉 <strong>Perfecto:</strong> Todo el dinero físico y bancario coincide con la suma de tus botes, sobres y previsiones."
                  : `⚠️ <strong>Desfase de ${importe(conc.diferencia_formula, "negativo")}:</strong> Tus cuentas bancarias no coinciden con la suma de tus botes y recibos de previsión.`
              }
            </div>
          </div>

          <!-- Desglose de la Fórmula -->
          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-main);">
            Desglose de los Componentes
          </h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>🏛️ <strong>1. Dinero Real en Cuentas y Tarjetas</strong> (Bancos + Efectivo)</span>
              <strong>${importe(conc.total_cuentas_formula)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>🏁 <strong>2. Saldos iniciales</strong> (Dinero de apertura de las cuentas)</span>
              <span class="${Number(conc.saldo_inicial_total) >= 0 ? "positivo" : "negativo"}">${importe(conc.saldo_inicial_total, Number(conc.saldo_inicial_total) < 0 ? "negativo" : "")}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>💶 <strong>3. Dinero sin asignar</strong> (En cuentas, todavía sin bote)</span>
              <span class="${Number(conc.sin_asignar) >= 0 ? "positivo" : "negativo"}">${importe(conc.sin_asignar, Number(conc.sin_asignar) < 0 ? "negativo" : "")}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>📦 <strong>4. Sobres y Botes</strong> (Ahorro, Mes, Ocio, Hipoteca...)</span>
              <span class="positivo">${importe(conc.total_botes_formula)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>📅 <strong>5. Bote Gastos Anuales (Previsión)</strong> (Provisión guardada − Facturas pagadas)</span>
              <span class="${Number(conc.total_prevision_formula) >= 0 ? "positivo" : "negativo"}">${importe(conc.total_prevision_formula, Number(conc.total_prevision_formula) < 0 ? "negativo" : "")}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>🤝 <strong>6. Dinero que me deben</strong> (Pendiente de cobro)</span>
              <span class="negativo">${importe(conc.total_me_deben_formula, "negativo")}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>🚗 <strong>7. Préstamos que debo</strong> (Deuda pendiente)</span>
              <span class="negativo">${importe(conc.total_prestamos_formula, "negativo")}</span>
            </div>
          </div>

          <!-- Explicación de por qué sale esta cifra concreta -->
          <div style="background: var(--surface-card); border-left: 3px solid #6366f1; border-radius: var(--radius-sm); padding: 0.85rem 1.15rem; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.5rem;">
            ${
              Number(conc.total_cuentas_formula) === 0 && Number(conc.total_prevision_formula) < 0
                ? "💡 <strong>¿Por qué sale esta cifra exacta?</strong> Actualmente tienes las cuentas bancarias vacías (0,00 €), pero en la pantalla de Previsión de Gastos constan facturas pagadas (−1.830,50 €) sin que haya meses de provisión guardada aportados. El sistema avisa de que hay 1.830 € de pagos registrados que no están respaldados por ningún saldo bancario."
                : "💡 <strong>Fórmula contable:</strong> Dinero en Cuentas = Saldos iniciales + Botes + Sin asignar + Previsión − Deudas − Préstamos. El dinero sin asignar (por ejemplo, para recibos aún pendientes) NO es un descuadre. Cuando ingresas dinero en el banco o ajustas los botes, esta diferencia se actualiza automáticamente."
            }
          </div>

          <div class="modal-footer" style="padding: 0; display: flex; justify-content: flex-end; gap: 0.75rem;">
            <a href="#/copia-seguridad" class="btn-secondary" onclick="document.getElementById('fintech-modal-overlay')?.remove()">
              Restaurar Copia de Seguridad
            </a>
            <a href="#/prevision-gastos" class="btn-secondary" onclick="document.getElementById('fintech-modal-overlay')?.remove()">
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
        <p style="color: #ef4444; padding: 1rem;">No se pudo calcular la conciliación: ${err.message}</p>
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
    } else if (accion === "ver-cuadre") {
      abrirModalDesgloseCuadre();
    }
  });
}

