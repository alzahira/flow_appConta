"""Tests para el sistema de autenticación, sesiones y rate-limiting (OWASP)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.usefixtures("_migrado")


def test_login_exitoso_y_obtener_me(client: TestClient, db_module) -> None:
    from app_conta.services.hogar import asegurar_hogar_unico
    from app_conta.services.seguridad import limpiar_rate_limits
    from app_conta.services.usuarios import asegurar_usuarios_iniciales

    limpiar_rate_limits()

    with db_module.SessionLocal() as session:
        asegurar_hogar_unico(session)
        asegurar_usuarios_iniciales(session)

    # 1. Login exitoso con javier
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "javier", "password": "flow2026"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["usuario"]["username"] == "javier"
    assert data["usuario"]["rol"] == "admin"
    assert "token" in data
    assert "flow_session" in resp.cookies

    # 2. Consultar /me con la cookie establecida
    me_resp = client.get("/api/v1/auth/me")
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["username"] == "javier"
    assert me_data["rol"] == "admin"

    # 3. Consultar /me con cabecera Bearer en un cliente nuevo sin cookies
    client_sin_cookies = TestClient(client.app)
    bearer_resp = client_sin_cookies.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert bearer_resp.status_code == 200
    assert bearer_resp.json()["username"] == "javier"


def test_login_credenciales_invalidas_y_rate_limit(client: TestClient, db_module) -> None:
    from app_conta.services.hogar import asegurar_hogar_unico
    from app_conta.services.seguridad import limpiar_rate_limits
    from app_conta.services.usuarios import asegurar_usuarios_iniciales

    limpiar_rate_limits()

    with db_module.SessionLocal() as session:
        asegurar_hogar_unico(session)
        asegurar_usuarios_iniciales(session)

    # Intentos fallidos consecutivos
    for _ in range(5):
        fail_resp = client.post(
            "/api/v1/auth/login",
            json={"username": "javier", "password": "password_incorrecto"},
        )
        assert fail_resp.status_code == 401

    # El sexto intento debe ser bloqueado por rate limit (HTTP 429)
    bloqueado = client.post(
        "/api/v1/auth/login",
        json={"username": "javier", "password": "password_incorrecto"},
    )
    assert bloqueado.status_code == 429
    res_json = bloqueado.json()
    mensaje = res_json.get("error", {}).get("mensaje", "") or res_json.get("detail", "")
    assert "Demasiados intentos" in mensaje


def test_logout_invalida_sesion(client: TestClient, db_module) -> None:
    from app_conta.services.hogar import asegurar_hogar_unico
    from app_conta.services.seguridad import limpiar_rate_limits
    from app_conta.services.usuarios import asegurar_usuarios_iniciales

    limpiar_rate_limits()

    with db_module.SessionLocal() as session:
        asegurar_hogar_unico(session)
        asegurar_usuarios_iniciales(session)

    # Iniciar sesión
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "mujer", "password": "flow2026"},
    )
    assert login_resp.status_code == 200

    # Cerrar sesión
    logout_resp = client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200
    assert logout_resp.json()["ok"] is True

    # Comprobar que /me ya no tiene acceso
    me_post = client.get("/api/v1/auth/me")
    assert me_post.status_code == 401


def test_usuario_demo_aislado_sin_permisos_admin(client: TestClient, db_module) -> None:
    from app_conta.services.hogar import asegurar_hogar_unico
    from app_conta.services.seguridad import limpiar_rate_limits
    from app_conta.services.usuarios import asegurar_usuarios_iniciales

    limpiar_rate_limits()

    with db_module.SessionLocal() as session:
        asegurar_hogar_unico(session)
        asegurar_usuarios_iniciales(session)

    # Iniciar sesión como demo
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "demo", "password": "demo123"},
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["usuario"]["rol"] == "demo"

    # Intento de vaciar BD como demo -> 403 Forbidden
    vaciar_resp = client.post(
        "/api/v1/backup/vaciar",
        json={"confirmar": True},
    )
    assert vaciar_resp.status_code == 403
