"""Servicio de gestión de carteras de inversión, activos financieros y rentabilidad."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.inversion import Inversion
from app_conta.models.movimiento import Movimiento
from app_conta.services.cuentas import obtener_cuenta
from app_conta.services.errors import ErrorNoEncontrado, ErrorValidacion
from app_conta.services.hogar import exigir_hogar

TIPOS_ACTIVOS_VALIDOS = {
    "fondos",
    "acciones_etfs",
    "renta_fija",
    "pensiones",
    "cripto",
    "inmobiliario",
    "otros",
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


def crear_inversion(session: Session, hogar_id: str, datos: dict[str, Any]) -> Inversion:
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        raise ErrorValidacion("El nombre de la inversión es obligatorio.")

    entidad = (datos.get("entidad") or "").strip()
    if not entidad:
        raise ErrorValidacion("La entidad o broker es obligatorio.")

    fecha_inicio = _parsear_fecha(datos.get("fecha_inicio"))

    tipo_activo = (datos.get("tipo_activo") or "fondos").strip().lower()
    if tipo_activo not in TIPOS_ACTIVOS_VALIDOS:
        tipo_activo = "otros"

    capital_aportado = int(datos.get("capital_aportado_centimos") or 0)
    if capital_aportado < 0:
        raise ErrorValidacion("El capital aportado no puede ser negativo.")

    valor_actual_raw = datos.get("valor_actual_centimos")
    valor_actual = int(valor_actual_raw) if valor_actual_raw is not None else capital_aportado
    if valor_actual < 0:
        raise ErrorValidacion("El valor actual no puede ser negativo.")

    cuenta_id = datos.get("cuenta_id")
    if cuenta_id is not None:
        obtener_cuenta(session, int(cuenta_id), hogar_id)
    notas = (datos.get("notas") or "").strip() or None

    inversion = Inversion(
        hogar_id=str(hogar_id),
        nombre=nombre,
        entidad=entidad,
        tipo_activo=tipo_activo,
        capital_aportado_centimos=capital_aportado,
        valor_actual_centimos=valor_actual,
        cuenta_id=cuenta_id,
        fecha_inicio=fecha_inicio,
        notas=notas,
        activo=True,
    )
    session.add(inversion)

    # Si se pide crear el movimiento contable inicial descontando de una cuenta
    if datos.get("crear_movimiento_inicial") and cuenta_id and capital_aportado > 0:
        mov = Movimiento(
            hogar_id=str(hogar_id),
            cuenta_id=cuenta_id,
            importe_centimos=-capital_aportado,
            fecha=fecha_inicio,
            descripcion=f"Inversión inicial: {nombre}",
            origen="manual",
        )
        session.add(mov)

    session.commit()
    session.refresh(inversion)
    return inversion


def listar_inversiones(
    session: Session, hogar_id: str, solo_activas: bool = True
) -> list[Inversion]:
    stmt = select(Inversion).where(Inversion.hogar_id == str(hogar_id))
    if solo_activas:
        stmt = stmt.where(Inversion.activo.is_(True))
    stmt = stmt.order_by(Inversion.valor_actual_centimos.desc(), Inversion.id.desc())
    return list(session.scalars(stmt))


def obtener_inversion(
    session: Session, inversion_id: int, hogar_id: int | str | None = None
) -> Inversion:
    inv = session.get(Inversion, inversion_id)
    if not inv or not inv.activo:
        raise ErrorNoEncontrado(f"Inversión con id {inversion_id} no encontrada.")
    exigir_hogar(inv, hogar_id, f"Inversión {inversion_id}")
    return inv


def actualizar_inversion(
    session: Session,
    inversion_id: int,
    datos: dict[str, Any],
    hogar_id: int | str | None = None,
) -> Inversion:
    inv = obtener_inversion(session, inversion_id, hogar_id)

    if "nombre" in datos:
        nombre = (datos["nombre"] or "").strip()
        if not nombre:
            raise ErrorValidacion("El nombre no puede estar vacío.")
        inv.nombre = nombre

    if "entidad" in datos:
        entidad = (datos["entidad"] or "").strip()
        if not entidad:
            raise ErrorValidacion("La entidad no puede estar vacía.")
        inv.entidad = entidad

    if "tipo_activo" in datos:
        tipo = (datos["tipo_activo"] or "").strip().lower()
        if tipo in TIPOS_ACTIVOS_VALIDOS:
            inv.tipo_activo = tipo

    if "fecha_inicio" in datos and datos["fecha_inicio"]:
        inv.fecha_inicio = _parsear_fecha(datos["fecha_inicio"])

    if "notas" in datos:
        inv.notas = (datos["notas"] or "").strip() or None

    if "cuenta_id" in datos:
        if datos["cuenta_id"] is not None:
            obtener_cuenta(session, int(datos["cuenta_id"]), inv.hogar_id)
        inv.cuenta_id = datos["cuenta_id"]

    session.commit()
    session.refresh(inv)
    return inv


def actualizar_valoracion(
    session: Session,
    inversion_id: int,
    nuevo_valor_centimos: int,
    hogar_id: int | str | None = None,
) -> Inversion:
    if nuevo_valor_centimos < 0:
        raise ErrorValidacion("El nuevo valor de mercado no puede ser negativo.")

    inv = obtener_inversion(session, inversion_id, hogar_id)
    inv.valor_actual_centimos = nuevo_valor_centimos
    session.commit()
    session.refresh(inv)
    return inv


def registrar_aportacion(
    session: Session,
    inversion_id: int,
    importe_centimos: int,
    cuenta_origen_id: int | None = None,
    fecha: Any = None,
    hogar_id: int | str | None = None,
) -> Inversion:
    if importe_centimos <= 0:
        raise ErrorValidacion("El importe de la aportación debe ser estrictamente positivo.")

    inv = obtener_inversion(session, inversion_id, hogar_id)
    inv.capital_aportado_centimos += importe_centimos
    inv.valor_actual_centimos += importe_centimos

    if cuenta_origen_id:
        obtener_cuenta(session, int(cuenta_origen_id), inv.hogar_id)
        f_obj = _parsear_fecha(fecha) if fecha else date.today()
        mov = Movimiento(
            hogar_id=inv.hogar_id,
            cuenta_id=cuenta_origen_id,
            importe_centimos=-importe_centimos,
            fecha=f_obj,
            descripcion=f"Aportación inversión: {inv.nombre}",
            origen="manual",
        )
        session.add(mov)

    session.commit()
    session.refresh(inv)
    return inv


def registrar_reembolso(
    session: Session,
    inversion_id: int,
    importe_centimos: int,
    cuenta_destino_id: int | None = None,
    fecha: Any = None,
    hogar_id: int | str | None = None,
) -> Inversion:
    if importe_centimos <= 0:
        raise ErrorValidacion("El importe del reembolso debe ser estrictamente positivo.")

    inv = obtener_inversion(session, inversion_id, hogar_id)
    if importe_centimos > inv.valor_actual_centimos:
        raise ErrorValidacion(
            f"El importe a reembolsar supera el valor actual de la inversión "
            f"({inv.valor_actual_centimos / 100:.2f} €)."
        )

    # Reducimos valor actual y proporcionalmente el capital aportado
    inv.valor_actual_centimos -= importe_centimos
    if inv.capital_aportado_centimos > 0:
        inv.capital_aportado_centimos = max(0, inv.capital_aportado_centimos - importe_centimos)

    if cuenta_destino_id:
        obtener_cuenta(session, int(cuenta_destino_id), inv.hogar_id)
        f_obj = _parsear_fecha(fecha) if fecha else date.today()
        mov = Movimiento(
            hogar_id=inv.hogar_id,
            cuenta_id=cuenta_destino_id,
            importe_centimos=importe_centimos,
            fecha=f_obj,
            descripcion=f"Reembolso inversión: {inv.nombre}",
            origen="manual",
        )
        session.add(mov)

    session.commit()
    session.refresh(inv)
    return inv


def eliminar_inversion(
    session: Session, inversion_id: int, hogar_id: int | str | None = None
) -> None:
    inv = obtener_inversion(session, inversion_id, hogar_id)
    inv.activo = False
    session.commit()


def resumen_inversiones(session: Session, hogar_id: str) -> dict[str, Any]:
    inversiones = listar_inversiones(session, hogar_id, solo_activas=True)

    total_capital = sum(inv.capital_aportado_centimos for inv in inversiones)
    total_valor = sum(inv.valor_actual_centimos for inv in inversiones)
    total_plusvalia = total_valor - total_capital

    rentabilidad_global = (
        round((total_plusvalia / total_capital) * 100, 2) if total_capital > 0 else 0.0
    )

    # Distribución por tipo de activo
    por_tipo: dict[str, int] = {}
    for inv in inversiones:
        por_tipo[inv.tipo_activo] = por_tipo.get(inv.tipo_activo, 0) + inv.valor_actual_centimos

    distribucion_tipo = []
    for tipo, val in sorted(por_tipo.items(), key=lambda x: x[1], reverse=True):
        pct = round((val / total_valor) * 100, 1) if total_valor > 0 else 0.0
        distribucion_tipo.append({"tipo": tipo, "valor_centimos": val, "pct": pct})

    # Distribución por entidad / plataforma
    por_entidad: dict[str, int] = {}
    for inv in inversiones:
        por_entidad[inv.entidad] = por_entidad.get(inv.entidad, 0) + inv.valor_actual_centimos

    distribucion_entidad = []
    for entidad, val in sorted(por_entidad.items(), key=lambda x: x[1], reverse=True):
        pct = round((val / total_valor) * 100, 1) if total_valor > 0 else 0.0
        distribucion_entidad.append({"entidad": entidad, "valor_centimos": val, "pct": pct})

    return {
        "total_capital_aportado_centimos": total_capital,
        "total_valor_actual_centimos": total_valor,
        "total_plusvalia_centimos": total_plusvalia,
        "rentabilidad_global_pct": rentabilidad_global,
        "total_posiciones": len(inversiones),
        "distribucion_tipo": distribucion_tipo,
        "distribucion_entidad": distribucion_entidad,
        "inversiones": inversiones,
    }
