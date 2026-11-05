"""Servicio del Hogar único (seed al arranque — finding U1)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.hogar import Hogar
from app_conta.services.errors import ErrorNoEncontrado

NOMBRE_HOGAR = "Hogar"


def asegurar_hogar_unico(db: Session) -> Hogar:
    """Devuelve el Hogar único, creándolo si la BD está vacía."""
    hogar = db.execute(select(Hogar)).scalars().first()
    if hogar is None:
        hogar = Hogar(nombre=NOMBRE_HOGAR, moneda="EUR")
        db.add(hogar)
        db.commit()
        db.refresh(hogar)
    return hogar


def mismo_hogar(valor: int | str | None, hogar_id: int | str | None) -> bool:
    """Compara hogar_id sin depender de que SQLite lo guarde como int o str."""
    if hogar_id is None:
        return True
    return str(valor) == str(hogar_id)


def exigir_hogar(obj, hogar_id: int | str | None, etiqueta: str = "Recurso") -> None:
    """Impide IDOR/BOLA: un usuario solo puede tocar filas de su propio hogar.

    Se usa en los `obtener_*` de los servicios y devuelve 404 (no 403) para no
    revelar la existencia de recursos de otros hogares.
    """
    if not mismo_hogar(getattr(obj, "hogar_id", None), hogar_id):
        raise ErrorNoEncontrado(f"{etiqueta} no encontrado")
