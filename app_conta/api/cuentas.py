"""Router /api/v1/cuentas (T020, US2) — contrato en specs/001-conta-mvp/contracts/rest-api.md.

Serializer: `saldo`, `saldo_inicial` y `total` salen como string de euros con
dos decimales; los saldos se calculan, nunca se leen de BD (Principio II).
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.models.cuenta import Cuenta
from app_conta.services.cuentas import (
    crear_cuenta,
    editar_cuenta,
    eliminar_cuenta,
    listar_cuentas_activas,
    movimientos_activos,
    obtener_cuenta,
    obtener_hogar_unico,
)
from app_conta.services.dinero import euros_str
from app_conta.services.movimientos import saldo_cuenta

router = APIRouter(prefix="/cuentas", tags=["cuentas"])


class CuentaCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nombre: str
    tipo: Literal["banco", "tarjeta", "efectivo", "inversion"]
    entidad: str | None = None
    saldo_inicial: str | int | float = "0.00"
    fecha_apertura: str


class CuentaPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nombre: str | None = None
    tipo: Literal["banco", "tarjeta", "efectivo", "inversion"] | None = None
    entidad: str | None = None
    fecha_apertura: str | None = None
    saldo_inicial: str | int | float | None = None
    # `saldo` (derivado) aceptado para ignorarse explícitamente (Principio II)
    saldo: str | None = None


def _serializar_cuenta(db: Session, cuenta: Cuenta) -> dict:
    return {
        "id": cuenta.id,
        "nombre": cuenta.nombre,
        "tipo": cuenta.tipo,
        "entidad": cuenta.entidad,
        "saldo_inicial": euros_str(cuenta.saldo_inicial_centimos),
        "saldo": euros_str(saldo_cuenta(db, cuenta)),
        "fecha_apertura": cuenta.fecha_apertura.isoformat(),
        "archivada": bool(cuenta.archivada),
    }


def _serializar_movimiento(mov) -> dict:
    return {
        "id": mov.id,
        "fecha": mov.fecha.isoformat() if isinstance(mov.fecha, date) else str(mov.fecha),
        "importe": euros_str(mov.importe_centimos),
        "descripcion": mov.descripcion,
        "cuenta_id": mov.cuenta_id,
        "categoria_id": mov.categoria_id,
        "bote_id": mov.bote_id,
        "marcar_revisar": bool(mov.marcar_revisar),
        "origen": mov.origen,
    }


@router.post("", status_code=201)
def post_cuenta(payload: CuentaCreate, db: Session = Depends(get_db)) -> dict:
    hogar_id = obtener_hogar_unico(db)
    cuenta = crear_cuenta(
        db,
        nombre=payload.nombre,
        tipo=payload.tipo,
        entidad=payload.entidad,
        saldo_inicial=payload.saldo_inicial,
        fecha_apertura=payload.fecha_apertura,
        hogar_id=hogar_id,
    )
    db.commit()
    db.refresh(cuenta)
    return _serializar_cuenta(db, cuenta)


@router.get("")
def get_cuentas(db: Session = Depends(get_db)) -> dict:
    pares, total = listar_cuentas_activas(db)
    return {
        "items": [_serializar_cuenta(db, c) for c, _s in pares],
        "total": euros_str(total),
    }


@router.get("/{cuenta_id}")
def get_cuenta(cuenta_id: int, db: Session = Depends(get_db)) -> dict:
    cuenta = obtener_cuenta(db, cuenta_id)
    data = _serializar_cuenta(db, cuenta)
    data["movimientos"] = [_serializar_movimiento(m) for m in movimientos_activos(db, cuenta)]
    return data


@router.patch("/{cuenta_id}")
def patch_cuenta(cuenta_id: int, payload: CuentaPatch, db: Session = Depends(get_db)) -> dict:
    cuenta = obtener_cuenta(db, cuenta_id)
    cambios = payload.model_dump(exclude_none=False, exclude={"saldo"})
    cambios = {k: v for k, v in cambios.items() if k in CuentaPatch.model_fields and v is not None}
    cuenta = editar_cuenta(db, cuenta_id, cambios)
    db.commit()
    db.refresh(cuenta)
    return _serializar_cuenta(db, cuenta)


@router.delete("/{cuenta_id}", status_code=204)
def delete_cuenta(
    cuenta_id: int,
    confirmar_destino: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    eliminar_cuenta(db, cuenta_id, confirmar_destino)
    db.commit()
