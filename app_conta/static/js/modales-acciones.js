// Modales de Acciones Rápidas (+ Ingreso, − Gasto y Reparto de Nómina)
import { esc, importe, hoy } from "./vistas.js";

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
              <label for="mg-bote" class="form-label">¿A qué sobre o préstamo se descuenta?</label>
              <select id="mg-bote" name="bote_id">
                <optgroup label="General">
                  <option value="">— Ninguno (Gasto general directo de cuenta) —</option>
                </optgroup>
                ${
                  botes.length > 0
                    ? `
                <optgroup label="Sobres y Botes">
                  ${botes
                    .map(
                      (b) => `
                    <option value="${b.id}">
                      🐷 ${esc(b.nombre)} (${b.saldo} € disponible)
                    </option>
                  `
                    )
                    .join("")}
                </optgroup>`
                    : ""
                }
                ${
                  prestamos.length > 0
                    ? `
                <optgroup label="Préstamos que debo (Amortizar / Pago de cuota)">
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
      const boteId = String(fData.get("bote_id") || "");
      const categoriaId = fData.get("categoria_id");
      const desc = fData.get("descripcion");
      const fecha = fData.get("fecha");

      try {
        if (boteId.startsWith("prestamo:")) {
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
    const [resCuentas, resBotes, resPlantillas, resPagos, resPrestamos] = await Promise.all([
      API.get("/cuentas"),
      API.get("/botes"),
      API.get("/plantillas-reparto"),
      API.get("/pagos-recurrentes"),
      API.get("/prestamos"),
    ]);

    const cuentas = resCuentas.items || [];
    const botes = resBotes.items || [];
    const plantillas = resPlantillas || [];
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
                <label for="mi-destino" class="form-label">¿A qué destinar este ingreso? *</label>
                <select id="mi-destino" name="destino">
                  <optgroup label="Cuenta Bancaria">
                    <option value="cuenta" selected>— Dejar libre en la cuenta corriente (Sin asignar) —</option>
                  </optgroup>
                  ${
                    botes.length > 0
                      ? `
                  <optgroup label="Sobres y Botes de Ahorro">
                    ${botes
                      .map(
                        (b) => `
                      <option value="bote:${b.id}">
                        🐷 ${esc(b.nombre)} (${b.saldo} € actual)
                      </option>
                    `
                      )
                      .join("")}
                  </optgroup>`
                      : ""
                  }
                  ${
                    prestamos.length > 0
                      ? `
                  <optgroup label="Préstamos y Financiaciones (Amortizar / Ingresar en préstamo)">
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
                <div id="mi-destino-info" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem;">
                  🏦 El dinero quedará como saldo libre en la cuenta seleccionada.
                </div>
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

        try {
          if (destino.startsWith("prestamo:")) {
            const prestamoId = Number(destino.split(":")[1]);
            // 1. Registramos la entrada del dinero en la cuenta elegida
            await API.post("/movimientos", {
              fecha: fecha,
              importe: `+${valor}`,
              descripcion: descripcion,
              cuenta_id: Number(cuentaId),
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
              bote_id: boteId,
            });
          } else {
            const boteId = destino && destino !== "cuenta" ? Number(destino) : null;
            await API.post("/movimientos", {
              fecha: fecha,
              importe: `+${valor}`,
              descripcion: descripcion,
              cuenta_id: Number(cuentaId),
              bote_id: boteId,
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
          if (window.location.hash === "#/inicio" || window.location.hash === "") {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } else {
            location.hash = "#/inicio";
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
              <span>📦 <strong>2. Sobres y Botes</strong> (Ahorro, Mes, Ocio, Hipoteca...)</span>
              <span class="positivo">${importe(conc.total_botes_formula)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>💶 <strong>3. Dinero sin asignar</strong> (En cuentas, todavía sin bote)</span>
              <span class="${Number(conc.sin_asignar) >= 0 ? "positivo" : "negativo"}">${importe(conc.sin_asignar, Number(conc.sin_asignar) < 0 ? "negativo" : "")}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>📅 <strong>4. Bote Gastos Anuales (Previsión)</strong> (Provisión guardada − Facturas pagadas)</span>
              <span class="${Number(conc.total_prevision_formula) >= 0 ? "positivo" : "negativo"}">${importe(conc.total_prevision_formula, Number(conc.total_prevision_formula) < 0 ? "negativo" : "")}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>🤝 <strong>5. Dinero que me deben</strong> (Pendiente de cobro)</span>
              <span class="negativo">${importe(conc.total_me_deben_formula, "negativo")}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <span>🚗 <strong>6. Préstamos que debo</strong> (Deuda pendiente)</span>
              <span class="negativo">${importe(conc.total_prestamos_formula, "negativo")}</span>
            </div>
          </div>

          <!-- Explicación de por qué sale esta cifra concreta -->
          <div style="background: var(--surface-card); border-left: 3px solid #6366f1; border-radius: var(--radius-sm); padding: 0.85rem 1.15rem; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.5rem;">
            ${
              Number(conc.total_cuentas_formula) === 0 && Number(conc.total_prevision_formula) < 0
                ? "💡 <strong>¿Por qué sale esta cifra exacta?</strong> Actualmente tienes las cuentas bancarias vacías (0,00 €), pero en la pantalla de Previsión de Gastos constan facturas pagadas (−1.830,50 €) sin que haya meses de provisión guardada aportados. El sistema avisa de que hay 1.830 € de pagos registrados que no están respaldados por ningún saldo bancario."
                : "💡 <strong>Fórmula contable:</strong> Dinero en Cuentas = Botes + Sin asignar + Previsión − Deudas − Préstamos. El dinero sin asignar (por ejemplo, para recibos aún pendientes) NO es un descuadre. Cuando ingresas dinero en el banco o ajustas los botes, esta diferencia se actualiza automáticamente."
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
    }
  });
}

