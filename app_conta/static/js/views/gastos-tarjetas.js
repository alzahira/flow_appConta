// Redirección y compatibilidad con la nueva vista Pagos Diarios
import { vista } from "../vistas.js";

export default vista("gastos-tarjetas", async () => {
  if (window.irA) {
    window.irA("pagos-diarios", true);
  }
  const { default: pagosDiarios } = await import("./pagos-diarios.js");
  return pagosDiarios.render();
});
