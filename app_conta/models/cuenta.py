"""Cuenta: dinero real (banco, tarjeta, efectivo, inversión).

El saldo NUNCA se persiste: se deriva de movimientos (Principio II).
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base

TipoCuenta = Enum("banco", "tarjeta", "efectivo", "inversion", name="tipo_cuenta")


class Cuenta(Base):
    __tablename__ = "cuentas"
    __table_args__ = (UniqueConstraint("hogar_id", "nombre", name="uq_cuenta_nombre"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hogares.id"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    tipo: Mapped[str] = mapped_column(TipoCuenta, nullable=False)
    entidad: Mapped[str | None] = mapped_column(String(120), nullable=True)
    saldo_inicial_centimos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fecha_apertura: Mapped[date] = mapped_column(Date, nullable=False)
    archivada: Mapped[bool] = mapped_column(default=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    movimientos: Mapped[list[Movimiento]] = relationship(  # noqa: F821
        back_populates="cuenta"
    )
    hogar: Mapped[Hogar] = relationship(back_populates="cuentas")  # noqa: F821
