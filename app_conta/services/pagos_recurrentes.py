"""Servicio para pagos periódicos y domiciliaciones recurrentes."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.cuenta import Cuenta
from app_conta.models.movimiento import Movimiento
from app_conta.models.pago_recurrente import PagoRecurrente
from app_conta.services.dinero import centimos_a_euros, euros_a_centimos, euros_str
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.movimientos import crear_movimiento

PAGOS_SEMILLA_DEFECTO = [
    # LA CAIXA (Total 526,00 €)
    {"banco_clave": "caixa", "concepto": "Hipoteca Estudio", "importe": "140.00", "orden": 1},
    {"banco_clave": "caixa", "concepto": "Hipoteca Córdoba", "importe": "153.00", "orden": 2},
    {"banco_clave": "caixa", "concepto": "Seguro Hogar Córdoba", "importe": "28.00", "orden": 3},
    {"banco_clave": "caixa", "concepto": "Cruz Roja", "importe": "3.00", "orden": 4},
    {"banco_clave": "caixa", "concepto": "Comunidad Los Verdiales", "importe": "55.00", "orden": 5},
    {"banco_clave": "caixa", "concepto": "Comunidad Córdoba", "importe": "20.00", "orden": 6},
    {"banco_clave": "caixa", "concepto": "Luz piso", "importe": "65.00", "orden": 7},
    {"banco_clave": "caixa", "concepto": "Finetwork", "importe": "19.00", "orden": 8},
    {"banco_clave": "caixa", "concepto": "Vodafone", "importe": "43.00", "orden": 9},
    # DEUTSCHE BANK (Total 548,00 €)
    {"banco_clave": "deutsche", "concepto": "Hipoteca Piso", "importe": "483.00", "orden": 10},
    {"banco_clave": "deutsche", "concepto": "Seguro Hogar Cañete", "importe": "13.00", "orden": 11},
    {"banco_clave": "deutsche", "concepto": "Comunidad Piso", "importe": "52.00", "orden": 12},
]


def _serializar_pago(p: PagoRecurrente) -> dict[str, Any]:
    return {
        "id": p.id,
        "cuenta_id": p.cuenta_id,
        "cuenta_nombre": p.cuenta.nombre if p.cuenta else None,
        "cuenta_entidad": p.cuenta.entidad if p.cuenta else None,
        "concepto": p.concepto,
        "importe": euros_str(p.importe_centimos),
        "importe_centimos": p.importe_centimos,
        "categoria_id": p.categoria_id,
        "categoria_nombre": p.categoria.nombre if p.categoria else None,
        "dia_mes": p.dia_mes,
        "notas": p.notas,
        "orden": p.orden,
        "activo": p.activo,
        "ultimo_pago": p.ultimo_pago.isoformat() if p.ultimo_pago else None,
    }


def sembrar_pagos_defecto(db: Session, hogar_id: int) -> list[PagoRecurrente]:
    """Siembra los recibos recurrentes por defecto si no existen."""
    existentes = db.scalars(
        select(PagoRecurrente).where(PagoRecurrente.hogar_id == hogar_id)
    ).all()
    if existentes:
        return list(existentes)

    cuentas = db.scalars(select(Cuenta).where(Cuenta.hogar_id == hogar_id)).all()
    cuentas_banco = [c for c in cuentas if getattr(c, "tipo", None) == "banco"]
    if not cuentas_banco:
        cuentas_banco = cuentas

    cta_caixa = next(
        (c for c in cuentas_banco if "caixa" in (c.nombre + " " + (c.entidad or "")).lower()), None
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

    creados: list[PagoRecurrente] = []
    for item in PAGOS_SEMILLA_DEFECTO:
        cta = cta_caixa if item["banco_clave"] == "caixa" else cta_db
        if not cta:
            cta = cuentas[0] if cuentas else None
        if not cta:
            continue

        pago = PagoRecurrente(
            hogar_id=hogar_id,
            cuenta_id=cta.id,
            concepto=item["concepto"],
            importe_centimos=euros_a_centimos(item["importe"]),
            orden=item["orden"],
            activo=True,
        )
        db.add(pago)
        creados.append(pago)

    if creados:
        db.commit()
        for p in creados:
            db.refresh(p)
    return creados


def listar_pagos_recurrentes(db: Session, hogar_id: int) -> dict[str, Any]:
    """Devuelve los pagos recurrentes agrupados por entidad bancaria."""
    stmt = (
        select(PagoRecurrente)
        .where(PagoRecurrente.hogar_id == hogar_id)
        .order_by(PagoRecurrente.orden, PagoRecurrente.id)
    )
    pagos = db.scalars(stmt).all()

    # Si no hay ninguno, sembramos automáticamente los de Caixa y Deutsche Bank
    if not pagos:
        pagos = sembrar_pagos_defecto(db, hogar_id)

    items_serializados = [_serializar_pago(p) for p in pagos]

    # Agrupar por cuenta_id
    grupos_por_cuenta: dict[int, dict[str, Any]] = {}
    total_general_centimos = 0

    for item in items_serializados:
        c_id = item["cuenta_id"]
        if c_id not in grupos_por_cuenta:
            grupos_por_cuenta[c_id] = {
                "cuenta_id": c_id,
                "cuenta_nombre": item["cuenta_nombre"],
                "cuenta_entidad": item["cuenta_entidad"],
                "items": [],
                "total_centimos": 0,
                "total": "0.00",
            }
        grupos_por_cuenta[c_id]["items"].append(item)
        if item["activo"]:
            grupos_por_cuenta[c_id]["total_centimos"] += item["importe_centimos"]
            total_general_centimos += item["importe_centimos"]

    # Calcular totales formateados
    for g in grupos_por_cuenta.values():
        g["total"] = euros_str(g["total_centimos"])

    return {
        "items": items_serializados,
        "por_cuenta": list(grupos_por_cuenta.values()),
        "total_general": euros_str(total_general_centimos),
        "total_general_centimos": total_general_centimos,
    }


def obtener_pago_recurrente(db: Session, pago_id: int) -> PagoRecurrente:
    pago = db.get(PagoRecurrente, pago_id)
    if pago is None:
        raise ErrorNoEncontrado(f"Pago recurrente {pago_id} no encontrado")
    return pago


def crear_pago_recurrente(db: Session, hogar_id: int, datos: dict[str, Any]) -> PagoRecurrente:
    concepto = str(datos.get("concepto") or "").strip()
    if not concepto:
        raise ErrorValidacion("El concepto del pago recurrente es obligatorio")

    cuenta_id = int(datos["cuenta_id"])
    if db.get(Cuenta, cuenta_id) is None:
        raise ErrorValidacion("Cuenta bancaria no encontrada")

    importe_str = str(datos.get("importe", "0.00")).replace(",", ".").strip()
    importe_centimos = euros_a_centimos(importe_str)
    if importe_centimos <= 0:
        raise ErrorValidacion("El importe debe ser mayor a 0")

    pago = PagoRecurrente(
        hogar_id=hogar_id,
        cuenta_id=cuenta_id,
        concepto=concepto,
        importe_centimos=importe_centimos,
        categoria_id=int(datos["categoria_id"]) if datos.get("categoria_id") else None,
        dia_mes=int(datos["dia_mes"]) if datos.get("dia_mes") else None,
        notas=str(datos["notas"]).strip() if datos.get("notas") else None,
        orden=int(datos.get("orden", 0)),
        activo=bool(datos.get("activo", True)),
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)
    return pago


def actualizar_pago_recurrente(
    db: Session, pago_id: int, datos: dict[str, Any]
) -> PagoRecurrente:
    pago = obtener_pago_recurrente(db, pago_id)

    if "concepto" in datos:
        concepto = str(datos["concepto"]).strip()
        if not concepto:
            raise ErrorValidacion("El concepto no puede estar vacío")
        pago.concepto = concepto

    if "cuenta_id" in datos:
        cuenta_id = int(datos["cuenta_id"])
        if db.get(Cuenta, cuenta_id) is None:
            raise ErrorValidacion("Cuenta bancaria no encontrada")
        pago.cuenta_id = cuenta_id

    if "importe" in datos:
        importe_str = str(datos["importe"]).replace(",", ".").strip()
        pago.importe_centimos = euros_a_centimos(importe_str)

    if "categoria_id" in datos:
        cat_id = datos["categoria_id"]
        pago.categoria_id = int(cat_id) if cat_id else None

    if "dia_mes" in datos:
        dia = datos["dia_mes"]
        pago.dia_mes = int(dia) if dia else None

    if "notas" in datos:
        pago.notas = str(datos["notas"]).strip() if datos["notas"] else None

    if "activo" in datos:
        pago.activo = bool(datos["activo"])

    if "orden" in datos:
        pago.orden = int(datos["orden"])

    db.commit()
    db.refresh(pago)
    return pago


def eliminar_pago_recurrente(db: Session, pago_id: int) -> None:
    pago = obtener_pago_recurrente(db, pago_id)
    db.delete(pago)
    db.commit()


def ejecutar_pagos_recurrentes(
    db: Session,
    hogar_id: int,
    *,
    fecha: str | date,
    cuenta_id: int | None = None,
    pagos_seleccionados: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Aplica los recibos mensuales recurrentes generando movimientos de gasto negativos."""
    stmt = select(PagoRecurrente).where(
        PagoRecurrente.hogar_id == hogar_id, PagoRecurrente.activo.is_(True)
    )
    if cuenta_id is not None:
        stmt = stmt.where(PagoRecurrente.cuenta_id == cuenta_id)

    todos_activos = {p.id: p for p in db.scalars(stmt).all()}

    # Si se pasan pagos personalizados con importes modificados, los usamos
    items_a_ejecutar: list[tuple[PagoRecurrente, int]] = []
    if pagos_seleccionados is not None:
        for ps in pagos_seleccionados:
            p_id = int(ps["id"])
            if p_id in todos_activos:
                pago_obj = todos_activos[p_id]
                imp_str = str(ps.get("importe", "")).replace(",", ".").strip()
                centimos = euros_a_centimos(imp_str) if imp_str else pago_obj.importe_centimos
                items_a_ejecutar.append((pago_obj, centimos))
    else:
        items_a_ejecutar = [(p, p.importe_centimos) for p in todos_activos.values()]

    fecha_obj = date.fromisoformat(str(fecha)) if isinstance(fecha, str) else fecha
    movimientos_creados: list[Movimiento] = []
    total_gastado_centimos = 0

    for pago_obj, centimos in items_a_ejecutar:
        if centimos <= 0:
            continue

        importe_gasto = f"-{centimos_a_euros(centimos):.2f}"
        mov = crear_movimiento(
            db,
            fecha=fecha_obj,
            importe=importe_gasto,
            descripcion=pago_obj.concepto,
            cuenta_id=pago_obj.cuenta_id,
            categoria_id=pago_obj.categoria_id,
            bote_id=None,
            origen="manual",
        )
        pago_obj.ultimo_pago = fecha_obj
        movimientos_creados.append(mov)
        total_gastado_centimos += centimos

    db.commit()

    return {
        "ok": True,
        "movimientos_creados": len(movimientos_creados),
        "total_gastado": euros_str(total_gastado_centimos),
        "total_gastado_centimos": total_gastado_centimos,
    }
