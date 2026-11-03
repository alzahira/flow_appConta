// Vista de Copia de Seguridad y Restauración de Datos para Flow
import { vista, icono } from "../vistas.js";

export default vista("copia-seguridad", async () => {
  return `
  <!-- 1. Hero Header -->
  <div class="accounts-hero-total">
    <span class="hero-total-label">Copia de Seguridad & Mantenimiento</span>
    <div class="hero-total-amount text-primary" style="font-size: 2rem;">Seguridad de Datos</div>
    <span class="hero-total-sub">Exporta tu contabilidad completa en un archivo seguro y restáurala con verificación</span>
  </div>

  <!-- 2. Rejilla de Tarjetas: Solo Guardar y Restaurar -->
  <div class="backup-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
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
            <span class="glass-filter-chip" style="font-size: 0.7rem; padding: 0.1rem 0.5rem; margin-top: 2px;">COPIA COMPLETA (.JSON)</span>
          </div>
        </div>
        <p class="card-backup-desc">
          Descarga un archivo con toda tu información: cuentas bancarias, tarjetas, efectivo, botes de ahorro, movimientos, préstamos, personas que te deben, inversiones y plantillas de nóminas y recibos.
        </p>
      </div>
      <div class="card-backup-footer">
        <a href="/api/v1/backup/exportar" download="flow_backup.json" class="btn-primary" style="text-decoration: none; display: flex; width: 100%; justify-content: center; box-sizing: border-box;">
          ${icono("documento")} Descargar Copia de Seguridad (.json)
        </a>
      </div>
    </div>

    <!-- TARJETA 2: RESTAURAR DESDE ARCHIVO (CON DOBLE CHECK Y CONTRASEÑA) -->
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
            <h3 class="card-backup-title">2. Restaurar desde Archivo</h3>
            <span class="glass-filter-chip" style="font-size: 0.7rem; padding: 0.1rem 0.5rem; color: var(--accent); margin-top: 2px;">PROTEGIDO CON CONTRASEÑA</span>
          </div>
        </div>
        <p class="card-backup-desc">
          Carga un archivo <code>.json</code> previamente guardado para restaurar exactamente toda tu contabilidad. Requiere doble confirmación y tu clave de acceso.
        </p>
      </div>

      <form id="form-restaurar-backup" class="restore-form fintech-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <!-- Selector de Archivo -->
        <div class="campo">
          <label for="fichero-backup" style="font-size: 0.78rem; font-weight: 600; color: var(--fg);">Seleccionar archivo (.json) *</label>
          <input type="file" id="fichero-backup" accept=".json" required class="glass-filter-chip" style="width: 100%; box-sizing: border-box; padding: 0.45rem 0.6rem; font-size: 0.82rem;">
        </div>

        <!-- Check 1: Confirmación de seguridad explícita -->
        <div style="background: rgba(106, 77, 240, 0.06); border: 1px solid var(--line); border-radius: 10px; padding: 0.65rem 0.75rem;">
          <label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.78rem; color: var(--fg); cursor: pointer; user-select: none;">
            <input type="checkbox" id="check-confirmar-restaurar" required style="margin-top: 2px; accent-color: var(--accent);">
            <span><strong>Doble verificación 1:</strong> He descargado una copia reciente y entiendo que esta acción sobrescribirá todos los datos actuales con los del archivo.</span>
          </label>
        </div>

        <!-- Check 2: Contraseña de usuario -->
        <div class="campo">
          <label for="password-restaurar" style="font-size: 0.78rem; font-weight: 600; color: var(--fg);">Doble verificación 2: Tu contraseña de usuario *</label>
          <input type="password" id="password-restaurar" name="password" placeholder="Introduce tu contraseña para autorizar" required autocomplete="current-password" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; font-size: 0.85rem; border-radius: 10px;">
        </div>

        <div id="restaurar-err-box" class="modal-error-box" style="display: none; padding: 0.6rem; font-size: 0.82rem; border-radius: 8px; background: rgba(194, 54, 74, 0.12); color: var(--neg);"></div>

        <div class="card-backup-footer" style="margin-top: 0.5rem;">
          <button type="submit" class="btn-primary" id="btn-submit-restaurar" style="width: 100%; justify-content: center;">
            ${icono("check")} Verificar Contraseña y Restaurar
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- 3. Tarjeta de Información y Buenas Prácticas -->
  <div class="backup-info-card" style="margin-top: 1rem;">
    <div class="bic-icon">🛡️</div>
    <div class="bic-text">
      <strong>Seguridad y Privacidad de tus Datos:</strong>
      <ol style="margin: 0.35rem 0 0 1.25rem; padding: 0; font-size: 0.82rem; color: var(--fg-2); line-height: 1.6;">
        <li>Descarga periódicamente tu archivo de respaldo antes de realizar cambios estructurales grandes.</li>
        <li>Tus datos se exportan en formato estándar abierto JSON, legible y respaldable en cualquier soporte externo o nube propia.</li>
        <li>La restauración requiere tu contraseña activa y confirmación expresa para protegerte contra sobrescrituras accidentales.</li>
      </ol>
    </div>
  </div>
  `;
});

// Eventos interactivos para Restaurar Copia con Doble Check y Contraseña
document.addEventListener("submit", async (e) => {
  const form = e.target.closest("#form-restaurar-backup");
  if (!form) return;
  e.preventDefault();

  const fileInput = form.querySelector("#fichero-backup");
  const checkConfirmar = form.querySelector("#check-confirmar-restaurar");
  const passwordInput = form.querySelector("#password-restaurar");
  const errBox = form.querySelector("#restaurar-err-box");
  const btnSub = form.querySelector("#btn-submit-restaurar");

  errBox.style.display = "none";

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert("Por favor selecciona un archivo .json de copia de seguridad.");
    return;
  }

  if (!checkConfirmar || !checkConfirmar.checked) {
    alert("Debes marcar la casilla de verificación de seguridad para continuar.");
    return;
  }

  const password = (passwordInput?.value || "").trim();
  if (!password) {
    alert("Debes introducir tu contraseña para autorizar la restauración.");
    if (passwordInput) passwordInput.focus();
    return;
  }

  const confirmarDialogo = confirm(
    "⚠️ ÚLTIMA CONFIRMACIÓN DE SEGURIDAD\n\n" +
    "¿Estás completamente seguro de que deseas RESTAURAR la copia de seguridad?\n\n" +
    "Esta operación reemplazará todas las cuentas, botes, movimientos y saldos actuales por los contenidos en el archivo seleccionado."
  );

  if (!confirmarDialogo) return;

  btnSub.disabled = true;
  btnSub.textContent = "Verificando y restaurando datos...";

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("archivo", file);
  formData.append("password", password);

  try {
    const response = await fetch("/api/v1/backup/restaurar", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      const msg = data.detail || data.error?.mensaje || "Error al restaurar la copia de seguridad.";
      throw new Error(msg);
    }

    alert("🎉 " + (data.mensaje || "Copia de seguridad restaurada correctamente."));
    if (window.irA) window.irA("inicio"); else location.pathname = "/inicio";
  } catch (err) {
    btnSub.disabled = false;
    btnSub.textContent = "Verificar Contraseña y Restaurar";
    errBox.textContent = "❌ " + err.message;
    errBox.style.display = "block";
  }
});
