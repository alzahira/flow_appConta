"""Router /api/v1/categorias (T042, US4) — contrato en contracts/rest-api.md.

Serializer: `total` como string de euros (Σ de movimientos vivos, derivado en
el periodo opcional ?desde=&hasta=) y `movimientos_asignados` como recuento.
DELETE protegido (FR-005): 409 si está en uso, salvo ?confirmar=true.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.services.categorias import (
    archivar_categoria,
    crear_categoria,
    editar_categoria,
    listar_categorias_con_totales,
    movimientos_asignados_activos,
    obtener_categoria,
)
from app_conta.services.cuentas import obtener_hogar_unico
from app_conta.services.dinero import euros_str

router = APIRouter(prefix="/categorias", tags=["categorias"])


class CategoriaCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nombre: str
    color: str | None = None


class CategoriaPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nombre: str | None = None
    color: str | None = None
    # `total` (derivado) aceptado para ignorarse explícitamente (Principio II)
    total: str | None = None


def _serializar_categoria(db: Session, categoria, total_centimos: int = 0) -> dict:
    return {
        "id": categoria.id,
        "nombre": categoria.nombre,
        "color": categoria.color,
        "total": euros_str(total_centimos),
        "movimientos_asignados": len(movimientos_asignados_activos(db, categoria)),
        "archivada": bool(categoria.archivada),
    }


@router.post("", status_code=201)
def post_categoria(payload: CategoriaCreate, db: Session = Depends(get_db)) -> dict:
    hogar_id = obtener_hogar_unico(db)
    categoria = crear_categoria(
        db,
        nombre=payload.nombre,
        hogar_id=hogar_id,
        color=payload.color,
    )
    db.commit()
    db.refresh(categoria)
    return _serializar_categoria(db, categoria)


@router.get("")
def get_categorias(
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    pares, total = listar_categorias_con_totales(db, desde=desde, hasta=hasta)
    return {
        "items": [_serializar_categoria(db, c, t) for c, t in pares],
        "total": euros_str(total),
    }


@router.get("/{categoria_id}")
def get_categoria(categoria_id: int, db: Session = Depends(get_db)) -> dict:
    categoria = obtener_categoria(db, categoria_id)
    data = _serializar_categoria(db, categoria)
    return data


@router.patch("/{categoria_id}")
def patch_categoria(
    categoria_id: int,
    payload: CategoriaPatch,
    db: Session = Depends(get_db),
) -> dict:
    dumps = payload.model_dump()
    dumps.pop("total", None)  # derivado: nunca editable
    # nombre no puede vaciarse (null), color sí (null → sin color)
    cambios = {k: v for k, v in dumps.items() if v is not None or k == "color"}
    categoria = editar_categoria(db, categoria_id, cambios)
    db.commit()
    db.refresh(categoria)
    return _serializar_categoria(db, categoria)


@router.delete("/{categoria_id}", status_code=204)
def delete_categoria(
    categoria_id: int,
    confirmar: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    archivar_categoria(db, categoria_id, confirmar=confirmar)
    db.commit()
