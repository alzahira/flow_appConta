"""Servicio del Hogar único (seed al arranque — finding U1)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.hogar import Hogar

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
