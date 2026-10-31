"""Modelo PagoRecurrente: Pagos periódicos y domiciliaciones bancarias recurrentes."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base

if TYPE_CHECKING:
    from app_conta.models.categoria import Categoria
    from app_conta.models.cuenta import Cuenta
    from app_conta.models.hogar import Hogar


class PagoRecurrente(Base):
    """Gasto mensual recurrente domiciliado en un banco (luz, comunidad, hipotecas, etc.)."""

    __tablename__ = "pagos_recurrentes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hogares.id"), nullable=False, index=True
    )
    cuenta_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cuentas.id"), nullable=False, index=True
    )
    concepto: Mapped[str] = mapped_column(String(255), nullable=False)
    importe_centimos: Mapped[int] = mapped_column(Integer, nullable=False)
    categoria_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("categorias.id"), nullable=True
    )
    dia_mes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ultimo_pago: Mapped[date | None] = mapped_column(Date, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    hogar: Mapped[Hogar] = relationship(back_populates="pagos_recurrentes")
    cuenta: Mapped[Cuenta] = relationship("Cuenta")
    categoria: Mapped[Categoria | None] = relationship("Categoria")

