// Vista de Copia de Seguridad, Vaciado y Restauración de Datos para Flow
import { esc, vista, icono } from "../vistas.js";

export default vista("copia-seguridad", async () => {
  return `
  <!-- 1. Hero Header -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Copia de Seguridad & Mantenimiento</span>
    <div class="hero-total-amount text-primary" style="font-size: 2rem;">Seguridad de Datos</div>
    <span class="hero-total-sub">Exporta tu contabilidad en JSON, prueba en limpio y restaura cuando quieras</span>
  </div>

  <!-- 2. Rejilla de Tarjetas de Respaldo -->
  <div class="backup-grid">
    <!-- TARJETA 1: GUARDAR EN ARCHIVO -->
    <div class="glass-card card-backup">
      <div>
        <div class="card-backup-header">
          <div class="card-backup-icon export">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div>
            <h3 class="card-backup-title">1. Guardar en un Archivo</h3>
            <span class="glass-filter-chip" style="font-size: 0.7rem; padding: 0.1rem 0.5rem; margin-top: 2px;">COPIA COMPLETA</span>
          </div>
        </div>
        <p class="card-backup-desc">
          Descarga un archivo con toda tu información: bancos, cuentas, tarjetas, sobres de ahorro, movimientos, préstamos, inversiones y plantillas.
        </p>
      </div>
      <div class="card-backup-footer">
        <a href="/api/v1/backup/exportar" download="flow_backup.json" class="btn-primary" style="text-decoration: none; display: flex; width: 100%; justify-content: center; box-sizing: border-box;">
          ${icono("documento")} Descargar Copia (.json)
        </a>
      </div>
    </div>

    <!-- TARJETA 2: MODO PRUEBAS (PONER TODO A CERO CONSERVANDO BOTES) -->
    <div class="glass-card card-backup">
      <div>
        <div class="card-backup-header">
          <div class="card-backup-icon" style="background: rgba(106, 77, 240, 0.12); color: var(--accent);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
          </div>
          <div>
            <h3 class="card-backup-title">2. Poner Todo a Cero</h3>
            <span class="glass-filter-chip" style="font-size: 0.7rem; padding: 0.1rem 0.5rem; color: var(--accent); margin-top: 2px;">MODO PRUEBAS</span>
          </div>
        </div>
        <p class="card-backup-desc">
          Pone los saldos de todas las cuentas y botes a <strong>0,00 €</strong> y borra los movimientos de prueba. Conserva botes, cuentas y plantillas.
        </p>
      </div>
      <div class="card-backup-footer">
        <button type="button" class="btn-secondary" id="btn-poner-a-cero-bd" style="width: 100%; justify-content: center;">
          ${icono("rayo")} Poner Todo a Cero
        </button>
      </div>
    </div>

    <!-- TARJETA 3: VACIAR BASE DE DATOS COMPLETA -->
    <div class="glass-card card-backup">
      <div>
        <div class="card-backup-header">
          <div class="card-backup-icon wipe">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 class="card-backup-title">3. Vaciar Base de Datos</h3>
            <span class="glass-filter-chip" style="font-size: 0.7rem; padding: 0.1rem 0.5rem; color: var(--neg); margin-top: 2px;">ELIMINAR TODO</span>
          </div>
        </div>
        <p class="card-backup-desc">
          Elimina todas las cuentas, botes y movimientos dejando la base de datos vacía. Se guarda automáticamente un respaldo antes de vaciar.
        </p>
      </div>
      <div class="card-backup-footer">
        <button type="button" class="btn-secondary danger" id="btn-vaciar-bd" style="width: 100%; justify-content: center; color: var(--neg); border-color: rgba(194, 54, 74, 0.3);">
          ${icono("borrar")} Vaciar Todo
        </button>
      </div>
    </div>

    <!-- TARJETA 4: VOLVER A CARGAR ARCHIVO -->
    <div class="glass-card card-backup">
      <div>
        <div class="card-backup-header">
          <div class="card-backup-icon import">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div>
            <h3 class="card-backup-title">4. Restaurar desde Archivo</h3>
            <span class="glass-filter-chip" style="font-size: 0.7rem; padding: 0.1rem 0.5rem; color: var(--pos); margin-top: 2px;">RECUPERAR TODO</span>
          </div>
        </div>
        <p class="card-backup-desc">
          Selecciona el archivo <code>.json</code> que descargaste previamente para restaurar exactamente todas tus cuentas, botes y saldos.
        </p>
      </div>

      <form id="form-restaurar-backup" class="restore-form">
        <div style="margin-bottom: 0.75rem;">
          <input type="file" id="fichero-backup" accept=".json" required class="glass-filter-chip" style="width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem; font-size: 0.8rem;">
        </div>
        <div id="restaurar-err-box" class="modal-error-box" style="display: none; margin-bottom: 0.75rem;"></div>
        <div class="card-backup-footer">
          <button type="submit" class="btn-primary" id="btn-submit-restaurar" style="width: 100%; justify-content: center;">
            ${icono("documento")} Cargar y Restaurar
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- 3. Tarjeta de Información y Flujo Recomendado -->
  <div class="backup-info-card">
    <div class="bic-icon">💡</div>
    <div class="bic-text">
      <strong>Flujo de trabajo recomendado:</strong>
      <ol>
        <li>Pulsa primero en <strong>Descargar Copia (.json)</strong> y guárdalo en tu ordenador.</li>
        <li>Pulsa en <strong>Poner Todo a Cero</strong> o <strong>Vaciar Todo</strong> para probar la app limpia.</li>
        <li>Cuando quieras volver a como estabas, selecciona el archivo descargado en el paso 1 y pulsa en <strong>Cargar y Restaurar</strong>.</li>
      </ol>
    </div>
  </div>
  `;
});

