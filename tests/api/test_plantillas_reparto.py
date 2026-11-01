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


def test_reparto_nomina_a_diferentes_bancos(client):
    # 1. Crear 2 cuentas bancarias distintas (Caixa y BBVA)
    r_cta1 = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Caixa Reparto",
            "tipo": "banco",
            "entidad": "CaixaBank",
            "saldo_inicial": "100.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_cta1.status_code == 201
    cta1_id = r_cta1.json()["id"]

    r_cta2 = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "BBVA Reparto",
            "tipo": "banco",
            "entidad": "BBVA",
            "saldo_inicial": "200.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_cta2.status_code == 201
    cta2_id = r_cta2.json()["id"]

    # 2. Crear botes
    r_b = client.post(
        "/api/v1/botes",
        json={"nombre": "Bote Viaje Multi-Banco", "tipo": "ahorro", "categoria": "viajes"},
    )
    bote_id = r_b.json()["id"]

    # 3. Crear plantilla asignando explícitamente diferentes cuentas destino a las líneas
    r_p = client.post(
        "/api/v1/plantillas-reparto",
        json={
            "nombre": "Nómina Multi-Banco",
            "cuenta_id": cta1_id,
            "importe_estimado": "1500.00",
            "lineas": [
                {
                    "bote_id": None,
                    "cuenta_id": cta1_id,
                    "concepto": "Para Caixa gastos",
                    "importe": "500.00",
                },
                {
                    "bote_id": bote_id,
                    "cuenta_id": cta2_id,
                    "concepto": "Para BBVA ahorro viaje",
                    "importe": "1000.00",
                },
            ],
        },
    )
    assert r_p.status_code == 201
    p_id = r_p.json()["id"]
    lineas_res = r_p.json()["lineas"]
    assert lineas_res[0]["cuenta_id"] == cta1_id
    assert lineas_res[1]["cuenta_id"] == cta2_id

    # 4. Ejecutar el reparto
    r_ej = client.post(
        f"/api/v1/plantillas-reparto/{p_id}/ejecutar",
        json={"fecha": "2026-10-30", "descripcion_general": "Reparto Multi-Banco"},
    )
    assert r_ej.status_code == 200

    # 5. Comprobar que Caixa subió en 500 € (100 + 500 = 600)
    saldo_cta1 = client.get(f"/api/v1/cuentas/{cta1_id}").json()["saldo"]
    assert saldo_cta1 == "600.00"

    # 6. Comprobar que BBVA subió en 1000 € (200 + 1000 = 1200)
    saldo_cta2 = client.get(f"/api/v1/cuentas/{cta2_id}").json()["saldo"]
    assert saldo_cta2 == "1200.00"

    # 7. Comprobar que el bote de viaje recibió los 1000 €
    saldo_bote = client.get(f"/api/v1/botes/{bote_id}").json()["saldo"]
    assert saldo_bote == "1000.00"


def test_siembra_y_ejecucion_plantilla_nomina_mj(client):
    """Verifica que 'Nómina MJ' se siembra automáticamente y ejecuta 731.00 €."""
    # 1. Crear cuenta de Caixa
    r_cx = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "La Caixa Principal",
            "tipo": "banco",
            "entidad": "CaixaBank",
            "saldo_inicial": "100.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_cx.status_code == 201
    cx_id = r_cx.json()["id"]

    # 2. Listar plantillas (siembra ambas plantillas por defecto)
    r_list = client.get("/api/v1/plantillas-reparto")
    assert r_list.status_code == 200
    plantillas = r_list.json()
    assert len(plantillas) >= 2

    p_mj = next((p for p in plantillas if "mj" in p["nombre"].lower()), None)
    assert p_mj is not None
    assert p_mj["importe_estimado"] == "731.00"
    assert len(p_mj["lineas"]) == 6

    # 3. Ejecutar Nómina MJ (731.00 €)
    r_ej = client.post(
        f"/api/v1/plantillas-reparto/{p_mj['id']}/ejecutar",
        json={"fecha": "2026-11-01", "descripcion_general": "Nómina MJ"},
    )
    assert r_ej.status_code == 200, f"Error {r_ej.status_code}: {r_ej.text}"
    res_ej = r_ej.json()
    assert res_ej["total_ingresado"] == "731.00"
    assert res_ej["movimientos_count"] == 6

    # 4. Comprobar que la cuenta de Caixa subió en 731 € (100 + 731 = 831.00 €)
    saldo_cx = client.get(f"/api/v1/cuentas/{cx_id}").json()["saldo"]
    assert saldo_cx == "831.00"

    # 5. Comprobar botes
    r_botes = client.get("/api/v1/botes")
    assert r_botes.status_code == 200
    botes_map = {b["nombre"]: b["saldo"] for b in r_botes.json()["items"]}
    assert botes_map.get("Gasolina mes") == "40.00"
    assert botes_map.get("Bote IRPF") == "27.64"
    assert botes_map.get("Préstamo Coche Hyundai") == "199.01"
    assert botes_map.get("Guardado Resto Paro") == "199.01"
    assert botes_map.get("Bote ocio") == "132.67"
    assert botes_map.get("Mejoras del Hogar") == "132.67"


