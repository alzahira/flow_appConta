// Vista de Tarjetas Regalo y Monederos: Gestión del dinero en tarjetas prepago y regalo
import { vista, esc, importe, hoy, icono, subnavCuentas } from "../vistas.js";

export function esTarjetaRegalo(c) {
  if (c.tipo !== "tarjeta") return false;
  const txt = `${c.nombre} ${c.entidad || ""}`.toLowerCase();
  const esBanco =
    txt.includes("caixa") ||
    txt.includes("deutsche") ||
    txt.includes("bbva") ||
    txt.includes("revolut") ||
    txt.includes("santander") ||
    txt.includes("banco") ||
    txt.includes("bank");
  if (esBanco && !txt.includes("regalo")) return false;
  return (
    txt.includes("regalo") ||
    txt.includes("gift") ||
    txt.includes("monedero") ||
    txt.includes("prepago") ||
    txt.includes("amazon") ||
    txt.includes("corte ingles") ||
    txt.includes("corte inglés") ||
    txt.includes("ikea") ||
    txt.includes("decathlon") ||
    txt.includes("zalando") ||
    txt.includes("steam") ||
    (!txt.includes("carrefour pass") && txt.includes("carrefour regalo")) ||
    (c.entidad && c.entidad.toLowerCase().includes("regalo"))
  );
}

function obtenerEstiloComercio(entidad, nombre) {
  const txt = `${entidad} ${nombre}`.toLowerCase();
  if (txt.includes("amazon")) return { clase: "gift-amazon", badge: "Amazon", color: "#ff9900" };
  if (txt.includes("corte") || txt.includes("eci")) return { clase: "gift-eci", badge: "El Corte Inglés", color: "#006738" };
  if (txt.includes("carrefour")) return { clase: "gift-carrefour", badge: "Carrefour", color: "#004e9a" };
  if (txt.includes("ikea")) return { clase: "gift-ikea", badge: "IKEA", color: "#ffcc00" };
  if (txt.includes("decathlon")) return { clase: "gift-decathlon", badge: "Decathlon", color: "#0082c3" };
  if (txt.includes("zalando")) return { clase: "gift-zalando", badge: "Zalando", color: "#ff6900" };
  return { clase: "gift-generica", badge: entidad || "Tarjeta Regalo", color: "#10b981" };
}

function tarjetaRegaloItem(c) {
  const estilo = obtenerEstiloComercio(c.entidad || "", c.nombre || "");
  const saldoNum = Number(c.saldo);

  return `
    <article class="gift-card-fintech ${estilo.clase}">
      <div class="gift-card-shine"></div>
      
      <div class="gift-card-top-row">
        <div class="gift-card-ribbon">
          <span class="ribbon-icon">${icono("regalo")}</span>
          <span class="ribbon-text">${esc(estilo.badge)}</span>
        </div>
        <button class="btn-action-icon delete dark" data-accion="borrar-cuenta" data-id="${c.id}" data-nombre="${esc(c.nombre)}" title="Eliminar tarjeta regalo">
          ${icono("borrar")}
        </button>
      </div>

      <div class="gift-card-middle">
        <h3 class="gift-card-title">${esc(c.nombre)}</h3>
        <span class="gift-card-tag">${esc(c.entidad || "Tarjeta Regalo / Prepago")}</span>
      </div>

      <div class="gift-card-bottom-row">
        <div class="gift-card-balance-block">
          <span class="gift-card-balance-label">Saldo disponible</span>
          <div class="gift-card-balance-value">${importe(c.saldo)}</div>
        </div>
        <div class="gift-card-meta">
          <span>Carga inicial: ${c.saldo_inicial} €</span>
          <span>Fecha: ${c.fecha_apertura}</span>
        </div>
      </div>
    </article>
  `;
}

