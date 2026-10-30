"""Router /api/v1/plantillas-reparto: Plantillas para nóminas y repartos mensuales."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.services.cuentas import obtener_hogar_unico
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.plantillas_reparto import (
    actualizar_plantilla,
    crear_plantilla,
    ejecutar_reparto,
    eliminar_plantilla,
    listar_plantillas,
    obtener_plantilla,
    serializar_plantilla,
)

router = APIRouter(prefix="/plantillas-reparto", tags=["plantillas-reparto"])


class LineaRepartoInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bote_id: int | None = None
    concepto: str
    importe: str | float | int


class PlantillaRepartoCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nombre: str
    cuenta_id: int
    importe_estimado: str | float | int = "0.00"
    dia_mes: int | None = None
    activo: bool = True
    lineas: list[LineaRepartoInput] = []


class PlantillaRepartoUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nombre: str | None = None
    cuenta_id: int | None = None
    importe_estimado: str | float | int | None = None
    dia_mes: int | None = None
    activo: bool | None = None
    lineas: list[LineaRepartoInput] | None = None


class EjecutarRepartoInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    fecha: str
    cuenta_id: int | None = None
    descripcion_general: str | None = None
    lineas: list[LineaRepartoInput] | None = None


@router.get("", response_model=list[dict[str, Any]])
def get_plantillas(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    hogar_id = obtener_hogar_unico(db)
    return listar_plantillas(db, hogar_id)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict[str, Any])
def post_plantilla(
    payload: PlantillaRepartoCreate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    hogar_id = obtener_hogar_unico(db)
    try:
        plantilla = crear_plantilla(db, hogar_id, payload.model_dump())
        return serializar_plantilla(plantilla)
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.get("/{plantilla_id}", response_model=dict[str, Any])
def get_plantilla_detalle(
    plantilla_id: int, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        plantilla = obtener_plantilla(db, plantilla_id)
        return serializar_plantilla(plantilla)
    except ErrorNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.put("/{plantilla_id}", response_model=dict[str, Any])
def put_plantilla(
    plantilla_id: int, payload: PlantillaRepartoUpdate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        datos = {k: v for k, v in payload.model_dump().items() if v is not None}
        plantilla = actualizar_plantilla(db, plantilla_id, datos)
        return serializar_plantilla(plantilla)
    except ErrorNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.delete("/{plantilla_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plantilla(plantilla_id: int, db: Session = Depends(get_db)) -> None:
    try:
        eliminar_plantilla(db, plantilla_id)
    except ErrorNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.post("/{plantilla_id}/ejecutar", response_model=dict[str, Any])
def post_ejecutar_reparto(
    plantilla_id: int, payload: EjecutarRepartoInput, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        lineas_dump = (
            [linea.model_dump() for linea in payload.lineas]
            if payload.lineas is not None
            else None
        )
        res = ejecutar_reparto(
            db,
            plantilla_id,
            fecha=payload.fecha,
            cuenta_id=payload.cuenta_id,
            lineas=lineas_dump,
            descripcion_general=payload.descripcion_general,
        )
        return res
    except ErrorNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
