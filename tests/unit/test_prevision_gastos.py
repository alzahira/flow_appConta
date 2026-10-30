"""Tests unitarios del servicio de previsión de gastos anuales y bote de gastos."""

from __future__ import annotations

import pytest

from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.prevision_gastos import (
    actualizar_config_prevision,
    actualizar_gasto_recurrente,
    crear_gasto_recurrente,
    eliminar_gasto_recurrente,
    obtener_o_crear_config,
    obtener_resumen_prevision,
    registrar_pago_factura,
    semillar_gastos_si_vacio,
)


def test_obtener_o_crear_config(db, hogar_id):
    cfg = obtener_o_crear_config(db, hogar_id)
    assert cfg.meses_pagados == 11
    assert cfg.anio == 2026

    # Idempotente
    cfg2 = obtener_o_crear_config(db, hogar_id)
    assert cfg2.id == cfg.id


def test_actualizar_config_prevision(db, hogar_id):
    cfg = actualizar_config_prevision(db, hogar_id, meses_pagados=12, anio=2027)
    assert cfg.meses_pagados == 12
    assert cfg.anio == 2027

    with pytest.raises(ErrorValidacion):
        actualizar_config_prevision(db, hogar_id, meses_pagados=15)

    with pytest.raises(ErrorValidacion):
        actualizar_config_prevision(db, hogar_id, meses_pagados=-1)


def test_semillar_y_resumen_prevision(db, hogar_id):
    # Si la base de datos está vacía, no debe autosemillar
    resumen_vacio = obtener_resumen_prevision(db, hogar_id)
    assert resumen_vacio["total_saldo_centimos"] == 0
    assert len(resumen_vacio["gastos"]) == 0

    # Tras semillar explícitamente
    semillar_gastos_si_vacio(db, hogar_id)
    resumen = obtener_resumen_prevision(db, hogar_id)
    assert resumen["meses_pagados"] == 11
    assert resumen["total_mensual_centimos"] == 17654  # 176.54 €
    assert len(resumen["gastos"]) == 16

    # Comprobamos Basura Cañete
    basura = next(g for g in resumen["gastos"] if "Basura Cañete" in g["concepto"])
    assert basura["importe_anual_centimos"] == 14000
    assert basura["cuota_mensual_centimos"] == 1167
    assert basura["pagado_real_centimos"] == 7100
    assert basura["saldo_centimos"] == 5733  # 57.33 €
    assert basura["estado"] == "superavit"

    # Comprobamos IBI Cañete
    ibi = next(g for g in resumen["gastos"] if "Ibi Cañete" in g["concepto"])
    assert ibi["importe_anual_centimos"] == 23500
    assert ibi["pagado_real_centimos"] == 23500
    assert ibi["saldo_centimos"] == -1958  # -19.58 €
    assert ibi["estado"] == "deficit"


def test_crear_actualizar_y_eliminar_gasto(db, hogar_id):
    gasto = crear_gasto_recurrente(
        db,
        hogar_id,
        {
            "concepto": "Comunidad Garaje",
            "fecha_cobro": "Trimestral",
            "importe_anual_centimos": 12000,
            "cuota_mensual_centimos": 1000,
            "pagado_real_centimos": 3000,
            "notas": "Garaje centro",
        },
    )
    assert gasto.id is not None
    assert gasto.concepto == "Comunidad Garaje"

    actualizado = actualizar_gasto_recurrente(
        db, gasto.id, {"concepto": "Comunidad Garaje 2", "pagado_real_centimos": 6000}
    )
    assert actualizado.concepto == "Comunidad Garaje 2"
    assert actualizado.pagado_real_centimos == 6000

    eliminar_gasto_recurrente(db, gasto.id)
    with pytest.raises(ErrorNoEncontrado):
        actualizar_gasto_recurrente(db, gasto.id, {"concepto": "No existe"})


def test_registrar_pago_factura(db, hogar_id):
    gasto = crear_gasto_recurrente(
        db,
        hogar_id,
        {
            "concepto": "Seguro Moto",
            "fecha_cobro": "Mayo",
            "importe_anual_centimos": 12000,
            "pagado_real_centimos": 0,
        },
    )
    # Sumar pago
    g1 = registrar_pago_factura(db, gasto.id, 6000, sumar=True)
    assert g1.pagado_real_centimos == 6000
    g2 = registrar_pago_factura(db, gasto.id, 6000, sumar=True)
    assert g2.pagado_real_centimos == 12000

    # Establecer absoluto
    g3 = registrar_pago_factura(db, gasto.id, 5000, sumar=False)
    assert g3.pagado_real_centimos == 5000


def test_validaciones_gasto_recurrente(db, hogar_id):
    with pytest.raises(ErrorValidacion):
        crear_gasto_recurrente(
            db, hogar_id, {"concepto": "", "fecha_cobro": "Mayo", "importe_anual_centimos": 100}
        )

    with pytest.raises(ErrorValidacion):
        crear_gasto_recurrente(
            db, hogar_id, {"concepto": "Test", "fecha_cobro": "", "importe_anual_centimos": 100}
        )

    with pytest.raises(ErrorValidacion):
        crear_gasto_recurrente(
            db, hogar_id, {"concepto": "Test", "fecha_cobro": "Mayo", "importe_anual_centimos": 0}
        )