export default vista("tarjetas-regalo", async () => {
  const data = await API.get("/cuentas");
  const tarjetasRegalo = data.items.filter(esTarjetaRegalo);
  const totalRegalo = tarjetasRegalo.reduce((acc, c) => acc + Number(c.saldo), 0);

  return `
  ${subnavCuentas("tarjetas-regalo")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Tarjetas Regalo y Monederos</h2>
      <p class="page-subtitle">Control del dinero disponible en tarjetas regalo de Amazon, El Corte Inglés, Carrefour y prepago</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Total en Tarjetas Regalo</span>
      <span class="header-total-value">${importe(totalRegalo.toFixed(2))}</span>
      <span class="header-total-sub">${tarjetasRegalo.length} tarjeta(s) con saldo activo</span>
    </div>
  </div>

  <section class="section-block">
    <div class="section-header">
      <div>
        <h3 class="section-title">Tus Tarjetas Regalo con Saldo</h3>
        <p class="section-desc">Dinero real prepagado listo para consumir en comercios</p>
      </div>
    </div>

    <div class="grid-gift-cards">
      ${
        tarjetasRegalo.length > 0
          ? tarjetasRegalo.map(tarjetaRegaloItem).join("\n")
          : `<div class="empty-state">
              <span class="empty-icon">${icono("regalo")}</span>
              <p>No tienes ninguna tarjeta regalo guardada aún.</p>
              <span class="empty-sub">Añade tus tarjetas regalo de Amazon, El Corte Inglés u otros comercios para tener controlado tu saldo disponible.</span>
            </div>`
      }
    </div>
  </section>

  <section class="section-block">
    <div class="form-card-container">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("regalo")}</div>
        <div>
          <h3 class="form-card-title">Añadir Tarjeta Regalo o Monedero</h3>
          <p class="form-card-subtitle">Registra el saldo disponible para tenerlo computado en tus fondos</p>
        </div>
      </div>

      <div class="template-pills-row">
        <span class="template-label">Comercios habituales:</span>
        <button type="button" class="btn-template-pill" onclick="document.getElementById('gr-entidad').value='Amazon (Regalo)'; document.getElementById('gr-nombre').value='Tarjeta Amazon'; document.getElementById('gr-saldo').focus();">
          🛒 Amazon
        </button>
        <button type="button" class="btn-template-pill" onclick="document.getElementById('gr-entidad').value='El Corte Inglés (Regalo)'; document.getElementById('gr-nombre').value='Tarjeta El Corte Inglés'; document.getElementById('gr-saldo').focus();">
          🛍️ El Corte Inglés
        </button>
        <button type="button" class="btn-template-pill" onclick="document.getElementById('gr-entidad').value='Carrefour (Regalo)'; document.getElementById('gr-nombre').value='Tarjeta Regalo Carrefour'; document.getElementById('gr-saldo').focus();">
          ⛽ Carrefour
        </button>
        <button type="button" class="btn-template-pill" onclick="document.getElementById('gr-entidad').value='IKEA (Regalo)'; document.getElementById('gr-nombre').value='Tarjeta Regalo IKEA'; document.getElementById('gr-saldo').focus();">
          🪑 IKEA
        </button>
        <button type="button" class="btn-template-pill" onclick="document.getElementById('gr-entidad').value='Decathlon (Regalo)'; document.getElementById('gr-nombre').value='Tarjeta Decathlon'; document.getElementById('gr-saldo').focus();">
          🏃 Decathlon
        </button>
      </div>

      <form data-accion="crear-tarjeta-regalo" data-err="err-regalo" class="fintech-form">
        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="gr-nombre" class="form-label">Nombre descriptivo</label>
            <input id="gr-nombre" name="nombre" placeholder="Ej. Tarjeta Amazon 50€, Tarjeta Regalo El Corte Inglés..." required>
          </div>
          <div class="form-group form-span-2">
            <label for="gr-entidad" class="form-label">Comercio / Emisor</label>
            <input id="gr-entidad" name="entidad" placeholder="Ej. Amazon, El Corte Inglés, Carrefour, IKEA, Zara..." required>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="gr-saldo" class="form-label">Saldo Disponible en la Tarjeta (€)</label>
            <input id="gr-saldo" name="saldo_inicial" inputmode="decimal" placeholder="Ej. 50.00" required>
          </div>
          <div class="form-group form-span-2">
            <label for="gr-fecha" class="form-label">Fecha de Recepción / Alta</label>
            <input id="gr-fecha" name="fecha_apertura" type="date" value="${hoy()}" required>
          </div>
        </div>

        <div id="err-regalo"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Guardar Tarjeta Regalo
          </button>
        </div>
      </form>
    </div>
  </section>
  `;
});
