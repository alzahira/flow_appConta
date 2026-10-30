// Vista de Copia de Seguridad, Vaciado y Restauración de Datos para Flow
import { esc, vista, icono } from "../vistas.js";

export default vista("copia-seguridad", async () => {
  return `
  <div class="view-header">
    <div class="view-header-title">
      <h2 class="view-title">Copia de Seguridad y Datos</h2>
      <p class="view-desc">Guarda todo el estado actual de tus cuentas en un archivo, prueba en limpio y restaura cuando quieras</p>
    </div>
  </div>

  <div class="backup-grid">
    <!-- TARJETA 1: GUARDAR EN ARCHIVO -->
    <div class="card-backup">
      <div class="card-backup-header">
        <div class="card-backup-icon export">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div>
          <h3 class="card-backup-title">1. Guardar en un Archivo</h3>
          <span class="badge-subtle">COPIA DE SEGURIDAD</span>
        </div>
      </div>
      <p class="card-backup-desc">
        Descarga un archivo con toda tu información: bancos, cuentas, tarjetas, sobres de ahorro, movimientos, préstamos, deudas, inversiones y plantillas de nómina.
      </p>
      <div class="card-backup-footer">
        <a href="/api/v1/backup/exportar" download="flow_backup.json" class="btn-primary" style="text-decoration: none; width: 100%; justify-content: center;">
          📥 Descargar Archivo de Copia (.json)
        </a>
      </div>
    </div>

    <!-- TARJETA 2: VACIAR BASE DE DATOS -->
    <div class="card-backup">
      <div class="card-backup-header">
        <div class="card-backup-icon wipe">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </div>
        <div>
          <h3 class="card-backup-title">2. Probar en Limpio</h3>
          <span class="badge-subtle" style="color: #e11d48; background: #ffe4e6;">VACIAR BASE DE DATOS</span>
        </div>
      </div>
      <p class="card-backup-desc">
        Deja la aplicación completamente vacía a cero para hacer pruebas.
        <strong>Tranquilo:</strong> antes de vaciar, Flow guarda automáticamente un archivo de respaldo en el servidor por seguridad.
      </p>
      <div class="card-backup-footer">
        <button type="button" class="btn-secondary danger" id="btn-vaciar-bd" style="width: 100%; justify-content: center;">
          🗑️ Vaciar Todo y Empezar de Cero
        </button>
      </div>
    </div>

    <!-- TARJETA 3: VOLVER A CARGAR ARCHIVO -->
    <div class="card-backup">
      <div class="card-backup-header">
        <div class="card-backup-icon import">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div>
          <h3 class="card-backup-title">3. Restaurar desde Archivo</h3>
          <span class="badge-subtle">RECUPERAR TODO</span>
        </div>
      </div>
      <p class="card-backup-desc">
        Selecciona el archivo <code>.json</code> que descargaste previamente para restaurar exactamente todas tus cuentas, botes y saldos como estaban.
      </p>

      <form id="form-restaurar-backup" class="restore-form">
        <div class="file-input-wrapper">
          <input type="file" id="fichero-backup" accept=".json" required>
        </div>
        <div id="restaurar-err-box" class="modal-error-box" style="display: none; margin-top: 0.5rem;"></div>
        <div class="card-backup-footer" style="margin-top: 0.85rem;">
          <button type="submit" class="btn-primary ok" id="btn-submit-restaurar" style="width: 100%; justify-content: center;">
            📤 Cargar Archivo y Restaurar Datos
          </button>
        </div>
      </form>
    </div>
  </div>

  <div class="backup-info-card">
    <div class="bic-icon">💡</div>
    <div class="bic-text">
      <strong>Flujo recomendado:</strong>
      <ol style="margin: 0.4rem 0 0; padding-left: 1.25rem;">
        <li>Pulsa primero en <strong>Descargar Archivo de Copia</strong> y guárdalo en tu ordenador.</li>
        <li>Pulsa en <strong>Vaciar Todo</strong> para probar la app limpia y crear cuentas o botes desde cero.</li>
        <li>Cuando quieras volver a como estabas, selecciona el archivo descargado en el paso 3 y pulsa en <strong>Restaurar Datos</strong>.</li>
      </ol>
    </div>
  </div>
  `;
});

// Eventos interactivos de la vista de copia de seguridad
document.addEventListener("click", async (e) => {
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
    location.hash = "#/inicio";
  } catch (err) {
    btnVaciar.disabled = false;
    btnVaciar.textContent = "🗑️ Vaciar Todo y Empezar de Cero";
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
    location.hash = "#/inicio";
  } catch (err) {
    btnSub.disabled = false;
    btnSub.textContent = "📤 Cargar Archivo y Restaurar Datos";
    errBox.textContent = err.message;
    errBox.style.display = "block";
  }
});

