"""Tests para el router y servicio de plantillas_reparto (Nóminas y repartos mensuales)."""

from __future__ import annotations


def test_flujo_completo_plantilla_reparto(client):
    # 1. Crear una cuenta bancaria para cobrar la nómina
    r_cta = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Caixa Nómina",
            "tipo": "banco",
            "entidad": "CaixaBank",
            "saldo_inicial": "1000.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_cta.status_code == 201, r_cta.text
    cuenta_id = r_cta.json()["id"]

    # 2. Crear un par de botes de destino
    r_b1 = client.post(
        "/api/v1/botes",
        json={"nombre": "Bote Gastos Mes", "tipo": "ahorro", "categoria": "gastos"},
    )
    assert r_b1.status_code == 201, r_b1.text
    bote1_id = r_b1.json()["id"]

    r_b2 = client.post(
        "/api/v1/botes",
        json={"nombre": "Bote Ocio Mes", "tipo": "ahorro", "categoria": "ocio"},
    )
    assert r_b2.status_code == 201, r_b2.text
    bote2_id = r_b2.json()["id"]

    # 3. Listar plantillas inicialmente vacío o existente
    r_list = client.get("/api/v1/plantillas-reparto")
    assert r_list.status_code == 200

    # 4. Crear plantilla de nómina
    r_crear = client.post(
        "/api/v1/plantillas-reparto",
        json={
            "nombre": "Nómina Javier",
            "cuenta_id": cuenta_id,
            "importe_estimado": "2000.00",
            "dia_mes": 28,
            "lineas": [
                {"bote_id": bote1_id, "concepto": "Gastos del mes", "importe": "400.00"},
                {"bote_id": bote2_id, "concepto": "Ocio y cenas", "importe": "200.00"},
                {"bote_id": None, "concepto": "Remanente en cuenta", "importe": "1400.00"},
            ],
        },
    )
    assert r_crear.status_code == 201, r_crear.text
    p_data = r_crear.json()
    plantilla_id = p_data["id"]
    assert p_data["nombre"] == "Nómina Javier"
    assert len(p_data["lineas"]) == 3

    # 5. Obtener detalle
    r_det = client.get(f"/api/v1/plantillas-reparto/{plantilla_id}")
    assert r_det.status_code == 200
    assert r_det.json()["id"] == plantilla_id

    # 6. Ejecutar reparto de nómina
    r_ejec = client.post(
        f"/api/v1/plantillas-reparto/{plantilla_id}/ejecutar",
        json={
            "fecha": "2026-10-28",
            "descripcion_general": "Nómina Octubre",
        },
    )
    assert r_ejec.status_code == 200, r_ejec.text
    res_ejec = r_ejec.json()
    assert res_ejec["ok"] is True
    assert res_ejec["total_ingresado"] == "2000.00"
    assert res_ejec["movimientos_count"] == 3

    # 7. Verificar que el saldo de la cuenta aumentó en 2000 € (1000 + 2000 = 3000)
    r_cta_check = client.get(f"/api/v1/cuentas/{cuenta_id}")
    assert r_cta_check.status_code == 200
    assert r_cta_check.json()["saldo"] == "3000.00"

    # 8. Verificar que los botes aumentaron su saldo
    r_b1_check = client.get(f"/api/v1/botes/{bote1_id}")
    assert r_b1_check.status_code == 200
    assert r_b1_check.json()["saldo"] == "400.00"

    r_b2_check = client.get(f"/api/v1/botes/{bote2_id}")
    assert r_b2_check.status_code == 200
    assert r_b2_check.json()["saldo"] == "200.00"

    # 9. Actualizar plantilla
    r_upd = client.put(
        f"/api/v1/plantillas-reparto/{plantilla_id}",
        json={"nombre": "Nómina Javier Actualizada", "dia_mes": 30},
    )
    assert r_upd.status_code == 200
    assert r_upd.json()["nombre"] == "Nómina Javier Actualizada"
    assert r_upd.json()["dia_mes"] == 30

    # 10. Eliminar plantilla
    r_del = client.delete(f"/api/v1/plantillas-reparto/{plantilla_id}")
    assert r_del.status_code == 204

