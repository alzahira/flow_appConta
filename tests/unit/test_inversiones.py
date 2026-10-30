"""Tests unitarios del servicio de inversiones y carteras de activos."""

from __future__ import annotations

import pytest

from app_conta.models.cuenta import Cuenta
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.inversiones import (
    actualizar_inversion,
    actualizar_valoracion,
    crear_inversion,
    eliminar_inversion,
    listar_inversiones,
    obtener_inversion,
    registrar_aportacion,
    registrar_reembolso,
    resumen_inversiones,
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


def test_crear_inversion_basica(db, id_hogar):
    inv = crear_inversion(
        db,
        id_hogar,
        {
            "nombre": "MSCI World Indexado",
            "entidad": "MyInvestor",
            "tipo_activo": "fondos",
            "capital_aportado_centimos": 500000,  # 5.000 €
            "valor_actual_centimos": 550000,  # 5.500 €
            "fecha_inicio": "2026-01-15",
            "notas": "Fondo Vanguard Global",
        },
    )
    assert inv.id is not None
    assert inv.nombre == "MSCI World Indexado"
    assert inv.entidad == "MyInvestor"
    assert inv.plusvalia_centimos == 50000  # +500 €
    assert inv.rentabilidad_pct == 10.0  # +10.0%


def test_crear_inversion_con_descuento_cuenta(db, id_hogar):
    cuenta = _crear_cuenta(db, id_hogar)
    inv = crear_inversion(
        db,
        id_hogar,
        {
            "nombre": "Cartera Indexa 8/10",
            "entidad": "Indexa Capital",
            "tipo_activo": "fondos",
            "capital_aportado_centimos": 30000,  # 300 €
            "fecha_inicio": "2026-02-01",
            "cuenta_id": cuenta.id,
            "crear_movimiento_inicial": True,
        },
    )
    assert inv.valor_actual_centimos == 30000

    from app_conta.services.movimientos import listar_movimientos

    movs, total = listar_movimientos(db, cuenta=cuenta.id)
    assert total == 1
    assert movs[0].importe_centimos == -30000  # -300 €
    assert "Inversión inicial" in movs[0].descripcion


def test_validaciones_inversion(db, id_hogar):
    with pytest.raises(ErrorValidacion):
        crear_inversion(
            db, id_hogar, {"nombre": "", "entidad": "Caixa", "fecha_inicio": "2026-01-01"}
        )

    with pytest.raises(ErrorValidacion):
        crear_inversion(
            db, id_hogar, {"nombre": "Fondo", "entidad": "", "fecha_inicio": "2026-01-01"}
        )

    with pytest.raises(ErrorValidacion):
        crear_inversion(
            db,
            id_hogar,
            {"nombre": "Fondo", "entidad": "Caixa", "fecha_inicio": "fecha-invalida"},
        )


def test_actualizar_datos_inversion(db, id_hogar):
    inv = crear_inversion(
        db,
        id_hogar,
        {
            "nombre": "Fondo MSCI World",
            "entidad": "MyInvestor",
            "tipo_activo": "fondos",
            "capital_aportado_centimos": 100000,
        },
    )
    actualizado = actualizar_inversion(
        db,
        inv.id,
        {
            "nombre": "Vanguard ESG Global",
            "notas": "ISIN IE00BNG8L278",
            "tipo_activo": "fondos",
        },
    )
    assert actualizado.nombre == "Vanguard ESG Global"
    assert actualizado.notas == "ISIN IE00BNG8L278"

    with pytest.raises(ErrorNoEncontrado):
        actualizar_inversion(db, 99999, {"nombre": "Inexistente"})


def test_actualizar_valoracion_mercado(db, id_hogar):
    inv = crear_inversion(
        db,
        id_hogar,
        {
            "nombre": "Bitcoin Cold Storage",
            "entidad": "Ledger",
            "tipo_activo": "cripto",
            "capital_aportado_centimos": 100000,  # 1.000 €
            "fecha_inicio": "2026-01-10",
        },
    )
    assert inv.plusvalia_centimos == 0
    assert inv.rentabilidad_pct == 0.0

    actualizar_valoracion(db, inv.id, nuevo_valor_centimos=125000)  # Sube a 1.250 €
    db.refresh(inv)
    assert inv.valor_actual_centimos == 125000
    assert inv.plusvalia_centimos == 25000  # +250 €
    assert inv.rentabilidad_pct == 25.0  # +25%


def test_registrar_aportacion_y_reembolso(db, id_hogar):
    cuenta = _crear_cuenta(db, id_hogar)
    inv = crear_inversion(
        db,
        id_hogar,
        {
            "nombre": "Letras del Tesoro 12M",
            "entidad": "Banco de España",
            "tipo_activo": "renta_fija",
            "capital_aportado_centimos": 100000,
            "fecha_inicio": "2026-03-01",
        },
    )

    # Aportar 500 € desde cuenta
    registrar_aportacion(db, inv.id, importe_centimos=50000, cuenta_origen_id=cuenta.id)
    db.refresh(inv)
    assert inv.capital_aportado_centimos == 150000
    assert inv.valor_actual_centimos == 150000

    # Reembolsar 200 € hacia cuenta
    registrar_reembolso(db, inv.id, importe_centimos=20000, cuenta_destino_id=cuenta.id)
    db.refresh(inv)
    assert inv.valor_actual_centimos == 130000
    assert inv.capital_aportado_centimos == 130000

    from app_conta.services.movimientos import listar_movimientos

    movs, total = listar_movimientos(db, cuenta=cuenta.id)
    assert total == 2
    assert movs[0].importe_centimos == -50000
    assert movs[1].importe_centimos == 20000


def test_resumen_y_distribucion_inversiones(db, id_hogar):
    crear_inversion(
        db,
        id_hogar,
        {
            "nombre": "Fondo 1",
            "entidad": "MyInvestor",
            "tipo_activo": "fondos",
            "capital_aportado_centimos": 600000,
            "valor_actual_centimos": 660000,
            "fecha_inicio": "2026-01-01",
        },
    )
    crear_inversion(
        db,
        id_hogar,
        {
            "nombre": "Letras",
            "entidad": "Tesoro",
            "tipo_activo": "renta_fija",
            "capital_aportado_centimos": 400000,
            "valor_actual_centimos": 400000,
            "fecha_inicio": "2026-01-01",
        },
    )

    res = resumen_inversiones(db, id_hogar)
    assert res["total_capital_aportado_centimos"] == 1000000  # 10.000 €
    assert res["total_valor_actual_centimos"] == 1060000  # 10.600 €
    assert res["total_plusvalia_centimos"] == 60000  # +600 €
    assert res["rentabilidad_global_pct"] == 6.0  # +6.0%
    assert len(res["distribucion_tipo"]) == 2
    assert len(res["inversiones"]) == 2


def test_eliminar_inversion(db, id_hogar):
    inv = crear_inversion(
        db,
        id_hogar,
        {
            "nombre": "Plan Pensiones BBVA",
            "entidad": "BBVA",
            "tipo_activo": "pensiones",
            "capital_aportado_centimos": 200000,
            "fecha_inicio": "2026-01-01",
        },
    )
    eliminar_inversion(db, inv.id)
    activas = listar_inversiones(db, id_hogar, solo_activas=True)
    assert len(activas) == 0

    with pytest.raises(ErrorNoEncontrado):
        obtener_inversion(db, 99999)
