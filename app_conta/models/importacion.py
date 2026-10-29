"""Importacion: registro de ficheros ya importados (FR-010, repetidos)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app_conta.db import Base


class Importacion(Base):
    __tablename__ = "importaciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hogares.id"), nullable=False, index=True
    )
    nombre_fichero: Mapped[str] = mapped_column(String(255), nullable=False)
    huella: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    resumen: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    avisos: Mapped[list | None] = mapped_column(JSON, nullable=True)
    importado_en: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
