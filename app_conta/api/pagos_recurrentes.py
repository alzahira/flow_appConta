"""Router /api/v1/pagos-recurrentes: Gestión y ejecución de recibos fijos domiciliados."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.services.cuentas import obtener_hogar_unico
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.pagos_recurrentes import (
    _serializar_pago,
    actualizar_pago_recurrente,
    crear_pago_recurrente,
    ejecutar_pagos_recurrentes,
    eliminar_pago_recurrente,
    listar_pagos_recurrentes,
    obtener_pago_recurrente,
)

router = APIRouter(prefix="/pagos-recurrentes", tags=["pagos-recurrentes"])


class PagoRecurrenteCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cuenta_id: int
    concepto: str
    importe: str | float | int
    categoria_id: int | None = None
    dia_mes: int | None = None
    notas: str | None = None
    orden: int = 0
    activo: bool = True


class PagoRecurrenteUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cuenta_id: int | None = None
    concepto: str | None = None
    importe: str | float | int | None = None
    categoria_id: int | None = None
    dia_mes: int | None = None
    notas: str | None = None
    orden: int | None = None
    activo: bool | None = None


class PagoItemEjecutar(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    importe: str | float | int | None = None


class EjecutarPagosInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    fecha: str
    cuenta_id: int | None = None
    pagos: list[PagoItemEjecutar] | None = None


@router.get("")
def get_pagos_recurrentes(db: Session = Depends(get_db)) -> dict[str, Any]:
    hogar_id = obtener_hogar_unico(db)
    return listar_pagos_recurrentes(db, hogar_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def post_pago_recurrente(
    payload: PagoRecurrenteCreate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    hogar_id = obtener_hogar_unico(db)
    try:
        pago = crear_pago_recurrente(db, hogar_id, payload.model_dump())
        return _serializar_pago(pago)
    except ErrorValidacion as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/{pago_id}")
def get_pago_recurrente(pago_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        pago = obtener_pago_recurrente(db, pago_id)
        return _serializar_pago(pago)
    except ErrorNoEncontrado as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.put("/{pago_id}")
def put_pago_recurrente(
    pago_id: int, payload: PagoRecurrenteUpdate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        pago = actualizar_pago_recurrente(
            db, pago_id, payload.model_dump(exclude_unset=True)
        )
        return _serializar_pago(pago)
    except ErrorNoEncontrado as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except ErrorValidacion as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.delete("/{pago_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pago_recurrente(pago_id: int, db: Session = Depends(get_db)) -> None:
    try:
        eliminar_pago_recurrente(db, pago_id)
    except ErrorNoEncontrado as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.post("/ejecutar")
def post_ejecutar_pagos(
    payload: EjecutarPagosInput, db: Session = Depends(get_db)
) -> dict[str, Any]:
    hogar_id = obtener_hogar_unico(db)
    try:
        pagos_raw = [p.model_dump() for p in payload.pagos] if payload.pagos is not None else None
        res = ejecutar_pagos_recurrentes(
            db,
            hogar_id,
            fecha=payload.fecha,
            cuenta_id=payload.cuenta_id,
            pagos_seleccionados=pagos_raw,
        )
        return res
    except ErrorValidacion as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

