"""Tests unitarios del servicio de categorías (T039, US4) — escritos antes de implementar.

Reglas:
- nombre único por hogar (incluidas archivadas, igual que la restricción BD)
- total por categoría y periodo con signos mixtos (Σ importes vivos, Principio II)
- borrado protegido (FR-005): en uso → ErrorConflicto con recuento; con
  confirmación → se archiva y sus movimientos quedan sin categoría
"""

from __future__ import annotations

from datetime import date

import pytest

from app_conta.models.cuenta import Cuenta
from app_conta.services import categorias as svc
from app_conta.services.errors import ErrorConflicto, ErrorNoEncontrado, ErrorValidacion


def _cuenta(db, id_hogar, nombre="Banco"):
    cuenta = Cuenta(
        hogar_id=id_hogar,
        nombre=nombre,
        tipo="banco",
        saldo_inicial_centimos=100_000,
        fecha_apertura=date(2026, 10, 1),
    )
    db.add(cuenta)
    db.flush()
    return cuenta


def _mov(db, cuenta, *, fecha, importe, categoria_id):
    from app_conta.services.movimientos import crear_movimiento

    return crear_movimiento(
        db,
        fecha=fecha,
        importe=importe,
        descripcion=f"mov {fecha} #{categoria_id}",
        cuenta_id=cuenta.id,
        categoria_id=categoria_id,
    )


def test_crear_y_listar_activas(db, id_hogar):
    svc.crear_categoria(db, nombre="Supermercado", hogar_id=id_hogar, color="#22c55e")
    svc.crear_categoria(db, nombre="Gasolina", hogar_id=id_hogar)
    activas = svc.listar_categorias_activas(db)
    assert [c.nombre for c in activas] == ["Gasolina", "Supermercado"]  # por nombre
    assert activas[1].color == "#22c55e"


def test_nombre_unico_por_hogar(db, id_hogar):
    svc.crear_categoria(db, nombre="Comida", hogar_id=id_hogar)
    with pytest.raises(ErrorConflicto):
        svc.crear_categoria(db, nombre="Comida", hogar_id=id_hogar)


def test_nombre_validado(db, id_hogar):
    with pytest.raises(ErrorValidacion):
        svc.crear_categoria(db, nombre="   ", hogar_id=id_hogar)


