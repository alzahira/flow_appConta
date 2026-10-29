"""Test de integración del flujo US2 (T018, escrito antes de implementar).

Escenario del MVP: crear cuenta → registrar 3 movimientos → saldo correcto
(céntimo a céntimo, SC-003) → editar un movimiento → saldo recalculado →
auditoría registrada (FR-013).
"""

from __future__ import annotations


def _crear_cuenta(client, nombre: str, saldo_inicial: str) -> dict:
    resp = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": nombre,
            "tipo": "banco",
            "entidad": None,
            "saldo_inicial": saldo_inicial,
            "fecha_apertura": "2026-10-01",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _crear_movimiento(client, cuenta_id: int, importe: str, desc: str) -> dict:
    resp = client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2026-10-13",
            "importe": importe,
            "descripcion": desc,
            "cuenta_id": cuenta_id,
            "categoria_id": None,
            "bote_id": None,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _detalle_cuenta(client, cuenta_id: int) -> dict:
    resp = client.get(f"/api/v1/cuentas/{cuenta_id}")
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_us2_flujo_completo(client, db_module):
    """US2 independent test: saldo = inicial + ingresos − gastos (céntimo a céntimo)."""
    # 1. Crear cuenta con saldo inicial 1000.00 €
    cuenta = _crear_cuenta(client, "Flujo US2", "1000.00")
    assert cuenta["saldo"] == "1000.00"

    # 2. Tres movimientos: gasto, ingreso, gasto
    mov_gasto1 = _crear_movimiento(client, cuenta["id"], "-30.50", "Mercadona semanal")
    _crear_movimiento(client, cuenta["id"], "1500.00", "Nómina")
    mov_gasto2 = _crear_movimiento(client, cuenta["id"], "-12.00", "Panadería")

    # 3. Saldo exacto: 1000.00 + 1500.00 − 30.50 − 12.00 = 2457.50
    assert _detalle_cuenta(client, cuenta["id"])["saldo"] == "2457.50"

    # 4. Editar un movimiento (−12.00 → −20.00) → saldo recalculado
    resp = client.patch(f"/api/v1/movimientos/{mov_gasto2['id']}", json={"importe": "-20.00"})
    assert resp.status_code == 200, resp.text
    # 1000.00 + 1500.00 − 30.50 − 20.00 = 2449.50
    assert _detalle_cuenta(client, cuenta["id"])["saldo"] == "2449.50"

    # 5. Auditoría: creado x3 + editado x1 para los movimientos de esta cuenta
    from sqlalchemy import select

    from app_conta.models.auditoria import AuditoriaMovimiento

    with db_module.SessionLocal() as session:
        for mov_id in (mov_gasto1["id"], mov_gasto2["id"]):
            acciones = session.scalars(
                select(AuditoriaMovimiento.accion).where(
                    AuditoriaMovimiento.movimiento_id == mov_id
                )
            ).all()
            assert "creado" in acciones
        acciones_editada = session.scalars(
            select(AuditoriaMovimiento.accion).where(
                AuditoriaMovimiento.movimiento_id == mov_gasto2["id"]
            )
        ).all()
        assert "editado" in acciones_editada


def test_us2_saldo_inicial_negativo_y_signos_mixtos(client):
    """Edge case del data-model: saldo_inicial puede ser negativo."""
    cuenta = _crear_cuenta(client, "Descubierto", "-100.00")
    _crear_movimiento(client, cuenta["id"], "40.00", "Ingreso parcial")
    # −100.00 + 40.00 = −60.00
    assert _detalle_cuenta(client, cuenta["id"])["saldo"] == "-60.00"


def test_us2_auditoria_registra_cambios_json(client, db_module):
    """FR-013: la auditoría guarda anterior/nuevo del campo editado."""
    cuenta = _crear_cuenta(client, "Auditoria Cambios", "0.00")
    mov = _crear_movimiento(client, cuenta["id"], "-5.00", "Original")
    client.patch(
        f"/api/v1/movimientos/{mov['id']}",
        json={"importe": "-7.00", "descripcion": "Corregido"},
    )

    import json

    from sqlalchemy import select

    from app_conta.models.auditoria import AuditoriaMovimiento

    with db_module.SessionLocal() as session:
        filas = session.scalars(
            select(AuditoriaMovimiento).where(AuditoriaMovimiento.movimiento_id == mov["id"])
        ).all()
        ediciones = [f for f in filas if f.accion == "editado"]
        assert len(ediciones) == 1
        cambios = ediciones[0].cambios
        if isinstance(cambios, str):  # SQLite puede devolver JSON como texto
            cambios = json.loads(cambios)
        assert cambios["importe"]["anterior"] == -500
        assert cambios["importe"]["nuevo"] == -700
