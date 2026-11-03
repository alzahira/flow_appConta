"""Endpoints de autenticación, login, logout y usuario actual."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app_conta.api.dependencias import obtener_usuario_actual
from app_conta.db import get_db
from app_conta.models.usuario import Usuario
from app_conta.services.seguridad import comprobar_rate_limit
from app_conta.services.usuarios import autenticar_usuario, cerrar_sesion, crear_sesion

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=60)
    password: str = Field(..., min_length=1)
    recordar: bool = True


class UsuarioResponse(BaseModel):
    id: int
    username: str
    nombre: str
    rol: str
    hogar_id: int
    hogar_nombre: str


@router.post("/login", response_model=dict)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    """Inicia sesión, verifica rate-limit y asigna la cookie HttpOnly."""
    # 1. Obtener IP del cliente (con soporte para proxies Nginx / Cloudflare)
    ip_cliente = (
        request.headers.get("CF-Connecting-IP")
        or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else "127.0.0.1")
    )

    # 2. Rate limit: máx 5 intentos por minuto
    if not comprobar_rate_limit(ip_cliente, max_intentos=5, ventana_segundos=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Por seguridad, espera 1 minuto.",
        )

    # 3. Autenticar credenciales
    user = autenticar_usuario(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos.",
        )

    # 4. Crear sesión en base de datos
    user_agent = request.headers.get("User-Agent")
    token_plano, sesion = crear_sesion(
        db=db,
        usuario_id=user.id,
        ip=ip_cliente,
        user_agent=user_agent,
        recordar=payload.recordar,
    )

    # 5. Establecer Cookie de sesión segura
    # En producción bajo HTTPS activa secure=True
    es_prod = os.environ.get("APP_CONTA_ENV", "development").lower() == "production"
    max_age = 2592000 if payload.recordar else None  # 30 días en segundos

    response.set_cookie(
        key="flow_session",
        value=token_plano,
        httponly=True,
        samesite="lax",
        secure=es_prod,
        max_age=max_age,
        path="/",
    )

    return {
        "ok": True,
        "token": token_plano,
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
    token = request.cookies.get("flow_session")
    if token:
        cerrar_sesion(db, token)
    response.delete_cookie(key="flow_session", path="/")
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

