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
from app_conta.services.hogar import exigir_hogar

DEFAULT_LIMIT = 100
MAX_LIMIT = 500

REGLAS_AUTO_CATEGORIA: list[tuple[str, str, tuple[str, ...]]] = [
    (
        "Supermercado",
        "#10b981",
        (
            "supermercado",
            "mercadona",
            "lidl",
            "aldi",
            "supeco",
            "eroski",
            "fruteria",
            "panaderia",
            "pan",
            "dia ",
            "alcampo",
            "alimentacion",
            "comida",
        ),
    ),
    (
        "Gasolina",
        "#f59e0b",
        (
            "gasoil",
            "gasolina",
            "diesel",
            "repsol",
            "cepsa",
            "bp",
            "galp",
            "shell",
            "combustible",
            "gasolinera",
        ),
    ),
    (
        "Ocio",
        "#8b5cf6",
        (
            "ocio",
            "restaurante",
            "bar",
            "cafe",
            "cafes",
            "cafeteria",
            "cena",
            "copa",
            "cerveza",
            "churros",
            "mcdonalds",
            "burger",
            "kfc",
            "kebab",
            "cine",
        ),
    ),
    (
        "Hogar",
        "#3b82f6",
        (
            "casa",
            "hogar",
            "ikea",
            "leroy",
            "bricomart",
            "bricodepot",
            "ferreteria",
            "mueble",
            "pintura",
            "arreglo",
            "mejoras",
        ),
    ),
]


def auto_detectar_categoria_id(
    db: Session,
    descripcion: str,
    hogar_id: str,
    bote_id: int | None = None,
) -> int | None:
    desc_clean = (descripcion or "").lower().strip()

    nombre_cat_match: str | None = None
    color_cat_match = "#64748b"

    # 1. Comprobar palabras clave en la descripción
    for cat_nombre, cat_color, palabras in REGLAS_AUTO_CATEGORIA:
        for palabra in palabras:
            if palabra in desc_clean:
                nombre_cat_match = cat_nombre
                color_cat_match = cat_color
                break
        if nombre_cat_match:
            break

    # 2. Si no coincide por descripción, comprobar por nombre de bote
    if not nombre_cat_match and bote_id:
        bote = db.get(Bote, bote_id)
        if bote:
            exigir_hogar(bote, hogar_id, f"Bote {bote_id}")
            bote_nom = bote.nombre.lower()
            if "ocio" in bote_nom:
                nombre_cat_match = "Ocio"
                color_cat_match = "#8b5cf6"
            elif "mejoras" in bote_nom or "hogar" in bote_nom or "arreglos" in bote_nom:
                nombre_cat_match = "Hogar"
                color_cat_match = "#3b82f6"
            elif "gasolina" in bote_nom:
                nombre_cat_match = "Gasolina"
                color_cat_match = "#f59e0b"
            elif "mes" in bote_nom or "curso" in bote_nom:
                nombre_cat_match = "Supermercado"
                color_cat_match = "#10b981"

    if not nombre_cat_match:
        return None

    # Buscar categoría activa o crearla si no existe
    stmt = select(Categoria).where(
        Categoria.hogar_id == hogar_id,
        func.lower(Categoria.nombre) == nombre_cat_match.lower(),
        Categoria.archivada.is_(False),
    )
    cat = db.scalars(stmt).first()
    if cat is None:
        cat = Categoria(
            hogar_id=hogar_id,
            nombre=nombre_cat_match,
            color=color_cat_match,
        )
        db.add(cat)
        db.flush()
    return cat.id


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


def obtener_movimiento(
    db: Session, movimiento_id: int, hogar_id: int | str | None = None
) -> Movimiento:
    """Devuelve el movimiento activo o lanza 404 (los borrados lógicos no cuentan)."""
    mov = db.get(Movimiento, movimiento_id)
    if mov is None or mov.eliminado:
        raise ErrorNoEncontrado(f"Movimiento {movimiento_id} no encontrado")
    exigir_hogar(mov, hogar_id, f"Movimiento {movimiento_id}")
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
    hogar_id: int | str | None = None,
) -> Movimiento:
    """Alta validada: cuenta existente, importe ≠ 0 y referencias correctas."""
    if not descripcion or not str(descripcion).strip():
        raise ErrorValidacion("La descripción es obligatoria")

    cuenta = db.get(Cuenta, cuenta_id)
    if cuenta is None:
        raise ErrorNoEncontrado(f"Cuenta {cuenta_id} no encontrada")
    exigir_hogar(cuenta, hogar_id, f"Cuenta {cuenta_id}")

    centimos = _convertir_importe(importe)

    if categoria_id is None:
        categoria_id = auto_detectar_categoria_id(
            db, descripcion, cuenta.hogar_id, bote_id=bote_id
        )

    if categoria_id is not None:
        categoria = db.get(Categoria, categoria_id)
        if categoria is None:
            raise ErrorNoEncontrado(f"Categoría {categoria_id} no encontrada")
        exigir_hogar(categoria, cuenta.hogar_id, f"Categoría {categoria_id}")
    if bote_id is not None:
        bote = db.get(Bote, bote_id)
        if bote is None:
            raise ErrorNoEncontrado(f"Bote {bote_id} no encontrado")
        exigir_hogar(bote, cuenta.hogar_id, f"Bote {bote_id}")

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


