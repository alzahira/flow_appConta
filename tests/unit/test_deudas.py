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


def test_registrar_cobro_compensacion_con_bote(db, id_hogar):
    from app_conta.services.botes import crear_bote, saldo_bote
    from app_conta.services.conciliacion import calcular_conciliacion
    from app_conta.services.movimientos import crear_movimiento, saldo_cuenta

    cuenta = crear_cuenta(
        db,
        nombre="Caixa Operativa",
        tipo="banco",
        saldo_inicial="100.00",
        fecha_apertura=date(2026, 1, 1),
        hogar_id=id_hogar,
    )
    bote = crear_bote(
        db,
        nombre="Bote Mantecados",
        tipo="ahorro",
        categoria="otros",
        hogar_id=id_hogar,
    )
    # Ingreso de 30 € al bote con respaldo en la cuenta
    crear_movimiento(
        db,
        cuenta_id=cuenta.id,
        bote_id=bote.id,
        importe="+30.00",
        fecha="2026-11-20",
        descripcion="Recogida mantecados familia",
        hogar_id=id_hogar,
    )
    assert saldo_bote(db, bote) == 3000
    assert saldo_cuenta(db, cuenta) == 13000

    # Crear deuda de 100 €
    deuda = crear_deuda(
        db,
        deudor="Aitor",
        concepto="Mantecados pedido 1",
        importe="100.00",
        fecha="2026-11-20",
        hogar_id=id_hogar,
    )
    assert deuda.importe_inicial_centimos == 10000
    assert deuda.importe_cobrado_centimos == 0

    # Conciliación antes de la compensación
    conc_antes = calcular_conciliacion(db, id_hogar)

    # Compensar 30 € de la deuda usando el saldo del bote
    deuda = registrar_cobro(
        db,
        deuda.id,
        importe="30.00",
        bote_id=bote.id,
        fecha="2026-11-22",
    )
    assert deuda.importe_cobrado_centimos == 3000
    assert deuda.estado == "parcial"

    # Saldo del sobre debe ser ahora 0
    assert saldo_bote(db, bote) == 0

    # Saldo del banco NO debe haber cambiado (se mantiene en 130,00 €)
    assert saldo_cuenta(db, cuenta) == 13000

    # Conciliación: la diferencia debe ser IDÉNTICA (impacto neto en el balance = 0,00 €)
    conc_despues = calcular_conciliacion(db, id_hogar)
    assert conc_despues["diferencia_formula"] == conc_antes["diferencia_formula"]


def test_archivar_deudas_saldadas(db, id_hogar):
    from app_conta.services.deudas import archivar_deudas_saldadas

    d1 = crear_deuda(db, deudor="Saldado 1", concepto="Test 1", importe="40.00", fecha="2026-11-01", hogar_id=id_hogar)
    d2 = crear_deuda(db, deudor="Pendiente", concepto="Test 2", importe="60.00", fecha="2026-11-01", hogar_id=id_hogar)
    registrar_cobro(db, d1.id, importe="40.00")
    assert d1.estado == "saldado"
    assert d2.estado == "pendiente"

    archivadas = archivar_deudas_saldadas(db, id_hogar)
    assert archivadas == 1
    assert d1.archivada is True
    assert d2.archivada is False


