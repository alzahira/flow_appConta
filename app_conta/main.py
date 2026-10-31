"""App FastAPI: sirve la API JSON y la PWA estática (plan.md Structure Decision).

Seed al arranque: crea el Hogar único si no existe (finding U1 del análisis).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import app_conta.models  # noqa: E402,F401  (registra todos los modelos antes de consultar)
from app_conta.api.errors import register_error_handlers
from app_conta.db import SessionLocal
from app_conta.services.hogar import asegurar_hogar_unico

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with SessionLocal() as db:
        asegurar_hogar_unico(db)
    _imprimir_urls_red()
    yield


app = FastAPI(
    title="Flow",
    description="Flow: Finanzas del hogar y control por sistema de botes",
    version="2.0.0",
    lifespan=lifespan,
)
register_error_handlers(app)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/health")
def health() -> dict[str, str]:
    return {"estado": "ok"}


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


def _registrar_routers() -> None:
    """Registra los routers disponibles (se amplía en cada fase de tareas)."""
    from importlib import import_module

    for nombre in (
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
