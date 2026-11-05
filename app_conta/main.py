"""App FastAPI: sirve la API JSON y la PWA estática (plan.md Structure Decision).

Seed al arranque: crea el Hogar único si no existe (finding U1 del análisis).
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import app_conta.models  # noqa: E402,F401  (registra todos los modelos antes de consultar)
from app_conta.api.dependencias import _token_de_request
from app_conta.api.errors import register_error_handlers
from app_conta.db import SessionLocal
from app_conta.services.hogar import asegurar_hogar_unico
from app_conta.services.usuarios import (
    asegurar_usuarios_iniciales,
    obtener_usuario_por_token,
)

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with SessionLocal() as db:
        asegurar_hogar_unico(db)
        asegurar_usuarios_iniciales(db)
    _imprimir_urls_red()
    yield


_es_produccion = os.environ.get("APP_CONTA_ENV", "").lower() == "production"

app = FastAPI(
    title="Flow",
    description="Flow: Finanzas del hogar y control por sistema de botes",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if _es_produccion else "/docs",
    redoc_url=None if _es_produccion else "/redoc",
    openapi_url=None if _es_produccion else "/openapi.json",
)
register_error_handlers(app)


_RUTAS_API_PUBLICAS = {
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
}


def _json_error(codigo: str, mensaje: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"codigo": codigo, "mensaje": mensaje}},
    )


@app.middleware("http")
async def agregar_cabeceras_seguridad(request: Request, call_next):
    """Añade cabeceras de endurecimiento HTTP (OWASP) y evita cachear la API."""
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    # El filtro XSS de navegadores antiguos es peligroso; mejor desactivarlo.
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), usb=(), payment=()"
    )
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

    csp = (
        "default-src 'self'; "
        "base-uri 'self'; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "manifest-src 'self'; "
        "worker-src 'self'; "
        "media-src 'self'"
    )
    if _es_produccion:
        csp += "; upgrade-insecure-requests"
    response.headers["Content-Security-Policy"] = csp

    if _es_produccion and (
        request.url.scheme == "https"
        or "https" in request.headers.get("x-forwarded-proto", "").lower()
    ):
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"

    return response


@app.middleware("http")
async def proteger_api(request: Request, call_next):
    """Puerta de entrada única: toda /api/v1 exige sesión válida (salvo login/logout).

    Además bloquea peticiones de escritura cross-site (CSRF) y valida el Host
    cuando APP_CONTA_ALLOWED_HOSTS está definido.
    """
    path = request.url.path

    allowed_hosts = os.environ.get("APP_CONTA_ALLOWED_HOSTS", "").strip()
    if allowed_hosts and path.startswith("/api/"):
        permitidos = {h.strip().lower() for h in allowed_hosts.split(",") if h.strip()}
        if request.url.hostname and request.url.hostname.lower() not in permitidos:
            return _json_error("host_no_permitido", "Host no permitido.", 400)

    if not path.startswith("/api/v1"):
        return await call_next(request)

    if path in _RUTAS_API_PUBLICAS:
        return await call_next(request)

    # CSRF: las cookies SameSite=Strict ya lo mitigan, pero añadimos defensa en
    # profundidad para navegadores antiguos o proxies que reescriban cabeceras.
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin:
            origin_host = (urlparse(origin).hostname or "").lower()
            request_host = (request.url.hostname or "").lower()
            if origin_host != request_host:
                return _json_error("csrf", "Origen de la petición no permitido.", 403)
        sec_fetch_site = request.headers.get("sec-fetch-site", "").lower()
        if sec_fetch_site and sec_fetch_site not in {"same-origin", "none"}:
            return _json_error("csrf", "Petición cross-site bloqueada.", 403)

    token = _token_de_request(request)
    if not token:
        return _json_error("no_autorizado", "Sesión no iniciada o expirada.", 401)

    with SessionLocal() as db:
        usuario = obtener_usuario_por_token(db, token)
        if usuario is None:
            return _json_error("no_autorizado", "Sesión inválida o expirada.", 401)
        # Guardamos el id (no el objeto ORM) para que la dependencia lo cargue
        # dentro de la sesión de la petición, con sus relaciones disponibles.
        request.state.usuario_id = usuario.id
        request.state.hogar_id = usuario.hogar_id

    return await call_next(request)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/health")
def health() -> dict[str, str]:
    return {"estado": "ok"}


@app.get("/static/sw.js", include_in_schema=False)
@app.get("/sw.js", include_in_schema=False)
def service_worker() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "sw.js",
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "index.html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "favicon.svg",
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )



def _registrar_routers() -> None:
    """Registra los routers disponibles (se amplía en cada fase de tareas)."""
    from importlib import import_module

    for nombre in (
        "auth",
        "cuentas",
        "movimientos",
        "botes",
        "categorias",
        "conciliacion",
        "importacion",
        "deudas",
        "prevision_gastos",
        "inversiones",
        "prestamos",
        "plantillas_reparto",
        "pagos_recurrentes",
        "backup",
    ):
        try:
            modulo = import_module(f"app_conta.api.{nombre}")
        except ModuleNotFoundError:
            continue
        app.include_router(modulo.router, prefix="/api/v1")


_registrar_routers()


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str) -> FileResponse:
    """Fallback SPA (HTML5 History API): devuelve index.html para rutas directas."""
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API endpoint no encontrado")
    return FileResponse(
        STATIC_DIR / "index.html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


def _imprimir_urls_red(port: int | None = None) -> None:
    """Imprime la IP local para abrir la app desde el móvil (misma WiFi).

    Se ejecuta en el arranque de la app (lifespan), sea vía `run()`, `uvicorn`
    o el .bat, para que SIEMPRE aparezca la URL de los móviles en pantalla.
    """
    import os
    import socket

    if port is None:
        port = int(os.environ.get("APP_CONTA_PORT", "8000"))

    print("\n" + "=" * 54)
    print("App_Conta: servidor listo. Abre en cada dispositivo:")
    print(f"  - Este PC:      http://127.0.0.1:{port}")
    try:
        con_dns = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        con_dns.settimeout(2.0)
        con_dns.connect(("8.8.8.8", 80))
        ip = con_dns.getsockname()[0]
        con_dns.close()
        print("  - Moviles (misma WiFi):")
        print(f"      http://{ip}:{port}")
    except OSError:
        print("  - (Sin red: solo disponible en este PC)")
    print("=" * 54)
    print("Nota Windows: la primera vez, acepta el permiso del Firewall")
    print("para que los otros dispositivos puedan conectarse.")
    print()


def run() -> None:  # entry point: app-conta
    """Arranca el servidor accesible desde móviles de la misma red local.

    Variables de entorno APP_CONTA_HOST / APP_CONTA_PORT para ajustar.
    0.0.0.0: escucha en TODAS las interfaces → móvil + portátil acceden
    por la IP local (mismo hogar, misma BD compartida).
    """
    import os

    import uvicorn

    host = os.environ.get("APP_CONTA_HOST", "0.0.0.0")
    port = int(os.environ.get("APP_CONTA_PORT", "8000"))
    uvicorn.run("app_conta.main:app", host=host, port=port, reload=False)
