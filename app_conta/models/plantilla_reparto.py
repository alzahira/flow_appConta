"""PlantillaReparto y PlantillaRepartoLinea: plantillas para nóminas y repartos."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base


class PlantillaReparto(Base):
    """Plantilla de reparto mensual de ingresos (nómina de Javier, nómina de pareja, etc.)."""

    __tablename__ = "plantillas_reparto"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hogares.id"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    cuenta_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cuentas.id"), nullable=False, index=True
    )
    importe_estimado_centimos: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    dia_mes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    hogar: Mapped[Hogar] = relationship(back_populates="plantillas_reparto")  # noqa: F821
    cuenta: Mapped[Cuenta] = relationship()  # noqa: F821
    lineas: Mapped[list[PlantillaRepartoLinea]] = relationship(
        back_populates="plantilla",
        cascade="all, delete-orphan",
        order_by="PlantillaRepartoLinea.orden",
    )


class PlantillaRepartoLinea(Base):
    """Línea de desglose de una plantilla de nómina asignada a un bote concreto o libre."""

    __tablename__ = "plantillas_reparto_lineas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plantilla_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plantillas_reparto.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bote_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("botes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    cuenta_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("cuentas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    concepto: Mapped[str] = mapped_column(String(150), nullable=False)
    importe_centimos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    plantilla: Mapped[PlantillaReparto] = relationship(back_populates="lineas")
    bote: Mapped[Bote | None] = relationship()  # noqa: F821
    cuenta: Mapped[Cuenta | None] = relationship()  # noqa: F821
