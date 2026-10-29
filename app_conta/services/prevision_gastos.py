"""Servicio para la Previsión de Gastos Anuales y el Bote de Gastos Periódicos.

Permite planificar los gastos que se cobran anualmente o en cuotas (IBI, basuras,
seguros, agua, sellos de coche...), dividirlos en 12 meses para guardar una cantidad
fija cada mes ("Total a guardar al mes"), acumular la provisión según los meses
pagados/transcurridos y contrastarla con las facturas reales cobradas.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.gasto_recurrente import GastoRecurrente, PrevisionGastosConfig
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion

GASTOS_SEMILLA_DEFECTO = [
    {
        "concepto": "Basura Cañete",
        "fecha_cobro": "Marzo / Julio",
        "importe_anual_centimos": 14000,
        "cuota_mensual_centimos": 1167,
        "pagado_real_centimos": 7100,
        "notas": "2 plazos en Marzo y Julio",
        "orden": 1,
        "activo": True,
    },
    {
        "concepto": "Ibi Cañete  -  Pagado tarjeta Pass 28/4",
        "fecha_cobro": "Marzo",
        "importe_anual_centimos": 23500,
        "cuota_mensual_centimos": 1958,
        "pagado_real_centimos": 23500,
        "notas": "Pagado tarjeta Pass 28/4",
        "orden": 2,
        "activo": True,
    },
    {
        "concepto": "Ibi Estudio",
        "fecha_cobro": "Agosto",
        "importe_anual_centimos": 13600,
        "cuota_mensual_centimos": 1133,
        "pagado_real_centimos": 13300,
        "notas": None,
        "orden": 3,
        "activo": True,
    },
    {
        "concepto": "Seguro hogar Estudio - Allianz",
        "fecha_cobro": "Agosto",
        "importe_anual_centimos": 20200,
        "cuota_mensual_centimos": 1683,
        "pagado_real_centimos": 23000,
        "notas": "Allianz",
        "orden": 4,
        "activo": True,
    },
    {
        "concepto": "Seguro Vida Estudio y Córdoba - Klinc",
        "fecha_cobro": "Agosto",
        "importe_anual_centimos": 10500,
        "cuota_mensual_centimos": 875,
        "pagado_real_centimos": 11600,
        "notas": "Klinc",
        "orden": 5,
        "activo": True,
    },
    {
        "concepto": "Agua Piso",
        "fecha_cobro": "Marzo / Junio / Sept. / Diciembre",
        "importe_anual_centimos": 17000,
        "cuota_mensual_centimos": 1417,
        "pagado_real_centimos": 13600,
        "notas": "Cobro trimestral",
        "orden": 6,
        "activo": True,
    },
    {
        "concepto": "Basura Piso",
        "fecha_cobro": "Septiembre",
        "importe_anual_centimos": 14000,
        "cuota_mensual_centimos": 1167,
        "pagado_real_centimos": 7100,
        "notas": None,
        "orden": 7,
        "activo": True,
    },
    {
        "concepto": "Ibi Piso",
        "fecha_cobro": "Agosto",
        "importe_anual_centimos": 17250,
        "cuota_mensual_centimos": 1438,
        "pagado_real_centimos": 17250,
        "notas": None,
        "orden": 8,
        "activo": True,
    },
    {
        "concepto": "Seguro Vida Piso - Zurich",
        "fecha_cobro": "Enero   -  Cuota 210€",
        "importe_anual_centimos": 10500,
        "cuota_mensual_centimos": 875,
        "pagado_real_centimos": 21000,
        "notas": "Enero - Cuota 210€",
        "orden": 9,
        "activo": True,
    },
    {
        "concepto": "Seguro Hogar Piso - Tuio",
        "fecha_cobro": "Agosto",
        "importe_anual_centimos": 15700,
        "cuota_mensual_centimos": 1308,
        "pagado_real_centimos": 18900,
        "notas": "Tuio",
        "orden": 10,
        "activo": True,
    },
    {
        "concepto": "Seguro Decesos - Santa Licia",
        "fecha_cobro": "Junio",
        "importe_anual_centimos": 4400,
        "cuota_mensual_centimos": 367,
        "pagado_real_centimos": 4700,
        "notas": "Santa Lucía",
        "orden": 11,
        "activo": True,
    },
    {
        "concepto": "Ibi Córdoba",
        "fecha_cobro": "Agosto / Domiciliado  5 -08",
        "importe_anual_centimos": 15000,
        "cuota_mensual_centimos": 1250,
        "pagado_real_centimos": 14600,
        "notas": "Domiciliado 5-08",
        "orden": 12,
        "activo": True,
    },
    {
        "concepto": "Acción contra el Hambre",
        "fecha_cobro": "Junio / Diciembre",
        "importe_anual_centimos": 4000,
        "cuota_mensual_centimos": 333,
        "pagado_real_centimos": 2000,
        "notas": "Semestral",
        "orden": 13,
        "activo": True,
    },
    {
        "concepto": "Seguro Bayon",
        "fecha_cobro": "Enero - Direct Seguros",
        "importe_anual_centimos": 27400,
        "cuota_mensual_centimos": None,
        "pagado_real_centimos": 0,
        "notas": "Inactivo / Sin cuota mensual",
        "orden": 14,
        "activo": False,
    },
    {
        "concepto": "Seguro Coche -Direct Seguros",
        "fecha_cobro": "Noviembre",
        "importe_anual_centimos": 26800,
        "cuota_mensual_centimos": 2233,
        "pagado_real_centimos": 0,
        "notas": "Direct Seguros Noviembre",
        "orden": 15,
        "activo": True,
    },
    {
        "concepto": "Sello Coche",
        "fecha_cobro": "Septiembre",
        "importe_anual_centimos": 5400,
        "cuota_mensual_centimos": 450,
        "pagado_real_centimos": 5400,
        "notas": None,
        "orden": 16,
        "activo": True,
    },
]


def obtener_o_crear_config(session: Session, hogar_id: str) -> PrevisionGastosConfig:
    config = session.scalar(
        select(PrevisionGastosConfig).where(PrevisionGastosConfig.hogar_id == str(hogar_id))
    )
    if not config:
        config = PrevisionGastosConfig(
            hogar_id=str(hogar_id),
            meses_pagados=11,
            anio=2026,
        )
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


def semillar_gastos_si_vacio(session: Session, hogar_id: str) -> None:
    existentes = session.scalar(
        select(GastoRecurrente).where(GastoRecurrente.hogar_id == str(hogar_id))
    )
    if existentes:
        return
    for item in GASTOS_SEMILLA_DEFECTO:
        g = GastoRecurrente(
            hogar_id=str(hogar_id),
            concepto=item["concepto"],
            fecha_cobro=item["fecha_cobro"],
            importe_anual_centimos=item["importe_anual_centimos"],
            cuota_mensual_centimos=item["cuota_mensual_centimos"],
            pagado_real_centimos=item["pagado_real_centimos"],
            notas=item.get("notas"),
            orden=item.get("orden", 0),
            activo=item.get("activo", True),
        )
        session.add(g)
    session.commit()


def obtener_resumen_prevision(session: Session, hogar_id: str) -> dict[str, Any]:
    config = obtener_o_crear_config(session, hogar_id)
    semillar_gastos_si_vacio(session, hogar_id)

    stmt = (
        select(GastoRecurrente)
        .where(GastoRecurrente.hogar_id == str(hogar_id))
        .order_by(GastoRecurrente.orden, GastoRecurrente.id)
    )
    gastos = list(session.scalars(stmt))

    items = []
    total_anual_centimos = 0
    total_mensual_centimos = 0
    total_provision_centimos = 0
    total_pagado_centimos = 0
    total_saldo_centimos = 0

    meses = config.meses_pagados

    for g in gastos:
        # Cálculo de cuota mensual
        if g.activo:
            cuota_m = (
                g.cuota_mensual_centimos
                if g.cuota_mensual_centimos is not None
                else round(g.importe_anual_centimos / 12)
            )
            # Provisión acumulada hasta el mes actual
            provision_acumulada = round((g.importe_anual_centimos * meses) / 12)
            saldo = provision_acumulada - g.pagado_real_centimos

            total_anual_centimos += g.importe_anual_centimos
            total_mensual_centimos += cuota_m
            total_provision_centimos += provision_acumulada
            total_pagado_centimos += g.pagado_real_centimos
            total_saldo_centimos += saldo
        else:
            cuota_m = g.cuota_mensual_centimos or 0
            provision_acumulada = 0
            saldo = 0 - g.pagado_real_centimos

        # Estado del item
        if not g.activo:
            estado = "inactivo"
        elif saldo > 0:
            estado = "superavit"
        elif saldo < 0:
            estado = "deficit"
        else:
            estado = "equilibrado"

        items.append(
            {
                "id": g.id,
                "concepto": g.concepto,
                "fecha_cobro": g.fecha_cobro,
                "importe_anual_centimos": g.importe_anual_centimos,
                "cuota_mensual_centimos": cuota_m,
                "pagado_real_centimos": g.pagado_real_centimos,
                "provision_acumulada_centimos": provision_acumulada,
                "saldo_centimos": saldo,
                "estado": estado,
                "notas": g.notas,
                "orden": g.orden,
                "activo": g.activo,
            }
        )

    return {
        "anio": config.anio,
        "meses_pagados": config.meses_pagados,
        "total_anual_centimos": total_anual_centimos,
        "total_mensual_centimos": total_mensual_centimos,
        "total_provision_centimos": total_provision_centimos,
        "total_pagado_centimos": total_pagado_centimos,
        "total_saldo_centimos": total_saldo_centimos,
        "gastos": items,
    }


def actualizar_config_prevision(
    session: Session, hogar_id: str, meses_pagados: int | None = None, anio: int | None = None
) -> PrevisionGastosConfig:
    config = obtener_o_crear_config(session, hogar_id)
    if meses_pagados is not None:
        if meses_pagados < 0 or meses_pagados > 12:
            raise ErrorValidacion("Los meses pagados deben estar entre 0 y 12")
        config.meses_pagados = meses_pagados
    if anio is not None:
        if anio < 2000 or anio > 2100:
            raise ErrorValidacion("El año debe ser un año válido")
        config.anio = anio
    session.commit()
    session.refresh(config)
    return config


def crear_gasto_recurrente(
    session: Session, hogar_id: str, datos: dict[str, Any]
) -> GastoRecurrente:
    concepto = (datos.get("concepto") or "").strip()
    if not concepto:
        raise ErrorValidacion("El concepto es obligatorio")
    fecha_cobro = (datos.get("fecha_cobro") or "").strip()
    if not fecha_cobro:
        raise ErrorValidacion("La fecha o meses de cobro es obligatoria")
    importe_anual = datos.get("importe_anual_centimos")
    if importe_anual is None or importe_anual <= 0:
        raise ErrorValidacion("El importe anual debe ser mayor que 0")

    cuota_mensual = datos.get("cuota_mensual_centimos")
    if cuota_mensual is not None and cuota_mensual < 0:
        raise ErrorValidacion("La cuota mensual no puede ser negativa")

    pagado_real = datos.get("pagado_real_centimos", 0)
    if pagado_real < 0:
        raise ErrorValidacion("El importe pagado real no puede ser negativo")

    gasto = GastoRecurrente(
        hogar_id=str(hogar_id),
        concepto=concepto,
        fecha_cobro=fecha_cobro,
        importe_anual_centimos=importe_anual,
        cuota_mensual_centimos=cuota_mensual,
        pagado_real_centimos=pagado_real,
        notas=datos.get("notas"),
        orden=datos.get("orden", 0),
        activo=datos.get("activo", True),
    )
    session.add(gasto)
    session.commit()
    session.refresh(gasto)
    return gasto


def actualizar_gasto_recurrente(
    session: Session, gasto_id: int, datos: dict[str, Any]
) -> GastoRecurrente:
    gasto = session.get(GastoRecurrente, gasto_id)
    if not gasto:
        raise ErrorNoEncontrado("Gasto recurrente no encontrado")

    if "concepto" in datos:
        concepto = (datos["concepto"] or "").strip()
        if not concepto:
            raise ErrorValidacion("El concepto no puede quedar vacío")
        gasto.concepto = concepto

    if "fecha_cobro" in datos:
        fecha_cobro = (datos["fecha_cobro"] or "").strip()
        if not fecha_cobro:
            raise ErrorValidacion("La fecha de cobro no puede quedar vacía")
        gasto.fecha_cobro = fecha_cobro

    if "importe_anual_centimos" in datos:
        imp = datos["importe_anual_centimos"]
        if imp is None or imp <= 0:
            raise ErrorValidacion("El importe anual debe ser mayor que 0")
        gasto.importe_anual_centimos = imp

    if "cuota_mensual_centimos" in datos:
        gasto.cuota_mensual_centimos = datos["cuota_mensual_centimos"]

    if "pagado_real_centimos" in datos:
        pagado = datos["pagado_real_centimos"]
        if pagado is not None and pagado < 0:
            raise ErrorValidacion("El importe pagado no puede ser negativo")
        gasto.pagado_real_centimos = pagado if pagado is not None else 0

    if "notas" in datos:
        gasto.notas = datos["notas"]

    if "activo" in datos:
        gasto.activo = bool(datos["activo"])

    if "orden" in datos:
        gasto.orden = int(datos["orden"])

    session.commit()
    session.refresh(gasto)
    return gasto


def registrar_pago_factura(
    session: Session, gasto_id: int, importe_centimos: int, sumar: bool = True
) -> GastoRecurrente:
    if importe_centimos < 0:
        raise ErrorValidacion("El importe pagado no puede ser negativo")
    gasto = session.get(GastoRecurrente, gasto_id)
    if not gasto:
        raise ErrorNoEncontrado("Gasto recurrente no encontrado")

    if sumar:
        gasto.pagado_real_centimos += importe_centimos
    else:
        gasto.pagado_real_centimos = importe_centimos

    session.commit()
    session.refresh(gasto)
    return gasto


def eliminar_gasto_recurrente(session: Session, gasto_id: int) -> None:
    gasto = session.get(GastoRecurrente, gasto_id)
    if not gasto:
        raise ErrorNoEncontrado("Gasto recurrente no encontrado")
    session.delete(gasto)
    session.commit()


def restablecer_semilla(session: Session, hogar_id: str) -> None:
    # Eliminar existentes para este hogar
    gastos = list(
        session.scalars(select(GastoRecurrente).where(GastoRecurrente.hogar_id == str(hogar_id)))
    )
    for g in gastos:
        session.delete(g)
    session.commit()
    semillar_gastos_si_vacio(session, hogar_id)
