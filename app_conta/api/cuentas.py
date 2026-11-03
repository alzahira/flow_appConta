"""Router /api/v1/cuentas (T020, US2) — contrato en specs/001-conta-mvp/contracts/rest-api.md.

Serializer: `saldo`, `saldo_inicial` y `total` salen como string de euros con
dos decimales; los saldos se calculan, nunca se leen de BD (Principio II).
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.api.dependencias import obtener_hogar_activo
from app_conta.db import get_db
from app_conta.models.cuenta import Cuenta
from app_conta.models.movimiento import Movimiento
from app_conta.services.cuentas import (
    crear_cuenta,
    editar_cuenta,
    eliminar_cuenta,
    listar_cuentas_activas,
    movimientos_activos,
    obtener_cuenta,
)
from app_conta.services.dinero import euros_a_centimos, euros_str
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
def post_cuenta(
    payload: CuentaCreate,
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict:
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
def get_cuentas(
    hogar_id: int = Depends(obtener_hogar_activo),
    db: Session = Depends(get_db),
) -> dict:
    pares, total = listar_cuentas_activas(db, hogar_id=hogar_id)
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


class LiquidarTarjetaRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    cuenta_origen_id: int
    importe: str | int | float
    fecha: str | None = None
    concepto: str | None = None


@router.post("/{cuenta_id}/liquidar", status_code=201)
def post_liquidar_tarjeta(
    cuenta_id: int, payload: LiquidarTarjetaRequest, db: Session = Depends(get_db)
) -> dict:
    """Liquida total o parcialmente el recibo de una tarjeta cargándolo en el banco."""
    tarjeta = obtener_cuenta(db, cuenta_id)
    banco = obtener_cuenta(db, payload.cuenta_origen_id)

    try:
        importe_cent = euros_a_centimos(str(payload.importe))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Importe de liquidación no válido.") from exc

    if importe_cent <= 0:
        raise HTTPException(
            status_code=400, detail="El importe a liquidar debe ser estrictamente mayor que 0."
        )

    fecha_cobro = date.fromisoformat(payload.fecha) if payload.fecha else date.today()
    concepto_banco = payload.concepto or f"Liquidación recibo {tarjeta.nombre}"
    concepto_tarjeta = f"Abono liquidación recibo desde {banco.nombre}"

    # 1. Movimiento en la cuenta bancaria de origen (gasto real que sale del banco)
    mov_banco = Movimiento(
        hogar_id=banco.hogar_id,
        cuenta_id=banco.id,
        fecha=fecha_cobro,
        descripcion=concepto_banco,
        importe_centimos=-importe_cent,
    )
    # 2. Movimiento en la tarjeta (ingreso que reduce la deuda acumulada de la tarjeta)
    mov_tarjeta = Movimiento(
        hogar_id=tarjeta.hogar_id,
        cuenta_id=tarjeta.id,
        fecha=fecha_cobro,
        descripcion=concepto_tarjeta,
        importe_centimos=importe_cent,
    )

    db.add(mov_banco)
    db.add(mov_tarjeta)
    db.commit()

    return {
        "mensaje": (
            f"Se ha liquidado {euros_str(importe_cent)} € en {tarjeta.nombre} desde {banco.nombre}"
        ),
        "importe": euros_str(importe_cent),
        "saldo_tarjeta": euros_str(saldo_cuenta(db, tarjeta)),
        "saldo_banco": euros_str(saldo_cuenta(db, banco)),
    }


class TraspasoCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    cuenta_origen_id: int
    cuenta_destino_id: int
    importe: str | int | float
    fecha: str | None = None
    concepto: str | None = None
    bote_id: int | None = None


@router.post("/traspaso", status_code=200)
def post_traspaso(payload: TraspasoCreate, db: Session = Depends(get_db)) -> dict:
    if payload.cuenta_origen_id == payload.cuenta_destino_id:
        raise HTTPException(
            status_code=400, detail="La cuenta de origen y de destino no pueden ser la misma."
        )

    origen = db.get(Cuenta, payload.cuenta_origen_id)
    if not origen:
        raise HTTPException(status_code=404, detail="Cuenta de origen no encontrada.")

    destino = db.get(Cuenta, payload.cuenta_destino_id)
    if not destino:
        raise HTTPException(status_code=404, detail="Cuenta de destino no encontrada.")

    try:
        importe_cent = euros_a_centimos(str(payload.importe))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Importe de traspaso no válido.") from exc

    if importe_cent <= 0:
        raise HTTPException(
            status_code=400, detail="El importe a traspasar debe ser mayor que 0."
        )

    fecha_traspaso = date.fromisoformat(payload.fecha) if payload.fecha else date.today()
    concepto_salida = payload.concepto or f"Traspaso a {destino.nombre}"
    concepto_entrada = payload.concepto or f"Traspaso desde {origen.nombre}"

    mov_salida = Movimiento(
        hogar_id=origen.hogar_id,
        cuenta_id=origen.id,
        fecha=fecha_traspaso,
        descripcion=concepto_salida,
        importe_centimos=-importe_cent,
        bote_id=payload.bote_id,
    )
    mov_entrada = Movimiento(
        hogar_id=destino.hogar_id,
        cuenta_id=destino.id,
        fecha=fecha_traspaso,
        descripcion=concepto_entrada,
        importe_centimos=importe_cent,
        bote_id=payload.bote_id,
    )

    db.add(mov_salida)
    db.add(mov_entrada)
    db.commit()

    return {
        "mensaje": f"Traspaso de {euros_str(importe_cent)} € realizado con éxito de {origen.nombre} a {destino.nombre}.",
        "importe": euros_str(importe_cent),
        "saldo_origen": euros_str(saldo_cuenta(db, origen)),
        "saldo_destino": euros_str(saldo_cuenta(db, destino)),
    }

