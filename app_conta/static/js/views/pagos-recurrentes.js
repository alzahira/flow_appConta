// Vista de Recibos y Pagos Recurrentes: Domiciliaciones bancarias fijas (Caixa y Deutsche Bank)
import { vista, esc, importe, hoy, icono, subnavCuentas } from "../vistas.js";

export default vista("pagos-recurrentes", async () => {
  const [datosPagos, datosCuentas] = await Promise.all([
    API.get("/pagos-recurrentes"),
    API.get("/cuentas"),
  ]);

  const porCuenta = datosPagos.por_cuenta || [];
  const cuentas = datosCuentas.items || [];
  const totalGeneral = datosPagos.total_general || "0.00";
  const fechaHoy = hoy();
  const totalRecibos = porCuenta.reduce((acc, g) => acc + g.items.length, 0);

  return `
    ${subnavCuentas("pagos-recurrentes")}

    <!-- 1. Hero Total -->
    <div class="accounts-hero-total">
      <span class="hero-total-label">Total Mensual en Recibos Fijos</span>
      <div class="hero-total-amount text-primary">${importe(totalGeneral)}</div>
      <span class="hero-total-sub">${totalRecibos} recibos domiciliados en ${porCuenta.length} bancos</span>
    </div>

    <!-- Barra de acciones rápidas superior -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 1.25rem;">
      <button type="button" class="btn-primary" id="btn-nuevo-pago-rec">
        ${icono("plus")} Añadir Recibo Fijo
      </button>
    </div>

    <!-- 2. Banner de enlace con Reparto de Nómina -->
    <div class="recibos-banner-link glass-card" style="padding: 1rem 1.25rem; margin-bottom: 1.25rem;">
      <div style="display: flex; align-items: center; gap: 0.85rem;">
        <div class="acc-card-icon-wrap" style="color: var(--accent);">
          ${icono("nomina")}
        </div>
        <div>
          <strong style="color: var(--fg); font-size: 0.92rem; display: block;">¿Quieres pagar todos estos recibos al repartir tu nómina?</strong>
          <span style="font-size: 0.8rem; color: var(--fg-2);">
            Puedes aplicar automáticamente todos los recibos fijos de Caixa y Deutsche Bank en 1 solo clic desde el Reparto de Nómina.
          </span>
        </div>
      </div>
      <a href="#reparto-nomina" class="btn-secondary" style="text-decoration: none; font-size: 0.82rem; padding: 0.45rem 1rem;">
        Abrir Reparto de Nómina &rarr;
      </a>
    </div>

    <!-- 3. Barra de Acción Global: Aplicar Todos los Recibos del Mes -->
    <section class="glass-card recibos-global-exec-card">
      <div class="recibos-exec-content">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div class="acc-card-icon-wrap" style="color: var(--accent-2);">
            ${icono("rayo")}
          </div>
          <div>
            <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--fg); margin: 0;">Aplicación Mensual de Recibos</h3>
            <p style="font-size: 0.8rem; color: var(--fg-2); margin: 2px 0 0 0;">Genera los cargos reales en cada banco para que los saldos queden 100% exactos.</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <div style="display: inline-flex; align-items: center; gap: 0.45rem;">
            <label for="fecha-ejecutar-todos" style="font-size: 0.8rem; color: var(--fg-2);">Fecha:</label>
            <input type="date" id="fecha-ejecutar-todos" value="${fechaHoy}" class="glass-filter-chip" style="padding: 0.35rem 0.65rem; color: var(--fg); outline: none;">
          </div>
          <button type="button" class="btn-primary" id="btn-ejecutar-todos" style="padding: 0.55rem 1.25rem;">
            ${icono("rayo")} Aplicar Todos (${importe(totalGeneral)})
          </button>
        </div>
      </div>
    </section>

    <!-- 4. Tarjetas agrupadas por Entidad Bancaria -->
    <div class="grid-pagos-cuentas">
      ${
        porCuenta.length === 0
          ? `
        <div class="glass-card tarjeta-vacia">
          <div class="tarjeta-vacia-icon">${icono("movimientos")}</div>
          <h4>No hay recibos recurrentes configurados</h4>
          <p>Añade los recibos fijos domiciliados en tus bancos para controlarlos y pagarlos cada mes con un solo clic.</p>
        </div>
        `
          : porCuenta
              .map((g) => {
                const nombreLower = (g.cuenta_nombre || "").toLowerCase();
                let bankIconKey = "banco";
                let bankClass = "";
                if (nombreLower.includes("caixa")) {
                  bankIconKey = "caixa";
                  bankClass = "caixa";
                } else if (nombreLower.includes("deutsche") || nombreLower.includes("db")) {
                  bankIconKey = "deutsche";
                  bankClass = "deutsche";
                } else if (nombreLower.includes("bbva")) {
                  bankIconKey = "bbva";
                  bankClass = "bbva";
                } else if (nombreLower.includes("revolut")) {
                  bankIconKey = "revolut";
                  bankClass = "revolut";
                }

                return `
        <section class="glass-card card-banco-recibos" data-cuenta-id="${g.cuenta_id}">
          <div class="cbr-header">
            <div class="cbr-header-title">
              <div class="acc-card-icon-wrap ${bankClass}">
                ${icono(bankIconKey)}
              </div>
              <div>
                <h3 class="cbr-bank-name">${esc(g.cuenta_nombre)}</h3>
                <span class="cbr-bank-sub">${g.items.length} recibos domiciliados</span>
              </div>
            </div>
            <div class="cbr-header-total">
              <span class="cbr-total-label">Total mensual</span>
              <strong class="cbr-total-value">${g.total} €</strong>
            </div>
          </div>

          <div class="glass-table-wrap">
            <table class="table-recibos glass-table">
              <thead>
                <tr>
                  <th style="width: 36px; text-align: center;">
                    <input type="checkbox" class="chk-select-all-banco" checked title="Seleccionar todos">
                  </th>
                  <th>Concepto</th>
                  <th style="width: 140px; text-align: right;">Importe (€)</th>
                  <th style="width: 80px; text-align: center;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${g.items
                  .map(
                    (item) => `
                  <tr class="row-pago-rec" data-pago-id="${item.id}">
                    <td style="text-align: center;">
                      <input type="checkbox" class="chk-pago-item" data-id="${item.id}" ${item.activo ? "checked" : ""}>
                    </td>
                    <td>
                      <div class="pago-concepto-cell">
                        <strong class="pago-concepto-text">${esc(item.concepto)}</strong>
                        ${item.ultimo_pago ? `<span class="badge-mini-pago">Último cargo: ${esc(item.ultimo_pago)}</span>` : ""}
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <div class="pago-importe-input-wrap">
                        <input type="number" step="0.01" min="0" class="input-importe-pago" value="${item.importe}" data-id="${item.id}">
                        <span style="font-size: 0.82rem; color: var(--fg-2);">€</span>
                      </div>
                    </td>
                    <td style="text-align: center;">
                      <div class="pago-row-actions">
                        <button type="button" class="btn-card-more btn-editar-pago" data-id="${item.id}" title="Editar">
                          ${icono("editar")}
                        </button>
                        <button type="button" class="btn-card-more dropdown-item-danger btn-borrar-pago" data-id="${item.id}" title="Eliminar">
                          ${icono("borrar")}
                        </button>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          <div class="cbr-footer">
            <button type="button" class="btn-secondary btn-add-pago-a-cuenta" data-cuenta-id="${g.cuenta_id}" style="padding: 0.4rem 0.9rem; font-size: 0.82rem;">
              ${icono("plus")} Añadir a ${esc(g.cuenta_nombre)}
            </button>
            <button type="button" class="btn-primary btn-ejecutar-banco" data-cuenta-id="${g.cuenta_id}" data-cuenta-nombre="${esc(g.cuenta_nombre)}" style="padding: 0.45rem 1rem; font-size: 0.82rem;">
              ${icono("rayo")} Aplicar ${esc(g.cuenta_nombre)} (<span class="sum-banco">${g.total}</span> €)
            </button>
          </div>
        </section>
      `;
              })
              .join("")
      }
    </div>

    <!-- 5. Modal de Crear / Editar Recibo Fijo -->
    <div id="modal-pago-overlay" class="modal-overlay" style="display: none;">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3 class="modal-title" id="modal-pago-titulo">Nuevo Recibo Recurrente</h3>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal-pago">&times;</button>
        </div>

        <form id="form-pago-rec" class="modal-form fintech-form">
          <input type="hidden" id="pago-id" value="">

          <div class="campo">
            <label for="pago-concepto">Concepto del recibo *</label>
            <input id="pago-concepto" required placeholder="Ej. Luz Endesa, Comunidad, Vodafone...">
          </div>

          <div class="form-grid-2">
            <div class="campo">
              <label for="pago-cuenta">Banco domiciliado *</label>
              <select id="pago-cuenta" required>
                ${cuentas
                  .filter((c) => c.tipo === "banco" || c.tipo === "efectivo" || !c.tipo)
                  .map(
                    (c) => `
                  <option value="${c.id}">
                    ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""}
                  </option>
                `
                  )
                  .join("")}
              </select>
            </div>

            <div class="campo">
              <label for="pago-importe">Importe habitual (€) *</label>
              <input id="pago-importe" type="number" step="0.01" min="0.01" required placeholder="0.00">
            </div>
          </div>

          <div class="campo">
            <label for="pago-notas">Notas u observaciones (opcional)</label>
            <input id="pago-notas" placeholder="Ej. Se cobra el día 5 de cada mes">
          </div>

          <div id="modal-pago-err" class="modal-error-box" style="display: none;"></div>

          <div class="modal-footer" style="margin-top: 1.25rem;">
            <button type="button" class="btn-secondary" id="btn-cancelar-modal-pago">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-guardar-pago">Guardar Recibo</button>
          </div>
        </form>
      </div>
    </div>
  `;
}, (vistaEl) => {
  // Lógica interactiva
  const modal = vistaEl.querySelector("#modal-pago-overlay");
  const formPago = vistaEl.querySelector("#form-pago-rec");
  const btnCerrar = vistaEl.querySelector("#btn-cerrar-modal-pago");
  const btnCancelar = vistaEl.querySelector("#btn-cancelar-modal-pago");
  const errBox = vistaEl.querySelector("#modal-pago-err");

  function abrirModal(pago = null, cuentaIdPref = null) {
    if (!modal) return;
    errBox.style.display = "none";
    vistaEl.querySelector("#modal-pago-titulo").textContent = pago ? "Editar Recibo Recurrente" : "Nuevo Recibo Recurrente";
    vistaEl.querySelector("#pago-id").value = pago ? pago.id : "";
    vistaEl.querySelector("#pago-concepto").value = pago ? pago.concepto : "";
    vistaEl.querySelector("#pago-importe").value = pago ? pago.importe : "";
    vistaEl.querySelector("#pago-notas").value = pago ? pago.notas || "" : "";

    const selCta = vistaEl.querySelector("#pago-cuenta");
    if (pago && pago.cuenta_id) {
      selCta.value = String(pago.cuenta_id);
    } else if (cuentaIdPref) {
      selCta.value = String(cuentaIdPref);
    }

    modal.style.display = "flex";
  }

  function cerrarModal() {
    if (modal) modal.style.display = "none";
  }

  if (btnCerrar) btnCerrar.addEventListener("click", cerrarModal);
  if (btnCancelar) btnCancelar.addEventListener("click", cerrarModal);

  // Botón Nuevo Recibo arriba
  const btnNuevo = vistaEl.querySelector("#btn-nuevo-pago-rec");
  if (btnNuevo) btnNuevo.addEventListener("click", () => abrirModal());

  // Botones añadir a cuenta específica
  vistaEl.querySelectorAll(".btn-add-pago-a-cuenta").forEach((b) => {
    b.addEventListener("click", () => abrirModal(null, Number(b.dataset.cuentaId)));
  });

  // Botones editar y borrar por fila
  vistaEl.querySelectorAll(".btn-editar-pago").forEach((b) => {
    b.addEventListener("click", async () => {
      try {
        const pago = await API.get(`/pagos-recurrentes/${b.dataset.id}`);
        abrirModal(pago);
      } catch (err) {
        alert(err.message || "Error al cargar recibo");
      }
    });
  });

  vistaEl.querySelectorAll(".btn-borrar-pago").forEach((b) => {
    b.addEventListener("click", async () => {
      if (confirm("¿Seguro que deseas eliminar este recibo recurrente?")) {
        try {
          await API.del(`/pagos-recurrentes/${b.dataset.id}`);
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        } catch (err) {
          alert(err.message || "Error al eliminar");
        }
      }
    });
  });

  // Guardar formulario
  if (formPago) {
    formPago.addEventListener("submit", async (e) => {
      e.preventDefault();
      errBox.style.display = "none";
      const id = vistaEl.querySelector("#pago-id").value;
      const concepto = vistaEl.querySelector("#pago-concepto").value.trim();
      const cuentaId = vistaEl.querySelector("#pago-cuenta").value;
      const importeStr = vistaEl.querySelector("#pago-importe").value;
      const notas = vistaEl.querySelector("#pago-notas").value.trim();

      const payload = {
        concepto,
        cuenta_id: Number(cuentaId),
        importe: importeStr,
        notas,
      };

      try {
        if (id) {
          await API.put(`/pagos-recurrentes/${id}`, payload);
        } else {
          await API.post("/pagos-recurrentes", payload);
        }
        cerrarModal();
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch (err) {
        errBox.textContent = err.message || "Error al guardar el recibo";
        errBox.style.display = "block";
      }
    });
  }

  // Recalcular suma en directo si se cambian importes o checkboxes
  function recalcularTotales() {
    vistaEl.querySelectorAll(".card-banco-recibos").forEach((card) => {
      let suma = 0;
      card.querySelectorAll(".row-pago-rec").forEach((row) => {
        const chk = row.querySelector(".chk-pago-item");
        const inp = row.querySelector(".input-importe-pago");
        if (chk && chk.checked && inp) {
          suma += parseFloat(inp.value) || 0;
        }
      });
      const lblVal = card.querySelector(".cbr-total-value");
      const sumBtn = card.querySelector(".sum-banco");
      if (lblVal) lblVal.textContent = `${suma.toFixed(2)} €`;
      if (sumBtn) sumBtn.textContent = suma.toFixed(2);
    });
  }

  vistaEl.querySelectorAll(".input-importe-pago").forEach((inp) => {
    inp.addEventListener("input", recalcularTotales);
  });

  vistaEl.querySelectorAll(".chk-pago-item").forEach((chk) => {
    chk.addEventListener("change", recalcularTotales);
  });

  vistaEl.querySelectorAll(".chk-select-all-banco").forEach((chkAll) => {
    chkAll.addEventListener("change", (e) => {
      const card = e.target.closest(".card-banco-recibos");
      if (!card) return;
      card.querySelectorAll(".chk-pago-item").forEach((c) => {
        c.checked = e.target.checked;
      });
      recalcularTotales();
    });
  });

  // Ejecución de un banco específico
  vistaEl.querySelectorAll(".btn-ejecutar-banco").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ctaId = Number(btn.dataset.cuentaId);
      const ctaNombre = btn.dataset.cuentaNombre;
      const card = btn.closest(".card-banco-recibos");
      const fecha = vistaEl.querySelector("#fecha-ejecutar-todos").value || hoy();

      const pagosAEjecutar = [];
      card.querySelectorAll(".row-pago-rec").forEach((row) => {
        const chk = row.querySelector(".chk-pago-item");
        const inp = row.querySelector(".input-importe-pago");
        if (chk && chk.checked && inp) {
          pagosAEjecutar.push({
            id: Number(row.dataset.pagoId),
            importe: inp.value,
          });
        }
      });

      if (pagosAEjecutar.length === 0) {
        alert("Selecciona al menos un recibo para aplicar.");
        return;
      }

      const totalTxt = card.querySelector(".sum-banco")?.textContent || "0.00";
      if (!confirm(`¿Deseas aplicar los ${pagosAEjecutar.length} recibos de ${ctaNombre} por un total de ${totalTxt} € con fecha ${fecha}?`)) {
        return;
      }

      btn.disabled = true;
      btn.textContent = "Aplicando pagos...";

      try {
        const res = await API.post("/pagos-recurrentes/ejecutar", {
          fecha,
          cuenta_id: ctaId,
          pagos: pagosAEjecutar,
        });
        alert(`✅ ¡Listo! Se han aplicado ${res.movimientos_creados} recibos en ${ctaNombre} por un total de −${res.total_gastado} €.`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch (err) {
        btn.disabled = false;
        btn.textContent = `⚡ Aplicar Recibos ${ctaNombre}`;
        alert(err.message || "Error al aplicar recibos");
      }
    });
  });

  // Ejecución global de TODOS los recibos
  const btnEjecutarTodos = vistaEl.querySelector("#btn-ejecutar-todos");
  if (btnEjecutarTodos) {
    btnEjecutarTodos.addEventListener("click", async () => {
      const fecha = vistaEl.querySelector("#fecha-ejecutar-todos").value || hoy();
      const pagosAEjecutar = [];

      vistaEl.querySelectorAll(".row-pago-rec").forEach((row) => {
        const chk = row.querySelector(".chk-pago-item");
        const inp = row.querySelector(".input-importe-pago");
        if (chk && chk.checked && inp) {
          pagosAEjecutar.push({
            id: Number(row.dataset.pagoId),
            importe: inp.value,
          });
        }
      });

      if (pagosAEjecutar.length === 0) {
        alert("Selecciona al menos un recibo para aplicar.");
        return;
      }

      let sumaTotal = 0;
      pagosAEjecutar.forEach((p) => {
        sumaTotal += parseFloat(p.importe) || 0;
      });

      if (!confirm(`¿Deseas aplicar TODOS los recibos del mes (${pagosAEjecutar.length} recibos por un total de ${sumaTotal.toFixed(2)} €) con fecha ${fecha}?`)) {
        return;
      }

      btnEjecutarTodos.disabled = true;
      btnEjecutarTodos.textContent = "Aplicando todos los recibos...";

      try {
        const res = await API.post("/pagos-recurrentes/ejecutar", {
          fecha,
          pagos: pagosAEjecutar,
        });
        alert(`🎉 ¡Excelente! Se han aplicado con éxito ${res.movimientos_creados} recibos en tus bancos por un total de −${res.total_gastado} €.`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch (err) {
        btnEjecutarTodos.disabled = false;
        btnEjecutarTodos.textContent = `🚀 Aplicar Todos los Recibos (${totalGeneral} €)`;
        alert(err.message || "Error al aplicar recibos");
      }
    });
  }
});
