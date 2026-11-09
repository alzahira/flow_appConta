"""Router /api/v1/botes (T035, US3) — contrato en contracts/rest-api.md.

Serializer: `saldo`, `objetivo` y `total` como string de euros; `estado` =
`conseguido` | `en_curso` (regla 5 del data-model, con lógica de sentido para
objetivos negativos = presupuesto de gasto).
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.api.dependencias import obtener_hogar_activo
from app_conta.db import get_db
from app_conta.models.cuenta import Cuenta
from app_conta.models.movimiento import Movimiento
from app_conta.services.botes import (
    archivar_bote,
    crear_bote,
    editar_bote,
    estado_de_bote,
    listar_botes_activos,
    movimientos_asignados_activos,
    obtener_bote,
    saldo_bote,
)
from app_conta.services.cuentas import obtener_cuenta
from app_conta.services.dinero import euros_a_centimos, euros_str

router = APIRouter(prefix="/botes", tags=["botes"])


class BoteCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nombre: str
    tipo: Literal["recurrente", "ahorro", "proyecto", "ajeno"]
    categoria: str | None = None
    objetivo: str | int | float | None = None
    objetivo_fecha: str | None = None


class BotePatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nombre: str | None = None
    tipo: Literal["recurrente", "ahorro", "proyecto", "ajeno"] | None = None
    categoria: str | None = None
    objetivo: str | int | float | None = None
    objetivo_fecha: str | None = None
    # `saldo` (derivado) aceptado para ignorarse explícitamente (Principio II)
    saldo: str | None = None


def detectar_categoria_bote(nombre: str) -> str:
    n = nombre.lower()
    if any(k in n for k in ("viaje", "vacaciones", "rabat", "invierno", "navidad", "vuelo")):
        return "viajes"
    if any(k in n for k in ("mantenimiento", "casa", "piso", "arreglos", "reforma", "obra")):
        return "mantenimiento"
    if any(k in n for k in ("ropa", "calzado", "vestir", "zapatos", "moda")):
        return "ropa"
    if any(k in n for k in ("dentista", "salud", "diente", "médico", "medico", "farmacia")):
        return "dentista"
    if any(k in n for k in ("fianza", "fianzas", "garantia", "deposito")):
        return "fianzas"
    if any(k in n for k in ("inversion", "inversión", "fondo", "acciones", "patrimonio", "etoro")):
        return "inversion"
    if any(k in n for k in ("gasolina", "combustible", "diesel", "coche", "moto")):
        return "gasolina"
    if any(k in n for k in ("ocio", "cena", "fiesta", "salidas", "cerveza")):
        return "ocio"
    if any(k in n for k in ("paro", "reserva", "emergencia", "guardado")):
        return "reserva"
    if any(k in n for k in ("aitor", "javi", "marijose", "m.jose", "hijo", "familiar")):
        return "personal"
    if any(k in n for k in ("kitoli", "mes", "cash", "pagar")):
        return "gastos"
    return "otros"


def _serializar_bote(db: Session, bote) -> dict:
    saldo = saldo_bote(db, bote)
    return {
        "id": bote.id,
        "nombre": bote.nombre,
        "tipo": bote.tipo,
        "categoria": bote.categoria or detectar_categoria_bote(bote.nombre),
        "objetivo": euros_str(bote.objetivo_centimos)
        if bote.objetivo_centimos is not None
        else None,
        "objetivo_fecha": bote.objetivo_fecha.isoformat() if bote.objetivo_fecha else None,
        "saldo": euros_str(saldo),
        "estado": estado_de_bote(bote, saldo),
        "archivado": bool(bote.archivado),
    }


@router.post("", status_code=201)
def post_bote(
    payload: BoteCreate,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict:
    bote = crear_bote(
        db,
        nombre=payload.nombre,
        tipo=payload.tipo,
        hogar_id=hogar_id,
        categoria=payload.categoria,
        objetivo=payload.objetivo,
        objetivo_fecha=payload.objetivo_fecha,
    )
    db.commit()
    db.refresh(bote)
    return _serializar_bote(db, bote)


@router.get("")
def get_botes(
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict:
    pares, total = listar_botes_activos(db, hogar_id=hogar_id)
    return {
        "items": [_serializar_bote(db, b) for b, _s in pares],
        "total": euros_str(total),
    }


class TraspasoBotesCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bote_origen_id: int
    bote_destino_id: int
    importe: str | int | float
    fecha: str | None = None
    concepto: str | None = None
    cuenta_id: int | None = None


@router.post("/traspaso", status_code=200)
def post_traspaso_botes(
    payload: TraspasoBotesCreate,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict:
    if payload.bote_origen_id == payload.bote_destino_id:
        raise HTTPException(
            status_code=400,
            detail="El sobre de origen y de destino no pueden ser el mismo.",
        )

    origen = obtener_bote(db, payload.bote_origen_id, hogar_id)
    destino = obtener_bote(db, payload.bote_destino_id, hogar_id)

    try:
        importe_cent = euros_a_centimos(str(payload.importe))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Importe de traspaso no válido.") from exc

    if importe_cent <= 0:
        raise HTTPException(
            status_code=400, detail="El importe a mover entre botes debe ser mayor que 0."
        )

    if payload.cuenta_id is not None:
        cuenta = obtener_cuenta(db, payload.cuenta_id, hogar_id)
    else:
        # Cuenta bancaria activa para asentar la anotación de partida doble sin impacto neto
        cuenta = db.scalar(
            select(Cuenta)
            .where(Cuenta.hogar_id == hogar_id, Cuenta.archivada.is_(False), Cuenta.tipo == "banco")
            .order_by(Cuenta.id)
        )
        if not cuenta:
            cuenta = db.scalar(
                select(Cuenta)
                .where(Cuenta.hogar_id == hogar_id, Cuenta.archivada.is_(False))
                .order_by(Cuenta.id)
            )
        if not cuenta:
            raise HTTPException(
                status_code=400,
                detail="Se requiere al menos una cuenta activa en el sistema para asentar la anotación.",
            )

    fecha_traspaso = date.fromisoformat(payload.fecha) if payload.fecha else date.today()
    concepto_salida = payload.concepto or f"Traspaso a sobre {destino.nombre}"
    concepto_entrada = payload.concepto or f"Traspaso desde sobre {origen.nombre}"

    mov_salida = Movimiento(
        hogar_id=hogar_id,
        cuenta_id=cuenta.id,
        fecha=fecha_traspaso,
        descripcion=concepto_salida,
        importe_centimos=-importe_cent,
        bote_id=origen.id,
    )
    mov_entrada = Movimiento(
        hogar_id=hogar_id,
        cuenta_id=cuenta.id,
        fecha=fecha_traspaso,
        descripcion=concepto_entrada,
        importe_centimos=importe_cent,
        bote_id=destino.id,
    )

    db.add(mov_salida)
    db.add(mov_entrada)
    db.commit()

    return {
        "mensaje": f"Traspaso de {euros_str(importe_cent)} € realizado de {origen.nombre} a {destino.nombre}.",
        "importe": euros_str(importe_cent),
        "saldo_origen": euros_str(saldo_bote(db, origen)),
        "saldo_destino": euros_str(saldo_bote(db, destino)),
    }


@router.get("/{bote_id}")
def get_bote(
    bote_id: int,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict:
    bote = obtener_bote(db, bote_id, hogar_id)
    data = _serializar_bote(db, bote)
    data["movimientos_asignados"] = len(movimientos_asignados_activos(db, bote))
    return data


@router.patch("/{bote_id}")
def patch_bote(
    bote_id: int,
    payload: BotePatch,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict:
    dumps = payload.model_dump()
    dumps.pop("saldo", None)  # derivado: nunca editable
    # objetivo/objetivo_fecha sí pueden vaciarse de forma explícita (null → None)
    cambios = {
        k: v for k, v in dumps.items() if v is not None or k in ("objetivo", "objetivo_fecha")
    }
    bote = editar_bote(db, bote_id, cambios, hogar_id=hogar_id)
    db.commit()
    db.refresh(bote)
    return _serializar_bote(db, bote)


@router.delete("/{bote_id}", status_code=204)
def delete_bote(
    bote_id: int,
    confirmar: bool = Query(default=False),
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
):
    archivar_bote(db, bote_id, confirmar=confirmar, hogar_id=hogar_id)
    db.commit()
