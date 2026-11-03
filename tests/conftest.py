"""Fixtures globales: BD SQLite temporal con migraciones Alembic + TestClient."""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

# La BD de test debe fijarse ANTES de importar app_conta (el engine se crea al importar).
_TEST_DB = os.path.join(os.path.dirname(__file__), "_test_conta.db")
os.environ["APP_CONTA_DB"] = _TEST_DB

import app_conta.models  # noqa: E402,F401  (registra TODOS los modelos en Base antes de usarlos)


@pytest.fixture(scope="session")
def db_module():
    """Módulo app_conta.db con el engine apuntando a la BD temporal."""
    import importlib

    import app_conta.db as dbmod

    importlib.reload(dbmod)
    yield dbmod


@pytest.fixture(scope="session")
def _migrado(db_module) -> None:
    """Aplica migraciones desde BD vacía (gate del Principio IV)."""
    from alembic import command
    from alembic.config import Config

    if os.path.exists(_TEST_DB):
        os.remove(_TEST_DB)

    cfg = Config("alembic.ini")
    cfg.set_main_option("script_location", "migrations")
    cfg.set_main_option("sqlalchemy.url", db_module.DATABASE_URL)
    command.upgrade(cfg, "head")


@pytest.fixture()
def id_hogar(_migrado, db_module) -> int:
    """ID real (int) del Hogar único, creado si no existe."""
    from app_conta.services.hogar import asegurar_hogar_unico

    session = db_module.SessionLocal()
    try:
        return asegurar_hogar_unico(session).id
    finally:
        session.close()


@pytest.fixture()
def db(_migrado, db_module) -> Iterator:
    """Sesión limpia por test (rollback al acabar)."""
    session = db_module.SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(autouse=True)
def _aislar_bd(_migrado, db_module) -> Iterator[None]:
    """Limpia TODA la BD tras cada test."""
    yield
    from sqlalchemy import text

    with db_module.SessionLocal() as s:
        for tabla in (
            "sesiones_usuario",
            "usuarios",
            "auditoria_movimientos",
            "movimientos",
            "plantillas_reparto_lineas",
            "plantillas_reparto",
            "pagos_recurrentes",
            "prestamos",
            "importaciones",
            "inversiones",
            "gastos_recurrentes",
            "prevision_gastos_config",
            "deudas",
            "botes",
            "categorias",
            "cuentas",
            "hogares",
        ):
            s.execute(text(f"DELETE FROM {tabla}"))  # noqa: S608 (nombres internos, no input)
        s.commit()


@pytest.fixture()
def client(_migrado, db_module):
    """TestClient con get_db apuntando a la BD temporal."""
    from fastapi.testclient import TestClient

    import app_conta.main as main

    def _override_get_db():
        session = db_module.SessionLocal()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.rollback()
            session.close()

    main.app.dependency_overrides[db_module.get_db] = _override_get_db
    with TestClient(main.app) as c:
        yield c


@pytest.fixture()
def admin_client(client, db_module):
    """TestClient autenticado con rol admin (javier)."""
    from app_conta.services.hogar import asegurar_hogar_unico
    from app_conta.services.usuarios import (
        asegurar_usuarios_iniciales,
        autenticar_usuario,
        crear_sesion,
    )

    with db_module.SessionLocal() as session:
        asegurar_hogar_unico(session)
        asegurar_usuarios_iniciales(session)
        user = autenticar_usuario(session, "javier", "flow2026")
        assert user is not None
        token, _sesion = crear_sesion(session, user.id)
        session.commit()

    client.cookies.set("flow_session", token)
    return client


@pytest.fixture()
def demo_client(client, db_module):
    """TestClient autenticado con rol demo (usuario demo)."""
    from app_conta.services.hogar import asegurar_hogar_unico
    from app_conta.services.usuarios import (
        asegurar_usuarios_iniciales,
        autenticar_usuario,
        crear_sesion,
    )

    with db_module.SessionLocal() as session:
        asegurar_hogar_unico(session)
        asegurar_usuarios_iniciales(session)
        user = autenticar_usuario(session, "demo", "demo123")
        assert user is not None
        token, _sesion = crear_sesion(session, user.id)
        session.commit()

    client.cookies.set("flow_session", token)
    return client


@pytest.fixture()
def hogar_id(_migrado, db_module) -> str:
    """ID real (str) del Hogar único, creado si no existe."""
    from app_conta.services.hogar import asegurar_hogar_unico

    session = db_module.SessionLocal()
    try:
        h = asegurar_hogar_unico(session)
        return str(h.id)
    finally:
        session.close()
