"""Router /api/v1/botes (T035, US3) — contrato en contracts/rest-api.md.

Serializer: `saldo`, `objetivo` y `total` como string de euros; `estado` =
`conseguido` | `en_curso` (regla 5 del data-model, con lógica de sentido para
objetivos negativos = presupuesto de gasto).
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
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
from app_conta.services.cuentas import obtener_hogar_unico
from app_conta.services.dinero import euros_str

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
def post_bote(payload: BoteCreate, db: Session = Depends(get_db)) -> dict:
    hogar_id = obtener_hogar_unico(db)
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
def get_botes(db: Session = Depends(get_db)) -> dict:
    pares, total = listar_botes_activos(db)
    return {
        "items": [_serializar_bote(db, b) for b, _s in pares],
        "total": euros_str(total),
    }


@router.get("/{bote_id}")
def get_bote(bote_id: int, db: Session = Depends(get_db)) -> dict:
    bote = obtener_bote(db, bote_id)
    data = _serializar_bote(db, bote)
    data["movimientos_asignados"] = len(movimientos_asignados_activos(db, bote))
    return data


@router.patch("/{bote_id}")
def patch_bote(bote_id: int, payload: BotePatch, db: Session = Depends(get_db)) -> dict:
    dumps = payload.model_dump()
    dumps.pop("saldo", None)  # derivado: nunca editable
    # objetivo/objetivo_fecha sí pueden vaciarse de forma explícita (null → None)
    cambios = {
        k: v for k, v in dumps.items() if v is not None or k in ("objetivo", "objetivo_fecha")
    }
    bote = editar_bote(db, bote_id, cambios)
    db.commit()
    db.refresh(bote)
    return _serializar_bote(db, bote)


@router.delete("/{bote_id}", status_code=204)
def delete_bote(
    bote_id: int,
    confirmar: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    archivar_bote(db, bote_id, confirmar=confirmar)
    db.commit()
