"""GastoRecurrente y PrevisionGastosConfig: planificación anual y bote para gastos periódicos."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base


class GastoRecurrente(Base):
    """Gasto anual periódico (IBI, basuras, seguros, sellos, etc.)."""

    __tablename__ = "gastos_recurrentes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hogares.id"), nullable=False, index=True
    )
    concepto: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha_cobro: Mapped[str] = mapped_column(String(100), nullable=False)
    importe_anual_centimos: Mapped[int] = mapped_column(Integer, nullable=False)
    cuota_mensual_centimos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pagado_real_centimos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    hogar: Mapped[Hogar] = relationship(back_populates="gastos_recurrentes")  # noqa: F821


class PrevisionGastosConfig(Base):
    """Configuración del año y meses transcurridos/pagados del bote de gastos."""

    __tablename__ = "prevision_gastos_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hogares.id"), nullable=False, unique=True, index=True
    )
    meses_pagados: Mapped[int] = mapped_column(Integer, nullable=False, default=11)
    anio: Mapped[int] = mapped_column(Integer, nullable=False, default=2026)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
