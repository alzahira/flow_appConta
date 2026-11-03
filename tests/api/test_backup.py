"""Tests para el servicio y API de Backup, Vaciado y Restauración con control de acceso."""

from __future__ import annotations

import io
import json


def test_backup_requiere_autenticacion_y_prohibe_demo(client, db_module):
    """Verifica que endpoints destructivos de backup rechazan anónimos y demo."""
    from app_conta.services.hogar import asegurar_hogar_unico
    from app_conta.services.usuarios import (
        asegurar_usuarios_iniciales,
        autenticar_usuario,
        crear_sesion,
    )

    # 1. Anónimo -> 401
    client.cookies.clear()
    assert client.get("/api/v1/backup/exportar").status_code == 401
    assert client.post("/api/v1/backup/vaciar", json={"confirmar": True}).status_code == 401
    assert client.post("/api/v1/backup/poner-a-cero", json={"confirmar": True}).status_code == 401

    # 2. Demo -> 403 Forbidden
    with db_module.SessionLocal() as session:
        asegurar_hogar_unico(session)
        asegurar_usuarios_iniciales(session)
        user = autenticar_usuario(session, "demo", "demo123")
        assert user is not None
        token, _sesion = crear_sesion(session, user.id)
        session.commit()

    client.cookies.set("flow_session", token)
    assert client.get("/api/v1/backup/exportar").status_code == 403
    assert client.post("/api/v1/backup/vaciar", json={"confirmar": True}).status_code == 403
    assert client.post("/api/v1/backup/poner-a-cero", json={"confirmar": True}).status_code == 403


def test_flujo_backup_vaciar_y_restaurar(admin_client):
    client = admin_client
    # 1. Crear datos de prueba: una cuenta y un bote
    r_cta = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Cuenta Para Backup",
            "tipo": "banco",
            "entidad": "Banco Test",
            "saldo_inicial": "500.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_cta.status_code == 201
    cuenta_id = r_cta.json()["id"]

    r_bote = client.post(
        "/api/v1/botes",
        json={"nombre": "Bote Para Backup", "tipo": "ahorro", "categoria": "viajes"},
    )
    assert r_bote.status_code == 201
    bote_id = r_bote.json()["id"]

    # 2. Exportar backup
    r_exp = client.get("/api/v1/backup/exportar")
    assert r_exp.status_code == 200
    assert "attachment" in r_exp.headers.get("content-disposition", "")
    backup_data = r_exp.json()
    assert backup_data["app"] == "Flow"
    assert "tablas" in backup_data
    assert len(backup_data["tablas"]["cuentas"]) >= 1

    # 3. Vaciar base de datos sin confirmar falla
    r_vaciar_fail = client.post("/api/v1/backup/vaciar", json={"confirmar": False})
    assert r_vaciar_fail.status_code == 400

    # 4. Vaciar base de datos confirmando
    r_vaciar = client.post("/api/v1/backup/vaciar", json={"confirmar": True})
    assert r_vaciar.status_code == 200
    assert r_vaciar.json()["ok"] is True

    # 5. Comprobar que las cuentas, botes y previsión se han vaciado
    r_cuentas_vacias = client.get("/api/v1/cuentas")
    assert r_cuentas_vacias.status_code == 200
    assert len(r_cuentas_vacias.json()["items"]) == 0

    r_botes_vacios = client.get("/api/v1/botes")
    assert r_botes_vacios.status_code == 200
    assert len(r_botes_vacios.json()["items"]) == 0

    r_prevision_vacia = client.get("/api/v1/prevision-gastos")
    assert r_prevision_vacia.status_code == 200
    assert len(r_prevision_vacia.json()["gastos"]) == 0
    assert r_prevision_vacia.json()["total_saldo"] == "0.00"

    # 6. Restaurar desde el backup exportado
    fichero_bytes = json.dumps(backup_data).encode("utf-8")
    r_restaurar = client.post(
        "/api/v1/backup/restaurar",
        files={"archivo": ("backup.json", io.BytesIO(fichero_bytes), "application/json")},
    )
    assert r_restaurar.status_code == 200, r_restaurar.text
    assert r_restaurar.json()["ok"] is True

    # 7. Verificar que la cuenta y el bote han vuelto a existir
    r_cta_check = client.get(f"/api/v1/cuentas/{cuenta_id}")
    assert r_cta_check.status_code == 200
    assert r_cta_check.json()["nombre"] == "Cuenta Para Backup"

    r_bote_check = client.get(f"/api/v1/botes/{bote_id}")
    assert r_bote_check.status_code == 200
    assert r_bote_check.json()["nombre"] == "Bote Para Backup"


