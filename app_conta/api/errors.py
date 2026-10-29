"""Manejo de errores de API: formato común { error: { codigo, mensaje } }."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app_conta.services.errors import ErrorDominio


def _error(codigo: str, mensaje: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"codigo": codigo, "mensaje": mensaje}},
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ErrorDominio)
    async def dominio_handler(_request: Request, exc: ErrorDominio) -> JSONResponse:
        return _error(exc.codigo, str(exc), exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        codigo = {
            400: "validacion",
            404: "no_encontrado",
            409: "conflicto",
        }.get(exc.status_code, "error")
        return _error(codigo, str(exc.detail), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        campos = [
            {".".join(str(p) for p in e["loc"][1:]) or "cuerpo": e["msg"]} for e in exc.errors()
        ]
        return _error("validacion", f"Datos no válidos: {campos}", 400)
