"""Tests unitarios del servicio de botes (T031, US3) — escritos antes de implementar.

Reglas: saldo = Σ importes de movimientos asignados (NUNCA editable), objetivo
alcanzado → estado `conseguido`, reasignación solo cambia el bote del movimiento
(los saldos se recalculan por derivación), nombre único por hogar.
Convención de importes: Decimal de euros → céntimos (−30.00 € = −3000 céntimos).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app_conta.models.cuenta import Cuenta
from app_conta.services.botes import (
    archivar_bote,
    crear_bote,
    estado_de_bote,
    listar_botes_activos,
    reasignar_bote,
    saldo_bote,
)
from app_conta.services.errors import ErrorConflicto, ErrorValidacion
from app_conta.services.movimientos import crear_movimiento


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


def test_saldo_es_suma_de_movimientos_asignados(db, id_hogar):
    bote = crear_bote(db, nombre="Vacaciones", tipo="ahorro", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    mov1 = crear_movimiento(
        db,
        fecha="2026-10-25",
        importe=Decimal("-50.00"),
        descripcion="Para el bote",
        cuenta_id=cuenta.id,
    )
    mov2 = crear_movimiento(
        db, fecha="2026-10-26", importe=Decimal("-30.00"), descripcion="Otro", cuenta_id=cuenta.id
    )

    reasignar_bote(db, mov1.id, bote.id)
    assert saldo_bote(db, bote) == -5000  # −50.00 € solo

    reasignar_bote(db, mov2.id, bote.id)
    assert saldo_bote(db, bote) == -8000  # −50.00 + −30.00

    _ = mov1  # ambos movimientos asignados


def test_reasignacion_actualiza_ambos_botes(db, id_hogar):
    bote_a = crear_bote(db, nombre="A", tipo="ahorro", hogar_id=id_hogar)
    bote_b = crear_bote(db, nombre="B", tipo="proyecto", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    mov = crear_movimiento(
        db,
        fecha="2026-10-26",
        importe=Decimal("-70.00"),
        descripcion="Traslado",
        cuenta_id=cuenta.id,
    )

    reasignar_bote(db, mov.id, bote_a.id)
    assert saldo_bote(db, bote_a) == -7000
    assert saldo_bote(db, bote_b) == 0

    reasignar_bote(db, mov.id, bote_b.id)
    assert saldo_bote(db, bote_a) == 0
    assert saldo_bote(db, bote_b) == -7000

    reasignar_bote(db, mov.id, None)
    assert saldo_bote(db, bote_a) == 0
    assert saldo_bote(db, bote_b) == 0


def test_objetivo_conseguido(db, id_hogar):
    """Criterio data-model regla 5: conseguido cuando `saldo >= objetivo`.

    Un bote de ahorro recibe APORTACIONES (ingresos asignados) acumulándose
    hasta el objetivo. Presupuesto de gasto agotado se representa con objetivo
    negativo y saldo que llega o baja de él (`saldo <= objetivo`).
    """
    bote = crear_bote(db, nombre="Vacaciones", tipo="ahorro", objetivo="60.00", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)

    mov = crear_movimiento(
        db,
        fecha="2026-10-26",
        importe=Decimal("+30.00"),
        descripcion="aportación 1",
        cuenta_id=cuenta.id,
    )
    reasignar_bote(db, mov.id, bote.id)
    assert estado_de_bote(bote, saldo_bote(db, bote)) == "en_curso"

    mov2 = crear_movimiento(
        db,
        fecha="2026-10-27",
        importe=Decimal("+35.00"),
        descripcion="aportación 2",
        cuenta_id=cuenta.id,
    )
    reasignar_bote(db, mov2.id, bote.id)
    assert saldo_bote(db, bote) == 6500  # +30.00 + +35.00
    # objetivo 60.00 alcanzado → conseguido
    assert estado_de_bote(bote, saldo_bote(db, bote)) == "conseguido"


def test_objetivo_presupuesto_negativo(db, id_hogar):
    """Bote presupuesto (objetivo negativo): se considera agotado al llegar a él."""
    bote = crear_bote(
        db, nombre="Presupuesto ocio", tipo="recurrente", objetivo="-60.00", hogar_id=id_hogar
    )
    assert estado_de_bote(bote, 0) == "en_curso"
    assert estado_de_bote(bote, -6000) == "conseguido"  # presupuesto agotado
    assert estado_de_bote(bote, -6500) == "conseguido"


def test_nombre_duplicado_rechazado(db, id_hogar):
    crear_bote(db, nombre="Común", tipo="recurrente", hogar_id=id_hogar)
    with pytest.raises(ErrorConflicto):
        crear_bote(db, nombre="Común", tipo="ahorro", hogar_id=id_hogar)


def test_tipo_invalido_rechazado(db, id_hogar):
    with pytest.raises(ErrorValidacion):
        crear_bote(db, nombre="Mal tipo", tipo="chatarra", hogar_id=id_hogar)


def test_bote_negativo_se_muestra_sin_bloqueo(db, id_hogar):
    """Edge case del spec: un bote con saldo NEGATIVO se muestra, sin bloquearse."""
    bote = crear_bote(db, nombre="Sobre útil", tipo="recurrente", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    mov = crear_movimiento(
        db,
        fecha="2026-10-26",
        importe=Decimal("-120.00"),
        descripcion="Exceso",
        cuenta_id=cuenta.id,
    )
    reasignar_bote(db, mov.id, bote.id)

    botes, total = listar_botes_activos(db)
    assert [(b, s) for (b, s) in botes] == [(bote, -12000)]  # visible, sin bloqueo
    assert total == -12000


def test_archivar_bote_libera_movimientos(db, id_hogar):
    bote = crear_bote(db, nombre="Que va fuera", tipo="ajeno", hogar_id=id_hogar)
    cuenta = _cuenta(db, id_hogar)
    mov = crear_movimiento(
        db, fecha="2026-10-26", importe=Decimal("-10.00"), descripcion="...", cuenta_id=cuenta.id
    )
    reasignar_bote(db, mov.id, bote.id)

    archivar_bote(db, bote.id, confirmar=True)

    botes, _ = listar_botes_activos(db)
    assert botes == []  # archivado → fuera del listado de activos
