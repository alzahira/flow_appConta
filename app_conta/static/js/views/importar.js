// Vista importar: Carga del histórico Excel (OCTUBRE.xlsx) con previsualización y cuadre
import { esc, importe, vista, icono } from "../vistas.js";

let ficheroPendiente = null;

function filaDiferencia(d) {
  const esCero = d.diferencia === "0.00";
  return `
    <tr>
      <td><strong>${esc(d.bote)}</strong></td>
      <td class="num">${importe(d.excel)}</td>
      <td class="num">${importe(d.app)}</td>
      <td class="text-center">
        <span class="badge-tag ${esCero ? "ok" : "alerta"}">${esc(d.diferencia)} €</span>
      </td>
    </tr>
  `;
}

function filaAviso(a) {
  const donde = a.hoja ? `${esc(a.hoja)}${a.fila ? ` (fila ${a.fila})` : ""}` : "";
  return `
    <li class="alert-item">
      <span class="alert-bullet">&bull;</span>
      <div class="alert-desc">
        ${donde ? `<strong class="alert-source">${donde}:</strong>` : ""}
        <span>${esc(a.motivo)}</span>
      </div>
    </li>
  `;
}

function tarjetaFichero(f) {
  return `
    <div class="file-history-item">
      <div class="file-history-icon">${icono("importar")}</div>
      <div class="file-history-info">
        <h4 class="file-history-name">${esc(f.nombre_fichero)}</h4>
        <span class="file-history-meta">Huella: ${esc(f.huella.slice(0, 12))}… &bull; ${esc(f.importado_en.slice(0, 16))}</span>
      </div>
      <span class="badge-tag ok">${icono("check")} Importado</span>
    </div>
  `;
}

function resumenPrev(data) {
  const r = data.resumen;
  const avisos = data.avisos || [];
  const diferencias = data.diferencias_conciliacion || [];

  return `
  <div class="preview-card">
    <div class="preview-header">
      <div class="preview-icon">${icono("check")}</div>
      <div>
        <h3 class="preview-title">Previsualización del Libro Excel</h3>
        <p class="preview-subtitle">Fichero: <strong>${esc(data.fichero.nombre)}</strong> &bull; Huella sha256: <code>${esc(data.fichero.huella.slice(0, 12))}…</code></p>
      </div>
    </div>

    <div class="preview-stats-grid">
      <div class="preview-stat-box">
        <span class="stat-number">${r.cuentas}</span>
        <span class="stat-caption">Cuentas nuevas</span>
      </div>
      <div class="preview-stat-box">
        <span class="stat-number">${r.botes}</span>
        <span class="stat-caption">Botes a crear</span>
      </div>
      <div class="preview-stat-box">
        <span class="stat-number">${r.movimientos}</span>
        <span class="stat-caption">Movimientos detectados</span>
      </div>
      <div class="preview-stat-box">
        <span class="stat-number">${r.categorias}</span>
        <span class="stat-caption">Categorías</span>
      </div>
    </div>

    ${
      diferencias.length > 0
        ? `
      <div class="preview-section">
        <h4 class="preview-section-title">Comprobación de Cuadre por Botes (SC-004)</h4>
        <div class="card-table-wrap">
          <table class="table-fintech mini">
            <thead>
              <tr>
                <th>Sobre / Bote</th>
                <th class="num">Saldo en Excel</th>
                <th class="num">Saldo Calculado</th>
                <th class="text-center" style="width: 120px">Desviación</th>
              </tr>
            </thead>
            <tbody>
              ${diferencias.map(filaDiferencia).join("\n")}
            </tbody>
          </table>
        </div>
      </div>
    `
        : ""
    }

    ${
      avisos.length > 0
        ? `
      <div class="preview-section">
        <h4 class="preview-section-title">Avisos y Ajustes Detectados (${avisos.length})</h4>
        <div class="alerts-container">
          <ul class="alerts-list">${avisos.map(filaAviso).join("\n")}</ul>
        </div>
      </div>
    `
        : ""
    }

    <div class="preview-actions">
      <button type="button" class="btn-primary large" data-accion="importar-aplicar">
        ${icono("check")} Aplicar e Integrar en la Base de Datos
      </button>
    </div>
  </div>
  `;
}

