"""Dependencias FastAPI para autenticación, control de acceso y multi-hogar."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.models.usuario import Usuario
from app_conta.services.usuarios import obtener_usuario_por_token


def _token_de_request(request: Request) -> str | None:
    """Lee el token de la cookie HttpOnly o, para scripts, de Authorization: Bearer."""
    token = request.cookies.get("flow_session")
    if token:
        return token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None


def obtener_usuario_actual(
    request: Request,
    db: Session = Depends(get_db),
) -> Usuario:
    """Valida la sesión y devuelve el usuario. Nunca cae a un hogar por defecto."""
    # El middleware de main.py ya validó el token y dejó el id en request.state.
    usuario_id = getattr(request.state, "usuario_id", None)
    if usuario_id is not None:
        usuario = db.get(Usuario, usuario_id)
        if usuario is not None and usuario.activo:
            return usuario
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = _token_de_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no iniciada o expirada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario = obtener_usuario_por_token(db, token)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return usuario


def obtener_hogar_activo(
    usuario: Usuario = Depends(obtener_usuario_actual),
) -> int:
    """Hogar del usuario autenticado. Sin sesión válida → 401 (sin fallback)."""
    return int(usuario.hogar_id)


def requerir_admin(
    usuario: Usuario = Depends(obtener_usuario_actual),
) -> Usuario:
    """Valida que el usuario tenga rol de administrador y no sea un usuario demo."""
    if usuario.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes. Esta acción requiere rol de Administrador.",
        )
    return usuario

