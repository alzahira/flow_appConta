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


def test_flujo_conjunto_nomina_y_pagos_recurrentes(client):
    """Verifica que el reparto de nómina y el pago de recibos fijos cuadran netos."""
    # 1. Crear Caixa y Deutsche Bank
    r_cx = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Caixa Operaciones",
            "tipo": "banco",
            "entidad": "CaixaBank",
            "saldo_inicial": "100.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_cx.status_code == 201
    cx_id = r_cx.json()["id"]

    r_db = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Deutsche Bank Principal",
            "tipo": "banco",
            "entidad": "Deutsche Bank",
            "saldo_inicial": "200.00",
            "fecha_apertura": "2026-01-01",
        },
    )
    assert r_db.status_code == 201
    db_id = r_db.json()["id"]

    # 2. Listar plantillas de reparto (siembra automáticamente 'Reparto Mensual Hogar')
    r_plantillas = client.get("/api/v1/plantillas-reparto")
    assert r_plantillas.status_code == 200
    plantillas = r_plantillas.json()
    assert len(plantillas) >= 1
    plantilla = plantillas[0]
    assert plantilla["nombre"] == "Reparto Mensual Hogar"
    assert plantilla["importe_estimado"] == "2323.00"

    # 3. Listar pagos recurrentes (siembra los 12 recibos por defecto: 1074 €)
    r_pagos = client.get("/api/v1/pagos-recurrentes")
    assert r_pagos.status_code == 200
    pagos_data = r_pagos.json()
    assert pagos_data["total_general"] == "1074.00"

    # 4. Ejecutar Reparto de Nómina (+2323.00 € distribuidos en Caixa y DB)
    r_ejec_reparto = client.post(
        f"/api/v1/plantillas-reparto/{plantilla['id']}/ejecutar",
        json={"fecha": "2026-10-31", "descripcion_general": "Nómina Mensual"},
    )
    assert r_ejec_reparto.status_code == 200
    assert r_ejec_reparto.json()["total_ingresado"] == "2323.00"

    # 5. Ejecutar simultáneamente los Recibos Fijos Domiciliados (−1074.00 €)
    r_ejec_recibos = client.post(
        "/api/v1/pagos-recurrentes/ejecutar",
        json={"fecha": "2026-10-31"},
    )
    assert r_ejec_recibos.status_code == 200
    assert r_ejec_recibos.json()["total_gastado"] == "1074.00"
    assert r_ejec_recibos.json()["movimientos_creados"] == 12

    # 6. Comprobar saldos finales netos exactos:
    # Caixa: 100 saldo inicial + 860 repartido - 526 recibos = 434.00 €
    r_cx_final = client.get(f"/api/v1/cuentas/{cx_id}")
    assert r_cx_final.json()["saldo"] == "434.00"

    # DB: 200 saldo inicial + 1463 repartido - 548 recibos = 1115.00 €
    r_db_final = client.get(f"/api/v1/cuentas/{db_id}")
    assert r_db_final.json()["saldo"] == "1115.00"

    # Comprobar botes asignados:
    # Amortización Hipoteca recibe +927.00 €
    # Guardado Resto Paro descuenta -522.00 €
    r_botes = client.get("/api/v1/botes")
    assert r_botes.status_code == 200
    botes_map = {b["nombre"]: b["saldo"] for b in r_botes.json()["items"]}
    assert botes_map.get("Amortización Hipoteca") == "927.00"
    assert botes_map.get("Guardado Resto Paro") == "-522.00"

    # Ganancia neta total del mes = (434 - 100) + (1115 - 200) = 334 + 915 = 1249.00 €
    ganancia_neta = (
        float(r_cx_final.json()["saldo"]) - 100.0
        + float(r_db_final.json()["saldo"]) - 200.0
    )
    assert round(ganancia_neta, 2) == 1249.00

