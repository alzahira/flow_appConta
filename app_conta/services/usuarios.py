"""Servicio de Gestión de Usuarios, Sesiones y Multi-Hogar."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app_conta.models.hogar import Hogar
from app_conta.models.usuario import SesionUsuario, Usuario
from app_conta.services.seguridad import (
    crear_hash_password,
    generar_token_sesion,
    hash_dummy,
    hash_token,
    necesita_rehash,
    verificar_password,
)


def _ahora() -> datetime:
    return datetime.utcnow()


def _es_produccion() -> bool:
    return os.environ.get("APP_CONTA_ENV", "").strip().lower() == "production"


def _es_test() -> bool:
    return bool(os.environ.get("PYTEST_CURRENT_TEST")) or (
        os.environ.get("APP_CONTA_ENV", "").strip().lower() == "test"
    )


def _password_inicial(env_var: str, usuario: str, default_test: str) -> str:
    """Contraseña para un usuario nuevo.

    - Producción: obliga a definirla y exige 12+ caracteres.
    - Desarrollo: usa la de entorno o genera una aleatoria e imprime el aviso.
    - Tests: valor conocido para que la suite sea reproducible.
    """
    valor = os.environ.get(env_var)
    if valor:
        if _es_produccion() and len(valor) < 12:
            raise RuntimeError(
                f"{env_var} debe tener al menos 12 caracteres en producción."
            )
        return valor
    if _es_produccion():
        raise RuntimeError(
            f"Define {env_var} (mínimo 12 caracteres) antes de arrancar en producción."
        )
    if _es_test():
        return default_test
    # Desarrollo local: una contraseña aleatoria, nunca un valor por defecto público.
    valor = secrets.token_urlsafe(18)
    print(
        f"[seguridad] {env_var} no definida. Contraseña generada para '{usuario}': {valor}"
    )
    return valor


def _demo_habilitado() -> bool:
    if not _es_produccion():
        return True
    return os.environ.get("APP_CONTA_ENABLE_DEMO", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def asegurar_usuarios_iniciales(db: Session) -> None:
    """Crea los usuarios iniciales y el usuario demo (desactivado en producción)."""
    # 1. Asegurar Hogar Principal
    hogar_real = db.execute(select(Hogar).order_by(Hogar.id.asc())).scalars().first()
    if not hogar_real:
        hogar_real = Hogar(nombre="Familia Jaenes", moneda="EUR")
        db.add(hogar_real)
        db.flush()

    # 2. Comprobar si existen usuarios
    usuarios_existentes = db.execute(select(Usuario.username)).scalars().all()
    usernames = set(usuarios_existentes)

    # Usuario 1: Javier (Admin de Hogar Real)
    if "javier" not in usernames:
        db.add(
            Usuario(
                hogar_id=hogar_real.id,
                username="javier",
                password_hash=crear_hash_password(
                    _password_inicial("APP_CONTA_ADMIN_PASSWORD", "javier", "flow2026")
                ),
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
                password_hash=crear_hash_password(
                    _password_inicial("APP_CONTA_MUJER_PASSWORD", "mujer", "flow2026")
                ),
                nombre_mostrar="María",
                rol="miembro",
                activo=True,
            )
        )

    # Usuario 3: Demo (Hogar Demo aislado con datos inventados)
    if _demo_habilitado():
        hogar_demo = (
            db.execute(select(Hogar).filter(Hogar.nombre == "Hogar Demo")).scalars().first()
        )
        if not hogar_demo:
            hogar_demo = Hogar(nombre="Hogar Demo", moneda="EUR")
            db.add(hogar_demo)
            db.flush()
        if "demo" not in usernames:
            db.add(
                Usuario(
                    hogar_id=hogar_demo.id,
                    username="demo",
                    password_hash=crear_hash_password(
                        _password_inicial("APP_CONTA_DEMO_PASSWORD", "demo", "demo123")
                    ),
                    nombre_mostrar="Invitado Demo",
                    rol="demo",
                    activo=True,
                )
            )
    else:
        # En producción el demo no se crea y, si venía de una instalación antigua,
        # se desactiva para que no sea una puerta de entrada innecesaria.
        demo = db.execute(select(Usuario).filter(Usuario.username == "demo")).scalars().first()
        if demo is not None:
            demo.activo = False

    db.commit()

    # 4. Sembrar datos demo realistas si el hogar demo no tiene datos (no en tests)
    if _demo_habilitado() and not _es_test():
        from app_conta.services.seed_demo import sembrar_hogar_demo_si_vacio

        hogar_demo = (
            db.execute(select(Hogar).filter(Hogar.nombre == "Hogar Demo")).scalars().first()
        )
        if hogar_demo is not None:
            sembrar_hogar_demo_si_vacio(db, hogar_demo.id)


def autenticar_usuario(db: Session, username: str, password: str) -> Usuario | None:
    """Valida credenciales y devuelve el usuario si es válido y está activo.

    Si el usuario no existe se verifica igualmente un hash señuelo para no
    revelar por tiempos de respuesta qué nombres de usuario son válidos.
    """
    user = (
        db.execute(select(Usuario).filter(Usuario.username == username.lower().strip()))
        .scalars()
        .first()
    )
    if not user:
        verificar_password(password, hash_dummy())
        return None
    if not user.activo:
        verificar_password(password, hash_dummy())
        return None
    if not verificar_password(password, user.password_hash):
        return None
    # Rehash transparente si el hash es del formato/parámetros antiguos.
    if necesita_rehash(user.password_hash):
        user.password_hash = crear_hash_password(password)
        db.flush()
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

    # Limpieza de sesiones caducadas y límite de sesiones simultáneas por usuario.
    db.execute(delete(SesionUsuario).where(SesionUsuario.expira_en < _ahora()))
    sesiones_activas = list(
        db.execute(
            select(SesionUsuario)
            .where(SesionUsuario.usuario_id == usuario_id)
            .order_by(SesionUsuario.creado_en.asc())
        )
        .scalars()
        .all()
    )
    for antigua in sesiones_activas[:-9]:
        db.delete(antigua)

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


def cambiar_password(
    db: Session,
    usuario: Usuario,
    password_actual: str,
    password_nueva: str,
    token_actual: str | None = None,
) -> None:
    """Cambia la contraseña del usuario y revoca sus otras sesiones."""
    if not verificar_password(password_actual, usuario.password_hash):
        raise ValueError("La contraseña actual no es correcta.")
    if len(password_nueva) < 12:
        raise ValueError("La nueva contraseña debe tener al menos 12 caracteres.")
    if password_actual == password_nueva:
        raise ValueError("La nueva contraseña debe ser distinta de la actual.")

    usuario.password_hash = crear_hash_password(password_nueva)
    # Revoca todas las sesiones salvo la que está haciendo el cambio.
    token_hash_actual = hash_token(token_actual) if token_actual else None
    stmt = delete(SesionUsuario).where(SesionUsuario.usuario_id == usuario.id)
    if token_hash_actual:
        stmt = stmt.where(SesionUsuario.token_hash != token_hash_actual)
    db.execute(stmt)
    db.commit()
