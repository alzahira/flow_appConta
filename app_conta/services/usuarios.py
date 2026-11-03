"""Servicio de Gestión de Usuarios, Sesiones y Multi-Hogar."""

from __future__ import annotations

import os
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app_conta.models.hogar import Hogar
from app_conta.models.usuario import SesionUsuario, Usuario
from app_conta.services.seguridad import (
    crear_hash_password,
    generar_token_sesion,
    hash_token,
    verificar_password,
)


def _ahora() -> datetime:
    return datetime.utcnow()


def asegurar_usuarios_iniciales(db: Session) -> None:
    """Crea los usuarios iniciales del hogar familiar y el usuario demo si no existen."""
    # 1. Asegurar Hogar Principal
    hogar_real = db.execute(select(Hogar).order_by(Hogar.id.asc())).scalars().first()
    if not hogar_real:
        hogar_real = Hogar(nombre="Familia Jaenes", moneda="EUR")
        db.add(hogar_real)
        db.flush()

    # 2. Asegurar Hogar Demo
    hogar_demo = db.execute(select(Hogar).filter(Hogar.nombre == "Hogar Demo")).scalars().first()
    if not hogar_demo:
        hogar_demo = Hogar(nombre="Hogar Demo", moneda="EUR")
        db.add(hogar_demo)
        db.flush()

    # 3. Comprobar si existen usuarios
    usuarios_existentes = db.execute(select(Usuario.username)).scalars().all()
    usernames = set(usuarios_existentes)

    pass_admin = os.environ.get("APP_CONTA_ADMIN_PASSWORD", "flow2026")
    pass_mujer = os.environ.get("APP_CONTA_MUJER_PASSWORD", "flow2026")

    # Usuario 1: Javier (Admin de Hogar Real)
    if "javier" not in usernames:
        db.add(
            Usuario(
                hogar_id=hogar_real.id,
                username="javier",
                password_hash=crear_hash_password(pass_admin),
                nombre_mostrar="Javier",
                rol="admin",
                activo=True,
            )
        )

    # Usuario 2: Mujer (Miembro de Hogar Real)
    if "mujer" not in usernames:
        db.add(
            Usuario(
                hogar_id=hogar_real.id,
                username="mujer",
                password_hash=crear_hash_password(pass_mujer),
                nombre_mostrar="María",
                rol="miembro",
                activo=True,
            )
        )

    # Usuario 3: Demo (Hogar Demo aislado con datos inventados)
    if "demo" not in usernames:
        db.add(
            Usuario(
                hogar_id=hogar_demo.id,
                username="demo",
                password_hash=crear_hash_password("demo123"),
                nombre_mostrar="Invitado Demo",
                rol="demo",
                activo=True,
            )
        )

    db.commit()

    # 4. Sembrar datos demo realistas si el hogar demo no tiene datos (no en tests)
    if not os.environ.get("PYTEST_CURRENT_TEST") and os.environ.get("APP_CONTA_ENV") != "test":
        from app_conta.services.seed_demo import sembrar_hogar_demo_si_vacio

        sembrar_hogar_demo_si_vacio(db, hogar_demo.id)


def autenticar_usuario(db: Session, username: str, password: str) -> Usuario | None:
    """Valida credenciales y devuelve el usuario si es válido y está activo."""
    user = (
        db.execute(select(Usuario).filter(Usuario.username == username.lower().strip()))
        .scalars()
        .first()
    )
    if not user or not user.activo:
        return None
    if not verificar_password(password, user.password_hash):
        return None
    return user


def crear_sesion(
    db: Session,
    usuario_id: int,
    ip: str | None = None,
    user_agent: str | None = None,
    recordar: bool = True,
) -> tuple[str, SesionUsuario]:
    """Crea una sesión persistente en BD y devuelve (token_plano, sesion)."""
    dias = 30 if recordar else 1
    expira_en = _ahora() + timedelta(days=dias)
    token_plano, token_hash = generar_token_sesion()

    sesion = SesionUsuario(
        token_hash=token_hash,
        usuario_id=usuario_id,
        expira_en=expira_en,
        ip=ip,
        user_agent=user_agent[:255] if user_agent else None,
    )
    db.add(sesion)
    db.commit()
    db.refresh(sesion)
    return token_plano, sesion


def obtener_usuario_por_token(db: Session, token_plano: str) -> Usuario | None:
    """Busca la sesión por el hash del token y devuelve el usuario asociado si no ha expirado."""
    if not token_plano:
        return None

    t_hash = hash_token(token_plano)
    sesion = (
        db.execute(
            select(SesionUsuario)
            .filter(SesionUsuario.token_hash == t_hash)
            .join(SesionUsuario.usuario)
        )
        .scalars()
        .first()
    )

    if not sesion:
        return None

    # Comprobar expiración
    if sesion.expira_en < _ahora():
        db.delete(sesion)
        db.commit()
        return None

    usuario = sesion.usuario
    if not usuario or not usuario.activo:
        return None

    return usuario


def cerrar_sesion(db: Session, token_plano: str) -> bool:
    """Elimina la sesión activa de la BD."""
    if not token_plano:
        return False
    t_hash = hash_token(token_plano)
    res = db.execute(delete(SesionUsuario).filter(SesionUsuario.token_hash == t_hash))
    db.commit()
    return res.rowcount > 0
