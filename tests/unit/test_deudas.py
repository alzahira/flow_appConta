"""Tests unitarios del servicio de Deudas (dinero que le deben al hogar)."""

from datetime import date

import pytest

from app_conta.services.cuentas import crear_cuenta
from app_conta.services.deudas import (
    crear_deuda,
    eliminar_deuda,
    listar_deudas_activas,
    obtener_deuda,
    registrar_cobro,
)
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion


def test_crear_deuda_ok(db, id_hogar):
    deuda = crear_deuda(
        db,
        deudor="Juan Pérez",
        concepto="Cena cumpleaños",
        importe="45.50",
        fecha="2026-10-25",
        hogar_id=id_hogar,
        fecha_limite="2026-11-01",
        notas="Me lo paga por Bizum",
    )
    assert deuda.id is not None
    assert deuda.deudor == "Juan Pérez"
    assert deuda.concepto == "Cena cumpleaños"
    assert deuda.importe_inicial_centimos == 4550
    assert deuda.importe_cobrado_centimos == 0
    assert deuda.estado == "pendiente"
    assert deuda.fecha == date(2026, 10, 25)
    assert deuda.fecha_limite == date(2026, 11, 1)


def test_crear_deuda_validaciones(db, id_hogar):
    with pytest.raises(ErrorValidacion):
        crear_deuda(
            db, deudor="", concepto="Préstamo", importe="10", fecha="2026-10-25", hogar_id=id_hogar
        )

    with pytest.raises(ErrorValidacion):
        crear_deuda(
            db, deudor="Carlos", concepto="", importe="10", fecha="2026-10-25", hogar_id=id_hogar
        )

    with pytest.raises(ErrorValidacion):
        crear_deuda(
            db,
            deudor="Carlos",
            concepto="Viaje",
            importe="0",
            fecha="2026-10-25",
            hogar_id=id_hogar,
        )


def test_registrar_cobro_parcial_y_saldado(db, id_hogar):
    deuda = crear_deuda(
        db,
        deudor="Pedro",
        concepto="Préstamo moto",
        importe="200.00",
        fecha="2026-10-20",
        hogar_id=id_hogar,
    )
    # Cobro parcial de 80 €
    deuda = registrar_cobro(db, deuda.id, importe="80.00")
    assert deuda.importe_cobrado_centimos == 8000
    assert deuda.estado == "parcial"

    # Intentar cobrar más del saldo pendiente (quedan 120 €)
    with pytest.raises(ErrorValidacion):
        registrar_cobro(db, deuda.id, importe="150.00")

    # Cobro restante de 120 € -> queda saldado
    deuda = registrar_cobro(db, deuda.id, importe="120.00")
    assert deuda.importe_cobrado_centimos == 20000
    assert deuda.estado == "saldado"


def test_registrar_cobro_con_cuenta_crea_movimiento(db, id_hogar):
    cuenta = crear_cuenta(
        db,
        nombre="Caixa Principal",
        tipo="banco",
        hogar_id=id_hogar,
        fecha_apertura=date(2026, 1, 1),
    )
    deuda = crear_deuda(
        db,
        deudor="Ana",
        concepto="Fianza compartida",
        importe="150.00",
        fecha="2026-10-20",
        hogar_id=id_hogar,
    )
    deuda = registrar_cobro(
        db,
        deuda.id,
        importe="50.00",
        cuenta_id=cuenta.id,
        fecha="2026-10-29",
    )
    assert deuda.importe_cobrado_centimos == 5000

    from app_conta.services.movimientos import listar_movimientos

    movs, total = listar_movimientos(db, cuenta=cuenta.id)
    assert total == 1
    assert movs[0].importe_centimos == 5000
    assert "Ana" in movs[0].descripcion


def test_listar_y_eliminar_deuda(db, id_hogar):
    d1 = crear_deuda(
        db, deudor="A", concepto="C1", importe="100.00", fecha="2026-10-20", hogar_id=id_hogar
    )
    d2 = crear_deuda(
        db, deudor="B", concepto="C2", importe="50.00", fecha="2026-10-21", hogar_id=id_hogar
    )
    registrar_cobro(db, d1.id, importe="30.00")

    deudas, total_pendiente, total_cobrado = listar_deudas_activas(db, id_hogar)
    assert len(deudas) == 2
    assert total_pendiente == 7000 + 5000  # 120 €
    assert total_cobrado == 3000  # 30 €

    eliminar_deuda(db, d2.id)
    deudas2, total_pendiente2, _ = listar_deudas_activas(db, id_hogar)
    assert len(deudas2) == 1
    assert total_pendiente2 == 7000

    with pytest.raises(ErrorNoEncontrado):
        obtener_deuda(db, d2.id)