async function postArchivo(ruta, fichero, confirmar) {
  const fd = new FormData();
  fd.append("fichero", fichero, fichero.name);
  const url = confirmar ? `${ruta}?confirmar_repetido=true` : ruta;
  const r = await fetch(`/api/v1${url}`, {
    method: "POST",
    body: fd,
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    const mensaje =
      r.status === 404
        ? "El servidor en marcha no tiene el importador disponible. Cierra levantar.bat y vuelve a arrancarlo."
        : e?.error?.mensaje || `Error ${r.status}`;
    const error = new Error(mensaje);
    error.status = r.status;
    throw error;
  }
  return r.json();
}

export default vista("importar", async () => {
  const historial = await API.get("/importacion/historial").catch(() => ({ items: [] }));

  setTimeout(() => {
    const input = document.getElementById("input-fichero");
    const dropzone = document.getElementById("dropzone");
    const wrap = document.getElementById("wrap-resumen");
    const err = document.getElementById("err-importar");

    if (!input || !dropzone) return;

    async function procesar(fichero) {
      if (!fichero) return;
      ficheroPendiente = fichero;
      err.innerHTML = "";
      wrap.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Analizando hojas y fórmulas del Excel...</p>
        </div>
      `;
      try {
        const data = await postArchivo("/importacion/previsualizar", fichero, false);
        wrap.innerHTML = resumenPrev(data);

        const btnAplicar = wrap.querySelector("[data-accion=importar-aplicar]");
        btnAplicar?.addEventListener("click", async () => {
          btnAplicar.disabled = true;
          btnAplicar.innerHTML = "Aplicando importación...";
          try {
            await postArchivo("/importacion/aplicar", ficheroPendiente, false);
            alert("¡Importación completada con éxito!");
            location.hash = "#/inicio";
          } catch (e2) {
            if (e2.status === 409) {
              const ok = confirm(
                "Este fichero ya fue importado anteriormente.\n¿Deseas duplicar los movimientos de todos modos?"
              );
              if (ok) {
                await postArchivo("/importacion/aplicar", ficheroPendiente, true);
                alert("Importación duplicada aplicada.");
                location.hash = "#/inicio";
                return;
              }
            }
            err.innerHTML = `<div class="alerta-error">${esc(e2.message)}</div>`;
            btnAplicar.disabled = false;
            btnAplicar.innerHTML = "Reintentar importación";
          }
        });
      } catch (e) {
        wrap.innerHTML = "";
        err.innerHTML = `<div class="alerta-error">${esc(e.message)}</div>`;
      }
    }

    input.addEventListener("change", (e) => procesar(e.target.files[0]));
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files?.[0]) procesar(e.dataTransfer.files[0]);
    });
  }, 0);

  return `
  <div class="page-header-row">
    <div>
      <h2 class="page-title">Importar Excel Histórico</h2>
      <p class="page-subtitle">Carga las 14 hojas de tu archivo OCTUBRE.xlsx para poblar cuentas, botes y saldos</p>
    </div>
  </div>

  <section class="section-block">
    <div class="upload-dropzone" id="dropzone">
      <div class="upload-icon">${icono("subir")}</div>
      <h3 class="upload-title">Arrastra tu archivo Excel aquí</h3>
      <p class="upload-subtitle">Soporta archivos <code>.xlsx</code> (formato OCTUBRE con hojas de CAJA y botes)</p>
      <label class="btn-primary mini upload-btn">
        Seleccionar archivo del equipo
        <input id="input-fichero" type="file" accept=".xlsx" style="display:none">
      </label>
    </div>
    <div id="err-importar"></div>
    <div id="wrap-resumen"></div>
  </section>

  ${
    historial.items.length > 0
      ? `
  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Archivos Importados Previamente</h3>
        <p class="section-desc">Historial de cargas con huella de verificación criptográfica</p>
      </div>
    </div>
    <div class="files-history-list">
      ${historial.items.map(tarjetaFichero).join("\n")}
    </div>
  </section>
  `
      : ""
  }
  `;
});
