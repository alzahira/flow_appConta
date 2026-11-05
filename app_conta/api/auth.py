"""Endpoints de autenticación, login, logout y usuario actual."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app_conta.api.dependencias import _token_de_request, obtener_usuario_actual
from app_conta.db import get_db
from app_conta.models.usuario import Usuario
from app_conta.services.seguridad import (
    comprobar_rate_limit,
    limpiar_intentos,
    obtener_ip_cliente,
    registrar_fallo,
)
from app_conta.services.usuarios import (
    autenticar_usuario,
    cambiar_password,
    cerrar_sesion,
    crear_sesion,
)

logger = logging.getLogger("flow.security")

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=60)
    password: str = Field(..., min_length=1)
    recordar: bool = True


class CambioPasswordRequest(BaseModel):
    password_actual: str = Field(..., min_length=1)
    password_nueva: str = Field(..., min_length=1)


class UsuarioResponse(BaseModel):
    id: int
    username: str
    nombre: str
    rol: str
    hogar_id: int
    hogar_nombre: str


def _es_produccion() -> bool:
    return os.environ.get("APP_CONTA_ENV", "development").strip().lower() == "production"


@router.post("/login", response_model=dict)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    """Inicia sesión, verifica rate-limit y asigna la cookie HttpOnly."""
    ip_cliente = obtener_ip_cliente(request)

    # 1. Rate limit por IP: solo cuentan los intentos fallidos.
    if not comprobar_rate_limit(ip_cliente, max_intentos=5, ventana_segundos=60):
        logger.warning("Login bloqueado por rate-limit ip=%s usuario=%s", ip_cliente, payload.username)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Por seguridad, espera 1 minuto.",
        )

    # 2. Autenticar credenciales
    user = autenticar_usuario(db, payload.username, payload.password)
    if not user:
        registrar_fallo(ip_cliente)
        logger.warning("Login fallido ip=%s usuario=%s", ip_cliente, payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos.",
        )
    limpiar_intentos(ip_cliente)

    # 3. Crear sesión en base de datos
    user_agent = request.headers.get("User-Agent")
    token_plano, _sesion = crear_sesion(
        db=db,
        usuario_id=user.id,
        ip=ip_cliente,
        user_agent=user_agent,
        recordar=payload.recordar,
    )

    # 4. Cookie de sesión: HttpOnly + SameSite=Strict + Secure en producción.
    max_age = 2592000 if payload.recordar else None  # 30 días en segundos
    response.set_cookie(
        key="flow_session",
        value=token_plano,
        httponly=True,
        samesite="strict",
        secure=_es_produccion(),
        max_age=max_age,
        path="/",
    )

    # El token NO se devuelve en el JSON: la cookie HttpOnly es el único canal
    # para el navegador. Así un XSS no puede leer la sesión desde la respuesta.
    return {
        "ok": True,
        "usuario": {
            "id": user.id,
            "username": user.username,
            "nombre": user.nombre_mostrar,
            "rol": user.rol,
            "hogar_id": user.hogar_id,
            "hogar_nombre": user.hogar.nombre if user.hogar else "Hogar",
        },
    }


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    """Cierra la sesión activa y borra la cookie del navegador."""
    token = _token_de_request(request)
    if token:
        cerrar_sesion(db, token)
    response.delete_cookie(
        key="flow_session",
        path="/",
        httponly=True,
        samesite="strict",
        secure=_es_produccion(),
    )
    return {"ok": True}


@router.get("/me", response_model=UsuarioResponse)
def usuario_actual(
    usuario: Usuario = Depends(obtener_usuario_actual),
) -> UsuarioResponse:
    """Devuelve el perfil del usuario autenticado actualmente."""
    return UsuarioResponse(
        id=usuario.id,
        username=usuario.username,
        nombre=usuario.nombre_mostrar,
        rol=usuario.rol,
        hogar_id=usuario.hogar_id,
        hogar_nombre=usuario.hogar.nombre if usuario.hogar else "Hogar",
    )


@router.post("/cambiar-password")
def cambiar_password_endpoint(
    payload: CambioPasswordRequest,
    request: Request,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
) -> dict:
    """Cambia la contraseña del usuario y revoca sus sesiones anteriores."""
    try:
        cambiar_password(
            db,
            usuario,
            payload.password_actual,
            payload.password_nueva,
            token_actual=_token_de_request(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"ok": True, "mensaje": "Contraseña actualizada y sesiones anteriores revocadas."}
