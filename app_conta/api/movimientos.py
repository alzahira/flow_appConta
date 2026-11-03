"""Router /api/v1/movimientos (T021, US2) — contrato en contracts/rest-api.md.

Listados paginados (limit/offset) y filtrables (desde/hasta/cuenta/bote/
categoria). Importes en los dos sentidos como string de euros con dos
decimales; borrado lógico + auditoría en el servicio.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.api.cuentas import _serializar_movimiento
from app_conta.api.dependencias import obtener_hogar_activo
from app_conta.db import get_db
from app_conta.services.botes import reasignar_bote
from app_conta.services.errors import ErrorNoEncontrado
from app_conta.services.movimientos import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    crear_movimiento,
    editar_movimiento,
    eliminar_movimiento,
    listar_movimientos,
    obtener_movimiento,
    restaurar_movimiento,
)

router = APIRouter(prefix="/movimientos", tags=["movimientos"])


class MovimientoCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    fecha: str
    importe: str | int | float
    descripcion: str
    cuenta_id: int
    categoria_id: int | None = None
    bote_id: int | None = None


class MovimientoPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    fecha: str | None = None
    importe: str | int | float | None = None
    descripcion: str | None = None
    categoria_id: int | None = None
    bote_id: int | None = None


class BoteAsignar(BaseModel):
    """Cuerpo del PATCH /movimientos/{id}/bote: `{ "bote_id": int | null }`."""

    bote_id: int | None = None


@router.post("", status_code=201)
def post_movimiento(payload: MovimientoCreate, db: Session = Depends(get_db)) -> dict:
    mov = crear_movimiento(
        db,
        fecha=payload.fecha,
        importe=payload.importe,
        descripcion=payload.descripcion,
        cuenta_id=payload.cuenta_id,
        categoria_id=payload.categoria_id,
        bote_id=payload.bote_id,
    )
    db.commit()
    db.refresh(mov)
    return _serializar_movimiento(mov)


@router.get("")
def get_movimientos(
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    cuenta: int | None = Query(default=None),
    bote: int | None = Query(default=None),
    categoria: int | None = Query(default=None),
    orden: str = Query(default="asc"),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict:
    filas, total = listar_movimientos(
        db,
        hogar_id=hogar_id,
        desde=desde,
        hasta=hasta,
        cuenta=cuenta,
        bote=bote,
        categoria=categoria,
        limit=limit,
        offset=offset,
        orden=orden,
    )
    return {
        "items": [_serializar_movimiento(m) for m in filas],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{movimiento_id}")
def get_movimiento(movimiento_id: int, db: Session = Depends(get_db)) -> dict:
    mov = obtener_movimiento(db, movimiento_id)
    return _serializar_movimiento(mov)


@router.patch("/{movimiento_id}")
def patch_movimiento(
    movimiento_id: int, payload: MovimientoPatch, db: Session = Depends(get_db)
) -> dict:
    mov = obtener_movimiento(db, movimiento_id)
    cambios = {k: v for k, v in payload.model_dump().items() if v is not None}
    mov = editar_movimiento(db, mov.id, cambios)
    db.commit()
    db.refresh(mov)
    return _serializar_movimiento(mov)


@router.delete("/{movimiento_id}", status_code=204)
def delete_movimiento(movimiento_id: int, db: Session = Depends(get_db)):
    try:
        eliminar_movimiento(db, movimiento_id)
    except ErrorNoEncontrado:
        db.rollback()
        raise
    db.commit()


@router.post("/{movimiento_id}/restaurar", status_code=200)
def post_restaurar_movimiento(movimiento_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        mov = restaurar_movimiento(db, movimiento_id)
    except ErrorNoEncontrado:
        db.rollback()
        raise
    db.commit()
    db.refresh(mov)
    return _serializar_movimiento(mov)


@router.patch("/{movimiento_id}/bote")
def patch_movimiento_bote(
    movimiento_id: int, payload: BoteAsignar, db: Session = Depends(get_db)
) -> dict:
    """Reasigna el bote de un movimiento (FR-008, US3) con auditoría."""
    mov = reasignar_bote(db, movimiento_id, payload.bote_id)
    db.commit()
    db.refresh(mov)
    return _serializar_movimiento(mov)
