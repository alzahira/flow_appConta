"""Contract test de GET /api/v1/conciliacion (T025, US1) — escrito antes de implementar.

Verifica la forma exacta del contrato: fecha_calculo, saldo_total_cuentas,
saldo_inicial_total, saldo_total_botes, sin_asignar, diferencia, estado.
Los importes salen como string de euros ("957.50").
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("_migrado")

CAMPOS_CONTRATO = {
    "fecha_calculo",
    "saldo_total_cuentas",
    "saldo_inicial_total",
    "saldo_total_botes",
    "sin_asignar",
    "diferencia",
    "estado",
}


def test_contrato_forma_con_bd_vacia(client):
    resp = client.get("/api/v1/conciliacion")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert CAMPOS_CONTRATO <= set(data)
    assert data["estado"] == "cuadrado"
    for campo in (
        "saldo_total_cuentas",
        "saldo_inicial_total",
        "saldo_total_botes",
        "sin_asignar",
        "diferencia",
    ):
        assert data[campo] == "0.00"
    assert data["fecha_calculo"]  # fecha del cálculo presente


def test_contrato_importes_string_con_datos(client):
    resp = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Banco",
            "tipo": "banco",
            "entidad": None,
            "saldo_inicial": "1000.00",
            "fecha_apertura": "2026-10-01",
        },
    )
    assert resp.status_code == 201, resp.text
    cuenta_id = resp.json()["id"]

    resp = client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2026-10-25",
            "importe": "-30.50",
            "descripcion": "Mercadona",
            "cuenta_id": cuenta_id,
        },
    )
    assert resp.status_code == 201, resp.text

    data = client.get("/api/v1/conciliacion").json()
    assert data["saldo_total_cuentas"] == "969.50"
    assert data["saldo_inicial_total"] == "1000.00"
    assert data["sin_asignar"] == "-30.50"
    assert data["diferencia"] == "0.00"
    assert data["estado"] == "cuadrado"
