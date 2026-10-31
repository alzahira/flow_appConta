"""Tests para el router /api/v1/pagos-recurrentes."""

from __future__ import annotations


def test_flujo_pagos_recurrentes(client):
    # 1. Crear cuentas para Caixa y Deutsche Bank
    r_cx = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Caixa Test",
            "tipo": "banco",
            "entidad": "CaixaBank",
            "saldo_inicial": "1000.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_cx.status_code == 201
    cx_id = r_cx.json()["id"]

    r_db = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Deustche Bank Test",
            "tipo": "banco",
            "entidad": "Deutsche Bank",
            "saldo_inicial": "1000.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_db.status_code == 201
    assert r_db.json()["id"] > 0

    # 2. Listar pagos recurrentes (siembra los 12 recibos por defecto)
    r_list = client.get("/api/v1/pagos-recurrentes")
    assert r_list.status_code == 200
    data = r_list.json()
    assert "items" in data
    assert len(data["items"]) >= 12
    assert data["total_general"] == "1074.00"

    # Verificar que por_cuenta tiene los 2 bancos con sus totales
    por_cuenta = data["por_cuenta"]
    totales_por_nombre = {g["cuenta_nombre"]: g["total"] for g in por_cuenta}
    # Caixa tiene 526.00 € y DB tiene 548.00 €
    assert any("526.00" in t for t in totales_por_nombre.values())
    assert any("548.00" in t for t in totales_por_nombre.values())

    # 3. Crear un nuevo pago recurrente
    r_nuevo = client.post(
        "/api/v1/pagos-recurrentes",
        json={
            "cuenta_id": cx_id,
            "concepto": "Gimnasio",
            "importe": "35.00",
            "notas": "Cobro el día 1",
        },
    )
    assert r_nuevo.status_code == 201
    nuevo_id = r_nuevo.json()["id"]
    assert r_nuevo.json()["concepto"] == "Gimnasio"
    assert r_nuevo.json()["importe"] == "35.00"

    # 4. Modificar el pago
    r_mod = client.put(
        f"/api/v1/pagos-recurrentes/{nuevo_id}",
        json={"importe": "39.90", "concepto": "Gimnasio Premium"},
    )
    assert r_mod.status_code == 200
    assert r_mod.json()["importe"] == "39.90"
    assert r_mod.json()["concepto"] == "Gimnasio Premium"

    # 5. Ejecutar solo ese pago personalizado
    r_ejec = client.post(
        "/api/v1/pagos-recurrentes/ejecutar",
        json={
            "fecha": "2026-10-31",
            "cuenta_id": cx_id,
            "pagos": [{"id": nuevo_id, "importe": "39.90"}],
        },
    )
    assert r_ejec.status_code == 200
    assert r_ejec.json()["movimientos_creados"] == 1
    assert r_ejec.json()["total_gastado"] == "39.90"

    # 6. Comprobar que el saldo de Caixa bajó de 1000 a 960.10 €
    r_cx_check = client.get(f"/api/v1/cuentas/{cx_id}")
    assert r_cx_check.json()["saldo"] == "960.10"

    # 7. Eliminar el pago
    r_del = client.delete(f"/api/v1/pagos-recurrentes/{nuevo_id}")
    assert r_del.status_code == 204
