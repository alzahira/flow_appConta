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

    <!-- TARJETA 2: MODO PRUEBAS (PONER TODO A CERO CONSERVANDO BOTES) -->
    <div class="card-backup" style="border: 1.5px solid rgba(99, 102, 241, 0.35); background: linear-gradient(180deg, rgba(99, 102, 241, 0.03) 0%, #ffffff 100%);">
      <div class="card-backup-header">
        <div class="card-backup-icon" style="background: rgba(99, 102, 241, 0.12); color: #6366f1;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
        </div>
        <div>
          <h3 class="card-backup-title">2. Poner Todo a Cero (Pruebas)</h3>
          <span class="badge-subtle" style="color: #4f46e5; background: #e0e7ff; font-weight: 700;">CONSERVA BOTES Y CUENTAS</span>
        </div>
      </div>
      <p class="card-backup-desc">
        Pone los saldos de todas las cuentas y botes a <strong>0,00 €</strong> y borra los movimientos de prueba.
        <strong>Conserva intactos:</strong> todos tus botes, cuentas bancarias, plantillas de nómina y recibos. Guarda copia automática antes de resetear.
      </p>
      <div class="card-backup-footer">
        <button type="button" class="btn-primary" id="btn-poner-a-cero-bd" style="width: 100%; justify-content: center; background: #6366f1; border-color: #6366f1; font-weight: 700;">
          🔄 Poner Todo a Cero (Modo Pruebas)
        </button>
      </div>
    </div>

    <!-- TARJETA 3: VACIAR BASE DE DATOS COMPLETA -->
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
          <h3 class="card-backup-title">3. Vaciar Base de Datos</h3>
          <span class="badge-subtle" style="color: var(--accent-negative); background: var(--accent-negative-soft); border: 1px solid var(--accent-negative-border);">ELIMINA TODO</span>
        </div>
      </div>
      <p class="card-backup-desc">
        Elimina todas las cuentas, botes y movimientos dejando la base de datos totalmente vacía.
        <strong>Tranquilo:</strong> antes de vaciar, Flow guarda automáticamente un archivo de respaldo en el servidor por seguridad.
      </p>
      <div class="card-backup-footer">
        <button type="button" class="btn-secondary danger" id="btn-vaciar-bd" style="width: 100%; justify-content: center;">
          🗑️ Vaciar Todo y Empezar de Cero
        </button>
      </div>
    </div>

    <!-- TARJETA 4: VOLVER A CARGAR ARCHIVO -->
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
          <h3 class="card-backup-title">4. Restaurar desde Archivo</h3>
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
      btnPonerACero.textContent = "🔄 Poner Todo a Cero (Modo Pruebas)";
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
    if (window.irA) window.irA("inicio"); else location.pathname = "/inicio";
  } catch (err) {
    btnSub.disabled = false;
    btnSub.textContent = "📤 Cargar Archivo y Restaurar Datos";
    errBox.textContent = err.message;
    errBox.style.display = "block";
  }
});