def editar_movimiento(
    db: Session,
    movimiento_id: int,
    cambios_peticion: dict,
    hogar_id: int | str | None = None,
) -> Movimiento:
    """Edita campos no derivados y registra auditoría con anterior/nuevo.

    `cambios` de la auditoría: `{ "importe": { "anterior": -3050, "nuevo": -4000 } }`
    (céntimos enteros). Solo se registran los campos realmente modificados.
    """
    mov = obtener_movimiento(db, movimiento_id, hogar_id)

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
                if nuevo is not None:
                    categoria = db.get(Categoria, nuevo)
                    if categoria is None:
                        raise ErrorNoEncontrado(f"Categoría {nuevo} no encontrada")
                    exigir_hogar(categoria, mov.hogar_id, f"Categoría {nuevo}")
                cambios[campo] = {"anterior": mov.categoria_id, "nuevo": nuevo}
                mov.categoria_id = nuevo
        elif campo == "bote_id":
            if nuevo != mov.bote_id:
                # La reasignación de bote es la tarea FR-008 (PATCH /movimientos/{id}/bote,
                # US3): por PATCH genérico se registra como editado.
                if nuevo is not None:
                    bote = db.get(Bote, nuevo)
                    if bote is None:
                        raise ErrorNoEncontrado(f"Bote {nuevo} no encontrado")
                    exigir_hogar(bote, mov.hogar_id, f"Bote {nuevo}")
                cambios[campo] = {"anterior": mov.bote_id, "nuevo": nuevo}
                mov.bote_id = nuevo

    if cambios:
        db.add(AuditoriaMovimiento(movimiento_id=mov.id, accion="editado", cambios=cambios))
    return mov


def eliminar_movimiento(
    db: Session,
    movimiento_id: int,
    forzar: bool = False,
    hogar_id: int | str | None = None,
) -> None:
    """Borrado lógico + auditoría `eliminado` (data-model).

    Protección activa: los movimientos de saldo consolidado o base de botes
    requieren confirmación forzada explícita para evitar descuadres en el hogar.
    """
    mov = obtener_movimiento(db, movimiento_id, hogar_id)
    desc_baja = (mov.descripcion or "").lower().strip()
    if not forzar and ("saldo consolidado" in desc_baja or "saldo base" in desc_baja):
        raise ErrorValidacion(
            f"El movimiento {movimiento_id} es un saldo base/consolidado ('{mov.descripcion}'). "
            "Para evitar descuadres en la contabilidad, no se puede eliminar sin confirmación explícita (forzar=true)."
        )
    mov.eliminado = True
    db.add(AuditoriaMovimiento(movimiento_id=mov.id, accion="eliminado", cambios={}))


def listar_movimientos_eliminados(
    db: Session, hogar_id: int | str | None = None, limit: int = 30
) -> list[Movimiento]:
    """Papelera de seguridad: devuelve los últimos movimientos eliminados."""
    stmt = select(Movimiento).where(Movimiento.eliminado.is_(True))
    if hogar_id is not None:
        stmt = stmt.where(
            (Movimiento.hogar_id == str(hogar_id)) | (Movimiento.hogar_id == hogar_id)
        )
    return list(
        db.scalars(
            stmt.order_by(Movimiento.actualizado_en.desc(), Movimiento.id.desc()).limit(
                min(max(limit, 1), 100)
            )
        ).all()
    )


def restaurar_movimiento(
    db: Session, movimiento_id: int, hogar_id: int | str | None = None
) -> Movimiento:
    """Restaura un movimiento eliminado (soft-delete rollback) con auditoría."""
    mov = db.get(Movimiento, movimiento_id)
    if mov is None:
        raise ErrorNoEncontrado(f"Movimiento {movimiento_id} no encontrado")
    exigir_hogar(mov, hogar_id, f"Movimiento {movimiento_id}")
    mov.eliminado = False
    db.add(AuditoriaMovimiento(movimiento_id=mov.id, accion="restaurado", cambios={}))
    db.flush()
    return mov


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
    hogar_id: int | str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    cuenta: int | None = None,
    bote: int | None = None,
    categoria: int | None = None,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
    orden: str = "asc",
) -> tuple[list[Movimiento], int]:
    """Lista filtrable de movimientos vivos, ordenada por fecha + id.

    Devuelve `(movimientos, total)` donde `total` es el recuento del filtro.
    """
    stmt = select(Movimiento).where(Movimiento.eliminado.is_(False))
    if hogar_id is not None:
        stmt = stmt.where(
            (Movimiento.hogar_id == str(hogar_id)) | (Movimiento.hogar_id == hogar_id)
        )
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
    order_clause = (
        (Movimiento.fecha.desc(), Movimiento.id.desc())
        if str(orden).lower() == "desc"
        else (Movimiento.fecha.asc(), Movimiento.id.asc())
    )
    filas: list = db.scalars(
        stmt.order_by(*order_clause)
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
