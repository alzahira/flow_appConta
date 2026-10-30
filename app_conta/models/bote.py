"""Bote: sobre con saldo derivado de sus movimientos (Principio II)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base

TipoBote = Enum("recurrente", "ahorro", "proyecto", "ajeno", name="tipo_bote")


class Bote(Base):
    __tablename__ = "botes"
    __table_args__ = (UniqueConstraint("hogar_id", "nombre", name="uq_bote_nombre"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hogares.id"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    tipo: Mapped[str] = mapped_column(TipoBote, nullable=False)
    categoria: Mapped[str | None] = mapped_column(String(50), nullable=True)
    objetivo_centimos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    objetivo_fecha: Mapped[date | None] = mapped_column(Date, nullable=True)
    archivado: Mapped[bool] = mapped_column(Boolean, default=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    movimientos: Mapped[list[Movimiento]] = relationship(  # noqa: F821
        back_populates="bote"
    )
    hogar: Mapped[Hogar] = relationship(back_populates="botes")  # noqa: F821
