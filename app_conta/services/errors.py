"""Errores de dominio de los servicios: mapeados a 400/404/409 en la capa API.

Los servicios nunca devuelven códigos HTTP: lanzan estos errores y
`app_conta.api.errors` los convierte al formato de contrato
`{ "error": { "codigo", "mensaje" } }`.
"""

from __future__ import annotations


class ErrorDominio(Exception):
    """Base: HTTP 400 validación por defecto."""

    status_code = 400
    codigo = "validacion"


class ErrorValidacion(ErrorDominio):
    """Datos inválidos → HTTP 400."""


class ErrorNoEncontrado(ErrorDominio):
    """Recurso inexistente → HTTP 404."""

    status_code = 404
    codigo = "no_encontrado"


class ErrorConflicto(ErrorDominio):
    """Conflicto (duplicado, borrado bloqueado…) → HTTP 409."""

    status_code = 409
    codigo = "conflicto"
