"""Router /api/v1/inversiones: Seguimiento de carteras de inversión, activos y rentabilidad."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.api.dependencias import obtener_hogar_activo
from app_conta.db import get_db
from app_conta.services.dinero import ErrorImporte, euros_a_centimos, euros_str
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.inversiones import (
    actualizar_inversion,
    actualizar_valoracion,
    crear_inversion,
    eliminar_inversion,
    obtener_inversion,
    registrar_aportacion,
    registrar_reembolso,
    resumen_inversiones,
)

router = APIRouter(prefix="/inversiones", tags=["inversiones"])


def _parse_imp(valor: str | int | float | None) -> int:
    if valor is None:
        return 0
    try:
        return euros_a_centimos(str(valor))
    except ErrorImporte as exc:
        raise ErrorValidacion(str(exc)) from exc


class InversionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nombre: str
    entidad: str
    tipo_activo: str = "fondos"
    capital_aportado: str | int | float = "0.00"
    valor_actual: str | int | float | None = None
    cuenta_id: int | None = None
    crear_movimiento_inicial: bool = False
    fecha_inicio: str | None = None
    notas: str | None = None


class InversionUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nombre: str | None = None
    entidad: str | None = None
    tipo_activo: str | None = None
    fecha_inicio: str | None = None
    notas: str | None = None
    cuenta_id: int | None = None


class ValoracionUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    valor_actual: str | int | float


class AportacionRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    importe: str | int | float
    cuenta_origen_id: int | None = None
    fecha: str | None = None


class ReembolsoRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    importe: str | int | float
    cuenta_destino_id: int | None = None
    fecha: str | None = None


def _formatear_inversion(inv: Any) -> dict[str, Any]:
    return {
        "id": inv.id,
        "nombre": inv.nombre,
        "entidad": inv.entidad,
        "tipo_activo": inv.tipo_activo,
        "capital_aportado_centimos": inv.capital_aportado_centimos,
        "capital_aportado": euros_str(inv.capital_aportado_centimos),
        "valor_actual_centimos": inv.valor_actual_centimos,
        "valor_actual": euros_str(inv.valor_actual_centimos),
        "plusvalia_centimos": inv.plusvalia_centimos,
        "plusvalia": euros_str(inv.plusvalia_centimos),
        "rentabilidad_pct": inv.rentabilidad_pct,
        "cuenta_id": inv.cuenta_id,
        "fecha_inicio": str(inv.fecha_inicio),
        "notas": inv.notas,
        "activo": inv.activo,
    }


@router.get("", status_code=status.HTTP_200_OK)
def get_inversiones(
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    res = resumen_inversiones(db, str(hogar_id))

    invs_fmt = [_formatear_inversion(i) for i in res["inversiones"]]

    dist_tipo = [
        {"tipo": d["tipo"], "valor": euros_str(d["valor_centimos"]), "pct": d["pct"]}
        for d in res["distribucion_tipo"]
    ]
    dist_ent = [
        {"entidad": d["entidad"], "valor": euros_str(d["valor_centimos"]), "pct": d["pct"]}
        for d in res["distribucion_entidad"]
    ]

    return {
        "total_posiciones": res["total_posiciones"],
        "total_capital_aportado_centimos": res["total_capital_aportado_centimos"],
        "total_capital_aportado": euros_str(res["total_capital_aportado_centimos"]),
        "total_valor_actual_centimos": res["total_valor_actual_centimos"],
        "total_valor_actual": euros_str(res["total_valor_actual_centimos"]),
        "total_plusvalia_centimos": res["total_plusvalia_centimos"],
        "total_plusvalia": euros_str(res["total_plusvalia_centimos"]),
        "rentabilidad_global_pct": res["rentabilidad_global_pct"],
        "distribucion_tipo": dist_tipo,
        "distribucion_entidad": dist_ent,
        "inversiones": invs_fmt,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_inversion(
    payload: InversionCreate,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        cap_cents = _parse_imp(payload.capital_aportado)
        val_cents = (
            _parse_imp(payload.valor_actual) if payload.valor_actual is not None else cap_cents
        )

        inv = crear_inversion(
            db,
            str(hogar_id),
            {
                "nombre": payload.nombre,
                "entidad": payload.entidad,
                "tipo_activo": payload.tipo_activo,
                "capital_aportado_centimos": cap_cents,
                "valor_actual_centimos": val_cents,
                "cuenta_id": payload.cuenta_id,
                "crear_movimiento_inicial": payload.crear_movimiento_inicial,
                "fecha_inicio": payload.fecha_inicio,
                "notas": payload.notas,
            },
        )
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return {"id": inv.id, "mensaje": "Inversión creada correctamente"}


@router.get("/{inversion_id}", status_code=status.HTTP_200_OK)
def get_inversion_detalle(
    inversion_id: int,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        inv = obtener_inversion(db, inversion_id, hogar_id)
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _formatear_inversion(inv)


@router.patch("/{inversion_id}", status_code=status.HTTP_200_OK)
def update_inversion_datos(
    inversion_id: int,
    payload: InversionUpdate,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    datos = payload.model_dump(exclude_unset=True)
    try:
        inv = actualizar_inversion(db, inversion_id, datos, hogar_id=hogar_id)
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return _formatear_inversion(inv)


@router.post("/{inversion_id}/valoracion", status_code=status.HTTP_200_OK)
def update_valoracion(
    inversion_id: int,
    payload: ValoracionUpdate,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        nuevo_valor_cents = _parse_imp(payload.valor_actual)
        inv = actualizar_valoracion(db, inversion_id, nuevo_valor_cents, hogar_id=hogar_id)
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return _formatear_inversion(inv)


@router.post("/{inversion_id}/aportar", status_code=status.HTTP_200_OK)
def record_aportacion(
    inversion_id: int,
    payload: AportacionRequest,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        imp_cents = _parse_imp(payload.importe)
        inv = registrar_aportacion(
            db,
            inversion_id,
            imp_cents,
            cuenta_origen_id=payload.cuenta_origen_id,
            fecha=payload.fecha,
            hogar_id=hogar_id,
        )
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return _formatear_inversion(inv)


@router.post("/{inversion_id}/reembolsar", status_code=status.HTTP_200_OK)
def record_reembolso(
    inversion_id: int,
    payload: ReembolsoRequest,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        imp_cents = _parse_imp(payload.importe)
        inv = registrar_reembolso(
            db,
            inversion_id,
            imp_cents,
            cuenta_destino_id=payload.cuenta_destino_id,
            fecha=payload.fecha,
            hogar_id=hogar_id,
        )
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return _formatear_inversion(inv)


@router.delete("/{inversion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inversion(
    inversion_id: int,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> None:
    try:
        eliminar_inversion(db, inversion_id, hogar_id)
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
