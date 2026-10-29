"""Hogar: raíz que agrupa todos los datos (único por instalación)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _ahora() -> datetime:
    return datetime.now(UTC)


class Hogar(Base):
    __tablename__ = "hogares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    moneda: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=_ahora)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime, default=_ahora, onupdate=_ahora)

    cuentas: Mapped[list[Cuenta]] = relationship(  # noqa: F821
        back_populates="hogar", cascade="all, delete-orphan"
    )
    botes: Mapped[list[Bote]] = relationship(  # noqa: F821
        back_populates="hogar", cascade="all, delete-orphan"
    )
    deudas: Mapped[list[Deuda]] = relationship(  # noqa: F821
        back_populates="hogar", cascade="all, delete-orphan"
    )
    gastos_recurrentes: Mapped[list[GastoRecurrente]] = relationship(  # noqa: F821
        back_populates="hogar", cascade="all, delete-orphan"
    )
