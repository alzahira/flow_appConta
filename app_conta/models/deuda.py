"""Deuda: dinero que le deben al hogar (Principio I: las deudas se modelan como entidades)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base

EstadoDeuda = Enum("pendiente", "parcial", "saldado", name="estado_deuda")


class Deuda(Base):
    __tablename__ = "deudas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hogares.id"), nullable=False, index=True
    )
    deudor: Mapped[str] = mapped_column(String(120), nullable=False)
    concepto: Mapped[str] = mapped_column(String(255), nullable=False)
    importe_inicial_centimos: Mapped[int] = mapped_column(Integer, nullable=False)
    importe_cobrado_centimos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_limite: Mapped[date | None] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(EstadoDeuda, nullable=False, default="pendiente")
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    archivada: Mapped[bool] = mapped_column(Boolean, default=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    hogar: Mapped[Hogar] = relationship(back_populates="deudas")  # noqa: F821
