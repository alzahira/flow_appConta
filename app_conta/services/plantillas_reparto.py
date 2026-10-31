"""Servicio para plantillas de nómina y repartos mensuales automáticos."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.bote import Bote
from app_conta.models.cuenta import Cuenta
from app_conta.models.movimiento import Movimiento
from app_conta.models.plantilla_reparto import PlantillaReparto, PlantillaRepartoLinea
from app_conta.services.dinero import centimos_a_euros, euros_a_centimos
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.movimientos import crear_movimiento


def _serializar_linea(linea: PlantillaRepartoLinea) -> dict[str, Any]:
    return {
        "id": linea.id,
        "bote_id": linea.bote_id,
        "bote_nombre": linea.bote.nombre if linea.bote else None,
        "bote_categoria": linea.bote.categoria if linea.bote else None,
        "cuenta_id": linea.cuenta_id,
        "cuenta_nombre": linea.cuenta.nombre if linea.cuenta else None,
        "cuenta_entidad": linea.cuenta.entidad if linea.cuenta else None,
        "concepto": linea.concepto,
        "importe": f"{centimos_a_euros(linea.importe_centimos):.2f}",
        "orden": linea.orden,
    }


def serializar_plantilla(plantilla: PlantillaReparto) -> dict[str, Any]:
    return {
        "id": plantilla.id,
        "nombre": plantilla.nombre,
        "cuenta_id": plantilla.cuenta_id,
        "cuenta_nombre": plantilla.cuenta.nombre if plantilla.cuenta else None,
        "cuenta_entidad": plantilla.cuenta.entidad if plantilla.cuenta else None,
        "importe_estimado": f"{centimos_a_euros(plantilla.importe_estimado_centimos):.2f}",
        "dia_mes": plantilla.dia_mes,
        "activo": plantilla.activo,
        "lineas": [_serializar_linea(linea) for linea in plantilla.lineas],
    }


def sembrar_plantillas_defecto(db: Session, hogar_id: int) -> list[PlantillaReparto]:
    """Siembra la plantilla mensual del hogar con desglose multi-banco y sobres."""
    stmt_cuentas = select(Cuenta).where(Cuenta.hogar_id == hogar_id)
    cuentas = list(db.scalars(stmt_cuentas).all())
    if not cuentas:
        return []

    cuentas_banco = [c for c in cuentas if c.tipo == "banco"]
    if not cuentas_banco:
        cuentas_banco = cuentas

    cta_caixa = next(
        (
            c
            for c in cuentas_banco
            if any(
                k in (c.nombre + " " + (c.entidad or "")).lower()
                for k in ["la caixa", "caixa", "caixabank"]
            )
        ),
        None,
    )
    cta_db = next(
        (
            c
            for c in cuentas_banco
            if any(
                k in (c.nombre + " " + (c.entidad or "")).lower()
                for k in ["deutsche", "deustche", " db"]
            )
        ),
        None,
    )

    if not cta_caixa and not cta_db:
        return []

    if not cta_db:
        cta_db = cta_caixa
    if not cta_caixa:
        cta_caixa = cta_db

    def obtener_o_crear_bote(nombre: str, tipo: str, categoria: str | None = None) -> Bote:
        stmt_b = select(Bote).where(Bote.hogar_id == hogar_id)
        todos_b = list(db.scalars(stmt_b).all())
        for b in todos_b:
            if nombre.lower() in b.nombre.lower() or b.nombre.lower() in nombre.lower():
                return b
        nuevo = Bote(
            hogar_id=hogar_id,
            nombre=nombre,
            tipo=tipo,
            categoria=categoria,
            archivado=False,
        )
        db.add(nuevo)
        db.flush()
        return nuevo

    bote_hipoteca = obtener_o_crear_bote("Amortización Hipoteca", "ahorro")
    bote_dazn = obtener_o_crear_bote("Bote DAZN", "recurrente", "suscripciones")
    bote_seguros = obtener_o_crear_bote("Provisión Seguros e IBI", "recurrente", "impuestos")
    bote_ahorro = obtener_o_crear_bote("Bote Ahorro Mes", "ahorro", "ahorro")
    bote_arreglos = obtener_o_crear_bote("Bote Arreglos Pisos", "proyecto")
    bote_ocio = obtener_o_crear_bote("Bote ocio", "ahorro")
    bote_mes = obtener_o_crear_bote("Cash para el mes en curso", "ahorro")

    lineas_datos = [
        {
            "bote_id": None,
            "cuenta_id": cta_caixa.id,
            "concepto": "Recibos y gastos Caixa",
            "importe": "526.00",
        },
        {
            "bote_id": None,
            "cuenta_id": cta_db.id,
            "concepto": "Recibos y gastos Deutsche Bank",
            "importe": "548.00",
        },
        {
            "bote_id": bote_dazn.id,
            "cuenta_id": cta_db.id,
            "concepto": "Cuota DAZN",
            "importe": "10.00",
        },
        {
            "bote_id": bote_seguros.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Provisión Seguros e IBI",
            "importe": "176.00",
        },
        {
            "bote_id": bote_mes.id,
            "cuenta_id": cta_db.id,
            "concepto": "Dinero del mes",
            "importe": "400.00",
        },
        {
            "bote_id": bote_ocio.id,
            "cuenta_id": cta_db.id,
            "concepto": "Bote ocio",
            "importe": "100.00",
        },
        {
            "bote_id": bote_hipoteca.id,
            "cuenta_id": cta_db.id,
            "concepto": "Cuota Hipotecas",
            "importe": "927.00",
        },
        {
            "bote_id": bote_ahorro.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Bote ahorro mes",
            "importe": "110.00",
        },
        {
            "bote_id": bote_arreglos.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Arreglos de pisos",
            "importe": "50.00",
        },
    ]

    plantilla = crear_plantilla(
        db,
        hogar_id,
        {
            "nombre": "Reparto Mensual Hogar",
            "cuenta_id": cta_db.id,
            "importe_estimado": "2847.00",
            "dia_mes": 28,
            "activo": True,
            "lineas": lineas_datos,
        },
    )
    return [plantilla]


def listar_plantillas(db: Session, hogar_id: int) -> list[dict[str, Any]]:
    stmt = (
        select(PlantillaReparto)
        .where(PlantillaReparto.hogar_id == hogar_id)
        .order_by(PlantillaReparto.id)
    )
    plantillas = list(db.scalars(stmt).all())
    if not plantillas:
        plantillas = sembrar_plantillas_defecto(db, hogar_id)
    return [serializar_plantilla(p) for p in plantillas]


def obtener_plantilla(db: Session, plantilla_id: int) -> PlantillaReparto:
    plantilla = db.get(PlantillaReparto, plantilla_id)
    if plantilla is None:
        raise ErrorNoEncontrado(f"Plantilla {plantilla_id} no encontrada")
    return plantilla


def crear_plantilla(db: Session, hogar_id: int, datos: dict[str, Any]) -> PlantillaReparto:
    nombre = str(datos.get("nombre") or "").strip()
    if not nombre:
        raise ErrorValidacion("El nombre de la plantilla es obligatorio")

    cuenta_id = datos.get("cuenta_id")
    if not cuenta_id or db.get(Cuenta, int(cuenta_id)) is None:
        raise ErrorValidacion("Debe indicar una cuenta bancaria válida")

    importe_estimado = datos.get("importe_estimado", "0.00")
    centimos_estimados = euros_a_centimos(importe_estimado)

    dia_mes = datos.get("dia_mes")
    if dia_mes is not None:
        dia_mes = int(dia_mes)
        if not 1 <= dia_mes <= 31:
            raise ErrorValidacion("El día del mes debe estar entre 1 y 31")

    plantilla = PlantillaReparto(
        hogar_id=hogar_id,
        nombre=nombre,
        cuenta_id=int(cuenta_id),
        importe_estimado_centimos=centimos_estimados,
        dia_mes=dia_mes,
        activo=bool(datos.get("activo", True)),
    )
    db.add(plantilla)
    db.flush()

    lineas_datos = datos.get("lineas") or []
    for idx, ld in enumerate(lineas_datos):
        concepto = str(ld.get("concepto") or "").strip()
        if not concepto:
            concepto = f"Línea {idx + 1}"
        importe = ld.get("importe", "0.00")
        centimos_linea = euros_a_centimos(importe)
        bote_id = ld.get("bote_id")
        if bote_id:
            bote_id = int(bote_id)
            if db.get(Bote, bote_id) is None:
                bote_id = None

        cuenta_linea_id = ld.get("cuenta_id")
        if cuenta_linea_id:
            cuenta_linea_id = int(cuenta_linea_id)
            if db.get(Cuenta, cuenta_linea_id) is None:
                cuenta_linea_id = None
        else:
            cuenta_linea_id = None

        linea = PlantillaRepartoLinea(
            plantilla_id=plantilla.id,
            bote_id=bote_id,
            cuenta_id=cuenta_linea_id,
            concepto=concepto,
            importe_centimos=centimos_linea,
            orden=idx,
        )
        db.add(linea)

    db.commit()
    db.refresh(plantilla)
    return plantilla


def actualizar_plantilla(db: Session, plantilla_id: int, datos: dict[str, Any]) -> PlantillaReparto:
    plantilla = obtener_plantilla(db, plantilla_id)

    if "nombre" in datos:
        nombre = str(datos["nombre"]).strip()
        if not nombre:
            raise ErrorValidacion("El nombre de la plantilla es obligatorio")
        plantilla.nombre = nombre

    if "cuenta_id" in datos:
        cuenta_id = int(datos["cuenta_id"])
        if db.get(Cuenta, cuenta_id) is None:
            raise ErrorValidacion("Cuenta bancaria no encontrada")
        plantilla.cuenta_id = cuenta_id

    if "importe_estimado" in datos:
        plantilla.importe_estimado_centimos = euros_a_centimos(datos["importe_estimado"])

    if "dia_mes" in datos:
        dia = datos["dia_mes"]
        if dia is not None:
            dia = int(dia)
            if not 1 <= dia <= 31:
                raise ErrorValidacion("El día del mes debe estar entre 1 y 31")
        plantilla.dia_mes = dia

    if "activo" in datos:
        plantilla.activo = bool(datos["activo"])

    if "lineas" in datos:
        # Reemplazar líneas
        plantilla.lineas.clear()
        db.flush()
        lineas_datos = datos["lineas"] or []
        for idx, ld in enumerate(lineas_datos):
            concepto = str(ld.get("concepto") or "").strip()
            if not concepto:
                concepto = f"Línea {idx + 1}"
            centimos_linea = euros_a_centimos(ld.get("importe", "0.00"))
            bote_id = ld.get("bote_id")
            if bote_id:
                bote_id = int(bote_id)
                if db.get(Bote, bote_id) is None:
                    bote_id = None

            cuenta_linea_id = ld.get("cuenta_id")
            if cuenta_linea_id:
                cuenta_linea_id = int(cuenta_linea_id)
                if db.get(Cuenta, cuenta_linea_id) is None:
                    cuenta_linea_id = None
            else:
                cuenta_linea_id = None

            linea = PlantillaRepartoLinea(
                plantilla_id=plantilla.id,
                bote_id=bote_id,
                cuenta_id=cuenta_linea_id,
                concepto=concepto,
                importe_centimos=centimos_linea,
                orden=idx,
            )
            db.add(linea)

    db.commit()
    db.refresh(plantilla)
    return plantilla


def eliminar_plantilla(db: Session, plantilla_id: int) -> None:
    plantilla = obtener_plantilla(db, plantilla_id)
    db.delete(plantilla)
    db.commit()


def ejecutar_reparto(
    db: Session,
    plantilla_id: int,
    *,
    fecha: str | date,
    cuenta_id: int | None = None,
    lineas: list[dict[str, Any]] | None = None,
    descripcion_general: str | None = None,
) -> dict[str, Any]:
    """Ejecuta el reparto generando los movimientos de ingreso correspondientes."""
    plantilla = obtener_plantilla(db, plantilla_id)
    target_cuenta_id = cuenta_id if cuenta_id is not None else plantilla.cuenta_id

    cuenta = db.get(Cuenta, target_cuenta_id)
    if cuenta is None:
        raise ErrorNoEncontrado(f"Cuenta {target_cuenta_id} no encontrada")

    prefijo = str(descripcion_general or plantilla.nombre).strip()
    movimientos_creados: list[Movimiento] = []
    total_centimos = 0

    # Si se pasan líneas personalizadas en la llamada, usamos esas; si no, las de la plantilla
    lineas_a_ejecutar = (
        lineas
        if lineas is not None
        else [
            {
                "bote_id": item.bote_id,
                "cuenta_id": item.cuenta_id,
                "concepto": item.concepto,
                "importe": centimos_a_euros(item.importe_centimos),
            }
            for item in plantilla.lineas
        ]
    )

    for ld in lineas_a_ejecutar:
        importe_str = str(ld.get("importe", "0.00")).replace(",", ".").strip()
        centimos = euros_a_centimos(importe_str)
        if centimos <= 0:
            continue

        concepto = str(ld.get("concepto") or "").strip()
        bote_id = ld.get("bote_id")
        if bote_id:
            bote_id = int(bote_id)

        # Destino de cuenta bancaria: si la línea especifica un banco concreto,
        # se ingresa ahí; si no, al principal
        linea_cuenta_id = ld.get("cuenta_id")
        destino_cuenta_id = target_cuenta_id
        if linea_cuenta_id:
            cta_test = db.get(Cuenta, int(linea_cuenta_id))
            if cta_test is not None:
                destino_cuenta_id = cta_test.id

        desc = f"{prefijo}: {concepto}" if concepto else prefijo

        mov = crear_movimiento(
            db,
            fecha=fecha,
            importe=centimos_a_euros(centimos),
            descripcion=desc,
            cuenta_id=destino_cuenta_id,
            bote_id=bote_id,
        )
        movimientos_creados.append(mov)
        total_centimos += centimos

    db.commit()

    return {
        "ok": True,
        "plantilla_id": plantilla.id,
        "plantilla_nombre": plantilla.nombre,
        "cuenta_id": target_cuenta_id,
        "cuenta_nombre": cuenta.nombre,
        "total_ingresado": f"{centimos_a_euros(total_centimos):.2f}",
        "movimientos_count": len(movimientos_creados),
        "movimiento_ids": [m.id for m in movimientos_creados],
    }
