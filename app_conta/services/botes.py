"""Servicio de botes (US3, T034): CRUD, saldo derivado y reasignación.

Reglas (data-model.md + contracts/rest-api.md):
- saldo_bote = Σ importes de movimientos asignados (NUNCA persistido ni
  editable — Principio II).
- estado `conseguido` cuando `saldo >= objetivo` (data-model regla 5). Con
  objetivo negativo (presupuesto de gasto) el cuadre se lee en la misma
  dirección: agotado cuando `saldo <= objetivo`.
- Nombre único por hogar (invariante Bote; también entre archivados, igual que
  la restricción única de BD).
- Reasignar un movimiento (FR-008) es cambiar su `bote_id` con auditoría
  `reasignado`; los saldos de ambos botes se recalculan por derivación.
- Archivar (DELETE con confirmación) libera los movimientos → sin asignar.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app_conta.models.bote import Bote
from app_conta.models.movimiento import Movimiento
from app_conta.services.dinero import ErrorImporte, euros_a_centimos
from app_conta.services.errors import ErrorConflicto, ErrorNoEncontrado, ErrorValidacion
from app_conta.services.movimientos import (
    _parsear_fecha,
    registrar_reasignacion_bote,
)

TIPOS_BOTE = ("recurrente", "ahorro", "proyecto", "ajeno")

ESTADO_EN_CURSO = "en_curso"
ESTADO_CONSEGUIDO = "conseguido"


def _validar_nombre(nombre: str) -> str:
    if not nombre or not str(nombre).strip():
        raise ErrorValidacion("El nombre del bote es obligatorio")
    return str(nombre).strip()


def _validar_tipo(tipo: str) -> str:
    if tipo not in TIPOS_BOTE:
        raise ErrorValidacion(f"Tipo de bote no válido: {tipo!r}. Valores: {', '.join(TIPOS_BOTE)}")
    return tipo


def _validar_objetivo(objetivo: str | int | None) -> int | None:
    """String de euros (puede ser negativo = presupuesto de gasto) → céntimos."""
    if objetivo is None:
        return None
    try:
        return euros_a_centimos(objetivo)
    except ErrorImporte as exc:
        raise ErrorValidacion(str(exc)) from exc


def _checar_nombre_unico(db: Session, nombre: str, bote_id: int | None = None) -> None:
    stmt = select(Bote).where(Bote.nombre == nombre)
    if bote_id is not None:
        stmt = stmt.where(Bote.id != bote_id)
    if db.scalars(stmt).first() is not None:
        raise ErrorConflicto(f"Ya existe un bote llamado {nombre!r}")


def crear_bote(
    db: Session,
    *,
    nombre: str,
    tipo: str,
    hogar_id: int,
    objetivo: str | int | None = None,
    objetivo_fecha: str | None = None,
) -> Bote:
    nombre = _validar_nombre(nombre)
    _validar_tipo(tipo)
    _checar_nombre_unico(db, nombre)

    fecha = None
    if objetivo_fecha not in (None, ""):
        fecha = _parsear_fecha(objetivo_fecha)

    bote = Bote(
        hogar_id=hogar_id,
        nombre=nombre,
        tipo=tipo,
        objetivo_centimos=_validar_objetivo(objetivo),
        objetivo_fecha=fecha,
    )
    db.add(bote)
    db.flush()
    return bote


def obtener_bote(db: Session, bote_id: int) -> Bote:
    bote = db.get(Bote, bote_id)
    if bote is None or bote.archivado:
        raise ErrorNoEncontrado(f"Bote {bote_id} no encontrado")
    return bote


def saldo_bote(db: Session, bote: Bote) -> int:
    """Saldo derivado: Σ importes vivos asignados a este bote (Principio II)."""
    suma = db.scalar(
        select(func.coalesce(func.sum(Movimiento.importe_centimos), 0)).where(
            Movimiento.bote_id == bote.id,
            Movimiento.eliminado.is_(False),
        )
    )
    return int(suma or 0)


def estado_de_bote(bote: Bote, saldo: int) -> str:
    """`conseguido` cuando se alcanza el objetivo en su propia dirección.

    Ahorro (objetivo ≥ 0): acumulando aportaciones → `saldo >= objetivo`.
    Presupuesto (objetivo < 0): gastando hasta agotar → `saldo <= objetivo`.
    """
    objetivo = bote.objetivo_centimos
    if objetivo is None:
        return ESTADO_EN_CURSO
    if objetivo >= 0 and saldo >= objetivo:
        return ESTADO_CONSEGUIDO
    if objetivo < 0 and saldo <= objetivo:
        return ESTADO_CONSEGUIDO
    return ESTADO_EN_CURSO


def listar_botes_activos(db: Session) -> tuple[list[tuple[Bote, int]], int]:
    """`[(bote, saldo), …]` de botes activos ordenados por nombre + total."""
    activos = list(db.scalars(select(Bote).where(Bote.archivado.is_(False))).all())
    pares = [(b, saldo_bote(db, b)) for b in sorted(activos, key=lambda x: x.nombre)]
    total = sum(s for _b, s in pares)
    return pares, total


def editar_bote(db: Session, bote_id: int, cambios_peticion: dict) -> Bote:
    bote = obtener_bote(db, bote_id)

    if "nombre" in cambios_peticion:
        nombre = _validar_nombre(cambios_peticion["nombre"])
        if nombre != bote.nombre:
            _checar_nombre_unico(db, nombre, bote_id)
            bote.nombre = nombre
    if "tipo" in cambios_peticion:
        bote.tipo = _validar_tipo(cambios_peticion["tipo"])
    if "objetivo" in cambios_peticion:
        bote.objetivo_centimos = _validar_objetivo(cambios_peticion["objetivo"])
    if "objetivo_fecha" in cambios_peticion:
        valor = cambios_peticion["objetivo_fecha"]
        bote.objetivo_fecha = None if valor in (None, "") else _parsear_fecha(valor)
    # `saldo` (derivado) NO es editable: se ignora si llega (Principio II).
    return bote


def movimientos_asignados_activos(db: Session, bote: Bote) -> list[Movimiento]:
    """Movimientos vivos asignados a este bote (para DELETE 409 y archivado)."""
    return list(
        db.scalars(
            select(Movimiento).where(
                Movimiento.bote_id == bote.id,
                Movimiento.eliminado.is_(False),
            )
        ).all()
    )


def reasignar_bote(db: Session, movimiento_id: int, bote_id: int | None) -> Movimiento:
    """Cambia el bote de un movimiento (FR-008) con auditoría `reasignado`."""
    from app_conta.services.movimientos import obtener_movimiento

    mov = obtener_movimiento(db, movimiento_id)

    if mov.bote_id == bote_id:
        return mov  # no-op: mismo bote

    if bote_id is not None:
        obtener_bote(db, bote_id)  # valida existencia (404 si no)

    anterior = mov.bote_id
    mov.bote_id = bote_id
    registrar_reasignacion_bote(db, mov.id, anterior, bote_id)
    # autoflush=False: flush explícito para que las consultas de saldo la vean
    db.flush()
    return mov


def archivar_bote(db: Session, bote_id: int, confirmar: bool = False) -> None:
    """DELETE del contrato: archiva; los movimientos pasan a "sin asignar".

    Si hay movimientos asignados y no llega confirmación → ErrorConflicto (409).
    Cada liberación registra auditoría `reasignado` (anterior bote → None).
    """
    bote = obtener_bote(db, bote_id)
    asignados = movimientos_asignados_activos(db, bote)

    if asignados and not confirmar:
        raise ErrorConflicto(
            f"El bote {bote.nombre!r} tiene {len(asignados)} movimientos asignados. "
            "Confirma con ?confirmar=true: quedarán sin asignar."
        )

    for mov in asignados:
        anterior = mov.bote_id
        mov.bote_id = None
        registrar_reasignacion_bote(db, mov.id, anterior, None)

    bote.archivado = True
    db.flush()  # autoflush=False: consistencia en consultas posteriores