// Eventos interactivos de la vista de copia de seguridad
document.addEventListener("click", async (e) => {
  const btnPonerACero = e.target.closest("#btn-poner-a-cero-bd");
  if (btnPonerACero) {
    const confirmar = confirm(
      "🔄 ¿Estás seguro de que quieres PONER TODO A CERO para pruebas?\n\n" +
      "• Se eliminarán los movimientos y auditoría.\n" +
      "• Todos los botes y cuentas bancarias quedarán con saldo a 0,00 €.\n" +
      "• Se CONSERVAN intactos todos tus botes, cuentas, plantillas de nómina y recibos.\n\n" +
      "Se guardará una copia de seguridad automática antes de resetear."
    );

    if (!confirmar) return;

    btnPonerACero.disabled = true;
    btnPonerACero.textContent = "Poniendo todo a cero...";

    try {
      const res = await API.post("/backup/poner-a-cero", { confirmar: true });
      alert("✅ " + (res.mensaje || "Todos los saldos y movimientos se han puesto a cero."));
      if (window.irA) window.irA("inicio"); else location.pathname = "/inicio";
    } catch (err) {
      btnPonerACero.disabled = false;
      btnPonerACero.textContent = "Poner Todo a Cero";
      alert("Error al poner a cero: " + err.message);
    }
    return;
  }

  const btnVaciar = e.target.closest("#btn-vaciar-bd");
  if (!btnVaciar) return;

  const confirmar = confirm(
    "⚠️ ¿Estás seguro de que quieres VACIAR la base de datos?\n\n" +
    "Se eliminarán las cuentas, botes y movimientos actuales para que puedas probar Flow desde cero.\n\n" +
    "Se guardará una copia de seguridad automática antes de vaciar."
  );

  if (!confirmar) return;

  btnVaciar.disabled = true;
  btnVaciar.textContent = "Vaciando base de datos...";

  try {
    const res = await API.post("/backup/vaciar", { confirmar: true });
    alert("✅ " + (res.mensaje || "Base de datos vaciada con éxito. Ahora está lista para pruebas en limpio."));
    if (window.irA) window.irA("inicio"); else location.pathname = "/inicio";
  } catch (err) {
    btnVaciar.disabled = false;
    btnVaciar.textContent = "Vaciar Todo";
    alert("Error al vaciar: " + err.message);
  }
});

document.addEventListener("submit", async (e) => {
  const form = e.target.closest("#form-restaurar-backup");
  if (!form) return;
  e.preventDefault();

  const fileInput = form.querySelector("#fichero-backup");
  const errBox = form.querySelector("#restaurar-err-box");
  const btnSub = form.querySelector("#btn-submit-restaurar");

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert("Por favor selecciona un archivo .json de copia de seguridad.");
    return;
  }

  errBox.style.display = "none";
  btnSub.disabled = true;
  btnSub.textContent = "Restaurando datos...";

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("archivo", file);

  try {
    const response = await fetch("/api/v1/backup/restaurar", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.mensaje || data.detail || "Error al restaurar");
    }

    alert("🎉 " + (data.mensaje || "Copia de seguridad restaurada correctamente."));
    if (window.irA) window.irA("inicio"); else location.pathname = "/inicio";
  } catch (err) {
    btnSub.disabled = false;
    btnSub.textContent = "Cargar y Restaurar";
    errBox.textContent = err.message;
    errBox.style.display = "block";
  }
});
