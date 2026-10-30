"""Servicio de gestión de préstamos, pasivos y deudas a devolver del hogar."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.cuenta import Cuenta
from app_conta.models.movimiento import Movimiento
from app_conta.models.prestamo import Prestamo
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion

TIPOS_PRESTAMO_VALIDOS = {
    "coche",
    "personal",
    "hipoteca",
    "consumo",
    "otro",
}


def _parsear_fecha(valor: Any) -> date:
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str) and valor.strip():
        try:
            return date.fromisoformat(valor.strip())
        except ValueError as exc:
            raise ErrorValidacion("Formato de fecha inválido. Use AAAA-MM-DD.") from exc
    return date.today()


def _parsear_fecha_opcional(valor: Any) -> date | None:
    if not valor:
        return None
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str) and valor.strip():
        try:
            return date.fromisoformat(valor.strip())
        except ValueError as exc:
            raise ErrorValidacion("Formato de fecha inválido. Use AAAA-MM-DD.") from exc
    return None


def crear_prestamo(session: Session, hogar_id: str, datos: dict[str, Any]) -> Prestamo:
    """Da de alta un nuevo préstamo o deuda que el hogar debe devolver."""
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        raise ErrorValidacion("El nombre o concepto del préstamo es obligatorio (ej. Coche).")

    entidad = (datos.get("entidad") or "").strip()
    if not entidad:
        raise ErrorValidacion("La entidad prestamista o financiera es obligatoria.")

    tipo = (datos.get("tipo") or "coche").strip().lower()
    if tipo not in TIPOS_PRESTAMO_VALIDOS:
        tipo = "otro"

    importe_inicial = int(datos.get("importe_inicial_centimos") or 0)
    if importe_inicial <= 0:
        raise ErrorValidacion("El capital financiado inicial debe ser mayor a 0.")

    importe_pendiente_raw = datos.get("importe_pendiente_centimos")
    if importe_pendiente_raw is not None:
        importe_pendiente = int(importe_pendiente_raw)
    else:
        importe_pendiente = importe_inicial

    if importe_pendiente < 0:
        raise ErrorValidacion("El capital pendiente no puede ser negativo.")
    if importe_pendiente > importe_inicial:
        raise ErrorValidacion(
            "El capital pendiente no puede superar el capital inicial financiado."
        )

    cuota_mensual_raw = datos.get("cuota_mensual_centimos")
    cuota_mensual = int(cuota_mensual_raw) if cuota_mensual_raw is not None else None
    if cuota_mensual is not None and cuota_mensual < 0:
        raise ErrorValidacion("La cuota mensual no puede ser negativa.")

    cuenta_id = datos.get("cuenta_id")
    if cuenta_id:
        cuenta = session.scalar(
            select(Cuenta).where(Cuenta.id == int(cuenta_id), Cuenta.hogar_id == hogar_id)
        )
        if not cuenta:
            raise ErrorNoEncontrado("La cuenta bancaria vinculada especificada no existe.")
        cuenta_id = cuenta.id
    else:
        cuenta_id = None

    fecha_inicio = _parsear_fecha(datos.get("fecha_inicio"))
    fecha_fin = _parsear_fecha_opcional(datos.get("fecha_fin"))

    prestamo = Prestamo(
        hogar_id=hogar_id,
        nombre=nombre,
        entidad=entidad,
        tipo=tipo,
        importe_inicial_centimos=importe_inicial,
        importe_pendiente_centimos=importe_pendiente,
        cuota_mensual_centimos=cuota_mensual,
        cuenta_id=cuenta_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        notas=(datos.get("notas") or "").strip() or None,
        activo=datos.get("activo", True),
    )
    session.add(prestamo)
    session.flush()
    return prestamo


def listar_prestamos(
    session: Session, hogar_id: str, incluir_inactivos: bool = False
) -> list[Prestamo]:
    """Devuelve la lista de préstamos del hogar ordenados por fecha de creación desc."""
    stmt = select(Prestamo).where(Prestamo.hogar_id == hogar_id)
    if not incluir_inactivos:
        stmt = stmt.where(Prestamo.activo.is_(True))
    stmt = stmt.order_by(Prestamo.creado_en.desc())
    return list(session.scalars(stmt).all())


def obtener_prestamo(session: Session, hogar_id: str, prestamo_id: int) -> Prestamo:
    """Devuelve un préstamo específico o lanza ErrorNoEncontrado."""
    prestamo = session.scalar(
        select(Prestamo).where(Prestamo.id == prestamo_id, Prestamo.hogar_id == hogar_id)
    )
    if not prestamo:
        raise ErrorNoEncontrado(f"Préstamo #{prestamo_id} no encontrado.")
    return prestamo


def actualizar_prestamo(
    session: Session, hogar_id: str, prestamo_id: int, datos: dict[str, Any]
) -> Prestamo:
    """Actualiza datos descriptivos o estado de un préstamo."""
    prestamo = obtener_prestamo(session, hogar_id, prestamo_id)

    if "nombre" in datos:
        nombre = str(datos["nombre"]).strip()
        if not nombre:
            raise ErrorValidacion("El nombre no puede estar vacío.")
        prestamo.nombre = nombre

    if "entidad" in datos:
        entidad = str(datos["entidad"]).strip()
        if not entidad:
            raise ErrorValidacion("La entidad no puede estar vacía.")
        prestamo.entidad = entidad

    if "tipo" in datos:
        tipo = str(datos["tipo"]).strip().lower()
        if tipo in TIPOS_PRESTAMO_VALIDOS:
            prestamo.tipo = tipo

    if "importe_pendiente_centimos" in datos:
        pendiente = int(datos["importe_pendiente_centimos"])
        if pendiente < 0:
            raise ErrorValidacion("El saldo pendiente no puede ser negativo.")
        if pendiente > prestamo.importe_inicial_centimos:
            raise ErrorValidacion("El saldo pendiente no puede ser superior al capital inicial.")
        prestamo.importe_pendiente_centimos = pendiente
        if pendiente == 0:
            prestamo.activo = False

    if "cuota_mensual_centimos" in datos:
        cuota = datos["cuota_mensual_centimos"]
        prestamo.cuota_mensual_centimos = int(cuota) if cuota is not None else None

    if "cuenta_id" in datos:
        cid = datos["cuenta_id"]
        if cid:
            cuenta = session.scalar(
                select(Cuenta).where(Cuenta.id == int(cid), Cuenta.hogar_id == hogar_id)
            )
            if not cuenta:
                raise ErrorNoEncontrado("La cuenta especificada no existe.")
            prestamo.cuenta_id = cuenta.id
        else:
            prestamo.cuenta_id = None

    if "fecha_inicio" in datos:
        prestamo.fecha_inicio = _parsear_fecha(datos["fecha_inicio"])

    if "fecha_fin" in datos:
        prestamo.fecha_fin = _parsear_fecha_opcional(datos["fecha_fin"])

    if "notas" in datos:
        prestamo.notas = str(datos["notas"]).strip() or None

    if "activo" in datos:
        prestamo.activo = bool(datos["activo"])

    session.flush()
    return prestamo


def registrar_pago_prestamo(
    session: Session,
    hogar_id: str,
    prestamo_id: int,
    importe_centimos: int,
    cuenta_id: int | None = None,
    concepto: str | None = None,
    fecha: date | None = None,
) -> Prestamo:
    """Registra una cuota o amortización parcial del préstamo reduciendo su deuda.

    Si se indica cuenta_id, descuenta el importe de la cuenta creando un movimiento contable.
    """
    prestamo = obtener_prestamo(session, hogar_id, prestamo_id)

    if importe_centimos <= 0:
        raise ErrorValidacion("El importe pagado o amortizado debe ser mayor a 0.")

    if importe_centimos > prestamo.importe_pendiente_centimos:
        imp_eur = importe_centimos / 100
        pend_eur = prestamo.importe_pendiente_centimos / 100
        raise ErrorValidacion(
            f"El importe a pagar ({imp_eur:.2f} €) supera la deuda pendiente ({pend_eur:.2f} €)."
        )

    # Reducimos capital pendiente
    prestamo.importe_pendiente_centimos -= importe_centimos

    if prestamo.importe_pendiente_centimos == 0:
        prestamo.activo = False  # Deuda completamente saldada

    # Si se vinculó una cuenta para el pago, creamos el movimiento contable negativo
    if cuenta_id:
        cuenta = session.scalar(
            select(Cuenta).where(Cuenta.id == cuenta_id, Cuenta.hogar_id == hogar_id)
        )
        if not cuenta:
            raise ErrorNoEncontrado("La cuenta de cargo especificada no existe.")

        fecha_mov = fecha or date.today()
        desc = concepto or f"Pago préstamo {prestamo.nombre} ({prestamo.entidad})"
        mov = Movimiento(
            hogar_id=int(hogar_id),
            cuenta_id=cuenta.id,
            fecha=fecha_mov,
            descripcion=desc,
            importe_centimos=-importe_centimos,  # Cargo negativo en la cuenta
        )
        session.add(mov)

    session.flush()
    return prestamo


def eliminar_prestamo(session: Session, hogar_id: str, prestamo_id: int) -> None:
    """Elimina definitivamente un registro de préstamo."""
    prestamo = obtener_prestamo(session, hogar_id, prestamo_id)
    session.delete(prestamo)
    session.flush()


def resumen_prestamos(session: Session, hogar_id: str) -> dict[str, Any]:
    """Calcula las métricas consolidadas del pasivo y deudas del hogar."""
    prestamos_activos = listar_prestamos(session, hogar_id, incluir_inactivos=False)

    total_deuda_centimos = sum(p.importe_pendiente_centimos for p in prestamos_activos)
    total_financiado_centimos = sum(p.importe_inicial_centimos for p in prestamos_activos)
    total_amortizado_centimos = max(0, total_financiado_centimos - total_deuda_centimos)
    cuota_mensual_total_centimos = sum(
        p.cuota_mensual_centimos or 0 for p in prestamos_activos if p.cuota_mensual_centimos
    )

    progreso_global = 0.0
    if total_financiado_centimos > 0:
        progreso_global = round((total_amortizado_centimos / total_financiado_centimos) * 100, 2)

    return {
        "total_prestamos": len(prestamos_activos),
        "total_deuda_pendiente_centimos": total_deuda_centimos,
        "total_financiado_centimos": total_financiado_centimos,
        "total_amortizado_centimos": total_amortizado_centimos,
        "progreso_global_pct": progreso_global,
        "cuota_mensual_total_centimos": cuota_mensual_total_centimos,
    }
