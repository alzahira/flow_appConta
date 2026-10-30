"""Smoke del Foundation (T015): migraciones desde BD vacía + creación de las 7 entidades."""

from __future__ import annotations

from datetime import date


def test_foundation_smoke(db, hogar_id):
    """El foundation permite crear una entidad de cada tipo (Principio IV)."""
    from app_conta.models.auditoria import AuditoriaMovimiento
    from app_conta.models.bote import Bote
    from app_conta.models.categoria import Categoria
    from app_conta.models.cuenta import Cuenta
    from app_conta.models.movimiento import Movimiento

    cuenta = Cuenta(
        hogar_id=hogar_id,
        nombre="La Caixa",
        tipo="banco",
        entidad="La Caixa",
        saldo_inicial_centimos=100_000,
        fecha_apertura=date(2026, 1, 1),
    )
    categoria = Categoria(hogar_id=hogar_id, nombre="Supermercado")
    bote = Bote(hogar_id=hogar_id, nombre="Bote gastos", tipo="recurrente")
    db.add_all([cuenta, categoria, bote])
    db.flush()

    mov = Movimiento(
        hogar_id=hogar_id,
        cuenta_id=cuenta.id,
        fecha=date(2026, 1, 15),
        importe_centimos=-3_050,
        descripcion="Mercadona",
        categoria_id=categoria.id,
        bote_id=bote.id,
    )
    db.add(mov)
    db.flush()

    auditoria = AuditoriaMovimiento(
        movimiento_id=mov.id,
        accion="creado",
        cambios={"importe_centimos": -3_050},
    )
    db.add(auditoria)
    db.commit()

    db.refresh(mov)
    assert mov.bote.nombre == "Bote gastos"
    assert [a.accion for a in mov.auditoria] == ["creado"]


def test_seed_hogar_unico_en_arranque(client):
    """El TestClient dispara el lifespan que siembra el Hogar (T012)."""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"estado": "ok"}

    r = client.get("/")
    assert r.status_code == 200
    assert "Flow" in r.text
