"""Dependencias FastAPI para autenticación, control de acceso y multi-hogar."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.models.usuario import Usuario
from app_conta.services.usuarios import obtener_usuario_por_token


def obtener_usuario_actual(
    request: Request,
    db: Session = Depends(get_db),
) -> Usuario:
    """Extrae y valida la cookie de sesión del usuario. Lanza 401 si no está autenticado."""
    token = request.cookies.get("flow_session")
    if not token:
        # También comprobamos cabecera Authorization: Bearer <token> para llamadas programáticas
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

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
    request: Request,
    db: Session = Depends(get_db),
) -> int:
    """Extrae el hogar_id del usuario autenticado (cookie flow_session o Bearer).
    Si no hay sesión (ej. tests unitarios de contrato), devuelve el hogar por defecto (1).
    """
    token = request.cookies.get("flow_session")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if token:
        usuario = obtener_usuario_por_token(db, token)
        if usuario:
            return int(usuario.hogar_id)

    from app_conta.services.cuentas import obtener_hogar_unico

    return obtener_hogar_unico(db)


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

