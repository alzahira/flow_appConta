"""Auditoría de movimientos (FR-013)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base

AccionAuditoria = Enum("creado", "editado", "eliminado", "reasignado", name="accion_auditoria")


class AuditoriaMovimiento(Base):
    __tablename__ = "auditoria_movimientos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    movimiento_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("movimientos.id"), nullable=False, index=True
    )
    accion: Mapped[str] = mapped_column(AccionAuditoria, nullable=False)
    cambios: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    movimiento: Mapped[Movimiento] = relationship(  # noqa: F821
        back_populates="auditoria"
    )
