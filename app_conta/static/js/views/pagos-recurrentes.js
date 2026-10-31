// Vista de Recibos y Pagos Recurrentes: Domiciliaciones bancarias fijas (Caixa y Deutsche Bank)
import { vista, esc, importe, hoy, subnavCuentas } from "../vistas.js";

export default vista("pagos-recurrentes", async () => {
  const [datosPagos, datosCuentas] = await Promise.all([
    API.get("/pagos-recurrentes"),
    API.get("/cuentas"),
  ]);

  const porCuenta = datosPagos.por_cuenta || [];
  const cuentas = datosCuentas.items || [];
  const totalGeneral = datosPagos.total_general || "0.00";
  const fechaHoy = hoy();

  return `
    ${subnavCuentas("pagos-recurrentes")}

    <div class="view-header">
      <div class="view-header-main">
        <div class="view-title-group">
          <div class="view-tag-badge">DOMICILIACIONES BANCARIAS</div>
          <h2 class="view-title">Recibos y Pagos Fijos</h2>
          <p class="view-desc">
            Gastos recurrentes domiciliados en tus cuentas bancarias. Aplícalos cada mes con un solo clic sin picar recibos a mano.
          </p>
        </div>
      </div>
      <div class="view-header-actions">
        <button type="button" class="btn-primary ok" id="btn-nuevo-pago-rec">+ Añadir Recibo Fijo</button>
      </div>
    </div>

    <!-- BARRA DE ACCIÓN GLOBAL: APLICAR TODOS LOS RECIBOS DEL MES -->
    <div class="card-ejecutar-todos-recibos">
      <div class="cetr-info">
        <div class="cetr-icon">⚡</div>
        <div class="cetr-texts">
          <strong>Aplicación Mensual de Recibos</strong>
          <span>Genera los cargos reales en cada cuenta bancaria para que los saldos queden 100% exactos.</span>
        </div>
      </div>
      <div class="cetr-actions">
        <div class="cetr-date-wrap">
          <label for="fecha-ejecutar-todos">Fecha del cargo:</label>
          <input type="date" id="fecha-ejecutar-todos" value="${fechaHoy}" class="input-fecha-recibos">
        </div>
        <button type="button" class="btn-primary ok btn-lg" id="btn-ejecutar-todos">
          🚀 Aplicar Todos los Recibos (${totalGeneral} €)
        </button>
      </div>
    </div>

    <!-- TARJETAS AGRUPADAS POR ENTIDAD BANCARIA -->
    <div class="grid-pagos-cuentas">
      ${
        porCuenta.length === 0
          ? `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No hay recibos recurrentes configurados</h3>
          <p>Añade los recibos fijos domiciliados en tus bancos para pagarlos cada mes.</p>
        </div>
        `
          : porCuenta
              .map(
                (g) => `
        <section class="card-banco-recibos" data-cuenta-id="${g.cuenta_id}">
          <div class="cbr-header">
            <div class="cbr-header-title">
              <span class="cbr-bank-icon">🏛️</span>
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

          <div class="cbr-table-wrap">
            <table class="table-recibos">
              <thead>
                <tr>
                  <th style="width: 32px;"><input type="checkbox" class="chk-select-all-banco" checked title="Seleccionar todos"></th>
                  <th>Concepto</th>
                  <th style="width: 130px; text-align: right;">Importe (€)</th>
                  <th style="width: 80px; text-align: center;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${g.items
                  .map(
                    (item) => `
                  <tr class="row-pago-rec" data-pago-id="${item.id}">
                    <td>
                      <input type="checkbox" class="chk-pago-item" data-id="${item.id}" ${item.activo ? "checked" : ""}>
                    </td>
                    <td>
                      <div class="pago-concepto-cell">
                        <strong class="pago-concepto-text">${esc(item.concepto)}</strong>
                        ${item.ultimo_pago ? `<span class="badge-mini-pago">Último: ${item.ultimo_pago}</span>` : ""}
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <div class="pago-importe-input-wrap">
                        <input type="number" step="0.01" min="0" class="input-importe-pago" value="${item.importe}" data-id="${item.id}">
                        <span>€</span>
                      </div>
                    </td>
                    <td style="text-align: center;">
                      <div class="pago-row-actions">
                        <button type="button" class="btn-icon btn-editar-pago" data-id="${item.id}" title="Editar">✏️</button>
                        <button type="button" class="btn-icon danger btn-borrar-pago" data-id="${item.id}" title="Eliminar">&times;</button>
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
            <button type="button" class="btn-secondary mini btn-add-pago-a-cuenta" data-cuenta-id="${g.cuenta_id}">
              + Añadir a ${esc(g.cuenta_nombre)}
            </button>
            <button type="button" class="btn-primary ok btn-ejecutar-banco" data-cuenta-id="${g.cuenta_id}" data-cuenta-nombre="${esc(g.cuenta_nombre)}">
              ⚡ Aplicar Recibos ${esc(g.cuenta_nombre)} (<span class="sum-banco">${g.total}</span> €)
            </button>
          </div>
        </section>
      `
              )
              .join("")
      }
    </div>

    <!-- MODAL DE CREAR / EDITAR RECIBO FIJO -->
    <div id="modal-pago-overlay" class="modal-overlay" style="display: none;">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge-action neutral">RECIBO FIJO</span>
            <h3 class="modal-title" id="modal-pago-titulo">Nuevo Recibo Recurrente</h3>
          </div>
          <button type="button" class="modal-btn-close" id="btn-cerrar-modal-pago">&times;</button>
        </div>

        <form id="form-pago-rec" class="modal-form">
          <input type="hidden" id="pago-id" value="">

          <div class="modal-grid-fields">
            <div class="modal-field modal-span-2">
              <label for="pago-concepto" class="form-label">Concepto del recibo</label>
              <input id="pago-concepto" required placeholder="Ej. Luz piso, Comunidad, Vodafone, etc.">
            </div>

            <div class="modal-field">
              <label for="pago-cuenta" class="form-label">Banco donde está domiciliado</label>
              <select id="pago-cuenta" required>
                ${cuentas
                  .filter((c) => c.tipo === "banco" || c.tipo === "efectivo" || !c.tipo)
                  .map(
                    (c) => `
                  <option value="${c.id}">
                    🏛️ ${esc(c.nombre)} ${c.entidad ? `(${esc(c.entidad)})` : ""}
                  </option>
                `
                  )
                  .join("")}
              </select>
            </div>

            <div class="modal-field">
              <label for="pago-importe" class="form-label">Importe habitual (€)</label>
              <input id="pago-importe" type="number" step="0.01" min="0.01" required placeholder="0.00">
            </div>

            <div class="modal-field modal-span-2">
              <label for="pago-notas" class="form-label">Notas u observaciones (opcional)</label>
              <input id="pago-notas" placeholder="Ej. Se cobra el día 5 de cada mes">
            </div>
          </div>

          <div id="modal-pago-err" class="modal-error-box" style="display: none;"></div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="btn-cancelar-modal-pago">Cancelar</button>
            <button type="submit" class="btn-primary ok" id="btn-guardar-pago">Guardar Recibo</button>
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

