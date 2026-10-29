"""Router /api/v1/deudas: Gestión de dinero que terceros le deben al hogar."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.models.deuda import Deuda
from app_conta.services.cuentas import obtener_hogar_unico
from app_conta.services.deudas import (
    crear_deuda,
    editar_deuda,
    eliminar_deuda,
    listar_deudas_activas,
    obtener_deuda,
    registrar_cobro,
)
from app_conta.services.dinero import euros_str

router = APIRouter(prefix="/deudas", tags=["deudas"])


class DeudaCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    deudor: str
    concepto: str
    importe: str | int | float
    fecha: str
    fecha_limite: str | None = None
    notas: str | None = None


class CobroCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    importe: str | int | float
    cuenta_id: int | None = None
    fecha: str | None = None
    descripcion: str | None = None


class DeudaPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    deudor: str | None = None
    concepto: str | None = None
    fecha_limite: str | None = None
    notas: str | None = None


def _serializar_deuda(deuda: Deuda) -> dict:
    pendiente_centimos = max(0, deuda.importe_inicial_centimos - deuda.importe_cobrado_centimos)
    return {
        "id": deuda.id,
        "deudor": deuda.deudor,
        "concepto": deuda.concepto,
        "importe_inicial": euros_str(deuda.importe_inicial_centimos),
        "importe_cobrado": euros_str(deuda.importe_cobrado_centimos),
        "importe_pendiente": euros_str(pendiente_centimos),
        "fecha": deuda.fecha.isoformat(),
        "fecha_limite": deuda.fecha_limite.isoformat() if deuda.fecha_limite else None,
        "estado": deuda.estado,
        "notas": deuda.notas,
        "archivada": bool(deuda.archivada),
    }


@router.post("", status_code=201)
def post_deuda(payload: DeudaCreate, db: Session = Depends(get_db)) -> dict:
    hogar_id = obtener_hogar_unico(db)
    deuda = crear_deuda(
        db,
        deudor=payload.deudor,
        concepto=payload.concepto,
        importe=payload.importe,
        fecha=payload.fecha,
        hogar_id=hogar_id,
        fecha_limite=payload.fecha_limite,
        notas=payload.notas,
    )
    db.commit()
    db.refresh(deuda)
    return _serializar_deuda(deuda)


@router.get("")
def get_deudas(db: Session = Depends(get_db)) -> dict:
    hogar_id = obtener_hogar_unico(db)
    deudas, total_pendiente, total_cobrado = listar_deudas_activas(db, hogar_id)
    total_inicial = total_pendiente + total_cobrado
    return {
        "items": [_serializar_deuda(d) for d in deudas],
        "total_pendiente": euros_str(total_pendiente),
        "total_cobrado": euros_str(total_cobrado),
        "total_inicial": euros_str(total_inicial),
    }


@router.get("/{deuda_id}")
def get_deuda(deuda_id: int, db: Session = Depends(get_db)) -> dict:
    deuda = obtener_deuda(db, deuda_id)
    return _serializar_deuda(deuda)


@router.post("/{deuda_id}/cobro")
def post_cobro(deuda_id: int, payload: CobroCreate, db: Session = Depends(get_db)) -> dict:
    deuda = registrar_cobro(
        db,
        deuda_id,
        importe=payload.importe,
        cuenta_id=payload.cuenta_id,
        fecha=payload.fecha,
        descripcion=payload.descripcion,
    )
    db.commit()
    db.refresh(deuda)
    return _serializar_deuda(deuda)


@router.patch("/{deuda_id}")
def patch_deuda(deuda_id: int, payload: DeudaPatch, db: Session = Depends(get_db)) -> dict:
    dumps = payload.model_dump()
    cambios = {k: v for k, v in dumps.items() if v is not None or k in ("fecha_limite", "notas")}
    deuda = editar_deuda(db, deuda_id, cambios)
    db.commit()
    db.refresh(deuda)
    return _serializar_deuda(deuda)


@router.delete("/{deuda_id}", status_code=204)
def delete_deuda(deuda_id: int, db: Session = Depends(get_db)) -> None:
    eliminar_deuda(db, deuda_id)
    db.commit()
