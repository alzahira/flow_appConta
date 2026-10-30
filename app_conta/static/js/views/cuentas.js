// Vista de Cuentas y Depósitos: Organización clara y elegante por entidades bancarias activas
import { vista, esc, importe, hoy, fechaCorta, icono, subnavCuentas } from "../vistas.js";

const BANCOS_CONFIG = [
  { id: "caixa", nombre: "CaixaBank / Caixa", iconoKey: "caixa", color: "#0072ce" },
  { id: "deutsche", nombre: "Deutsche Bank", iconoKey: "deutsche", color: "#0018a8" },
  { id: "bbva", nombre: "BBVA", iconoKey: "bbva", color: "#004481" },
  { id: "revolut", nombre: "Revolut", iconoKey: "revolut", color: "#0f172a" },
  { id: "otros", nombre: "Otros Depósitos y Entidades", iconoKey: "banco", color: "#059669" },
];

function clasificarBanco(cuenta) {
  const nombre = (cuenta.nombre || "").toLowerCase();
  const entidad = (cuenta.entidad || "").toLowerCase();
  const texto = `${nombre} ${entidad}`;

  if (texto.includes("caixa")) return "caixa";
  if (texto.includes("deutsche") || texto.includes("deustche") || texto.includes(" db")) return "deutsche";
  if (texto.includes("bbva")) return "bbva";
  if (texto.includes("revolut")) return "revolut";
  return "otros";
}

function tarjetaCuentaRow(c) {
  const bancoId = clasificarBanco(c);
  const bancoConfig = BANCOS_CONFIG.find((b) => b.id === bancoId) || {
    id: "otros",
    nombre: c.entidad || "Depósito Bancario",
    iconoKey: c.tipo === "efectivo" ? "efectivo" : "banco",
    color: "#059669",
  };
  const iconoKey = c.tipo === "efectivo" ? "efectivo" : bancoConfig.iconoKey;
  const esEfectivo = c.tipo === "efectivo";
  const tipoLabel = esEfectivo ? "Efectivo / Caja" : c.tipo === "inversion" ? "Inversión" : "Cuenta Corriente";

  return `
    <article class="card-account-row ${bancoId}">
      <div class="acc-row-main">
        <div class="acc-row-icon ${bancoId}">
          ${icono(iconoKey)}
        </div>
        <div class="acc-row-details">
          <div class="acc-row-header-texts">
            <h3 class="acc-row-title">${esc(c.nombre)}</h3>
            <span class="badge-subtle">${esc(c.entidad || bancoConfig.nombre)}</span>
            <span class="badge-tag">${esc(tipoLabel)}</span>
          </div>
          <div class="acc-row-meta">
            <span class="meta-item"><span class="meta-label">Saldo inicial:</span> <span class="meta-val">${c.saldo_inicial} €</span></span>
            <span class="meta-dot">&bull;</span>
            <span class="meta-item"><span class="meta-label">Apertura:</span> <span class="meta-val">${fechaCorta(c.fecha_apertura)}</span></span>
          </div>
        </div>
      </div>

      <div class="acc-row-side">
        <div class="acc-row-balance-block">
          <span class="balance-sub">Saldo disponible</span>
          <div class="acc-row-balance-value">${importe(c.saldo)}</div>
        </div>
        <div class="acc-row-actions">
          <button class="btn-action-icon delete" data-accion="borrar-cuenta" data-id="${c.id}" data-nombre="${esc(c.nombre)}" title="Eliminar esta cuenta">
            ${icono("borrar")}
          </button>
        </div>
      </div>
    </article>
  `;
}

