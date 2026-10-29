"""Movimiento: única fuente de verdad de los saldos (FR-002, FR-003)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base

OrigenMovimiento = Enum("manual", "importacion", name="origen_movimiento")


class Movimiento(Base):
    __tablename__ = "movimientos"
    __table_args__ = (
        Index("ix_movimientos_cuenta_fecha", "cuenta_id", "fecha"),
        Index("ix_movimientos_bote", "bote_id"),
        Index("ix_movimientos_categoria", "categoria_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hogares.id"), nullable=False, index=True
    )
    cuenta_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cuentas.id"), nullable=False, index=True
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    importe_centimos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    descripcion: Mapped[str] = mapped_column(String(300), nullable=False)
    categoria_id: Mapped[str | None] = mapped_column(
        Integer, ForeignKey("categorias.id"), nullable=True
    )
    bote_id: Mapped[str | None] = mapped_column(Integer, ForeignKey("botes.id"), nullable=True)
    marcar_revisar: Mapped[bool] = mapped_column(Boolean, default=False)
    motivo_revision: Mapped[str | None] = mapped_column(Text, nullable=True)
    origen: Mapped[str] = mapped_column(OrigenMovimiento, nullable=False, default="manual")
    eliminado: Mapped[bool] = mapped_column(Boolean, default=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    cuenta: Mapped[Cuenta] = relationship(back_populates="movimientos")  # noqa: F821
    bote: Mapped[Bote | None] = relationship(back_populates="movimientos")  # noqa: F821
    auditoria: Mapped[list[AuditoriaMovimiento]] = relationship(  # noqa: F821
        back_populates="movimiento", cascade="all, delete-orphan"
    )
