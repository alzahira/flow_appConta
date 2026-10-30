"""Tests de contrato API para endpoints de /api/v1/prestamos."""

from __future__ import annotations


def test_crud_prestamos_api(client):
    # 1. Crear préstamo (ej. Coche)
    res_crear = client.post(
        "/api/v1/prestamos",
        json={
            "nombre": "Préstamo Coche",
            "entidad": "Santander Consumer",
            "tipo": "coche",
            "importe_inicial": "15000.00",
            "importe_pendiente": "9000.00",
            "cuota_mensual": "250.00",
            "fecha_inicio": "2024-03-01",
            "fecha_fin": "2028-03-01",
            "notas": "Coche familiar",
        },
    )
    assert res_crear.status_code == 201
    data_crear = res_crear.json()
    assert "id" in data_crear
    p_id = data_crear["id"]
    assert data_crear["nombre"] == "Préstamo Coche"
    assert data_crear["importe_inicial"] == "15000.00"
    assert data_crear["importe_pendiente"] == "9000.00"
    assert data_crear["amortizado"] == "6000.00"
    assert data_crear["progreso_amortizado_pct"] == 40.0
    assert data_crear["cuota_mensual"] == "250.00"

    # 2. Consultar lista y resumen
    res_get = client.get("/api/v1/prestamos")
    assert res_get.status_code == 200
    resumen = res_get.json()
    assert resumen["total_prestamos"] == 1
    assert resumen["total_deuda_pendiente"] == "9000.00"
    assert resumen["total_financiado"] == "15000.00"
    assert resumen["total_amortizado"] == "6000.00"
    assert resumen["progreso_global_pct"] == 40.0
    assert resumen["cuota_mensual_total"] == "250.00"
    assert len(resumen["items"]) == 1

    # 3. Registrar pago / cuota
    res_pago = client.post(
        f"/api/v1/prestamos/{p_id}/pagar",
        json={"importe": "250.00", "concepto": "Cuota octubre"},
    )
    assert res_pago.status_code == 200
    p_pagado = res_pago.json()
    assert p_pagado["importe_pendiente"] == "8750.00"
    assert p_pagado["amortizado"] == "6250.00"

    # 4. Modificar notas
    res_patch = client.patch(
        f"/api/v1/prestamos/{p_id}",
        json={"notas": "Cuota domiciliada"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["notas"] == "Cuota domiciliada"

    # 5. Eliminar
    res_del = client.delete(f"/api/v1/prestamos/{p_id}")
    assert res_del.status_code == 204

    # Verificar que ya no está
    res_get2 = client.get("/api/v1/prestamos")
    assert res_get2.json()["total_prestamos"] == 0

