"""Servicio de categorías (US4, T041): CRUD con borrado protegido.

Reglas (data-model.md + contracts/rest-api.md):
- Nombre único por hogar (también entre archivadas, como la restricción de BD).
- Total por categoría = Σ importes de movimientos VIVOS en el periodo
  opcional [desde, hasta] (Principio II: derivado, nunca persistido).
- Borrado protegido (FR-005): con movimientos en uso → ErrorConflicto con el
  recuento; con confirmación → archivado lógico y liberación de los
  movimientos (quedan sin categoría), igual que `archivar_bote`.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app_conta.models.categoria import Categoria
from app_conta.models.movimiento import Movimiento
from app_conta.services.errors import (
    ErrorConflicto,
    ErrorNoEncontrado,
    ErrorValidacion,
)
from app_conta.services.hogar import exigir_hogar
from app_conta.services.movimientos import _parsear_fecha

_LONGITUD_MAXIMA_COLOR = 20


def _validar_nombre(nombre: str) -> str:
    if not nombre or not str(nombre).strip():
        raise ErrorValidacion("El nombre de la categoría es obligatorio")
    return str(nombre).strip()


def _validar_color(color: str | None) -> str | None:
    if color is None:
        return None
    color_limpio = str(color).strip()
    if not color_limpio:
        return None
    if len(color_limpio) > _LONGITUD_MAXIMA_COLOR:
        raise ErrorValidacion(f"El color no puede exceder {_LONGITUD_MAXIMA_COLOR} caracteres")
    return color_limpio


def _checar_nombre_unico(
    db: Session,
    nombre: str,
    categoria_id: int | None = None,
    hogar_id: int | str | None = None,
) -> None:
    stmt = select(Categoria).where(Categoria.nombre == nombre)
    if hogar_id is not None:
        stmt = stmt.where(
            (Categoria.hogar_id == str(hogar_id)) | (Categoria.hogar_id == hogar_id)
        )
    if categoria_id is not None:
        stmt = stmt.where(Categoria.id != categoria_id)
    if db.scalars(stmt).first() is not None:
        raise ErrorConflicto(f"Ya existe una categoría llamada {nombre!r}")


def crear_categoria(
    db: Session,
    *,
    nombre: str,
    hogar_id: str,
    color: str | None = None,
) -> Categoria:
    """Alta validada: nombre obligatorio y único por hogar, color opcional."""
    nombre = _validar_nombre(nombre)
    _checar_nombre_unico(db, nombre, hogar_id=hogar_id)

    categoria = Categoria(
        hogar_id=hogar_id,
        nombre=nombre,
        color=_validar_color(color),
    )
    db.add(categoria)
    db.flush()
    return categoria


def obtener_categoria(
    db: Session, categoria_id: int, hogar_id: int | str | None = None
) -> Categoria:
    """Devuelve la categoría activa o lanza 404 (las archivadas no cuentan)."""
    categoria = db.get(Categoria, categoria_id)
    if categoria is None or categoria.archivada:
        raise ErrorNoEncontrado(f"Categoría {categoria_id} no encontrada")
    exigir_hogar(categoria, hogar_id, f"Categoría {categoria_id}")
    return categoria


def listar_categorias_activas(
    db: Session, hogar_id: int | str | None = None
) -> list[Categoria]:
    """Categorías no archivadas, ordenadas por nombre."""
    stmt = select(Categoria).where(Categoria.archivada.is_(False))
    if hogar_id is not None:
        stmt = stmt.where((Categoria.hogar_id == str(hogar_id)) | (Categoria.hogar_id == hogar_id))
    activas = list(db.scalars(stmt).all())
    return sorted(activas, key=lambda c: c.nombre)


def editar_categoria(
    db: Session,
    categoria_id: int,
    cambios_peticion: dict,
    hogar_id: int | str | None = None,
) -> Categoria:
    """Edita nombre y/o color; ignora campos derivados como `total`."""
    categoria = obtener_categoria(db, categoria_id, hogar_id)

    if "nombre" in cambios_peticion:
        nombre = _validar_nombre(cambios_peticion["nombre"])
        if nombre != categoria.nombre:
            _checar_nombre_unico(db, nombre, categoria_id, categoria.hogar_id)
            categoria.nombre = nombre
    if "color" in cambios_peticion:
        categoria.color = _validar_color(cambios_peticion["color"])
    # `total` y `movimientos_asignados` (derivados) NO son editables: se ignoran.
    return categoria


def movimientos_asignados_activos(db: Session, categoria: Categoria) -> list[Movimiento]:
    """Movimientos vivos con esta categoría (para DELETE 409 y archivado)."""
    return list(
        db.scalars(
            select(Movimiento).where(
                Movimiento.categoria_id == categoria.id,
                Movimiento.eliminado.is_(False),
            )
        ).all()
    )


def archivar_categoria(
    db: Session,
    categoria_id: int,
    *,
    confirmar: bool = False,
    hogar_id: int | str | None = None,
) -> None:
    """Borrado protegido (FR-005).

    En uso y sin `confirmar` → ErrorConflicto con el recuento de movimientos.
    Con confirmación → archivado lógico + liberación de movimientos (quedan
    sin categoría).
    """
    categoria = obtener_categoria(db, categoria_id, hogar_id)

    movimientos = movimientos_asignados_activos(db, categoria)
    if movimientos and not confirmar:
        raise ErrorConflicto(
            f"La categoría {categoria.nombre!r} tiene {len(movimientos)} "
            "movimiento(s) asignado(s); repite la operación con confirmar=true"
        )

    for mov in movimientos:
        mov.categoria_id = None
    categoria.archivada = True
    db.flush()


def _filtro_periodo(desde: str | date | None, hasta: str | date | None) -> list:
    condiciones = []
    if desde is not None:
        condiciones.append(Movimiento.fecha >= _parsear_fecha(desde))
    if hasta is not None:
        condiciones.append(Movimiento.fecha <= _parsear_fecha(hasta))
    return condiciones


def total_categoria(
    db: Session,
    categoria_id: int,
    *,
    desde: str | date | None = None,
    hasta: str | date | None = None,
) -> int:
    """Σ importes de movimientos vivos de esta categoría (céntimos)."""
    stmt = select(func.coalesce(func.sum(Movimiento.importe_centimos), 0)).where(
        Movimiento.categoria_id == categoria_id,
        Movimiento.eliminado.is_(False),
        *_filtro_periodo(desde, hasta),
    )
    return int(db.scalar(stmt) or 0)


def listar_categorias_con_totales(
    db: Session,
    *,
    hogar_id: int | str | None = None,
    desde: str | date | None = None,
    hasta: str | date | None = None,
) -> tuple[list[tuple[Categoria, int]], int]:
    """`[(categoría, total), …]` de activas ordenadas por nombre + `total` global.

    Categorías sin movimientos en el periodo → total 0 (nunca ausentes).
    """
    categorias = listar_categorias_activas(db, hogar_id=hogar_id)
    stmt = (
        select(
            Movimiento.categoria_id,
            func.coalesce(func.sum(Movimiento.importe_centimos), 0),
        )
        .where(
            Movimiento.eliminado.is_(False),
            Movimiento.categoria_id.is_not(None),
            *_filtro_periodo(desde, hasta),
        )
        .group_by(Movimiento.categoria_id)
    )
    totales_por_id = {fila[0]: int(fila[1]) for fila in db.execute(stmt).all()}

    pares = [(c, totales_por_id.get(c.id, 0)) for c in categorias]
    total = sum(t for _c, t in pares)
    return pares, total
