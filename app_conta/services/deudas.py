"""Servicio de dominio de Deudas (dinero que le deben al hogar).

Principio I: importes exactos en céntimos; las deudas se modelan como entidades.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.deuda import Deuda
from app_conta.services.cuentas import obtener_cuenta
from app_conta.services.dinero import euros_a_centimos
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.hogar import exigir_hogar
from app_conta.services.movimientos import crear_movimiento


def crear_deuda(
    db: Session,
    *,
    deudor: str,
    concepto: str,
    importe: str | int | float,
    fecha: str | date,
    hogar_id: str | int,
    fecha_limite: str | date | None = None,
    notas: str | None = None,
) -> Deuda:
    """Crea un registro de dinero que un tercero debe al hogar."""
    deudor_limpio = deudor.strip()
    concepto_limpio = concepto.strip()
    if not deudor_limpio:
        raise ErrorValidacion("El nombre de la persona o deudor es obligatorio.")
    if not concepto_limpio:
        raise ErrorValidacion("El concepto o motivo de la deuda es obligatorio.")

    centimos = euros_a_centimos(importe)
    if centimos <= 0:
        raise ErrorValidacion(
            "El importe de la deuda debe ser un número positivo estrictamente mayor que cero."
        )

    if isinstance(fecha, str):
        fecha_obj = date.fromisoformat(fecha)
    else:
        fecha_obj = fecha

    fecha_limite_obj = None
    if fecha_limite:
        fecha_limite_obj = (
            date.fromisoformat(fecha_limite) if isinstance(fecha_limite, str) else fecha_limite
        )

    deuda = Deuda(
        hogar_id=str(hogar_id),
        deudor=deudor_limpio,
        concepto=concepto_limpio,
        importe_inicial_centimos=centimos,
        importe_cobrado_centimos=0,
        fecha=fecha_obj,
        fecha_limite=fecha_limite_obj,
        estado="pendiente",
        notas=notas.strip() if notas else None,
        archivada=False,
    )
    db.add(deuda)
    db.flush()
    return deuda


def listar_deudas_activas(db: Session, hogar_id: str | int) -> tuple[list[Deuda], int, int]:
    """Lista las deudas vivas del hogar y computa total pendiente y total cobrado en céntimos."""
    stmt = (
        select(Deuda)
        .where(Deuda.hogar_id == str(hogar_id), Deuda.archivada == False)  # noqa: E712
        .order_by(Deuda.fecha.desc(), Deuda.id.desc())
    )
    deudas = list(db.scalars(stmt))
    total_pendiente = sum(
        max(0, d.importe_inicial_centimos - d.importe_cobrado_centimos) for d in deudas
    )
    total_cobrado = sum(d.importe_cobrado_centimos for d in deudas)
    return deudas, total_pendiente, total_cobrado


def obtener_deuda(
    db: Session, deuda_id: int, hogar_id: int | str | None = None
) -> Deuda:
    """Obtiene una deuda viva por id o eleva ErrorNoEncontrado."""
    stmt = select(Deuda).where(Deuda.id == deuda_id, Deuda.archivada == False)  # noqa: E712
    deuda = db.scalar(stmt)
    if not deuda:
        raise ErrorNoEncontrado(f"No existe ninguna deuda activa con id {deuda_id}.")
    exigir_hogar(deuda, hogar_id, f"Deuda {deuda_id}")
    return deuda


def registrar_cobro(
    db: Session,
    deuda_id: int,
    *,
    importe: str | int | float,
    cuenta_id: int | None = None,
    fecha: str | date | None = None,
    descripcion: str | None = None,
    hogar_id: int | str | None = None,
) -> Deuda:
    """Registra la devolución total o parcial de una deuda.

    Si se proporciona `cuenta_id`, crea automáticamente el movimiento de ingreso
    en la cuenta correspondiente del hogar.
    """
    deuda = obtener_deuda(db, deuda_id, hogar_id)
    centimos_cobro = euros_a_centimos(importe)
    if centimos_cobro <= 0:
        raise ErrorValidacion("El importe cobrado debe ser estrictamente positivo.")

    pendiente_actual = max(0, deuda.importe_inicial_centimos - deuda.importe_cobrado_centimos)
    if centimos_cobro > pendiente_actual:
        cobro_str = f"{centimos_cobro / 100:.2f}"
        pend_str = f"{pendiente_actual / 100:.2f}"
        raise ErrorValidacion(
            f"El importe a cobrar ({cobro_str} €) supera el saldo pendiente ({pend_str} €)."
        )

    deuda.importe_cobrado_centimos += centimos_cobro
    if deuda.importe_cobrado_centimos >= deuda.importe_inicial_centimos:
        deuda.estado = "saldado"
    else:
        deuda.estado = "parcial"

    if cuenta_id is not None:
        # Valida que la cuenta de ingreso pertenece al mismo hogar (anti-IDOR).
        obtener_cuenta(db, cuenta_id, deuda.hogar_id)
        fecha_str = (
            fecha.isoformat() if isinstance(fecha, date) else (fecha or date.today().isoformat())
        )
        desc = descripcion or f"Cobro deuda {deuda.deudor}: {deuda.concepto}"
        crear_movimiento(
            db,
            fecha=fecha_str,
            importe=f"+{centimos_cobro / 100:.2f}",
            descripcion=desc,
            cuenta_id=cuenta_id,
            hogar_id=deuda.hogar_id,
        )

    db.flush()
    return deuda


def eliminar_deuda(
    db: Session, deuda_id: int, hogar_id: int | str | None = None
) -> None:
    """Archiva lógicamente una deuda."""
    deuda = obtener_deuda(db, deuda_id, hogar_id)
    deuda.archivada = True
    db.flush()


def editar_deuda(
    db: Session, deuda_id: int, cambios: dict, hogar_id: int | str | None = None
) -> Deuda:
    """Edita campos informativos de una deuda."""
    deuda = obtener_deuda(db, deuda_id, hogar_id)
    if "deudor" in cambios and cambios["deudor"]:
        deuda.deudor = cambios["deudor"].strip()
    if "concepto" in cambios and cambios["concepto"]:
        deuda.concepto = cambios["concepto"].strip()
    if "notas" in cambios:
        deuda.notas = cambios["notas"].strip() if cambios["notas"] else None
    if "fecha_limite" in cambios:
        val = cambios["fecha_limite"]
        deuda.fecha_limite = date.fromisoformat(val) if isinstance(val, str) else val
    db.flush()
    return deuda
