// Cliente de API. Los importes van SIEMPRE como string ("-30.50") — contrato REST.
async function lanzarErrorHttp(r) {
  const e = await r.json().catch(() => ({}));
  const err = new Error(e?.error?.mensaje || String(r.status));
  err.status = r.status;
  err.codigo = e?.error?.codigo || "error";
  throw err;
}

const API = {
  async get(ruta) {
    const r = await fetch(`/api/v1${ruta}`, { headers: { Accept: "application/json" } });
    if (!r.ok) await lanzarErrorHttp(r);
    return r.json();
  },
  async post(ruta, cuerpo) {
    const r = await fetch(`/api/v1${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!r.ok) await lanzarErrorHttp(r);
    return r.json();
  },
  async patch(ruta, cuerpo) {
    const r = await fetch(`/api/v1${ruta}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!r.ok) await lanzarErrorHttp(r);
    return r.json();
  },
  async del(ruta) {
    const r = await fetch(`/api/v1${ruta}`, { method: "DELETE" });
    if (!r.ok) await lanzarErrorHttp(r);
    return r.status === 204 ? null : r.json();
  },
};

const euros = (s) => {
  const n = Number(s);
  const ok = n < 0 ? "negativo" : "positivo";
  return `<span class="${ok}">${n.toFixed(2)} €</span>`;
};
