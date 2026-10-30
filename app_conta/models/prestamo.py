"""Prestamo: pasivos, financiaciones y deudas del hogar (coche, personal, hipoteca)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base


class Prestamo(Base):
    """Préstamo o financiación que debe devolver el hogar."""

    __tablename__ = "prestamos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hogares.id"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    entidad: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False, default="coche")
    importe_inicial_centimos: Mapped[int] = mapped_column(Integer, nullable=False)
    importe_pendiente_centimos: Mapped[int] = mapped_column(Integer, nullable=False)
    cuota_mensual_centimos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cuenta_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("cuentas.id"), nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date | None] = mapped_column(Date, nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    hogar: Mapped[Hogar] = relationship(back_populates="prestamos")  # noqa: F821
    cuenta: Mapped[Cuenta | None] = relationship()  # noqa: F821

    @property
    def amortizado_centimos(self) -> int:
        return max(0, self.importe_inicial_centimos - self.importe_pendiente_centimos)

    @property
    def progreso_amortizado_pct(self) -> float:
        if self.importe_inicial_centimos <= 0:
            return 0.0
        return round((self.amortizado_centimos / self.importe_inicial_centimos) * 100, 2)

