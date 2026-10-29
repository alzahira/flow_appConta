"""Servicio de movimientos: alta, edición, borrado lógico y saldo derivado.

Reglas (data-model.md + contrato REST):
- Los importes entran como string de euros ("−30.50") y se persisten como
  enteros en céntimos (research.md D-01).
- `importe_centimos != 0` (data-model).
- Toda creación/edición/borrado lógico queda registrado en
  `AuditoriaMovimiento` (FR-013): `creado | editado | eliminado`.
- El saldo de una cuenta NUNCA se persiste: saldo_inicial + Σ importes
  de movimientos no eliminados (Principio II).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app_conta.models.auditoria import AuditoriaMovimiento
from app_conta.models.bote import Bote
from app_conta.models.categoria import Categoria
from app_conta.models.cuenta import Cuenta
from app_conta.models.movimiento import Movimiento
from app_conta.services.dinero import (
    ErrorImporte,
    euros_a_centimos,
    validar_importe_no_cero,
)
from app_conta.services.errors import (
    ErrorNoEncontrado,
    ErrorValidacion,
)

DEFAULT_LIMIT = 100
MAX_LIMIT = 500


def _convertir_importe(importe: str | int | float) -> int:
    """String de euros → céntimos enteros; cero e inválidos → ErrorValidacion."""
    try:
        centimos = euros_a_centimos(importe)
    except ErrorImporte as exc:
        raise ErrorValidacion(str(exc)) from exc
    try:
        return validar_importe_no_cero(centimos)
    except ErrorImporte as exc:
        raise ErrorValidacion(str(exc)) from exc


def _parsear_fecha(valor: str | date) -> date:
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor))
    except ValueError as exc:
        raise ErrorValidacion(f"Fecha no válida: {valor!r}") from exc


def obtener_movimiento(db: Session, movimiento_id: int) -> Movimiento:
    """Devuelve el movimiento activo o lanza 404 (los borrados lógicos no cuentan)."""
    mov = db.get(Movimiento, movimiento_id)
    if mov is None or mov.eliminado:
        raise ErrorNoEncontrado(f"Movimiento {movimiento_id} no encontrado")
    return mov


def crear_movimiento(
    db: Session,
    *,
    fecha: str | date,
    importe: str | int | float,
    descripcion: str,
    cuenta_id: int,
    categoria_id: int | None = None,
    bote_id: int | None = None,
    origen: str = "manual",
    marcar_revisar: bool = False,
    motivo_revision: str | None = None,
) -> Movimiento:
    """Alta validada: cuenta existente, importe ≠ 0 y referencias correctas."""
    if not descripcion or not str(descripcion).strip():
        raise ErrorValidacion("La descripción es obligatoria")

    cuenta = db.get(Cuenta, cuenta_id)
    if cuenta is None:
        raise ErrorNoEncontrado(f"Cuenta {cuenta_id} no encontrada")

    centimos = _convertir_importe(importe)

    if categoria_id is not None and db.get(Categoria, categoria_id) is None:
        raise ErrorNoEncontrado(f"Categoría {categoria_id} no encontrada")
    if bote_id is not None and db.get(Bote, bote_id) is None:
        raise ErrorNoEncontrado(f"Bote {bote_id} no encontrado")

    mov = Movimiento(
        hogar_id=cuenta.hogar_id,
        cuenta_id=cuenta.id,
        fecha=_parsear_fecha(fecha),
        importe_centimos=centimos,
        descripcion=str(descripcion),
        categoria_id=categoria_id,
        bote_id=bote_id,
        origen=origen,
        marcar_revisar=marcar_revisar,
        motivo_revision=motivo_revision,
    )
    db.add(mov)
    db.flush()  # asigna id para poder registrar la auditoría
    db.add(AuditoriaMovimiento(movimiento_id=mov.id, accion="creado", cambios={}))
    return mov


_CAMPOS_EDITABLES = ("fecha", "importe", "descripcion", "categoria_id", "bote_id")


def editar_movimiento(db: Session, movimiento_id: int, cambios_peticion: dict) -> Movimiento:
    """Edita campos no derivados y registra auditoría con anterior/nuevo.

    `cambios` de la auditoría: `{ "importe": { "anterior": -3050, "nuevo": -4000 } }`
    (céntimos enteros). Solo se registran los campos realmente modificados.
    """
    mov = obtener_movimiento(db, movimiento_id)

    cambios: dict = {}
    for campo in _CAMPOS_EDITABLES:
        if campo not in cambios_peticion:
            continue
        nuevo = cambios_peticion[campo]
        if campo == "importe":
            nuevo_c = _convertir_importe(nuevo)
            if nuevo_c != mov.importe_centimos:
                cambios[campo] = {"anterior": mov.importe_centimos, "nuevo": nuevo_c}
                mov.importe_centimos = nuevo_c
        elif campo == "fecha":
            nuevo_f = _parsear_fecha(nuevo)
            if nuevo_f != mov.fecha:
                cambios[campo] = {"anterior": mov.fecha.isoformat(), "nuevo": nuevo_f.isoformat()}
                mov.fecha = nuevo_f
        elif campo == "descripcion":
            if nuevo is None or not str(nuevo).strip():
                raise ErrorValidacion("La descripción es obligatoria")
            if str(nuevo) != mov.descripcion:
                cambios[campo] = {"anterior": mov.descripcion, "nuevo": str(nuevo)}
                mov.descripcion = str(nuevo)
        elif campo == "categoria_id":
            if nuevo != mov.categoria_id:
                if nuevo is not None and db.get(Categoria, nuevo) is None:
                    raise ErrorNoEncontrado(f"Categoría {nuevo} no encontrada")
                cambios[campo] = {"anterior": mov.categoria_id, "nuevo": nuevo}
                mov.categoria_id = nuevo
        elif campo == "bote_id":
            if nuevo != mov.bote_id:
                # La reasignación de bote es la tarea FR-008 (PATCH /movimientos/{id}/bote,
                # US3): por PATCH genérico se registra como editado.
                if nuevo is not None and db.get(Bote, nuevo) is None:
                    raise ErrorNoEncontrado(f"Bote {nuevo} no encontrado")
                cambios[campo] = {"anterior": mov.bote_id, "nuevo": nuevo}
                mov.bote_id = nuevo

    if cambios:
        db.add(AuditoriaMovimiento(movimiento_id=mov.id, accion="editado", cambios=cambios))
    return mov


def eliminar_movimiento(db: Session, movimiento_id: int) -> None:
    """Borrado lógico + auditoría `eliminado` (data-model)."""
    mov = obtener_movimiento(db, movimiento_id)
    mov.eliminado = True
    db.add(AuditoriaMovimiento(movimiento_id=mov.id, accion="eliminado", cambios={}))


def saldo_cuenta(db: Session, cuenta: Cuenta) -> int:
    """Saldo derivado en céntimos: inicial + Σ importes vivos (Principio II)."""
    suma = db.scalar(
        select(func.coalesce(func.sum(Movimiento.importe_centimos), 0)).where(
            Movimiento.cuenta_id == cuenta.id, Movimiento.eliminado.is_(False)
        )
    )
    return int(cuenta.saldo_inicial_centimos) + int(suma or 0)


def listar_movimientos(
    db: Session,
    *,
    desde: str | None = None,
    hasta: str | None = None,
    cuenta: int | None = None,
    bote: int | None = None,
    categoria: int | None = None,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
) -> tuple[list[Movimiento], int]:
    """Lista filtrable de movimientos vivos, ordenada por fecha asc + id.

    Devuelve `(movimientos, total)` donde `total` es el recuento del filtro.
    """
    stmt = select(Movimiento).where(Movimiento.eliminado.is_(False))
    if desde is not None:
        stmt = stmt.where(Movimiento.fecha >= _parsear_fecha(desde))
    if hasta is not None:
        stmt = stmt.where(Movimiento.fecha <= _parsear_fecha(hasta))
    if cuenta is not None:
        stmt = stmt.where(Movimiento.cuenta_id == cuenta)
    if bote is not None:
        stmt = stmt.where(Movimiento.bote_id == bote)
    if categoria is not None:
        stmt = stmt.where(Movimiento.categoria_id == categoria)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    filas: list = db.scalars(
        stmt.order_by(Movimiento.fecha.asc(), Movimiento.id.asc())
        .limit(min(max(limit, 1), MAX_LIMIT))
        .offset(max(offset, 0))
    ).all()
    return list(filas), int(total)


def registrar_reasignacion_bote(
    db: Session, movimiento_id: int, bote_anterior: int | None, bote_nuevo: int | None
) -> None:
    """Auditoría `reasignado` (FR-008) cuando el bote de un movimiento cambia."""
    db.add(
        AuditoriaMovimiento(
            movimiento_id=movimiento_id,
            accion="reasignado",
            cambios={"bote_id": {"anterior": bote_anterior, "nuevo": bote_nuevo}},
        )
    )