def test_poner_a_cero_conserva_botes_y_cuentas(admin_client):
    client = admin_client
    # 1. Crear una cuenta con saldo inicial 500 €
    r_cta = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Caixa Pruebas",
            "tipo": "banco",
            "entidad": "CaixaBank",
            "saldo_inicial": "500.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_cta.status_code == 201
    cuenta_id = r_cta.json()["id"]

    # 2. Crear un bote
    r_bote = client.post(
        "/api/v1/botes",
        json={"nombre": "Sobre Ocio Pruebas", "tipo": "ahorro", "categoria": "ocio"},
    )
    assert r_bote.status_code == 201
    bote_id = r_bote.json()["id"]

    # 3. Crear un movimiento (+150 € a la cuenta y al bote)
    r_mov = client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2026-11-01",
            "importe": "150.00",
            "descripcion": "Ingreso prueba",
            "cuenta_id": cuenta_id,
            "bote_id": bote_id,
        },
    )
    assert r_mov.status_code == 201

    # 4. Comprobar saldos previos (cuenta = 500 + 150 = 650 €, bote = 150 €)
    assert client.get(f"/api/v1/cuentas/{cuenta_id}").json()["saldo"] == "650.00"
    assert client.get(f"/api/v1/botes/{bote_id}").json()["saldo"] == "150.00"
    assert len(client.get("/api/v1/movimientos").json()["items"]) == 1

    # 5. Fallo al no confirmar
    r_fail = client.post("/api/v1/backup/poner-a-cero", json={"confirmar": False})
    assert r_fail.status_code == 400

    # 6. Ejecutar poner a cero con confirmación
    r_reset = client.post("/api/v1/backup/poner-a-cero", json={"confirmar": True})
    assert r_reset.status_code == 200
    assert r_reset.json()["ok"] is True

    # 7. La cuenta SIGUE EXISTIENDO pero su saldo es 0.00 €
    r_cta_despues = client.get(f"/api/v1/cuentas/{cuenta_id}")
    assert r_cta_despues.status_code == 200
    assert r_cta_despues.json()["saldo"] == "0.00"
    assert r_cta_despues.json()["saldo_inicial"] == "0.00"

    # 8. El bote SIGUE EXISTIENDO pero su saldo es 0.00 €
    r_bote_despues = client.get(f"/api/v1/botes/{bote_id}")
    assert r_bote_despues.status_code == 200
    assert r_bote_despues.json()["saldo"] == "0.00"

    # 9. No quedan movimientos vivos
    assert len(client.get("/api/v1/movimientos").json()["items"]) == 0

    # 10. La conciliación queda a 0.00 € y cuadrada
    conc = client.get("/api/v1/conciliacion").json()
    assert conc["saldo_total_cuentas"] == "0.00"
    assert conc["saldo_total_botes"] == "0.00"
    assert conc["total_prevision_formula"] == "0.00"
    assert conc["total_me_deben_formula"] == "0.00"
    assert conc["total_prestamos_formula"] == "0.00"
    assert conc["diferencia_formula"] == "0.00"
    assert conc["estado_formula"] == "cuadrado"


def test_restaurar_backup_con_password_incorrecta(admin_client):
    fichero_bytes = b'{"app": "Flow", "tablas": {}}'
    r = admin_client.post(
        "/api/v1/backup/restaurar",
        files={"archivo": ("backup.json", io.BytesIO(fichero_bytes), "application/json")},
        data={"password": "password_erroneo_totalmente"},
    )
    assert r.status_code == 401
    assert "incorrecta" in r.text

