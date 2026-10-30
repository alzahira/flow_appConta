"""Tests para el servicio y API de Backup, Vaciado y Restauración."""

from __future__ import annotations

import io
import json


def test_flujo_backup_vaciar_y_restaurar(client):
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

