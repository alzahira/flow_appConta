"""Integration test US3 (T033): flujo completo de botes — escrito antes de implementar.

Crear 2 botes → asignar 3 movimientos → saldos → reasignar 1 → auditoría
`reasignado` → bote negativo mostrado sin bloqueo (edge case del spec).
"""

from __future__ import annotations


def test_us3_flujo_completo(client, db_module):
    # 1. Cuenta y dos botes
    cuenta = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Cuenta A",
            "tipo": "banco",
            "entidad": None,
            "saldo_inicial": "1000.00",
            "fecha_apertura": "2026-10-01",
        },
    ).json()
    bote_ocio = client.post(
        "/api/v1/botes",
        json={
            "nombre": "Ocio",
            "tipo": "recurrente",
            "objetivo": "-100.00",
            "objetivo_fecha": None,
        },
    ).json()
    bote_ahorro = client.post(
        "/api/v1/botes",
        json={"nombre": "Ahorro coche", "tipo": "ahorro", "objetivo": None, "objetivo_fecha": None},
    ).json()

    # 2. Tres movimientos: dos asignados a Ocio, uno libre
    def mov(importe, desc):
        r = client.post(
            "/api/v1/movimientos",
            json={
                "fecha": "2026-10-25",
                "importe": importe,
                "descripcion": desc,
                "cuenta_id": cuenta["id"],
            },
        )
        assert r.status_code == 201, r.text
        return r.json()

    m1 = mov("-40.00", "Cine")
    m2 = mov("-25.00", "Restaurantes")
    m3 = mov("200.00", "Ahorro mensual")

    client.patch(f"/api/v1/movimientos/{m1['id']}/bote", json={"bote_id": bote_ocio["id"]})
    client.patch(f"/api/v1/movimientos/{m2['id']}/bote", json={"bote_id": bote_ocio["id"]})

    def saldo(nombre):
        items = client.get("/api/v1/botes").json()["items"]
        return next(b for b in items if b["nombre"] == nombre)["saldo"]

    # 3. Saldos derivados exactos
    assert saldo("Ocio") == "-65.00"  # −40.00 + −25.00
    assert saldo("Ahorro coche") == "0.00"

    # 4. Asignar el tercero y reasignar m2 al bote de ahorro
    client.patch(f"/api/v1/movimientos/{m3['id']}/bote", json={"bote_id": bote_ahorro["id"]})
    client.patch(f"/api/v1/movimientos/{m2['id']}/bote", json={"bote_id": bote_ahorro["id"]})
    assert saldo("Ocio") == "-40.00"
    assert saldo("Ahorro coche") == "175.00"  # +200.00 − 25.00

    # 5. Auditoría `reasignado` registrada en BD
    from sqlalchemy import select

    from app_conta.models.auditoria import AuditoriaMovimiento

    with db_module.SessionLocal() as session:
        acciones = session.scalars(
            select(AuditoriaMovimiento.accion).where(AuditoriaMovimiento.movimiento_id == m2["id"])
        ).all()
        assert acciones.count("reasignado") >= 1
        assert acciones.count("creado") == 1

    # 6. Edge: bote con saldo NEGATIVO se muestra sin bloqueo (asignando gasto)
    m4 = mov("-250.00", "Reparación")
    bote_gasto = client.post(
        "/api/v1/botes",
        json={"nombre": "Coche", "tipo": "proyecto", "objetivo": None, "objetivo_fecha": None},
    ).json()
    client.patch(f"/api/v1/movimientos/{m4['id']}/bote", json={"bote_id": bote_gasto["id"]})
    items = client.get("/api/v1/botes").json()["items"]
    bote_coche = next(b for b in items if b["nombre"] == "Coche")
    assert bote_coche["saldo"] == "-250.00"  # visible, sin bloqueo

    # 7. Y sigue `en_curso` (sin objetivo, siempre en curso)
    assert bote_coche["estado"] == "en_curso"
