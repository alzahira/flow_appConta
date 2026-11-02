"""Router /api/v1/prestamos: Gestión de pasivos, financiaciones y deudas a devolver del hogar."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.services.cuentas import obtener_hogar_unico
from app_conta.services.dinero import ErrorImporte, euros_a_centimos, euros_str
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.prestamos import (
    actualizar_prestamo,
    crear_prestamo,
    eliminar_prestamo,
    listar_prestamos,
    obtener_prestamo,
    registrar_pago_prestamo,
    resumen_prestamos,
)

router = APIRouter(prefix="/prestamos", tags=["prestamos"])


def _parse_imp(valor: str | int | float | None) -> int:
    if valor is None:
        return 0
    try:
        return euros_a_centimos(str(valor))
    except ErrorImporte as exc:
        raise ErrorValidacion(str(exc)) from exc


def _parse_imp_opcional(valor: str | int | float | None) -> int | None:
    if valor is None or str(valor).strip() == "":
        return None
    try:
        return euros_a_centimos(str(valor))
    except ErrorImporte as exc:
        raise ErrorValidacion(str(exc)) from exc


class PrestamoCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nombre: str
    entidad: str
    tipo: str = "coche"
    importe_inicial: str | int | float
    importe_pendiente: str | int | float | None = None
    cuota_mensual: str | int | float | None = None
    cuenta_id: int | None = None
    fecha_inicio: str | None = None
    fecha_fin: str | None = None
    notas: str | None = None


class PrestamoUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nombre: str | None = None
    entidad: str | None = None
    tipo: str | None = None
    importe_pendiente: str | int | float | None = None
    cuota_mensual: str | int | float | None = None
    cuenta_id: int | None = None
    fecha_inicio: str | None = None
    fecha_fin: str | None = None
    notas: str | None = None
    activo: bool | None = None


class PagoPrestamoRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    importe: str | int | float
    cuenta_id: int | None = None
    concepto: str | None = None
    fecha: str | None = None


def _formatear_prestamo(p: Any) -> dict[str, Any]:
    return {
        "id": p.id,
        "nombre": p.nombre,
        "entidad": p.entidad,
        "tipo": p.tipo,
        "importe_inicial_centimos": p.importe_inicial_centimos,
        "importe_inicial": euros_str(p.importe_inicial_centimos),
        "importe_pendiente_centimos": p.importe_pendiente_centimos,
        "importe_pendiente": euros_str(p.importe_pendiente_centimos),
        "amortizado_centimos": p.amortizado_centimos,
        "amortizado": euros_str(p.amortizado_centimos),
        "progreso_amortizado_pct": p.progreso_amortizado_pct,
        "cuota_mensual_centimos": p.cuota_mensual_centimos,
        "cuota_mensual": (
            euros_str(p.cuota_mensual_centimos) if p.cuota_mensual_centimos is not None else None
        ),
        "cuenta_id": p.cuenta_id,
        "fecha_inicio": str(p.fecha_inicio),
        "fecha_fin": str(p.fecha_fin) if p.fecha_fin else None,
        "notas": p.notas,
        "activo": p.activo,
    }


@router.get("", status_code=status.HTTP_200_OK)
def get_prestamos(
    incluir_inactivos: bool = False, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Lista todos los préstamos y pasivos del hogar con métricas consolidadas."""
    hogar_id = obtener_hogar_unico(db)
    items = listar_prestamos(db, str(hogar_id), incluir_inactivos=incluir_inactivos)
    res = resumen_prestamos(db, str(hogar_id))

    return {
        "items": [_formatear_prestamo(p) for p in items],
        "total_prestamos": res["total_prestamos"],
        "total_deuda_pendiente_centimos": res["total_deuda_pendiente_centimos"],
        "total_deuda_pendiente": euros_str(res["total_deuda_pendiente_centimos"]),
        "total_financiado_centimos": res["total_financiado_centimos"],
        "total_financiado": euros_str(res["total_financiado_centimos"]),
        "total_amortizado_centimos": res["total_amortizado_centimos"],
        "total_amortizado": euros_str(res["total_amortizado_centimos"]),
        "progreso_global_pct": res["progreso_global_pct"],
        "cuota_mensual_total_centimos": res["cuota_mensual_total_centimos"],
        "cuota_mensual_total": euros_str(res["cuota_mensual_total_centimos"]),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def post_prestamo(
    payload: PrestamoCreate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Crea un nuevo préstamo o deuda que debe devolver el hogar."""
    hogar_id = obtener_hogar_unico(db)

    datos: dict[str, Any] = {
        "nombre": payload.nombre,
        "entidad": payload.entidad,
        "tipo": payload.tipo,
        "importe_inicial_centimos": _parse_imp(payload.importe_inicial),
        "cuenta_id": payload.cuenta_id,
        "fecha_inicio": payload.fecha_inicio,
        "fecha_fin": payload.fecha_fin,
        "notas": payload.notas,
    }

    if payload.importe_pendiente is not None:
        datos["importe_pendiente_centimos"] = _parse_imp(payload.importe_pendiente)

    if payload.cuota_mensual is not None:
        datos["cuota_mensual_centimos"] = _parse_imp_opcional(payload.cuota_mensual)

    try:
        prestamo = crear_prestamo(db, str(hogar_id), datos)
        db.commit()
    except (ErrorValidacion, ErrorNoEncontrado) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST
            if isinstance(exc, ErrorValidacion)
            else status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return _formatear_prestamo(prestamo)


@router.get("/{prestamo_id}", status_code=status.HTTP_200_OK)
def get_prestamo_por_id(prestamo_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Detalle de un préstamo concreto."""
    hogar_id = obtener_hogar_unico(db)
    try:
        prestamo = obtener_prestamo(db, str(hogar_id), prestamo_id)
    except ErrorNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _formatear_prestamo(prestamo)


@router.patch("/{prestamo_id}", status_code=status.HTTP_200_OK)
def patch_prestamo(
    prestamo_id: int, payload: PrestamoUpdate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Modifica datos o saldo de un préstamo."""
    hogar_id = obtener_hogar_unico(db)
    datos = payload.model_dump(exclude_unset=True)

    if "importe_pendiente" in datos and datos["importe_pendiente"] is not None:
        datos["importe_pendiente_centimos"] = _parse_imp(datos.pop("importe_pendiente"))

    if "cuota_mensual" in datos:
        datos["cuota_mensual_centimos"] = _parse_imp_opcional(datos.pop("cuota_mensual"))

    try:
        prestamo = actualizar_prestamo(db, str(hogar_id), prestamo_id, datos)
        db.commit()
    except (ErrorValidacion, ErrorNoEncontrado) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST
            if isinstance(exc, ErrorValidacion)
            else status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return _formatear_prestamo(prestamo)


@router.post("/{prestamo_id}/pagar", status_code=status.HTTP_200_OK)
def post_pago_prestamo(
    prestamo_id: int, payload: PagoPrestamoRequest, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Registra una cuota o amortización parcial del préstamo."""
    hogar_id = obtener_hogar_unico(db)
    importe_cent = _parse_imp(payload.importe)

    fecha_obj: date | None = None
    if payload.fecha:
        try:
            fecha_obj = date.fromisoformat(str(payload.fecha))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Fecha no válida: {payload.fecha}"
            ) from exc

    try:
        prestamo = registrar_pago_prestamo(
            db,
            str(hogar_id),
            prestamo_id,
            importe_cent,
            cuenta_id=payload.cuenta_id,
            concepto=payload.concepto,
            fecha=fecha_obj,
        )
        db.commit()
    except (ErrorValidacion, ErrorNoEncontrado) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST
            if isinstance(exc, ErrorValidacion)
            else status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return _formatear_prestamo(prestamo)


@router.delete("/{prestamo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prestamo(prestamo_id: int, db: Session = Depends(get_db)) -> None:
    """Elimina definitivamente un préstamo."""
    hogar_id = obtener_hogar_unico(db)
    try:
        eliminar_prestamo(db, str(hogar_id), prestamo_id)
        db.commit()
    except ErrorNoEncontrado as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
