"""Tests unitarios del servicio de conciliación (T024, US1) — escritos antes de implementar.

Fórmula del data-model.md:
  diferencia = saldo_total_cuentas − saldo_inicial_total − (saldo_total_botes + sin_asignar)
  sin_asignar = Σ importes de movimientos SIN bote (informativo, no rompe la conciliación)
  estado: `cuadrado` si diferencia = 0, `revisar` en caso contrario.

Escenarios de desfase (movimientos fuera de los saldos activos) se simulan aquí
con un bote ARCHIVADO que tiene movimientos asignados: sus importes cuentan en
los saldos de cuenta pero no en saldo_total_botes (el desfase real llega vía el
importador del Excel, US5).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select

from app_conta.models.hogar import Hogar
from app_conta.services.conciliacion import calcular_conciliacion


def _hogar_id(db) -> int:

    hogar = db.scalars(select(Hogar)).first()
    if hogar is None:
        hogar = Hogar(nombre="Hogar", moneda="EUR")
        db.add(hogar)
        db.flush()
    return hogar.id


def _cuenta(db, nombre="Banco", inicial_centimos=100_000, archivada=False):
    from app_conta.models.cuenta import Cuenta

    cuenta = Cuenta(
        hogar_id=_hogar_id(db),
        nombre=nombre,
        tipo="banco",
        saldo_inicial_centimos=inicial_centimos,
        fecha_apertura=date(2026, 10, 1),
        archivada=archivada,
    )
    db.add(cuenta)
    db.flush()
    return cuenta


def _movimiento(db, cuenta, centimos, bote=None, eliminado=False):
    from app_conta.models.movimiento import Movimiento

    mov = Movimiento(
        hogar_id=cuenta.hogar_id,
        cuenta_id=cuenta.id,
        fecha=date(2026, 10, 25),
        importe_centimos=centimos,
        descripcion=f"mov {centimos}",
        bote_id=bote.id if bote else None,
        eliminado=eliminado,
    )
    db.add(mov)
    db.flush()
    return mov


def _bote(db, nombre="Ahorro", archivado=False):
    from app_conta.models.bote import Bote

    bote = Bote(
        hogar_id=_hogar_id(db),
        nombre=nombre,
        tipo="ahorro",
        archivado=archivado,
    )
    db.add(bote)
    db.flush()
    return bote


def test_conciliacion_vacia_cuadrado(db, db_module):
    """SC: sin nada → todos los saldos en 0.00, diferencia 0 → estado cuadrado."""
    r = calcular_conciliacion(db)
    assert r["saldo_total_cuentas"] == 0
    assert r["saldo_inicial_total"] == 0
    assert r["saldo_total_botes"] == 0
    assert r["sin_asignar"] == 0
    assert r["diferencia"] == 0
    assert r["estado"] == "cuadrado"
    assert r["fecha_calculo"]  # presente


def test_conciliacion_solo_cuentas_iniciales_cuadrado(db):
    """Solo la cuenta creada (sin movimientos): diferencia = inicial − inicial = 0."""
    _cuenta(db, inicial_centimos=100_000)  # 1000.00 €
    r = calcular_conciliacion(db)
    assert r["saldo_total_cuentas"] == 100_000
    assert r["saldo_inicial_total"] == 100_000
    assert r["diferencia"] == 0
    assert r["estado"] == "cuadrado"


def test_conciliacion_movimientos_sin_asignar_no_rompen(db):
    """Los gastos sin bote son disponibles normal: cuadrado, sin_asignar informativo."""
    cuenta = _cuenta(db, inicial_centimos=100_000)
    _movimiento(db, cuenta, -3050)  # −30.50
    _movimiento(db, cuenta, -1200)  # −12.00
    r = calcular_conciliacion(db)
    assert r["saldo_total_cuentas"] == 100_000 - 3050 - 1200  # 957.50 €
    assert r["sin_asignar"] == -(3050 + 1200)  # −42.50 €
    assert r["diferencia"] == 0
    assert r["estado"] == "cuadrado"


def test_conciliacion_con_bote_asignado_encaja(db):
    """Movimientos asignados a bote ACTIVO: caen en saldo_total_botes (diferencia 0)."""
    cuenta = _cuenta(db, inicial_centimos=100_000)
    bote = _bote(db)
    _movimiento(db, cuenta, -5000, bote=bote)  # −50.00 al bote
    _movimiento(db, cuenta, -1200)  # −12.00 sin bote
    r = calcular_conciliacion(db)
    assert r["saldo_total_botes"] == -5000
    assert r["sin_asignar"] == -1200
    assert r["diferencia"] == 0
    assert r["estado"] == "cuadrado"


def test_conciliacion_desfase_detectado(db):
    """Bote archivado con movimientos: sus importes saltan del cuadre → revisar."""
    cuenta = _cuenta(db, inicial_centimos=100_000)
    bote = _bote(db, nombre="Vacaciones", archivado=True)
    _movimiento(db, cuenta, -7500, bote=bote)  # −75.00 "perdidos" del cuadre
    r = calcular_conciliacion(db)
    assert r["diferencia"] == -7500
    assert r["estado"] == "revisar"


def test_conciliacion_ignora_eliminados_y_cuentas_archivadas(db):
    """Movimiento eliminado y cuenta archivada: fuera de todos los cálculos."""
    cuenta = _cuenta(db, inicial_centimos=100_000)
    _movimiento(db, cuenta, -1000, eliminado=True)
    _cuenta(db, nombre="Cuenta vieja", inicial_centimos=50_000, archivada=True)
    r = calcular_conciliacion(db)
    assert r["saldo_total_cuentas"] == 100_000
    assert r["saldo_inicial_total"] == 100_000
    assert r["sin_asignar"] == 0
    assert r["diferencia"] == 0
    assert r["estado"] == "cuadrado"


def test_conciliacion_signos_mixtos_y_inicial_negativo(db):
    """Edge del data-model: saldo inicial negativo + ingreso (signos mixtos)."""
    cuenta = _cuenta(db, nombre="Descubierto", inicial_centimos=-100_00)  # −100.00 €
    _movimiento(db, cuenta, 4000)  # +40.00
    r = calcular_conciliacion(db)
    assert r["saldo_total_cuentas"] == -100_00 + 4000  # −60.00 €
    assert r["saldo_inicial_total"] == -100_00
    assert r["sin_asignar"] == 4000
    assert r["diferencia"] == 0  # −60.00 − (−100.00) − 40.00 = 0
    assert r["estado"] == "cuadrado"


def test_formula_ingreso_sin_bote_no_es_descuadre(db):
    """Un ingreso sin bote (recibos aún pendientes) es dinero real: fórmula cuadrada."""
    cuenta = _cuenta(db, inicial_centimos=0)
    _movimiento(db, cuenta, 232_300)  # +2.323,00 € sin asignar
    r = calcular_conciliacion(db)
    assert r["sin_asignar"] == 232_300
    assert r["diferencia"] == 0
    assert r["diferencia_formula"] == 0
    assert r["estado_formula"] == "cuadrado"


def test_formula_cuenta_con_bote_cuadra(db):
    """Cuenta con fondos asignados a un bote: la fórmula del hogar queda cuadrada."""
    cuenta = _cuenta(db, inicial_centimos=0)
    bote = _bote(db, nombre="Ahorro")
    _movimiento(db, cuenta, 150_000, bote=bote)
    r = calcular_conciliacion(db)
    assert r["total_botes_formula"] == 150_000
    assert r["diferencia_formula"] == 0
    assert r["estado_formula"] == "cuadrado"


def test_formula_reparto_con_recibos_pendientes_cuadra(db):
    """Reparto tipo nómina: botes + sin asignar (recibos por pagar) = cuentas."""
    cuenta = _cuenta(db, inicial_centimos=0)
    bote = _bote(db, nombre="Amortización Hipoteca")
    _movimiento(db, cuenta, 124_900, bote=bote)  # 1.249,00 € a botes
    _movimiento(db, cuenta, 107_400)  # 1.074,00 € libres para recibos
    r = calcular_conciliacion(db)
    assert r["total_botes_formula"] == 124_900
    assert r["sin_asignar"] == 107_400
    assert r["diferencia"] == 0
    assert r["diferencia_formula"] == 0
    assert r["estado_formula"] == "cuadrado"
