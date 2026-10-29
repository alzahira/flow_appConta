"""Integration test US1 (T026): escenario 2-4 del quickstart.md — escrito antes de implementar.

Cuenta con 1000.00 € y gastos de −30.50 y −12.00 → totales y diferencia exactos
(céntimo a céntimo, SC-003). El caso de desfase (estado `revisar`) se cubre a
nivel de servicio en tests/unit/test_conciliacion.py (requiere botes con
movimientos, US3, o el importador, US5 — vía API del MVP no hay como crear ese
estado todavía).
"""

from __future__ import annotations


def test_us1_escenario_quickstart(client):
    resp = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Cuenta única",
            "tipo": "banco",
            "entidad": None,
            "saldo_inicial": "1000.00",
            "fecha_apertura": "2026-10-01",
        },
    )
    assert resp.status_code == 201, resp.text
    cuenta_id = resp.json()["id"]

    for importe, desc in (("-30.50", "Mercadona semanal"), ("-12.00", "Panadería")):
        r = client.post(
            "/api/v1/movimientos",
            json={
                "fecha": "2026-10-25",
                "importe": importe,
                "descripcion": desc,
                "cuenta_id": cuenta_id,
            },
        )
        assert r.status_code == 201, r.text

    resp = client.get("/api/v1/conciliacion")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Σ cuentas = 1000.00 − 30.50 − 12.00 = 957.50
    assert data["saldo_total_cuentas"] == "957.50"
    assert data["saldo_inicial_total"] == "1000.00"
    assert data["saldo_total_botes"] == "0.00"  # botes vacíos hasta US3 (degradación graceful)
    assert data["sin_asignar"] == "-42.50"  # informativo, no rompe el cuadre
    assert data["diferencia"] == "0.00"
    assert data["estado"] == "cuadrado"
