"""Tests de contrato API para endpoints de /api/v1/inversiones."""

from __future__ import annotations


def test_crud_inversiones_api(client):
    # 1. Crear inversión
    res_crear = client.post(
        "/api/v1/inversiones",
        json={
            "nombre": "Fondo Vanguard Global Stock",
            "entidad": "MyInvestor",
            "tipo_activo": "fondos",
            "capital_aportado": "1000.00",
            "valor_actual": "1120.50",
            "fecha_inicio": "2026-01-10",
            "notas": "TER 0.18%",
        },
    )
    assert res_crear.status_code == 201
    data_crear = res_crear.json()
    assert "id" in data_crear
    inv_id = data_crear["id"]

    # 2. Consultar lista y resumen
    res_get = client.get("/api/v1/inversiones")
    assert res_get.status_code == 200
    resumen = res_get.json()
    assert resumen["total_posiciones"] == 1
    assert resumen["total_capital_aportado"] == "1000.00"
    assert resumen["total_valor_actual"] == "1120.50"
    assert resumen["total_plusvalia"] == "120.50"
    assert resumen["rentabilidad_global_pct"] == 12.05
    assert len(resumen["inversiones"]) == 1

    item = resumen["inversiones"][0]
    assert item["nombre"] == "Fondo Vanguard Global Stock"
    assert item["plusvalia"] == "120.50"

    # 3. Actualizar valoración de mercado
    res_val = client.post(
        f"/api/v1/inversiones/{inv_id}/valoracion",
        json={"valor_actual": "1200.00"},
    )
    assert res_val.status_code == 200
    assert res_val.json()["valor_actual"] == "1200.00"
    assert res_val.json()["plusvalia"] == "200.00"

    # 4. Aportar dinero
    res_ap = client.post(
        f"/api/v1/inversiones/{inv_id}/aportar",
        json={"importe": "300.00"},
    )
    assert res_ap.status_code == 200
    assert res_ap.json()["capital_aportado"] == "1300.00"
    assert res_ap.json()["valor_actual"] == "1500.00"

    # 5. Reembolsar dinero
    res_re = client.post(
        f"/api/v1/inversiones/{inv_id}/reembolsar",
        json={"importe": "100.00"},
    )
    assert res_re.status_code == 200
    assert res_re.json()["valor_actual"] == "1400.00"

    # 6. Eliminar
    res_del = client.delete(f"/api/v1/inversiones/{inv_id}")
    assert res_del.status_code == 204

    # Lista vacía
    res_post_del = client.get("/api/v1/inversiones")
    assert res_post_del.json()["total_posiciones"] == 0