export default vista("cuentas", async () => {
  const data = await API.get("/cuentas");

  // Filtramos: solo cuentas y depósitos (excluimos tarjetas, van a su pestaña propia)
  const cuentasValidas = data.items.filter(
    (c) => c.tipo !== "tarjeta" && !c.nombre.toUpperCase().startsWith("TARJETA")
  );

  // Agrupamos por banco para la barra de resumen superior
  const agrupado = {
    caixa: [],
    deutsche: [],
    bbva: [],
    revolut: [],
    otros: [],
  };

  cuentasValidas.forEach((c) => {
    const bancoId = clasificarBanco(c);
    agrupado[bancoId].push(c);
  });

  const totalCuentas = cuentasValidas.reduce((acc, c) => acc + Number(c.saldo), 0);

  // Filtramos SOLO las entidades bancarias que tienen cuentas registradas
  const bancosConCuentas = BANCOS_CONFIG.filter((b) => (agrupado[b.id] || []).length > 0);

  return `
  ${subnavCuentas("cuentas")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Cuentas y Depósitos</h2>
      <p class="page-subtitle">Posición consolidada por entidades bancarias y depósitos líquidos</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Total en Cuentas y Depósitos</span>
      <span class="header-total-value">${importe(totalCuentas.toFixed(2))}</span>
    </div>
  </div>

  <!-- Resumen de entidades activas -->
  ${
    bancosConCuentas.length > 1
      ? `
    <div class="bank-pills-summary">
      ${bancosConCuentas
        .map((b) => {
          const cuentasB = agrupado[b.id] || [];
          const subtotalB = cuentasB.reduce((acc, c) => acc + Number(c.saldo), 0);
          return `
          <div class="bank-pill-item">
            <span class="bank-pill-dot" style="background: ${b.color};"></span>
            <span class="bank-pill-name">${b.nombre}</span>
            <span class="bank-pill-val">${importe(subtotalB.toFixed(2))}</span>
          </div>
        `;
        })
        .join("")}
    </div>
  `
      : ""
  }

  <!-- Listado de cuentas a ancho completo -->
  <section class="section-block">
    <div class="accounts-list-full">
      ${
        cuentasValidas.length > 0
          ? cuentasValidas.map(tarjetaCuentaRow).join("\n")
          : `
          <div class="tarjeta-vacia">
            <div class="tarjeta-vacia-icon">${icono("banco")}</div>
            <h4>No tienes cuentas bancarias registradas todavía</h4>
            <p>Añade tu primera cuenta corriente, libreta de ahorro o depósito en el formulario inferior para comenzar a registrar movimientos.</p>
          </div>
        `
      }
    </div>
  </section>

  <!-- Formulario para dar de alta nueva cuenta -->
  <section class="section-block">
    <details class="form-inversion-details">
      <summary class="btn-nuevo-inversion-trigger">
        ${icono("plus")} Dar de alta nueva cuenta bancaria o depósito
      </summary>
      <div class="form-container" style="padding: 0 1.5rem 1.5rem 1.5rem;">
        <form data-accion="crear-cuenta" data-err="err-cuenta" class="fintech-form">
          <h3 class="form-title" style="margin-top: 0.5rem;">Nueva Cuenta o Depósito</h3>
          <p class="form-desc">Registra una cuenta corriente, depósito o caja de efectivo para gestionar cobros y pagos.</p>

          <div class="form-grid-2">
            <div class="campo">
              <label for="ct-nombre">Nombre de la cuenta *</label>
              <input id="ct-nombre" name="nombre" placeholder="Ej. Cuenta Nómina Caixa, Disponible BBVA, Efectivo Caja..." required>
            </div>
            <div class="campo">
              <label for="ct-entidad">Entidad Bancaria / Plataforma *</label>
              <select id="ct-entidad" name="entidad" required>
                <option value="Caixa">CaixaBank</option>
                <option value="Deutsche Bank">Deutsche Bank</option>
                <option value="BBVA">BBVA</option>
                <option value="Revolut">Revolut</option>
                <option value="Otros">Otra Entidad</option>
              </select>
            </div>
          </div>

          <div class="form-grid-3">
            <div class="campo">
              <label for="ct-tipo">Tipo de depósito</label>
              <select id="ct-tipo" name="tipo" required>
                <option value="banco">🏦 Cuenta Bancaria Corriente</option>
                <option value="efectivo">💵 Efectivo / Caja</option>
                <option value="inversion">📈 Inversión / Fondo</option>
              </select>
            </div>
            <div class="campo">
              <label for="ct-saldo">Saldo inicial (€)</label>
              <input id="ct-saldo" name="saldo_inicial" inputmode="decimal" placeholder="0.00" value="0.00">
            </div>
            <div class="campo">
              <label for="ct-apertura">Fecha de apertura</label>
              <input id="ct-apertura" name="fecha_apertura" type="date" value="${hoy()}" required>
            </div>
          </div>

          <div id="err-cuenta"></div>

          <div class="form-actions" style="margin-top: 1rem;">
            <button type="submit" class="btn-primary">
              ${icono("plus")} Crear Cuenta Bancaria
            </button>
          </div>
        </form>
      </div>
    </details>
  </section>
  `;
});
