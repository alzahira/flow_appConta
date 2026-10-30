"""Tests unitarios del servicio de préstamos, pasivos y financiaciones del hogar."""

from __future__ import annotations

import pytest

from app_conta.models.cuenta import Cuenta
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.prestamos import (
    actualizar_prestamo,
    crear_prestamo,
    eliminar_prestamo,
    listar_prestamos,
    obtener_prestamo,
    registrar_pago_prestamo,
    resumen_prestamos,
)


def _crear_cuenta(db, id_hogar, nombre="Cuenta Corriente Caixa"):
    from datetime import date

    c = Cuenta(
        hogar_id=str(id_hogar),
        nombre=nombre,
        tipo="banco",
        entidad="Caixa",
        saldo_inicial_centimos=100000,  # 1.000 €
        fecha_apertura=date(2026, 1, 1),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def test_crear_prestamo_coche_exito(db, id_hogar):
    p = crear_prestamo(
        db,
        id_hogar,
        {
            "nombre": "Préstamo Coche",
            "entidad": "Santander Consumer",
            "tipo": "coche",
            "importe_inicial_centimos": 1500000,  # 15.000 €
            "importe_pendiente_centimos": 900000,  # 9.000 €
            "cuota_mensual_centimos": 25000,  # 250 €/mes
            "fecha_inicio": "2024-03-01",
            "fecha_fin": "2028-03-01",
            "notas": "Financiación coche familiar",
        },
    )
    assert p.id is not None
    assert p.nombre == "Préstamo Coche"
    assert p.entidad == "Santander Consumer"
    assert p.tipo == "coche"
    assert p.importe_inicial_centimos == 1500000
    assert p.importe_pendiente_centimos == 900000
    assert p.amortizado_centimos == 600000  # 6.000 € devueltos
    assert p.progreso_amortizado_pct == 40.0
    assert p.cuota_mensual_centimos == 25000
    assert p.activo is True


def test_validaciones_prestamo(db, id_hogar):
    with pytest.raises(ErrorValidacion, match="nombre o concepto"):
        crear_prestamo(
            db,
            id_hogar,
            {"nombre": "", "entidad": "BBVA", "importe_inicial_centimos": 500000},
        )

    with pytest.raises(ErrorValidacion, match="entidad prestamista"):
        crear_prestamo(
            db,
            id_hogar,
            {"nombre": "Coche", "entidad": "", "importe_inicial_centimos": 500000},
        )

    with pytest.raises(ErrorValidacion, match="mayor a 0"):
        crear_prestamo(
            db,
            id_hogar,
            {"nombre": "Coche", "entidad": "BBVA", "importe_inicial_centimos": 0},
        )

    with pytest.raises(ErrorValidacion, match="no puede superar el capital inicial"):
        crear_prestamo(
            db,
            id_hogar,
            {
                "nombre": "Coche",
                "entidad": "BBVA",
                "importe_inicial_centimos": 500000,
                "importe_pendiente_centimos": 600000,
            },
        )


def test_registrar_pago_prestamo(db, id_hogar):
    cuenta = _crear_cuenta(db, id_hogar)
    p = crear_prestamo(
        db,
        id_hogar,
        {
            "nombre": "Préstamo Coche",
            "entidad": "Santander Consumer",
            "tipo": "coche",
            "importe_inicial_centimos": 1000000,
            "importe_pendiente_centimos": 500000,
        },
    )

    # Pagamos 250 € descontando de la cuenta
    p_act = registrar_pago_prestamo(
        db,
        id_hogar,
        p.id,
        importe_centimos=25000,
        cuenta_id=cuenta.id,
        concepto="Cuota mensual coche",
    )
    assert p_act.importe_pendiente_centimos == 475000
    assert p_act.amortizado_centimos == 525000
    assert p_act.progreso_amortizado_pct == 52.5
    assert p_act.activo is True

    # Comprobamos que se creó el movimiento contable negativo en la cuenta
    from sqlalchemy import select

    from app_conta.models.movimiento import Movimiento

    mov = db.scalar(select(Movimiento).where(Movimiento.cuenta_id == cuenta.id))
    assert mov is not None
    assert mov.importe_centimos == -25000


def test_pago_saldar_prestamo(db, id_hogar):
    p = crear_prestamo(
        db,
        id_hogar,
        {
            "nombre": "Financiación Móvil",
            "entidad": "Cetelem",
            "importe_inicial_centimos": 50000,
            "importe_pendiente_centimos": 10000,
        },
    )

    # Pagamos los 100 € restantes
    p_saldado = registrar_pago_prestamo(db, id_hogar, p.id, importe_centimos=10000)
    assert p_saldado.importe_pendiente_centimos == 0
    assert p_saldado.activo is False  # Pasa a inactivo/saldado automáticamente


def test_resumen_prestamos(db, id_hogar):
    crear_prestamo(
        db,
        id_hogar,
        {
            "nombre": "Coche",
            "entidad": "Santander",
            "tipo": "coche",
            "importe_inicial_centimos": 2000000,  # 20.000 €
            "importe_pendiente_centimos": 1000000,  # 10.000 €
            "cuota_mensual_centimos": 30000,  # 300 €
        },
    )
    crear_prestamo(
        db,
        id_hogar,
        {
            "nombre": "Reforma",
            "entidad": "BBVA",
            "tipo": "personal",
            "importe_inicial_centimos": 1000000,  # 10.000 €
            "importe_pendiente_centimos": 500000,  # 5.000 €
            "cuota_mensual_centimos": 15000,  # 150 €
        },
    )

    res = resumen_prestamos(db, id_hogar)
    assert res["total_prestamos"] == 2
    assert res["total_financiado_centimos"] == 3000000  # 30.000 €
    assert res["total_deuda_pendiente_centimos"] == 1500000  # 15.000 €
    assert res["total_amortizado_centimos"] == 1500000  # 15.000 €
    assert res["progreso_global_pct"] == 50.0
    assert res["cuota_mensual_total_centimos"] == 45000  # 450 €/mes


def test_eliminar_prestamo(db, id_hogar):
    p = crear_prestamo(
        db,
        id_hogar,
        {"nombre": "A borrar", "entidad": "Bank", "importe_inicial_centimos": 100000},
    )
    eliminar_prestamo(db, id_hogar, p.id)
    with pytest.raises(ErrorNoEncontrado):
        obtener_prestamo(db, id_hogar, p.id)


def test_actualizar_y_listar_prestamos(db, id_hogar):
    p = crear_prestamo(
        db,
        id_hogar,
        {"nombre": "Moto", "entidad": "Honda", "importe_inicial_centimos": 600000},
    )
    actualizar_prestamo(db, id_hogar, p.id, {"cuota_mensual_centimos": 12000, "notas": "Revisar"})
    lista = listar_prestamos(db, id_hogar)
    assert len(lista) == 1
    assert lista[0].cuota_mensual_centimos == 12000
    assert lista[0].notas == "Revisar"
