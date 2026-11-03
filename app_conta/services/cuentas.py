"""Servicio de cuentas: alta, listado con saldo derivado, edición y borrado.

Reglas (data-model.md + contrato REST):
- Nombre único dentro del hogar (invariante Cuenta).
- El saldo nunca se persiste: se calcula con `services.movimientos.saldo_cuenta`
  (Principio II).
- No se puede eliminar una cuenta con movimientos activos salvo confirmación
  explícita del destino (US2 escenario 4, FR-002):
  `?confirmar_destino=archivar` o `eliminar_movimientos`.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.cuenta import Cuenta
from app_conta.models.movimiento import Movimiento
from app_conta.services.dinero import ErrorImporte, euros_a_centimos
from app_conta.services.errors import (
    ErrorConflicto,
    ErrorNoEncontrado,
    ErrorValidacion,
)
from app_conta.services.movimientos import (
    _convertir_importe,  # noqa: PLC2701  (uso interno deliberado, misma regla de importes)
    _parsear_fecha,
    eliminar_movimiento,
    saldo_cuenta,
)

TIPOS_CUENTA = ("banco", "tarjeta", "efectivo", "inversion")


def _validar_tipo(tipo: str) -> str:
    if tipo not in TIPOS_CUENTA:
        raise ErrorValidacion(
            f"Tipo de cuenta no válido: {tipo!r}. Valores: {', '.join(TIPOS_CUENTA)}"
        )
    return tipo


def _validar_nombre(nombre: str) -> str:
    if not nombre or not str(nombre).strip():
        raise ErrorValidacion("El nombre de la cuenta es obligatorio")
    return str(nombre).strip()


def _checar_nombre_unico(db: Session, nombre: str, cuenta_id: int | None = None) -> None:
    """Restricción DB uq_cuenta_nombre: se avisa con 409 ANTES del insert."""
    stmt = select(Cuenta).where(Cuenta.nombre == nombre)
    if cuenta_id is not None:
        stmt = stmt.where(Cuenta.id != cuenta_id)
    cuenta_existente = db.scalars(stmt).first()
    if cuenta_existente is not None:
        if cuenta_existente.archivada:
            tiene_movs = db.scalars(
                select(Movimiento).where(Movimiento.cuenta_id == cuenta_existente.id)
            ).first() is not None
            if not tiene_movs and cuenta_existente.saldo_inicial_centimos == 0:
                db.delete(cuenta_existente)
                db.flush()
            else:
                cuenta_existente.nombre = f"{cuenta_existente.nombre} (archivada #{cuenta_existente.id})"
                db.flush()
        else:
            raise ErrorConflicto(f"Ya existe una cuenta llamada {nombre!r}")


def crear_cuenta(
    db: Session,
    *,
    nombre: str,
    tipo: str,
    entidad: str | None = None,
    saldo_inicial: str | int | float = "0.00",
    fecha_apertura: str,
    hogar_id: int,
) -> Cuenta:
    """Alta validada. `saldo_inicial` es string de euros; puede ser negativo."""
    nombre = _validar_nombre(nombre)
    _validar_tipo(tipo)
    _checar_nombre_unico(db, nombre)

    try:
        centimos = euros_a_centimos(saldo_inicial)
    except ErrorImporte as exc:
        raise ErrorValidacion(str(exc)) from exc

    cuenta = Cuenta(
        hogar_id=hogar_id,
        nombre=nombre,
        tipo=tipo,
        entidad=entidad,
        saldo_inicial_centimos=centimos,
        fecha_apertura=_parsear_fecha(fecha_apertura),
    )
    db.add(cuenta)
    db.flush()  # asigna el id antes del commit del router
    return cuenta


def obtener_cuenta(db: Session, cuenta_id: int) -> Cuenta:
    cuenta = db.get(Cuenta, cuenta_id)
    if cuenta is None:
        raise ErrorNoEncontrado(f"Cuenta {cuenta_id} no encontrada")
    return cuenta


def obtener_hogar_unico(db: Session) -> int:
    """El MVP tiene exactamente un Hogar (seed al arranque de main.py)."""
    from app_conta.models.hogar import Hogar

    hogar = db.scalars(select(Hogar)).first()
    if hogar is None:
        raise ErrorNoEncontrado("Hogar no encontrado (seed no ejecutado)")
    return int(hogar.id)


def listar_cuentas_activas(
    db: Session, hogar_id: int | str | None = None
) -> tuple[list[tuple[Cuenta, int]], int]:
    """Devuelve `[(cuenta, saldo_centimos), …]` de cuentas NO archivadas y el total."""
    stmt = select(Cuenta).order_by(Cuenta.nombre)
    if hogar_id is not None:
        stmt = stmt.where((Cuenta.hogar_id == str(hogar_id)) | (Cuenta.hogar_id == hogar_id))
    activas = list(db.scalars(stmt).all())
    pares = [(c, saldo_cuenta(db, c)) for c in activas if not c.archivada]
    total = sum(s for _c, s in pares)
    return pares, total


def movimientos_activos(db: Session, cuenta: Cuenta) -> list[Movimiento]:
    """Movimientos vivos de la cuenta (para detalle y DELETE 409)."""
    return list(
        db.scalars(
            select(Movimiento)
            .where(Movimiento.cuenta_id == cuenta.id, Movimiento.eliminado.is_(False))
            .order_by(Movimiento.fecha.asc(), Movimiento.id.asc())
        ).all()
    )


def editar_cuenta(db: Session, cuenta_id: int, cambios_peticion: dict) -> Cuenta:
    """Edita campos no derivados. `saldo` (derivado) se ignora si llega."""
    cuenta = obtener_cuenta(db, cuenta_id)

    if "nombre" in cambios_peticion:
        nombre = _validar_nombre(cambios_peticion["nombre"])
        if nombre != cuenta.nombre:
            _checar_nombre_unico(db, nombre, cuenta_id)
            cuenta.nombre = nombre
    if "tipo" in cambios_peticion:
        cuenta.tipo = _validar_tipo(cambios_peticion["tipo"])
    if "entidad" in cambios_peticion:
        cuenta.entidad = cambios_peticion["entidad"]
    if "fecha_apertura" in cambios_peticion:
        cuenta.fecha_apertura = _parsear_fecha(cambios_peticion["fecha_apertura"])
    # `saldo_inicial` sí es un campo no derivado: editarla cambia el saldo calculado.
    if "saldo_inicial" in cambios_peticion:
        cuenta.saldo_inicial_centimos = _convertir_importe(cambios_peticion["saldo_inicial"])
    return cuenta


def eliminar_cuenta(db: Session, cuenta_id: int, confirmar_destino: str | None = None) -> None:
    """Borrado según US2-4: 409 con movimientos salvo destino confirmado.

    - Sin movimientos activos → se elimina la fila.
    - `archivar` → la cuenta queda marcada archivada (sus movimientos intactos).
    - `eliminar_movimientos` → borrado lógico de cada movimiento (con auditoría)
      y la cuenta se archiva (mantiene integridad FK del borrado lógico).
    """
    cuenta = obtener_cuenta(db, cuenta_id)
    activos = movimientos_activos(db, cuenta)

    if not activos:
        db.delete(cuenta)
        return

    if confirmar_destino is None:
        raise ErrorConflicto(
            f"La cuenta {cuenta.nombre!r} tiene {len(activos)} movimientos. "
            "Confirma el destino con ?confirmar_destino=archivar o "
            "eliminar_movimientos."
        )

    if confirmar_destino == "archivar":
        cuenta.archivada = True
        return

    if confirmar_destino == "eliminar_movimientos":
        for mov in activos:
            eliminar_movimiento(db, mov.id)
        cuenta.archivada = True
        return

    raise ErrorValidacion("confirmar_destino no válido: usa archivar o eliminar_movimientos")
