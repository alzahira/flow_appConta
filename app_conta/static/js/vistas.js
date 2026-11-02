// Registro compartido de vistas + helpers de formato, iconos SVG y escape.
// Cada vista (módulo ES en /views) importa `vista()` y se auto-registra.

const rutas = [];

/** Registra una vista: vista("cuentas", renderCuentas). */
export function vista(nombre, render) {
  rutas.push({ nombre, render });
}

/** Devuelve la lista de vistas registradas (para pintar la navegación). */
export function rutasRegistradas() {
  return [...rutas];
}

/** Escapa HTML para inyectar texto del usuario con seguridad. */
export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/** Iconos SVG inline vectoriales limpios y modernos */
export const ICONOS = {
  inicio: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  movimientos: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="19 15 12 22 5 15"/><polyline points="5 9 12 2 19 9"/></svg>`,
  cuentas: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`,
  tarjetas: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><path d="M6 15h2"/></svg>`,
  "gastos-tarjetas": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><line x1="16" x2="16" y1="14" y2="18"/><line x1="14" x2="18" y1="16" y2="16"/></svg>`,
  "tarjetas-regalo": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
  regalo: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
  mas: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  chevron: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  botes: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  categorias: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
  importar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>`,

  // Cuentas
  banco: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
  tarjeta: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><path d="M6 15h2"/></svg>`,
  efectivo: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>`,
  inversion: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,

  // Bancos específicos
  caixa: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  deutsche: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="16" y1="8" x2="8" y2="16"/></svg>`,
  bbva: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  revolut: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H9"/><path d="M9 12l6 8"/><line x1="9" y1="4" x2="9" y2="20"/></svg>`,

  // Botes
  recurrente: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`,
  ahorro: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h1l1-2.5-1-1.5V9c0-1.5-1.5-4-3-4Z"/><path d="M7 11h.01"/><path d="M14 6.5v1"/></svg>`,
  proyecto: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  ajeno: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  prevision: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,

  // Estados & Acciones
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  alerta: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  editar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  borrar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  calendario: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  subir: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  prestamo: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`,
  coche: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.8 2 11v5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
  volver: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  ojo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,

  // Iconos temáticos de transacciones Fintech
  carrito: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
  hogar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  luz: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  telefono: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
  ocio: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
  seguro: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  salud: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  nomina: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  buscar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  filtro: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  flechaArriba: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`,
  flechaAbajo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>`,
  transferencia: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
};


export function icono(nombre) {
  return ICONOS[nombre] || ICONOS.cuentas;
}

/** Importe en euros (string del contrato) → HTML coloreado con signo, céntimos secundarios y formato tabular */
export function importe(centimosStr, extraClase = "", splitDecimals = true) {
  let n = Number(centimosStr || 0);
  const forzarNegativo = typeof extraClase === "string" && extraClase.includes("negativo");
  if (forzarNegativo && n > 0) {
    n = -n;
  }
  const esNeg = n < 0;
  const clase = esNeg ? "negativo" : n > 0 ? "positivo" : "neutro";
  const signo = esNeg ? "−" : "";
  const absVal = Math.abs(n).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (splitDecimals) {
    const comaIdx = absVal.lastIndexOf(",");
    if (comaIdx !== -1) {
      const entero = absVal.slice(0, comaIdx);
      const decimal = absVal.slice(comaIdx);
      return `<span class="importe ${clase} ${extraClase}"><span class="signo">${signo}</span>${entero}<small class="centimos">${decimal}&nbsp;€</small></span>`;
    }
  }
  return `<span class="importe ${clase} ${extraClase}"><span class="signo">${signo}</span>${absVal}&nbsp;<span class="moneda">€</span></span>`;
}

/** Fecha ISO "2026-10-28" → "28 oct 2026" (elegante para listados). */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fechaCorta(iso) {
  if (!iso) return "";
  const partes = String(iso).split("-");
  if (partes.length < 3) return iso;
  const [y, m, d] = partes;
  return `${Number(d)} ${MESES[Number(m) - 1]} ${y}`;
}

/** Fecha de hoy en formato ISO (para inputs date). */
export function hoy() {
  return new Date().toISOString().slice(0, 10);
}

/** Publica el último error de un formulario bajo el propio form. */
export function mostrarError(idwrap, e) {
  const zona = document.getElementById(idwrap);
  if (zona) {
    zona.innerHTML = `<div class="alerta-error">
      <span class="alerta-icono">${ICONOS.alerta}</span>
      <span>${esc(e.message)}</span>
    </div>`;
  }
}

/** Barra de subnavegación tipo píldora para el grupo Cuentas y Tarjetas */
export function subnavCuentas(activa) {
  const tabs = [
    { id: "cuentas", href: "/cuentas", label: "Cuentas y Depósitos", iconoKey: "cuentas" },
    { id: "inversiones", href: "/inversiones", label: "Inversiones", iconoKey: "inversion" },
    { id: "tarjetas", href: "/tarjetas", label: "Tarjetas Bancarias", iconoKey: "tarjetas" },
    { id: "tarjetas-regalo", href: "/tarjetas-regalo", label: "Tarjetas Regalo", iconoKey: "regalo" },
    { id: "pagos-diarios", href: "/pagos-diarios", label: "Pagos Diarios", iconoKey: "carrito" },
    { id: "pagos-recurrentes", href: "/pagos-recurrentes", label: "Recibos Fijos", iconoKey: "prevision" },
  ];

  return `
    <nav class="subnav-pills-bar" aria-label="Subnavegación de Cuentas y Tarjetas">
      ${tabs
        .map(
          (t) => `
        <a href="${t.href}" class="subnav-pill ${activa === t.id ? "activa" : ""}">
          <span class="subnav-pill-icon">${icono(t.iconoKey)}</span>
          <span>${t.label}</span>
        </a>`
        )
        .join("")}
    </nav>
  `;
}


/** Barra de subnavegación tipo píldora para el grupo Ahorro y Botes */
export function subnavAhorro(activa) {
  const tabs = [
    { id: "botes", href: "/botes", label: "Sobres y Botes", iconoKey: "botes" },
    { id: "deben", href: "/deben", label: "Dinero que me deben", iconoKey: "prestamo" },
    { id: "ahorro", href: "/ahorro", label: "Fondo Ahorro Hipoteca", iconoKey: "ahorro" },
  ];

  return `
    <nav class="subnav-pills-bar" aria-label="Subnavegación de Ahorro y Botes">
      ${tabs
        .map(
          (t) => `
        <a href="${t.href}" class="subnav-pill ${activa === t.id ? "activa" : ""}">
          <span class="subnav-pill-icon">${icono(t.iconoKey)}</span>
          <span>${t.label}</span>
        </a>`
        )
        .join("")}
    </nav>
  `;
}

/** Configuración de estilos y categorización semántica para transacciones Fintech */
export function clasificarMovimientoVisual(descripcion, categoriaNombre = "", boteNombre = "", esIngreso = false) {
  const txt = `${descripcion || ""} ${categoriaNombre || ""} ${boteNombre || ""}`.toLowerCase();

  if (esIngreso || txt.includes("nómina") || txt.includes("nomina") || txt.includes("sueldo") || txt.includes("salario") || txt.includes("alquiler córdoba") || txt.includes("alquiler cañete") || txt.includes("alquiler estudio")) {
    return {
      key: "nomina",
      label: "Ingreso / Nómina",
      icono: ICONOS.nomina,
      bg: "rgba(13, 148, 136, 0.12)",
      color: "#0d9488",
      borderColor: "rgba(13, 148, 136, 0.3)",
    };
  }
  if (txt.includes("mercadona") || txt.includes("carrefour") || txt.includes("lidl") || txt.includes("día") || txt.includes("dia") || txt.includes("alcampo") || txt.includes("eroski") || txt.includes("supermercado") || txt.includes("compra") || txt.includes("alimentación") || txt.includes("alimentacion") || txt.includes("comida")) {
    return {
      key: "supermercado",
      label: "Supermercado",
      icono: ICONOS.carrito,
      bg: "rgba(249, 115, 22, 0.12)",
      color: "#ea580c",
      borderColor: "rgba(249, 115, 22, 0.3)",
    };
  }
  if (txt.includes("hipoteca") || txt.includes("comunidad") || txt.includes("casa") || txt.includes("piso") || txt.includes("hogar") || txt.includes("estudio") || txt.includes("verdiales")) {
    return {
      key: "hogar",
      label: "Vivienda e Hipotecas",
      icono: ICONOS.hogar,
      bg: "rgba(99, 102, 241, 0.12)",
      color: "#6366f1",
      borderColor: "rgba(99, 102, 241, 0.3)",
    };
  }
  if (txt.includes("luz") || txt.includes("electricidad") || txt.includes("endesa") || txt.includes("iberdrola") || txt.includes("naturgy") || txt.includes("agua") || txt.includes("gas") || txt.includes("suministro")) {
    return {
      key: "suministros",
      label: "Luz y Suministros",
      icono: ICONOS.luz,
      bg: "rgba(14, 165, 233, 0.12)",
      color: "#0284c7",
      borderColor: "rgba(14, 165, 233, 0.3)",
    };
  }
  if (txt.includes("vodafone") || txt.includes("finetwork") || txt.includes("movistar") || txt.includes("orange") || txt.includes("o2") || txt.includes("fibra") || txt.includes("teléfono") || txt.includes("telefono") || txt.includes("móvil") || txt.includes("movil")) {
    return {
      key: "telecom",
      label: "Telefonía e Internet",
      icono: ICONOS.telefono,
      bg: "rgba(139, 92, 246, 0.12)",
      color: "#8b5cf6",
      borderColor: "rgba(139, 92, 246, 0.3)",
    };
  }
  if (txt.includes("dazn") || txt.includes("netflix") || txt.includes("spotify") || txt.includes("prime") || txt.includes("ocio") || txt.includes("cine") || txt.includes("bar") || txt.includes("cerveza") || txt.includes("restaurante") || txt.includes("cena")) {
    return {
      key: "ocio",
      label: "Ocio y Suscripciones",
      icono: ICONOS.ocio,
      bg: "rgba(236, 72, 153, 0.12)",
      color: "#db2777",
      borderColor: "rgba(236, 72, 153, 0.3)",
    };
  }
  if (txt.includes("gasolina") || txt.includes("combustible") || txt.includes("coche") || txt.includes("moto") || txt.includes("parking") || txt.includes("repsol") || txt.includes("cepsa") || txt.includes("peaje")) {
    return {
      key: "transporte",
      label: "Transporte y Gasolina",
      icono: ICONOS.coche,
      bg: "rgba(234, 179, 8, 0.14)",
      color: "#ca8a04",
      borderColor: "rgba(234, 179, 8, 0.35)",
    };
  }
  if (txt.includes("seguro") || txt.includes("ibi") || txt.includes("cruz roja") || txt.includes("tributo") || txt.includes("impuesto") || txt.includes("basura")) {
    return {
      key: "seguro",
      label: "Seguros e Impuestos",
      icono: ICONOS.seguro,
      bg: "rgba(71, 85, 105, 0.12)",
      color: "#475569",
      borderColor: "rgba(71, 85, 105, 0.3)",
    };
  }
  if (txt.includes("farmacia") || txt.includes("médico") || txt.includes("medico") || txt.includes("dentista") || txt.includes("salud") || txt.includes("óptica")) {
    return {
      key: "salud",
      label: "Salud y Bienestar",
      icono: ICONOS.salud,
      bg: "rgba(190, 18, 60, 0.10)",
      color: "#be123c",
      borderColor: "rgba(190, 18, 60, 0.25)",
    };
  }
  if (txt.includes("ahorro") || txt.includes("paro") || txt.includes("reserva") || txt.includes("bote") || txt.includes("guardado")) {
    return {
      key: "ahorro",
      label: "Sobres y Ahorro",
      icono: ICONOS.botes,
      bg: "rgba(99, 102, 241, 0.12)",
      color: "#4f46e5",
      borderColor: "rgba(99, 102, 241, 0.3)",
    };
  }

  // Por defecto según si es positivo o negativo
  if (esIngreso) {
    return {
      key: "ingreso-general",
      label: "Ingreso",
      icono: ICONOS.flechaArriba,
      bg: "rgba(13, 148, 136, 0.12)",
      color: "#0d9488",
      borderColor: "rgba(13, 148, 136, 0.3)",
    };
  }
  return {
    key: "gasto-general",
    label: "Gasto",
    icono: ICONOS.flechaAbajo,
    bg: "rgba(241, 245, 249, 0.9)",
    color: "#64748b",
    borderColor: "rgba(203, 213, 225, 0.6)",
  };
}

/** Insignia bancaria con logotipo y color corporativo */
export function renderInsigniaCuenta(cuenta) {
  if (!cuenta) return "";
  const nombre = (cuenta.nombre || "").toLowerCase();
  const entidad = (cuenta.entidad || "").toLowerCase();
  const texto = `${nombre} ${entidad}`;

  let bg = "#f1f5f9";
  let color = "#475569";
  let border = "#e2e8f0";
  let icon = ICONOS.banco;

  if (texto.includes("caixa")) {
    bg = "rgba(0, 114, 206, 0.08)";
    color = "#0072ce";
    border = "rgba(0, 114, 206, 0.25)";
    icon = ICONOS.caixa;
  } else if (texto.includes("deutsche") || texto.includes("deustche") || texto.includes(" db")) {
    bg = "rgba(0, 24, 168, 0.08)";
    color = "#0018a8";
    border = "rgba(0, 24, 168, 0.25)";
    icon = ICONOS.deutsche;
  } else if (texto.includes("bbva")) {
    bg = "rgba(0, 68, 129, 0.08)";
    color = "#004481";
    border = "rgba(0, 68, 129, 0.25)";
    icon = ICONOS.bbva;
  } else if (texto.includes("revolut")) {
    bg = "rgba(15, 23, 42, 0.08)";
    color = "#0f172a";
    border = "rgba(15, 23, 42, 0.25)";
    icon = ICONOS.revolut;
  } else if (cuenta.tipo === "efectivo" || texto.includes("efectivo") || texto.includes("caja")) {
    bg = "rgba(13, 148, 136, 0.08)";
    color = "#0d9488";
    border = "rgba(13, 148, 136, 0.25)";
    icon = ICONOS.efectivo;
  } else if (cuenta.tipo === "tarjeta" || texto.includes("tarjeta")) {
    bg = "rgba(124, 58, 237, 0.08)";
    color = "#7c3aed";
    border = "rgba(124, 58, 237, 0.25)";
    icon = ICONOS.tarjeta;
  }

  return `
    <span class="pill-banco" style="background: ${bg}; color: ${color}; border: 1px solid ${border};" title="${esc(cuenta.entidad || cuenta.nombre)}">
      <span class="pill-banco-icon">${icon}</span>
      <span class="pill-banco-text">${esc(cuenta.nombre)}</span>
    </span>
  `;
}

/** Formatea una fecha en título de grupo ("Sábado, 31 de octubre de 2026") */
export function fechaTituloGrupo(iso) {
  if (!iso) return "Fecha sin determinar";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const mesesCompletos = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const hoyStr = hoy();
    if (iso === hoyStr) {
      return `Hoy, ${d} de ${mesesCompletos[m - 1]} de ${y}`;
    }
    const diaSemana = dias[dateObj.getDay()];
    return `${diaSemana}, ${d} de ${mesesCompletos[m - 1]} de ${y}`;
  } catch (_e) {
    return fechaCorta(iso);
  }
}


