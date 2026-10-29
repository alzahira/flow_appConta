// Vista de Cuentas y Depósitos: Organización por bancos (Caixa, Deutsche Bank, BBVA, Revolut, Otros)
import { vista, esc, importe, hoy, icono, subnavCuentas } from "../vistas.js";

const BANCOS_CONFIG = [
  { id: "caixa", nombre: "Caixa", iconoKey: "caixa", color: "#0072ce" },
  { id: "deutsche", nombre: "Deutsche Bank", iconoKey: "deutsche", color: "#0018a8" },
  { id: "bbva", nombre: "BBVA", iconoKey: "bbva", color: "#004481" },
  { id: "revolut", nombre: "Revolut", iconoKey: "revolut", color: "#1969ff" },
  { id: "otros", nombre: "Otros Depósitos y Cuentas", iconoKey: "banco", color: "#10b981" },
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
  return `
    <article class="card-account-full ${c.tipo}">
      <div class="card-account-top">
        <div class="card-account-icon ${c.tipo}">
          ${icono(c.tipo)}
        </div>
        <div class="card-account-actions">
          <span class="badge-type">${esc(c.tipo)}</span>
          <button class="btn-action-icon delete" data-accion="borrar-cuenta" data-id="${c.id}" data-nombre="${esc(c.nombre)}" title="Eliminar esta cuenta">
            ${icono("borrar")}
          </button>
        </div>
      </div>
      
      <div class="card-account-body">
        <h3 class="account-title">${esc(c.nombre)}</h3>
        <p class="account-institution">${esc(c.entidad || "Depósito / Cuenta")}</p>
      </div>

      <div class="card-account-footer">
        <div class="account-balance-group">
          <span class="balance-sub">Saldo disponible</span>
          <div class="account-balance-value">${importe(c.saldo)}</div>
        </div>
        <div class="account-meta-small">
          <span>Inicial: ${c.saldo_inicial} €</span>
          <span>Apertura: ${c.fecha_apertura}</span>
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

  return `
  ${subnavCuentas("cuentas")}

  <div class="page-header-row">
    <div>
      <h2 class="page-title">Cuentas y Depósitos</h2>
      <p class="page-subtitle">Posición en entidades bancarias: Caixa, Deutsche Bank, BBVA, Revolut y otros</p>
    </div>
    <div class="header-total-card">
      <span class="header-total-label">Total en Cuentas y Depósitos</span>
      <span class="header-total-value">${importe(totalCuentas.toFixed(2))}</span>
    </div>
  </div>

  ${BANCOS_CONFIG.map((banco) => {
    const cuentasBanco = agrupado[banco.id] || [];
    const subtotal = cuentasBanco.reduce((acc, c) => acc + Number(c.saldo), 0);
    return `
      <section class="section-block">
        <div class="bank-group-header">
          <div class="bank-group-title">
            <span class="bank-group-icon ${banco.id}">${icono(banco.iconoKey)}</span>
            <div>
              <h3 class="bank-group-name">${banco.nombre}</h3>
              <span class="bank-group-count">${cuentasBanco.length} cuenta(s)</span>
            </div>
          </div>
          <div class="bank-group-subtotal">
            <span class="subtotal-label">Subtotal</span>
            <span class="subtotal-value">${importe(subtotal.toFixed(2))}</span>
          </div>
        </div>

        <div class="grid-accounts-large">
          ${
            cuentasBanco.length > 0
              ? cuentasBanco.map(tarjetaCuentaItem).join("\n")
              : `<div class="empty-state mini">
                  <p>Sin cuentas registradas en ${banco.nombre}</p>
                </div>`
          }
        </div>
      </section>
    `;
  }).join("\n")}

  <section class="section-block">
    <div class="form-card-container">
      <div class="form-card-header">
        <div class="form-card-icon">${icono("plus")}</div>
        <div>
          <h3 class="form-card-title">Dar de Alta Nueva Cuenta Bancaria</h3>
          <p class="form-card-subtitle">Añade una cuenta o depósito a Caixa, Deutsche Bank, BBVA, Revolut u otra entidad</p>
        </div>
      </div>

      <form data-accion="crear-cuenta" data-err="err-cuenta" class="fintech-form">
        <div class="form-row-grid">
          <div class="form-group form-span-2">
            <label for="ct-nombre" class="form-label">Nombre de la Cuenta</label>
            <input id="ct-nombre" name="nombre" placeholder="Ej. Cuenta Nómina, Cuenta Ahorro, Disponible..." required>
          </div>
          <div class="form-group form-span-2">
            <label for="ct-entidad" class="form-label">Entidad Bancaria</label>
            <select id="ct-entidad" name="entidad" required>
              <option value="Caixa">Caixa</option>
              <option value="Deutsche Bank">Deutsche Bank</option>
              <option value="BBVA">BBVA</option>
              <option value="Revolut">Revolut</option>
              <option value="Otros">Otra Entidad</option>
            </select>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group">
            <label for="ct-tipo" class="form-label">Tipo de Depósito</label>
            <select id="ct-tipo" name="tipo" required>
              <option value="banco">🏦 Cuenta Bancaria Corriente</option>
              <option value="efectivo">💵 Efectivo / Caja</option>
              <option value="inversion">📈 Inversión / Fondo</option>
            </select>
          </div>
          <div class="form-group">
            <label for="ct-saldo" class="form-label">Saldo Inicial (€)</label>
            <input id="ct-saldo" name="saldo_inicial" inputmode="decimal" placeholder="0.00" value="0.00">
          </div>
          <div class="form-group form-span-2">
            <label for="ct-apertura" class="form-label">Fecha de Apertura</label>
            <input id="ct-apertura" name="fecha_apertura" type="date" value="${hoy()}" required>
          </div>
        </div>

        <div id="err-cuenta"></div>

        <div class="form-actions-right">
          <button type="submit" class="btn-primary">
            ${icono("plus")} Crear Cuenta Bancaria
          </button>
        </div>
      </form>
    </div>
  </section>
  `;
});
