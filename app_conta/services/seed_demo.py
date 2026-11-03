"""Semillado de datos ficticios para el Hogar Demo."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.bote import Bote
from app_conta.models.categoria import Categoria
from app_conta.models.cuenta import Cuenta
from app_conta.models.deuda import Deuda
from app_conta.models.gasto_recurrente import GastoRecurrente, PrevisionGastosConfig
from app_conta.models.inversion import Inversion
from app_conta.models.movimiento import Movimiento
from app_conta.models.prestamo import Prestamo


def sembrar_hogar_demo_si_vacio(db: Session, hogar_demo_id: int) -> None:
    """Rellena el Hogar Demo con datos realistas y atractivos si no tiene cuentas."""
    stmt = select(Cuenta).filter(Cuenta.hogar_id == hogar_demo_id)
    cuenta_existente = db.execute(stmt).scalars().first()
    if cuenta_existente:
        return  # Ya está sembrado

    hoy = date.today()

    # 1. Categorías del hogar demo
    cat_nomina = Categoria(hogar_id=str(hogar_demo_id), nombre="Nómina", color="#10B981")
    cat_super = Categoria(hogar_id=str(hogar_demo_id), nombre="Supermercado", color="#3B82F6")
    cat_ocio = Categoria(hogar_id=str(hogar_demo_id), nombre="Ocio y Restaurantes", color="#8B5CF6")
    cat_suministros = Categoria(hogar_id=str(hogar_demo_id), nombre="Suministros", color="#F59E0B")
    db.add_all([cat_nomina, cat_super, cat_ocio, cat_suministros])
    db.flush()

    # 2. Cuentas
    cta_principal = Cuenta(
        hogar_id=hogar_demo_id,
        nombre="Cuenta Principal Demo",
        tipo="banco",
        entidad="OpenBank Demo",
        saldo_inicial_centimos=215000,  # 2.150,00 €
        fecha_apertura=hoy,
        archivada=False,
    )
    cta_tarjeta = Cuenta(
        hogar_id=hogar_demo_id,
        nombre="Tarjeta Compras Demo",
        tipo="tarjeta",
        entidad="Visa Demo",
        saldo_inicial_centimos=0,
        fecha_apertura=hoy,
        archivada=False,
    )
    cta_ahorro = Cuenta(
        hogar_id=hogar_demo_id,
        nombre="Cuenta Ahorro Demo",
        tipo="banco",
        entidad="MyInvestor Demo",
        saldo_inicial_centimos=150000,  # 1.500,00 €
        fecha_apertura=hoy,
        archivada=False,
    )
    db.add_all([cta_principal, cta_tarjeta, cta_ahorro])
    db.flush()

    # 3. Botes (con los importes del dashboard: 400 € Mes, 230 € Ocio)
    bote_mes = Bote(
        hogar_id=str(hogar_demo_id),
        nombre="Dinero del Mes",
        tipo="recurrente",
        categoria="general",
        objetivo_centimos=40000,  # 400,00 €
        archivado=False,
    )
    bote_ocio = Bote(
        hogar_id=str(hogar_demo_id),
        nombre="Ocio & Caprichos",
        tipo="recurrente",
        categoria="ocio",
        objetivo_centimos=23000,  # 230,00 €
        archivado=False,
    )
    bote_viajes = Bote(
        hogar_id=str(hogar_demo_id),
        nombre="Vacaciones y Viajes",
        tipo="ahorro",
        categoria="viajes",
        objetivo_centimos=180000,  # 1.800,00 €
        archivado=False,
    )
    bote_emergencia = Bote(
        hogar_id=str(hogar_demo_id),
        nombre="Fondo de Emergencia",
        tipo="ahorro",
        categoria="emergencia",
        objetivo_centimos=300000,  # 3.000,00 €
        archivado=False,
    )
    db.add_all([bote_mes, bote_ocio, bote_viajes, bote_emergencia])
    db.flush()

    # 4. Dotaciones y movimientos representativos
    m1 = Movimiento(
        hogar_id=hogar_demo_id,
        cuenta_id=cta_principal.id,
        bote_id=bote_mes.id,
        categoria_id=cat_nomina.id,
        fecha=hoy,
        importe_centimos=40000,
        descripcion="Dotación mensual presupuestaria",
        origen="manual",
    )
    m2 = Movimiento(
        hogar_id=hogar_demo_id,
        cuenta_id=cta_principal.id,
        bote_id=bote_ocio.id,
        categoria_id=cat_nomina.id,
        fecha=hoy,
        importe_centimos=23000,
        descripcion="Dotación mensual ocio libre",
        origen="manual",
    )
    m3 = Movimiento(
        hogar_id=hogar_demo_id,
        cuenta_id=cta_tarjeta.id,
        bote_id=bote_mes.id,
        categoria_id=cat_super.id,
        fecha=hoy,
        importe_centimos=-2500,  # -25,00 €
        descripcion="Compra Mercadona alimentación",
        origen="manual",
    )
    m4 = Movimiento(
        hogar_id=hogar_demo_id,
        cuenta_id=cta_tarjeta.id,
        bote_id=bote_ocio.id,
        categoria_id=cat_ocio.id,
        fecha=hoy,
        importe_centimos=-1578,  # -15,78 €
        descripcion="Cine y palomitas fin de semana",
        origen="manual",
    )
    m5 = Movimiento(
        hogar_id=hogar_demo_id,
        cuenta_id=cta_ahorro.id,
        bote_id=bote_emergencia.id,
        fecha=hoy,
        importe_centimos=150000,  # 1.500,00 €
        descripcion="Saldo base del fondo de emergencia",
        origen="manual",
    )
    db.add_all([m1, m2, m3, m4, m5])

    # 5. Previsión de gastos recurrentes
    cfg_prev = PrevisionGastosConfig(
        hogar_id=str(hogar_demo_id),
        meses_pagados=11,
        anio=hoy.year,
    )
    g1 = GastoRecurrente(
        hogar_id=str(hogar_demo_id),
        concepto="Seguro Hogar",
        fecha_cobro="Abril",
        importe_anual_centimos=24000,
        cuota_mensual_centimos=2000,
        pagado_real_centimos=24000,
        orden=1,
        activo=True,
    )
    g2 = GastoRecurrente(
        hogar_id=str(hogar_demo_id),
        concepto="IBI Vivienda",
        fecha_cobro="Septiembre",
        importe_anual_centimos=45000,
        cuota_mensual_centimos=3750,
        pagado_real_centimos=45000,
        orden=2,
        activo=True,
    )
    g3 = GastoRecurrente(
        hogar_id=str(hogar_demo_id),
        concepto="Seguro Coche",
        fecha_cobro="Noviembre",
        importe_anual_centimos=36000,
        cuota_mensual_centimos=3000,
        pagado_real_centimos=0,
        orden=3,
        activo=True,
    )
    db.add_all([cfg_prev, g1, g2, g3])

    # 6. Deudas ficticias a favor del usuario demo
    d1 = Deuda(
        hogar_id=hogar_demo_id,
        deudor="Amigo Carlos",
        concepto="Cena de cumpleaños compartida",
        importe_inicial_centimos=4500,
        importe_cobrado_centimos=0,
        fecha=hoy,
        estado="pendiente",
        archivada=False,
    )
    d2 = Deuda(
        hogar_id=hogar_demo_id,
        deudor="Marta Compañera",
        concepto="Entradas concierto",
        importe_inicial_centimos=3500,
        importe_cobrado_centimos=0,
        fecha=hoy,
        estado="pendiente",
        archivada=False,
    )
    db.add_all([d1, d2])

    # 7. Préstamo ficticio para demo
    p1 = Prestamo(
        hogar_id=str(hogar_demo_id),
        nombre="Préstamo Reforma Cocina",
        entidad="OpenBank Demo",
        tipo="personal",
        importe_inicial_centimos=600000,
        importe_pendiente_centimos=420000,
        cuota_mensual_centimos=15000,
        fecha_inicio=hoy,
        activo=True,
    )
    db.add(p1)

    # 8. Inversión ficticia para demo
    i1 = Inversion(
        hogar_id=hogar_demo_id,
        nombre="Cartera Fondos Indexados",
        entidad="MyInvestor Demo",
        tipo_activo="fondos",
        capital_aportado_centimos=200000,
        valor_actual_centimos=218000,
        fecha_inicio=hoy,
        activo=True,
    )
    db.add(i1)

    db.commit()
