"""Router /api/v1/prevision-gastos: Previsión de gastos periódicos y bote anual."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.services.cuentas import obtener_hogar_unico
from app_conta.services.dinero import ErrorImporte, euros_a_centimos, euros_str
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.prevision_gastos import (
    actualizar_config_prevision,
    actualizar_gasto_recurrente,
    crear_gasto_recurrente,
    eliminar_gasto_recurrente,
    obtener_resumen_prevision,
    registrar_pago_factura,
    restablecer_semilla,
)

router = APIRouter(prefix="/prevision-gastos", tags=["prevision-gastos"])


def _parse_imp(valor: str | int | float | None) -> int | None:
    if valor is None:
        return None
    try:
        return euros_a_centimos(str(valor))
    except ErrorImporte as exc:
        raise ErrorValidacion(str(exc)) from exc


class ConfigPrevisionUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    meses_pagados: int | None = None
    anio: int | None = None


class GastoRecurrenteCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    concepto: str
    fecha_cobro: str
    importe_anual: str | int | float
    cuota_mensual: str | int | float | None = None
    pagado_real: str | int | float | None = None
    notas: str | None = None
    orden: int = 0
    activo: bool = True


class GastoRecurrenteUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    concepto: str | None = None
    fecha_cobro: str | None = None
    importe_anual: str | int | float | None = None
    cuota_mensual: str | int | float | None = None
    pagado_real: str | int | float | None = None
    notas: str | None = None
    orden: int | None = None
    activo: bool | None = None


class PagoFacturaRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    importe: str | int | float
    sumar: bool = True


def _formatear_resumen(resumen: dict[str, Any]) -> dict[str, Any]:
    gastos_fmt = []
    for g in resumen["gastos"]:
        gastos_fmt.append(
            {
                "id": g["id"],
                "concepto": g["concepto"],
                "fecha_cobro": g["fecha_cobro"],
                "importe_anual_centimos": g["importe_anual_centimos"],
                "importe_anual": euros_str(g["importe_anual_centimos"]),
                "cuota_mensual_centimos": g["cuota_mensual_centimos"],
                "cuota_mensual": euros_str(g["cuota_mensual_centimos"]),
                "pagado_real_centimos": g["pagado_real_centimos"],
                "pagado_real": euros_str(g["pagado_real_centimos"]),
                "provision_acumulada_centimos": g["provision_acumulada_centimos"],
                "provision_acumulada": euros_str(g["provision_acumulada_centimos"]),
                "saldo_centimos": g["saldo_centimos"],
                "saldo": euros_str(g["saldo_centimos"]),
                "estado": g["estado"],
                "notas": g["notas"],
                "orden": g["orden"],
                "activo": g["activo"],
            }
        )

    return {
        "anio": resumen["anio"],
        "meses_pagados": resumen["meses_pagados"],
        "total_anual_centimos": resumen["total_anual_centimos"],
        "total_anual": euros_str(resumen["total_anual_centimos"]),
        "total_mensual_centimos": resumen["total_mensual_centimos"],
        "total_mensual": euros_str(resumen["total_mensual_centimos"]),
        "total_provision_centimos": resumen["total_provision_centimos"],
        "total_provision": euros_str(resumen["total_provision_centimos"]),
        "total_pagado_centimos": resumen["total_pagado_centimos"],
        "total_pagado": euros_str(resumen["total_pagado_centimos"]),
        "total_saldo_centimos": resumen["total_saldo_centimos"],
        "total_saldo": euros_str(resumen["total_saldo_centimos"]),
        "gastos": gastos_fmt,
    }


@router.get("", status_code=status.HTTP_200_OK)
def get_prevision(db: Session = Depends(get_db)) -> dict[str, Any]:
    hogar_id = obtener_hogar_unico(db)
    resumen = obtener_resumen_prevision(db, str(hogar_id))
    return _formatear_resumen(resumen)


@router.patch("/config", status_code=status.HTTP_200_OK)
def update_config(payload: ConfigPrevisionUpdate, db: Session = Depends(get_db)) -> dict[str, Any]:
    hogar_id = obtener_hogar_unico(db)
    try:
        actualizar_config_prevision(
            db, str(hogar_id), meses_pagados=payload.meses_pagados, anio=payload.anio
        )
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    resumen = obtener_resumen_prevision(db, str(hogar_id))
    return _formatear_resumen(resumen)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_gasto(payload: GastoRecurrenteCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    hogar_id = obtener_hogar_unico(db)
    try:
        imp_anual = _parse_imp(payload.importe_anual)
        cuota_m = _parse_imp(payload.cuota_mensual) if payload.cuota_mensual is not None else None
        pagado_r = _parse_imp(payload.pagado_real) if payload.pagado_real is not None else 0
        gasto = crear_gasto_recurrente(
            db,
            str(hogar_id),
            {
                "concepto": payload.concepto,
                "fecha_cobro": payload.fecha_cobro,
                "importe_anual_centimos": imp_anual,
                "cuota_mensual_centimos": cuota_m,
                "pagado_real_centimos": pagado_r,
                "notas": payload.notas,
                "orden": payload.orden,
                "activo": payload.activo,
            },
        )
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return {"id": gasto.id, "mensaje": "Gasto recurrente creado correctamente"}


@router.patch("/{gasto_id}", status_code=status.HTTP_200_OK)
def update_gasto(
    gasto_id: int, payload: GastoRecurrenteUpdate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    datos: dict[str, Any] = {}
    try:
        if payload.concepto is not None:
            datos["concepto"] = payload.concepto
        if payload.fecha_cobro is not None:
            datos["fecha_cobro"] = payload.fecha_cobro
        if payload.importe_anual is not None:
            datos["importe_anual_centimos"] = _parse_imp(payload.importe_anual)
        if payload.cuota_mensual is not None:
            datos["cuota_mensual_centimos"] = _parse_imp(payload.cuota_mensual)
        if payload.pagado_real is not None:
            datos["pagado_real_centimos"] = _parse_imp(payload.pagado_real)
        if payload.notas is not None:
            datos["notas"] = payload.notas
        if payload.orden is not None:
            datos["orden"] = payload.orden
        if payload.activo is not None:
            datos["activo"] = payload.activo

        actualizar_gasto_recurrente(db, gasto_id, datos)
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return {"mensaje": "Gasto recurrente actualizado correctamente"}


@router.post("/{gasto_id}/pagar", status_code=status.HTTP_200_OK)
def record_pago(
    gasto_id: int, payload: PagoFacturaRequest, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        imp_cents = _parse_imp(payload.importe)
        if imp_cents is None:
            raise ErrorValidacion("El importe es obligatorio")
        gasto = registrar_pago_factura(db, gasto_id, imp_cents, sumar=payload.sumar)
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return {
        "id": gasto.id,
        "pagado_real_centimos": gasto.pagado_real_centimos,
        "pagado_real": euros_str(gasto.pagado_real_centimos),
        "mensaje": "Pago registrado correctamente",
    }


@router.delete("/{gasto_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gasto(gasto_id: int, db: Session = Depends(get_db)) -> None:
    try:
        eliminar_gasto_recurrente(db, gasto_id)
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/restablecer-semilla", status_code=status.HTTP_200_OK)
def reset_seed(db: Session = Depends(get_db)) -> dict[str, Any]:
    hogar_id = obtener_hogar_unico(db)
    restablecer_semilla(db, str(hogar_id))
    resumen = obtener_resumen_prevision(db, str(hogar_id))
    return _formatear_resumen(resumen)
