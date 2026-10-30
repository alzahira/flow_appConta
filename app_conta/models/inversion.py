"""Inversion: activos financieros, fondos, acciones, renta fija y pensiones."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base


class Inversion(Base):
    """Posición o activo de inversión del hogar."""

    __tablename__ = "inversiones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hogares.id"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    entidad: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo_activo: Mapped[str] = mapped_column(String(50), nullable=False, default="fondos")
    capital_aportado_centimos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valor_actual_centimos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cuenta_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("cuentas.id"), nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    hogar: Mapped[Hogar] = relationship(back_populates="inversiones")  # noqa: F821
    cuenta: Mapped[Cuenta | None] = relationship()  # noqa: F821

    @property
    def plusvalia_centimos(self) -> int:
        return self.valor_actual_centimos - self.capital_aportado_centimos

    @property
    def rentabilidad_pct(self) -> float:
        if self.capital_aportado_centimos <= 0:
            return 0.0
        return round((self.plusvalia_centimos / self.capital_aportado_centimos) * 100, 2)