def test_total_por_categoria_con_signos_mixtos(db, id_hogar):
    cat = svc.crear_categoria(db, nombre="Ocio", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    _mov(db, cuenta, fecha="2025-03-10", importe="200.00", categoria_id=None)
    _mov(db, cuenta, fecha="2025-03-20", importe="-50.50", categoria_id=None)
    _mov(db, cuenta, fecha="2025-03-20", importe="-10.00", categoria_id=cat.id)
    assert svc.total_categoria(db, cat.id, desde=None, hasta=None) == -1000


def test_total_respeta_el_periodo(db, id_hogar):
    cat = svc.crear_categoria(db, nombre="Viajes", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    _mov(db, cuenta, fecha="2025-01-15", importe="-100.00", categoria_id=cat.id)
    _mov(db, cuenta, fecha="2025-06-15", importe="-50.00", categoria_id=cat.id)
    _mov(db, cuenta, fecha="2025-12-15", importe="-25.00", categoria_id=cat.id)
    assert svc.total_categoria(db, cat.id, desde="2025-02-01", hasta="2025-11-30") == -5000
    assert svc.total_categoria(db, cat.id, desde=None, hasta=None) == -17500


def test_totales_varias_categorias(db, id_hogar):
    c1 = svc.crear_categoria(db, nombre="A", hogar_id=id_hogar)
    c2 = svc.crear_categoria(db, nombre="B", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    _mov(db, cuenta, fecha="2025-05-01", importe="-10.00", categoria_id=c1.id)
    _mov(db, cuenta, fecha="2025-05-02", importe="40.00", categoria_id=c2.id)
    c3 = svc.crear_categoria(db, nombre="C", hogar_id=id_hogar)
    pares, _total = svc.listar_categorias_con_totales(db)
    por_id = {cat.id: t for cat, t in pares}
    assert por_id[c1.id] == -1000
    assert por_id[c2.id] == 4000
    assert por_id[c3.id] == 0  # sin movimientos → 0 (ver bolsa vacía)


def test_borrado_protegido_con_recuento(db, id_hogar):
    cat = svc.crear_categoria(db, nombre="Salud", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    _mov(db, cuenta, fecha="2025-05-01", importe="-15.00", categoria_id=cat.id)
    _mov(db, cuenta, fecha="2025-05-02", importe="-35.00", categoria_id=cat.id)
    with pytest.raises(ErrorConflicto) as info:
        svc.archivar_categoria(db, cat.id, confirmar=False)
    assert "2" in str(info.value)  # recuento (FR-005)


def test_borrado_confirmado_libera_movimientos(db, id_hogar):
    from app_conta.models.movimiento import Movimiento

    cat = svc.crear_categoria(db, nombre="Salud2", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    mov = _mov(db, cuenta, fecha="2025-05-01", importe="-15.00", categoria_id=cat.id)
    svc.archivar_categoria(db, cat.id, confirmar=True)
    assert db.get(Movimiento, mov.id).categoria_id is None
    with pytest.raises(ErrorNoEncontrado):
        svc.obtener_categoria(db, cat.id)  # archivada deja de existir aquí
    assert all(c.id != cat.id for c in svc.listar_categorias_activas(db))


def test_editar_nombre_y_color(db, id_hogar):
    cat = svc.crear_categoria(db, nombre="Viejo", hogar_id=id_hogar)
    cat_editada = svc.editar_categoria(db, cat.id, {"nombre": "Nuevo", "color": "#ef4444"})
    assert cat_editada.nombre == "Nuevo"
    assert cat_editada.color == "#ef4444"


def test_obtener_inexistente_y_archivada(db, id_hogar):
    cat = svc.crear_categoria(db, nombre="Temp", hogar_id=id_hogar)
    svc.archivar_categoria(db, cat.id, confirmar=True)
    with pytest.raises(ErrorNoEncontrado):
        svc.obtener_categoria(db, cat.id)
    with pytest.raises(ErrorNoEncontrado):
        svc.obtener_categoria(db, 9999)


def test_auto_detectar_categoria_supermercado_gasoil_ocio_casa(db, id_hogar):
    from app_conta.models.bote import Bote
    from app_conta.services.movimientos import crear_movimiento

    cuenta = _cuenta(db, id_hogar)

    # 1. Por descripción "Supermercado Mercadona" -> Categoría Supermercado
    m1 = crear_movimiento(
        db,
        fecha="2026-11-02",
        importe="-45.20",
        descripcion="Compra en Supermercado",
        cuenta_id=cuenta.id,
    )
    assert m1.categoria_id is not None
    cat1 = svc.obtener_categoria(db, m1.categoria_id)
    assert cat1.nombre == "Supermercado"

    # 2. Por descripción "Gasoil Repsol" -> Categoría Gasolina
    m2 = crear_movimiento(
        db,
        fecha="2026-11-02",
        importe="-60.00",
        descripcion="Gasoil Repsol",
        cuenta_id=cuenta.id,
    )
    assert m2.categoria_id is not None
    cat2 = svc.obtener_categoria(db, m2.categoria_id)
    assert cat2.nombre == "Gasolina"

    # 3. Por bote "Bote ocio" -> Categoría Ocio
    bote_ocio = Bote(hogar_id=id_hogar, nombre="Bote ocio", tipo="recurrente")
    db.add(bote_ocio)
    db.flush()
    m3 = crear_movimiento(
        db,
        fecha="2026-11-02",
        importe="-25.00",
        descripcion="Cena fin de semana",
        cuenta_id=cuenta.id,
        bote_id=bote_ocio.id,
    )
    assert m3.categoria_id is not None
    cat3 = svc.obtener_categoria(db, m3.categoria_id)
    assert cat3.nombre == "Ocio"

    # 4. Por descripción "Casa Bricomart" o bote "Mejoras del Hogar" -> Categoría Hogar
    m4 = crear_movimiento(
        db,
        fecha="2026-11-02",
        importe="-18.50",
        descripcion="Cosas para la casa",
        cuenta_id=cuenta.id,
    )
    assert m4.categoria_id is not None
    cat4 = svc.obtener_categoria(db, m4.categoria_id)
    assert cat4.nombre == "Hogar"

