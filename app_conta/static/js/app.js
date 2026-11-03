// Router de la PWA (T023). Cada vista vive en /views y se auto-registra.
import { rutasRegistradas, esc } from "./vistas.js";
import { pintarNav } from "./nav.js";
import { renderLogin } from "./views/login.js";

// Import de vistas con efecto de registro (orden = orden de la navegación):
import "./views/inicio.js";
import "./views/cuentas.js";
import "./views/inversiones.js";
import "./views/tarjetas.js";
import "./views/tarjetas-regalo.js";
import "./views/ahorro.js";
import "./views/botes.js";
import "./views/prevision-gastos.js";
import "./views/deben.js";
import "./views/movimientos.js";
import "./views/gastos-tarjetas.js";
import "./views/pagos-diarios.js";
import "./views/prestamos.js";
import "./views/categorias.js";
import "./views/importar.js";
import "./views/copia-seguridad.js";
import "./views/pagos-recurrentes.js";
import { iniciarModalesAcciones } from "./modales-acciones.js";

export function irA(ruta, reemplazar = false) {
  const limpia = String(ruta || "").replace(/^#\/?/, "").replace(/^\//, "");
  const targetPath = limpia && limpia !== "inicio" ? `/${limpia}` : "/";
  if (reemplazar) {
    window.history.replaceState(null, "", targetPath);
  } else if (window.location.pathname !== targetPath) {
    window.history.pushState(null, "", targetPath);
  }
  navegar();
}
window.irA = irA;

export async function navegar() {
  if (!usuarioActual) {
    const u = await verificarSesion();
    if (!u) {
      const navContainer = document.getElementById("nav");
      if (navContainer) navContainer.style.display = "none";
      const portal = document.getElementById("nav-sheet-portal");
      if (portal) portal.style.display = "none";
      const mainEl = document.getElementById("vista");
      if (mainEl) {
        renderLogin(mainEl, async (user) => {
          usuarioActual = user;
          if (navContainer) navContainer.style.display = "";
          if (portal) portal.style.display = "";
          pintarNav(rutasRegistradas());
          iniciarModalesAcciones();
          await navegar();
        });
      }
      return;
    }
    usuarioActual = u;
  }

  // 1. Obtener la ruta limpia desde pathname o hash de compatibilidad
  let ruta = window.location.pathname.replace(/^\//, "") || "";
  if (!ruta && window.location.hash) {
    ruta = window.location.hash.replace(/^#\/?/, "");
    window.history.replaceState(null, "", ruta && ruta !== "inicio" ? `/${ruta}` : "/");
  }
  if (!ruta || ruta === "index.html") {
    ruta = "inicio";
  }

  const actual = rutasRegistradas().find((v) => v.nombre === ruta) || rutasRegistradas()[0];
  if (!actual) return;

  // Resaltar la pestaña del grupo activo en la barra inferior flotante
  const grupoCuentas = ["cuentas", "inversiones", "tarjetas", "tarjetas-regalo"];
  const grupoBotes = ["botes", "ahorro"];
  const grupoMas = ["pagos-diarios", "gastos-tarjetas", "prestamos", "prevision-gastos", "pagos-recurrentes", "categorias", "copia-seguridad", "deben", "importar"];

  document.querySelectorAll("nav a[data-nav-group]").forEach((a) => {
    const grupo = a.dataset.navGroup;
    let activa = false;
    if (grupo === "inicio" && actual.nombre === "inicio") activa = true;
    else if (grupo === "cuentas" && grupoCuentas.includes(actual.nombre)) activa = true;
    else if (grupo === "botes" && grupoBotes.includes(actual.nombre)) activa = true;
    else if (grupo === "movimientos" && actual.nombre === "movimientos") activa = true;
    a.classList.toggle("activa", activa);
  });

  // Resaltar elementos del menú desplegable / drawer de cristal Más
  document.querySelectorAll(".glass-sheet-item[data-vista], .dropdown-item[data-vista]").forEach((a) => {
    a.classList.toggle("activa", a.dataset.vista === actual.nombre);
  });

  // Marcar el botón desplegable "Más" cuando alguna de sus rutas esté activa
  const btnMas = document.getElementById("btn-nav-mas");
  if (btnMas) {
    btnMas.classList.toggle("activa", grupoMas.includes(actual.nombre));
  }

  const main = document.getElementById("vista");
  if (!main) return;
  try {
    main.innerHTML = await actual.render();
    main.dataset.vista = actual.nombre;
  } catch (e) {
    main.innerHTML = `<div class="tarjeta mensaje-error">No se pudo cargar la pantalla: ${e.message}</div>`;
  }

  // Desplazar siempre al principio de la nueva pantalla (solución al scroll intermedio)
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.body.scrollTo({ top: 0, left: 0, behavior: "instant" });
  if (main) main.scrollTop = 0;
}
window.navegar = navegar;

/**
 * Delegación global de emits (instalada una sola vez):
 * - <form data-accion="…"> → submit
 * - [data-accion]          → click
 */
document.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-accion]");
  if (!form) return;
  e.preventDefault();
  const datos = new FormData(form);
  const errWrap = document.getElementById(form.dataset.err || "-");
  try {
    if (form.dataset.accion === "crear-cuenta") {
      await API.post("/cuentas", {
        nombre: datos.get("nombre"),
        tipo: datos.get("tipo"),
        entidad: datos.get("entidad") || null,
        saldo_inicial: datos.get("saldo_inicial") || "0.00",
        fecha_apertura: datos.get("fecha_apertura"),
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "crear-movimiento") {
      const signo = datos.get("signo") || form.querySelector("[name=signo]:checked")?.value || "-";
      const valor = String(datos.get("importe") || "").replace(",", ".").trim();
      const rawBoteId = String(datos.get("bote_id") || datos.get("destino") || "");
      const categoriaId = datos.get("categoria_id");
      const cuentaId = Number(datos.get("cuenta_id"));
      const fecha = datos.get("fecha");
      const desc = datos.get("descripcion");

      if (rawBoteId.startsWith("prestamo:")) {
        const prestamoId = Number(rawBoteId.split(":")[1]);
        if (signo === "+") {
          // Si es ingreso, primero anotamos la entrada en cuenta y luego amortizamos el préstamo
          await API.post("/movimientos", {
            fecha,
            importe: `+${valor}`,
            descripcion: desc,
            cuenta_id: cuentaId,
            categoria_id: categoriaId ? Number(categoriaId) : null,
          });
        }
        await API.post(`/prestamos/${prestamoId}/pagar`, {
          importe: valor,
          cuenta_id: cuentaId,
          concepto: `Amortización préstamo: ${desc}`,
          fecha,
        });
      } else {
        const boteId = rawBoteId && rawBoteId !== "cuenta" ? Number(rawBoteId) : null;
        await API.post("/movimientos", {
          fecha,
          importe: `${signo}${valor}`,
          descripcion: desc,
          cuenta_id: cuentaId,
          bote_id: boteId,
          categoria_id: categoriaId ? Number(categoriaId) : null,
        });
      }
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "crear-categoria") {
      await API.post("/categorias", {
        nombre: datos.get("nombre"),
        color: datos.get("color") || null,
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "filtrar-categorias") {
      const { fijarPeriodo } = await import("./views/categorias.js");
      fijarPeriodo(datos.get("desde"), datos.get("hasta"));
      await navegar();
    } else if (form.dataset.accion === "crear-bote") {
      const objetivo = String(datos.get("objetivo") || "").replace(",", ".").trim();
      await API.post("/botes", {
        nombre: datos.get("nombre"),
        tipo: datos.get("tipo"),
        categoria: datos.get("categoria") || null,
        objetivo: objetivo || null,
        objetivo_fecha: datos.get("objetivo_fecha") || null,
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "crear-bote-ahorro") {
      const objetivo = String(datos.get("objetivo") || "").replace(",", ".").trim();
      await API.post("/botes", {
        nombre: datos.get("nombre"),
        tipo: "ahorro",
        objetivo: objetivo || null,
        objetivo_fecha: datos.get("objetivo_fecha") || null,
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "crear-tarjeta-regalo") {
      const saldoInicial = String(datos.get("saldo_inicial") || "0.00").replace(",", ".").trim();
      const entidad = datos.get("entidad") || "Tarjeta Regalo";
      await API.post("/cuentas", {
        nombre: datos.get("nombre"),
        tipo: "tarjeta",
        entidad: entidad.toLowerCase().includes("regalo") ? entidad : `${entidad} (Regalo)`,
        saldo_inicial: saldoInicial,
        fecha_apertura: datos.get("fecha_apertura"),
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "crear-deuda") {
      const importe = String(datos.get("importe") || "").replace(",", ".").trim();
      await API.post("/deudas", {
        deudor: datos.get("deudor"),
        concepto: datos.get("concepto"),
        importe: importe,
        fecha: datos.get("fecha"),
        fecha_limite: datos.get("fecha_limite") || null,
        notas: datos.get("notas") || null,
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "registrar-cobro-deuda") {
      const deudaId = Number(form.dataset.deudaId);
      const importe = String(datos.get("importe") || "").replace(",", ".").trim();
      const cuentaId = datos.get("cuenta_id") ? Number(datos.get("cuenta_id")) : null;
      await API.post(`/deudas/${deudaId}/cobro`, {
        importe: importe,
        cuenta_id: cuentaId,
      });
      await navegar();
    } else if (
      form.dataset.accion === "crear-movimiento-bote" ||
      form.dataset.accion === "crear-movimiento-ahorro"
    ) {
      const boteId = Number(form.dataset.boteId);
      const signo = form.querySelector("[name=signo]:checked")?.value || "+";
      const valor = String(datos.get("importe") || "").replace(",", ".").trim();
      await API.post("/movimientos", {
        fecha: datos.get("fecha"),
        importe: `${signo}${valor}`,
        descripcion: datos.get("descripcion"),
        cuenta_id: Number(datos.get("cuenta_id")),
        bote_id: boteId,
      });
      await navegar();
    } else if (form.dataset.accion === "crear-gasto-recurrente") {
      const impAnual = String(datos.get("importe_anual") || "").replace(",", ".").trim();
      const cuotaM = datos.get("cuota_mensual")
        ? String(datos.get("cuota_mensual")).replace(",", ".").trim()
        : null;
      const pagadoR = datos.get("pagado_real")
        ? String(datos.get("pagado_real")).replace(",", ".").trim()
        : null;
      await API.post("/prevision-gastos", {
        concepto: datos.get("concepto"),
        fecha_cobro: datos.get("fecha_cobro"),
        importe_anual: impAnual,
        cuota_mensual: cuotaM || null,
        pagado_real: pagadoR || null,
        notas: datos.get("notas") || null,
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "crear-inversion") {
      const capAportado = String(datos.get("capital_aportado") || "0.00").replace(",", ".").trim();
      const valActual = datos.get("valor_actual")
        ? String(datos.get("valor_actual")).replace(",", ".").trim()
        : null;
      const cuentaId = datos.get("cuenta_id") ? Number(datos.get("cuenta_id")) : null;
      const crearMov = datos.get("crear_movimiento_inicial") === "true";
      await API.post("/inversiones", {
        nombre: datos.get("nombre"),
        entidad: datos.get("entidad"),
        tipo_activo: datos.get("tipo_activo"),
        capital_aportado: capAportado,
        valor_actual: valActual || capAportado,
        cuenta_id: cuentaId,
        crear_movimiento_inicial: crearMov,
        fecha_inicio: datos.get("fecha_inicio") || null,
        notas: datos.get("notas") || null,
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "aportar-inversion") {
      const invId = Number(form.dataset.id);
      const importe = String(datos.get("importe") || "").replace(",", ".").trim();
      const cuentaId = datos.get("cuenta_id") ? Number(datos.get("cuenta_id")) : null;
      await API.post(`/inversiones/${invId}/aportar`, {
        importe: importe,
        cuenta_origen_id: cuentaId,
      });
      await navegar();
    } else if (form.dataset.accion === "reembolsar-inversion") {
      const invId = Number(form.dataset.id);
      const importe = String(datos.get("importe") || "").replace(",", ".").trim();
      const cuentaId = datos.get("cuenta_id") ? Number(datos.get("cuenta_id")) : null;
      await API.post(`/inversiones/${invId}/reembolsar`, {
        importe: importe,
        cuenta_destino_id: cuentaId,
      });
      await navegar();
    } else if (form.dataset.accion === "crear-prestamo") {
      const impInicial = String(datos.get("importe_inicial") || "").replace(",", ".").trim();
      const impPendienteRaw = datos.get("importe_pendiente");
      const impPendiente = impPendienteRaw ? String(impPendienteRaw).replace(",", ".").trim() : null;
      const cuotaRaw = datos.get("cuota_mensual");
      const cuota = cuotaRaw ? String(cuotaRaw).replace(",", ".").trim() : null;
      const cuentaId = datos.get("cuenta_id") ? Number(datos.get("cuenta_id")) : null;

      await API.post("/prestamos", {
        nombre: datos.get("nombre"),
        entidad: datos.get("entidad"),
        tipo: datos.get("tipo") || "coche",
        importe_inicial: impInicial,
        importe_pendiente: impPendiente || impInicial,
        cuota_mensual: cuota,
        cuenta_id: cuentaId,
        fecha_inicio: datos.get("fecha_inicio") || null,
        fecha_fin: datos.get("fecha_fin") || null,
        notas: datos.get("notas") || null,
      });
      form.reset();
      await navegar();
    } else if (form.dataset.accion === "pagar-prestamo") {
      const pId = Number(form.dataset.id);
      const importe = String(datos.get("importe") || "").replace(",", ".").trim();
      const cuentaId = datos.get("cuenta_id") ? Number(datos.get("cuenta_id")) : null;
      const concepto = datos.get("concepto") ? String(datos.get("concepto")).trim() : null;
      const fecha = datos.get("fecha") || null;

      await API.post(`/prestamos/${pId}/pagar`, {
        importe,
        cuenta_id: cuentaId,
        concepto,
        fecha,
      });
      await navegar();
    }

  } catch (e2) {
    if (errWrap)
      errWrap.innerHTML = `<p class="mensaje-error">${esc(e2.message)}</p>`;
  }
});

window.addEventListener("popstate", navegar);
window.addEventListener("hashchange", navegar);

// Interceptar clicks en enlaces internos para navegación limpia sin almohadilla (#)
document.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (!link) return;
  const href = link.getAttribute("href");
  if (!href) return;

  // Evitar interceptar descargas o enlaces externos
  if (
    link.target === "_blank" ||
    link.hasAttribute("download") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:")
  ) {
    return;
  }

  // Si es una ruta interna de la SPA (con almohadilla o limpia)
  if (
    href.startsWith("#/") ||
    (href.startsWith("/") && !href.startsWith("/static/") && !href.startsWith("/api/"))
  ) {
    e.preventDefault();
    irA(href);
  }
});

/** Delegación única de clicks para acciones de vista (paginación, categorías, borrados…). */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-accion=mas-movimientos]");
  if (btn) {
    const limit = Number(btn.dataset.limit) || 20;
    const offset = Number(btn.dataset.offset) || 0;
    const { pintarFilaMovimiento } = await import("./views/movimientos.js");
    const data = await API.get(`/movimientos?limit=${limit}&offset=${offset}`);
    document
      .getElementById("lista-movimientos")
      .insertAdjacentHTML("beforeend", data.items.map(pintarFilaMovimiento).join(""));
    btn.dataset.offset = offset + data.items.length;
    if (offset + data.items.length >= data.total) btn.closest(".fila-acciones")?.remove();
    return;
  }

  // Borrar Bote / Fondo de ahorro
  const btnBorrarBote = e.target.closest('[data-accion="borrar-bote"]');
  if (btnBorrarBote) {
    const id = Number(btnBorrarBote.dataset.id);
    const nombre = btnBorrarBote.dataset.nombre || "este bote";
    if (!confirm(`¿Deseas eliminar el sobre "${nombre}"?`)) return;
    try {
      await API.del(`/botes/${id}`);
      await navegar();
    } catch (err) {
      const ok = confirm(
        `${err.message}\n¿Confirmas archivar este sobre? Sus movimientos asignados quedarán sin asignar.`
      );
      if (!ok) return;
      try {
        await API.del(`/botes/${id}?confirmar=true`);
        await navegar();
      } catch (err2) {
        alert(`No se pudo eliminar el sobre: ${err2.message}`);
      }
    }
    return;
  }

  // Borrar Cuenta / Tarjeta
  const btnBorrarCuenta = e.target.closest('[data-accion="borrar-cuenta"]');
  if (btnBorrarCuenta) {
    const id = Number(btnBorrarCuenta.dataset.id);
    const nombre = btnBorrarCuenta.dataset.nombre || "esta cuenta";
    if (!confirm(`¿Deseas eliminar la cuenta "${nombre}"?`)) return;
    try {
      await API.del(`/cuentas/${id}`);
      await navegar();
    } catch (err) {
      const ok = confirm(
        `${err.message}\n¿Confirmas archivar esta cuenta para preservar su histórico contable?`
      );
      if (!ok) return;
      try {
        await API.del(`/cuentas/${id}?confirmar_destino=archivar`);
        await navegar();
      } catch (err2) {
        alert(`No se pudo eliminar la cuenta: ${err2.message}`);
      }
    }
    return;
  }

  // Borrar Movimiento
  const btnBorrarMov = e.target.closest('[data-accion="borrar-movimiento"]');
  if (btnBorrarMov) {
    const id = Number(btnBorrarMov.dataset.id);
    const concepto = btnBorrarMov.dataset.concepto || "este movimiento";
    const imp = btnBorrarMov.dataset.importe ? `${btnBorrarMov.dataset.importe} €` : "";

    let mensajeConfirm = `¿Deseas eliminar "${concepto}" ${imp}?`;
    if (concepto.toLowerCase().includes("saldo consolidado")) {
      mensajeConfirm = `⚠️ ATENCIÓN:\n"${concepto}" es el saldo base o consolidado de un bote (${imp}).\n\nSi lo eliminas, ese dinero desaparecerá del bote y causará un descuadre en tu contabilidad.\n\n¿Estás completamente seguro de que deseas eliminarlo?`;
    }
    if (!confirm(mensajeConfirm)) return;
    try {
      await API.del(`/movimientos/${id}`);
      mostrarToastDeshacer(id, concepto, imp);
      await navegar();
    } catch (err) {
      if (err.message && (err.message.includes("forzar=true") || err.message.includes("saldo base/consolidado"))) {
        const forzar = confirm(`⚠️ PROTECCIÓN CONTABLE:\n\n${err.message}\n\n¿Deseas forzar el borrado de todas formas?`);
        if (forzar) {
          try {
            await API.del(`/movimientos/${id}?forzar=true`);
            mostrarToastDeshacer(id, concepto, imp);
            await navegar();
          } catch (errForzar) {
            alert(`No se pudo forzar el borrado: ${errForzar.message}`);
          }
          return;
        }
      } else {
        alert(`No se pudo eliminar el movimiento: ${err.message}`);
      }
    }
    return;
  }

  // Abrir Papelera de Seguridad
  const btnPapelera = e.target.closest('[data-accion="abrir-papelera-movimientos"]');
  if (btnPapelera) {
    const { abrirModalPapelera } = await import("./modales-acciones.js");
    await abrirModalPapelera();
    return;
  }

  // Editar Movimiento (Modal seguro sin cambios accidentales)
  const btnEditMov = e.target.closest('[data-accion="editar-movimiento"]');
  if (btnEditMov) {
    const id = Number(btnEditMov.dataset.id);
    const { abrirModalEditarMovimiento } = await import("./modales-acciones.js");
    await abrirModalEditarMovimiento(id);
    return;
  }

  // Toggle menú contextual en tarjetas de botes y fondos de ahorro
  const btnMenuBote = e.target.closest('[data-accion="toggle-menu-bote"]');
  if (btnMenuBote) {
    const wrapper = btnMenuBote.closest(".card-more-menu-wrapper");
    const dropdown = wrapper?.querySelector(".card-more-dropdown");
    document.querySelectorAll(".card-more-dropdown.is-open").forEach((d) => {
      if (d !== dropdown) d.classList.remove("is-open");
    });
    dropdown?.classList.toggle("is-open");
    return;
  }

  // Cerrar cualquier menú desplegable si se hace clic fuera
  if (!e.target.closest(".card-more-menu-wrapper")) {
    document.querySelectorAll(".card-more-dropdown.is-open").forEach((d) => {
      d.classList.remove("is-open");
    });
  }

  // Filtrar Botes por Categoría
  const btnCatBote = e.target.closest('[data-accion="filtrar-categoria-bote"]');
  if (btnCatBote) {
    const cat = btnCatBote.dataset.categoria;
    const { establecerCategoriaBote } = await import("./views/botes.js");
    establecerCategoriaBote(cat);
    await navegar();
    return;
  }

  // Ver Detalle / Extracto de un Bote
  const btnVerBote = e.target.closest('[data-accion="ver-detalle-bote"]');
  if (btnVerBote) {
    if (e.target.closest(".card-more-menu-wrapper")) return;
    const id = Number(btnVerBote.dataset.id);
    const { seleccionarBote } = await import("./views/botes.js");
    seleccionarBote(id);
    irA("botes");
    return;
  }

  // Cerrar Detalle de un Bote
  const btnCerrarBote = e.target.closest('[data-accion="cerrar-detalle-bote"]');
  if (btnCerrarBote) {
    const { seleccionarBote } = await import("./views/botes.js");
    seleccionarBote(null);
    await navegar();
    return;
  }

  // Ver Detalle / Extracto de Fondo de Ahorro
  const btnVerAhorro = e.target.closest('[data-accion="ver-detalle-ahorro"]');
  if (btnVerAhorro) {
    if (e.target.closest(".card-more-menu-wrapper")) return;
    const id = Number(btnVerAhorro.dataset.id);
    const { seleccionarFondoAhorro } = await import("./views/ahorro.js");
    seleccionarFondoAhorro(id);
    irA("ahorro");
    return;
  }

  // Cerrar Detalle de Fondo de Ahorro
  const btnCerrarAhorro = e.target.closest('[data-accion="cerrar-detalle-ahorro"]');
  if (btnCerrarAhorro) {
    const { seleccionarFondoAhorro } = await import("./views/ahorro.js");
    seleccionarFondoAhorro(null);
    await navegar();
    return;
  }

  // Borrar Deuda (Dinero que me deben)
  const btnBorrarDeuda = e.target.closest('[data-accion="borrar-deuda"]');
  if (btnBorrarDeuda) {
    const id = Number(btnBorrarDeuda.dataset.id);
    const deudor = btnBorrarDeuda.dataset.deudor || "este registro";
    if (!confirm(`¿Deseas eliminar el registro de dinero que te debe "${deudor}"?`)) return;
    try {
      await API.del(`/deudas/${id}`);
      await navegar();
    } catch (err) {
      alert(`No se pudo eliminar la deuda: ${err.message}`);
    }
    return;
  }

  // Previsión de Gastos: Ajustar mes (+ / -)
  const btnAjustarMes = e.target.closest('[data-accion="ajustar-mes-prevision"]');
  if (btnAjustarMes) {
    const delta = Number(btnAjustarMes.dataset.delta);
    try {
      const cfg = await API.get("/prevision-gastos");
      const nuevoMes = Math.max(0, Math.min(12, (cfg.meses_pagados || 0) + delta));
      await API.patch("/prevision-gastos/config", { meses_pagados: nuevoMes });
      await navegar();
    } catch (err) {
      alert(`No se pudo ajustar el mes: ${err.message}`);
    }
    return;
  }

  // Previsión de Gastos: Registrar factura o cobro
  const btnPagarGasto = e.target.closest('[data-accion="pagar-gasto"]');
  if (btnPagarGasto) {
    const id = Number(btnPagarGasto.dataset.id);
    const concepto = btnPagarGasto.dataset.concepto;
    const actual = btnPagarGasto.dataset.actual || "0.00";
    const imp = prompt(
      `Registrar factura o recibo cobrado para "${concepto}":\n\nTotal pagado hasta ahora: ${actual} €\n\nIntroduce el importe a sumar (ej: 140.00)\no pon el signo = delante para sustituir el total (ej: =140.00):`
    );
    if (!imp) return;
    try {
      if (imp.trim().startsWith("=")) {
        const sustituto = imp.trim().substring(1).replace(",", ".").trim();
        await API.patch(`/prevision-gastos/${id}`, { pagado_real: sustituto });
      } else {
        const aSumar = imp.replace(",", ".").trim();
        await API.post(`/prevision-gastos/${id}/pagar`, { importe: aSumar, sumar: true });
      }
      await navegar();
    } catch (err) {
      alert(`No se pudo registrar el pago: ${err.message}`);
    }
    return;
  }

  // Previsión de Gastos: Editar gasto recurrente
  const btnEditarGasto = e.target.closest('[data-accion="editar-gasto"]');
  if (btnEditarGasto) {
    const id = Number(btnEditarGasto.dataset.id);
    const concepto = prompt("Concepto del gasto:", btnEditarGasto.dataset.concepto);
    if (concepto === null) return;
    const fecha = prompt("Fecha o frecuencia de cobro:", btnEditarGasto.dataset.fecha);
    if (fecha === null) return;
    const anual = prompt("Importe anual estimado (€):", btnEditarGasto.dataset.anual);
    if (anual === null) return;
    const cuota = prompt("Cuota mensual a guardar (€, vacío para auto /12):", btnEditarGasto.dataset.cuota);
    if (cuota === null) return;
    const notas = prompt("Notas / referencia (opcional):", btnEditarGasto.dataset.notas);
    if (notas === null) return;
    try {
      await API.patch(`/prevision-gastos/${id}`, {
        concepto: concepto.trim(),
        fecha_cobro: fecha.trim(),
        importe_anual: anual.replace(",", ".").trim(),
        cuota_mensual: cuota ? cuota.replace(",", ".").trim() : null,
        notas: notas.trim() || null,
      });
      await navegar();
    } catch (err) {
      alert(`No se pudo editar el gasto: ${err.message}`);
    }
    return;
  }

  // Previsión de Gastos: Borrar gasto recurrente
  const btnBorrarGasto = e.target.closest('[data-accion="borrar-gasto"]');
  if (btnBorrarGasto) {
    const id = Number(btnBorrarGasto.dataset.id);
    const concepto = btnBorrarGasto.dataset.concepto || "este gasto";
    if (!confirm(`¿Deseas eliminar el gasto recurrente "${concepto}"?`)) return;
    try {
      await API.del(`/prevision-gastos/${id}`);
      await navegar();
    } catch (err) {
      alert(`No se pudo eliminar el gasto: ${err.message}`);
    }
    return;
  }

  // Previsión de Gastos: Restablecer plantilla inicial del Excel
  const btnResetSemilla = e.target.closest('[data-accion="restablecer-semilla-prevision"]');
  if (btnResetSemilla) {
    if (!confirm("¿Deseas restablecer la plantilla con los 16 gastos habituales del hogar (IBI, basuras, seguros, sellos...)? Los importes pagados volverán a sus valores iniciales.")) return;
    try {
      await API.post("/prevision-gastos/restablecer-semilla");
      await navegar();
    } catch (err) {
      alert(`No se pudo restablecer la plantilla: ${err.message}`);
    }
    return;
  }

  // Inversiones: Actualizar valoración de mercado
  const btnActValor = e.target.closest('[data-accion="actualizar-valor-inversion"]');
  if (btnActValor) {
    const id = Number(btnActValor.dataset.id);
    const nombre = btnActValor.dataset.nombre || "esta inversión";
    const actual = btnActValor.dataset.valor || "0.00";
    const nuevo = prompt(
      `Actualizar cotización / valor de mercado de "${nombre}":\n\nValoración actual: ${actual} €\n\nIntroduce el nuevo valor total de mercado (€):`,
      actual
    );
    if (nuevo === null) return;
    const valorStr = nuevo.replace(",", ".").trim();
    if (!valorStr) return;
    try {
      await API.post(`/inversiones/${id}/valoracion`, { valor_actual: valorStr });
      await navegar();
    } catch (err) {
      alert(`No se pudo actualizar la valoración: ${err.message}`);
    }
    return;
  }

  // Inversiones: Borrar posición
  const btnBorrarInv = e.target.closest('[data-accion="borrar-inversion"]');
  if (btnBorrarInv) {
    const id = Number(btnBorrarInv.dataset.id);
    const nombre = btnBorrarInv.dataset.nombre || "esta inversión";
    if (!confirm(`¿Deseas eliminar la posición de inversión "${nombre}"?`)) return;
    try {
      await API.del(`/inversiones/${id}`);
      await navegar();
    } catch (err) {
      alert(`No se pudo eliminar la inversión: ${err.message}`);
    }
    return;
  }

  // Inversiones: Filtrar por tipo de activo
  const btnFiltroInv = e.target.closest('[data-accion="filtrar-inversiones"]');
  if (btnFiltroInv) {
    const tipo = btnFiltroInv.dataset.tipo;
    const { fijarFiltroInversion } = await import("./views/inversiones.js");
    fijarFiltroInversion(tipo);
    await navegar();
    return;
  }

  // Préstamos: Borrar préstamo
  const btnBorrarPrestamo = e.target.closest('[data-accion="borrar-prestamo"]');
  if (btnBorrarPrestamo) {
    const id = Number(btnBorrarPrestamo.dataset.id);
    const nombre = btnBorrarPrestamo.dataset.nombre || "este préstamo";
    if (!confirm(`¿Deseas eliminar definitivamente el préstamo "${nombre}"?`)) return;
    try {
      await API.del(`/prestamos/${id}`);
      await navegar();
    } catch (err) {
      alert(`No se pudo eliminar el préstamo: ${err.message}`);
    }
    return;
  }

  // Préstamos: Editar datos rápidos (capital pendiente / cuota mensual)
  const btnEditarPrestamo = e.target.closest('[data-accion="editar-prestamo"]');
  if (btnEditarPrestamo) {
    const id = Number(btnEditarPrestamo.dataset.id);
    const nombre = btnEditarPrestamo.dataset.nombre || "este préstamo";
    const pendienteActual = prompt(
      `Actualizar capital pendiente para "${nombre}" (€):`,
      btnEditarPrestamo.dataset.pendiente || ""
    );
    if (pendienteActual === null) return;
    const cuotaActual = prompt(
      "Cuota mensual (€, o vacío si no aplica):",
      btnEditarPrestamo.dataset.cuota || ""
    );
    if (cuotaActual === null) return;
    try {
      await API.patch(`/prestamos/${id}`, {
        importe_pendiente: pendienteActual.replace(",", ".").trim(),
        cuota_mensual: cuotaActual.trim() === "" ? null : cuotaActual.replace(",", ".").trim(),
      });
      await navegar();
    } catch (err) {
      alert(`No se pudo actualizar el préstamo: ${err.message}`);
    }
    return;
  }


  const btnEditarCat = e.target.closest('[data-accion="editar-categoria"]');
  if (btnEditarCat) {
    const nombre = prompt("Nuevo nombre:", btnEditarCat.dataset.nombre);
    if (nombre === null) return;
    const color = prompt("Color (hex o vacío):", btnEditarCat.dataset.color);
    if (color === null) return;
    try {
      await API.patch(`/categorias/${btnEditarCat.dataset.id}`, {
        nombre,
        color: color === "" ? null : color,
      });
      await navegar();
    } catch (err) {
      alert(`No se pudo editar la categoría: ${err.message}`);
    }
    return;
  }

  const btnBorrarCat = e.target.closest('[data-accion="borrar-categoria"]');
  if (btnBorrarCat) {
    const id = Number(btnBorrarCat.dataset.id);
    try {
      await API.del(`/categorias/${id}`);
      await navegar();
    } catch (err) {
      const ok = confirm(
        `${err.message}\n¿Confirmas archivarla? Sus movimientos quedarán sin categoría.`
      );
      if (!ok) return;
      try {
        await API.del(`/categorias/${id}?confirmar=true`);
        await navegar();
      } catch (err2) {
        alert(`No se pudo borrar la categoría: ${err2.message}`);
      }
    }
  }
});

/** Delegación única de cambios (selectores de bote/categoría en las filas). */
document.addEventListener("change", async (e) => {
  const selBote = e.target.closest("select.sel-bote");
  if (selBote) {
    try {
      await API.patch(`/movimientos/${selBote.dataset.id}/bote`, {
        bote_id: selBote.value === "" ? null : Number(selBote.value),
      });
      await navegar();
    } catch (err) {
      alert(`No se pudo asignar el bote: ${err.message}`);
    }
    return;
  }
  const selCat = e.target.closest("select.sel-categoria");
  if (selCat) {
    try {
      await API.patch(`/movimientos/${selCat.dataset.id}`, {
        categoria_id: selCat.value === "" ? null : Number(selCat.value),
      });
      await navegar();
    } catch (err) {
      alert(`No se pudo asignar la categoría: ${err.message}`);
    }
    return;
  }
  const selMesDirecto = e.target.closest("select[data-accion='cambiar-mes-directo']");
  if (selMesDirecto) {
    try {
      await API.patch("/prevision-gastos/config", {
        meses_pagados: Number(selMesDirecto.value),
      });
      await navegar();
    } catch (err) {
      alert(`No se pudo cambiar el mes: ${err.message}`);
    }
  }
});

// Cierre de menús contextuales (···) al hacer clic fuera
document.addEventListener("click", (e) => {
  if (!e.target.closest(".card-more-menu-wrapper")) {
    document.querySelectorAll(".card-more-dropdown.is-open").forEach((el) => {
      el.classList.remove("is-open");
    });
  }
});

let usuarioActual = null;
export function mostrarToastDeshacer(movId, concepto, imp) {
  let toast = document.getElementById("flow-toast-undo");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "flow-toast-undo";
    toast.className = "flow-floating-undo-toast";
    document.body.appendChild(toast);
  }
  const cleanNom = String(concepto || "").replace(/<[^>]*>/g, "").slice(0, 32);
  toast.innerHTML = `
    <span>🗑️ Eliminado: <strong>${cleanNom}</strong> ${imp ? `(${imp})` : ""}</span>
    <button type="button" class="btn-toast-undo" id="btn-undo-delete-mov">Deshacer</button>
  `;
  toast.classList.add("is-visible");

  const btnUndo = toast.querySelector("#btn-undo-delete-mov");
  if (btnUndo) {
    btnUndo.onclick = async () => {
      try {
        await API.post(`/movimientos/${movId}/restaurar`);
        toast.classList.remove("is-visible");
        await navegar();
      } catch (err) {
        alert(`No se pudo restaurar el movimiento: ${err.message}`);
      }
    };
  }

  if (window._flowToastTimer) clearTimeout(window._flowToastTimer);
  window._flowToastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 8500);
}

export function obtenerUsuarioActual() {
  return usuarioActual;
}

export async function verificarSesion() {
  try {
    const res = await fetch("/api/v1/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  }
}

async function iniciarApp() {
  const usuario = await verificarSesion();
  const navContainer = document.getElementById("nav");
  const vistaContainer = document.getElementById("vista");

  if (!usuario) {
    if (navContainer) navContainer.style.display = "none";
    const portal = document.getElementById("nav-sheet-portal");
    if (portal) portal.style.display = "none";

    renderLogin(vistaContainer, async (user) => {
      usuarioActual = user;
      if (navContainer) navContainer.style.display = "";
      if (portal) portal.style.display = "";
      pintarNav(rutasRegistradas());
      iniciarModalesAcciones();
      await navegar();
    });
    return;
  }

  usuarioActual = usuario;
  if (navContainer) navContainer.style.display = "";
  pintarNav(rutasRegistradas());
  iniciarModalesAcciones();
  await navegar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarApp);
} else {
  iniciarApp();
}
