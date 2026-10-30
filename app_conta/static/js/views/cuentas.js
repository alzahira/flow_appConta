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

function tarjetaCuentaItem(c) {
  const esEfectivo = c.tipo === "efectivo";
  const tipoLabel = esEfectivo ? "Efectivo / Caja" : c.tipo === "inversion" ? "Inversión" : "Cuenta Corriente";

  return `
    <article class="card-account-full ${c.tipo}">
      <div class="card-account-top">
        <div class="card-account-icon-wrap">
          <div class="card-account-icon ${c.tipo}">
            ${icono(c.tipo)}
          </div>
          <div class="card-account-title-group">
            <h3 class="account-title">${esc(c.nombre)}</h3>
            <span class="account-institution">${esc(c.entidad || "Depósito Bancario")}</span>
          </div>
        </div>
        <div class="card-account-actions">
          <span class="badge-subtle">${esc(tipoLabel)}</span>
          <button class="btn-action-icon delete" data-accion="borrar-cuenta" data-id="${c.id}" data-nombre="${esc(c.nombre)}" title="Eliminar esta cuenta">
            ${icono("borrar")}
          </button>
        </div>
      </div>
      
      <div class="account-balance-section">
        <span class="balance-sub">Saldo disponible</span>
        <div class="account-balance-value">${importe(c.saldo)}</div>
      </div>

      <div class="card-account-footer">
        <div class="account-meta-item">
          <span class="meta-label">Saldo inicial:</span>
          <span class="meta-val">${c.saldo_inicial} €</span>
        </div>
        <div class="account-meta-item">
          <span class="meta-label">Apertura:</span>
          <span class="meta-val">${fechaCorta(c.fecha_apertura)}</span>
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

  // Agrupamos por banco
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

  <!-- Resumen rápido de entidades con cuentas -->
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
            <span class="bank-pill-count">(${cuentasB.length})</span>
            <span class="bank-pill-val">${importe(subtotalB.toFixed(2))}</span>
          </div>
        `;
        })
        .join("")}
    </div>
  `
      : ""
  }

  <!-- Listado de bancos con cuentas -->
  ${
    bancosConCuentas.length > 0
      ? bancosConCuentas
          .map((banco) => {
            const cuentasBanco = agrupado[banco.id] || [];
            const subtotal = cuentasBanco.reduce((acc, c) => acc + Number(c.saldo), 0);
            return `
        <section class="section-block">
          <div class="bank-group-header">
            <div class="bank-group-title">
              <span class="bank-group-icon ${banco.id}">${icono(banco.iconoKey)}</span>
              <div>
                <h3 class="bank-group-name">${banco.nombre}</h3>
                <span class="bank-group-count">${cuentasBanco.length} ${cuentasBanco.length === 1 ? "cuenta activa" : "cuentas activas"}</span>
              </div>
            </div>
            <div class="bank-group-subtotal">
              <span class="subtotal-label">Subtotal entidad</span>
              <span class="subtotal-value">${importe(subtotal.toFixed(2))}</span>
            </div>
          </div>

          <div class="grid-accounts-large">
            ${cuentasBanco.map(tarjetaCuentaItem).join("\n")}
          </div>
        </section>
      `;
          })
          .join("\n")
      : `
      <div class="tarjeta-vacia">
        <div class="tarjeta-vacia-icon">${icono("banco")}</div>
        <h4>No tienes cuentas bancarias registradas todavía</h4>
        <p>Añade tu primera cuenta corriente, libreta de ahorro o depósito en el formulario inferior para comenzar a registrar movimientos.</p>
      </div>
    `
  }

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
