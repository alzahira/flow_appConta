"""Tests de contrato API para /api/v1/deudas."""


def test_api_deudas_flujo_completo(client):
    # 1. Listar inicialmente vacío
    resp = client.get("/api/v1/deudas")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total_pendiente"] == "0.00"

    # 2. Crear una deuda
    payload = {
        "deudor": "Carlos Gómez",
        "concepto": "Préstamo vacaciones",
        "importe": "300.00",
        "fecha": "2026-10-25",
        "fecha_limite": "2026-12-31",
        "notas": "Devolverá en dos plazos",
    }
    resp = client.post("/api/v1/deudas", json=payload)
    assert resp.status_code == 201
    deuda = resp.json()
    assert deuda["id"] is not None
    assert deuda["deudor"] == "Carlos Gómez"
    assert deuda["importe_inicial"] == "300.00"
    assert deuda["importe_cobrado"] == "0.00"
    assert deuda["importe_pendiente"] == "300.00"
    assert deuda["estado"] == "pendiente"

    deuda_id = deuda["id"]

    # 3. Registrar un cobro parcial de 100 €
    resp = client.post(f"/api/v1/deudas/{deuda_id}/cobro", json={"importe": "100.00"})
    assert resp.status_code == 200
    deuda_actualizada = resp.json()
    assert deuda_actualizada["importe_cobrado"] == "100.00"
    assert deuda_actualizada["importe_pendiente"] == "200.00"
    assert deuda_actualizada["estado"] == "parcial"

    # 4. Listar y verificar totales
    resp = client.get("/api/v1/deudas")
    assert resp.status_code == 200
    totales = resp.json()
    assert len(totales["items"]) == 1
    assert totales["total_pendiente"] == "200.00"
    assert totales["total_cobrado"] == "100.00"
    assert totales["total_inicial"] == "300.00"

    # 5. Cobro total restante de 200 €
    resp = client.post(f"/api/v1/deudas/{deuda_id}/cobro", json={"importe": "200.00"})
    assert resp.status_code == 200
    assert resp.json()["estado"] == "saldado"
    assert resp.json()["importe_pendiente"] == "0.00"

    # 6. Borrado
    resp = client.delete(f"/api/v1/deudas/{deuda_id}")
    assert resp.status_code == 204

    resp = client.get("/api/v1/deudas")
    assert len(resp.json()["items"]) == 0
