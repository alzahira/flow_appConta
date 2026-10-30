"""Tests API para endpoints de previsión de gastos anuales y bote de gastos."""

from __future__ import annotations


def test_get_prevision_200(client):
    # Si está vacía, no debe autosemillar
    res_init = client.get("/api/v1/prevision-gastos")
    assert res_init.status_code == 200
    assert len(res_init.json()["gastos"]) == 0

    # Restablecer plantilla inicial
    res_seed = client.post("/api/v1/prevision-gastos/restablecer-semilla")
    assert res_seed.status_code == 200

    res = client.get("/api/v1/prevision-gastos")
    assert res.status_code == 200
    data = res.json()
    assert "meses_pagados" in data
    assert "total_mensual" in data
    assert "total_saldo" in data
    assert "gastos" in data
    assert len(data["gastos"]) >= 16


def test_patch_config_stepper(client):
    res = client.patch("/api/v1/prevision-gastos/config", json={"meses_pagados": 12})
    assert res.status_code == 200
    data = res.json()
    assert data["meses_pagados"] == 12

    # Reset a 11
    res2 = client.patch("/api/v1/prevision-gastos/config", json={"meses_pagados": 11})
    assert res2.status_code == 200
    assert res2.json()["meses_pagados"] == 11


def test_crud_gasto_api(client):
    res_crear = client.post(
        "/api/v1/prevision-gastos",
        json={
            "concepto": "Impuesto Basuras Casa Campo",
            "fecha_cobro": "Octubre",
            "importe_anual": "60.00",
            "cuota_mensual": "5.00",
            "pagado_real": "0.00",
            "notas": "Recibo anual",
        },
    )
    assert res_crear.status_code == 201
    gasto_id = res_crear.json()["id"]

    # Editar
    res_edit = client.patch(
        f"/api/v1/prevision-gastos/{gasto_id}",
        json={"concepto": "Impuesto Basuras Campo Modificado", "pagado_real": "30.00"},
    )
    assert res_edit.status_code == 200

    # Registrar pago
    res_pago = client.post(
        f"/api/v1/prevision-gastos/{gasto_id}/pagar",
        json={"importe": "30.00", "sumar": True},
    )
    assert res_pago.status_code == 200
    assert res_pago.json()["pagado_real"] == "60.00"

    # Eliminar
    res_del = client.delete(f"/api/v1/prevision-gastos/{gasto_id}")
    assert res_del.status_code == 204
