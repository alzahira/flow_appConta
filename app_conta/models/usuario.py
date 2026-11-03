"""Modelos de Usuario y Sesión para autenticación y multi-hogar."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_conta.db import Base

if TYPE_CHECKING:
    from app_conta.models.hogar import Hogar


def _ahora() -> datetime:
    return datetime.utcnow()


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hogar_id: Mapped[int] = mapped_column(ForeignKey("hogares.id"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre_mostrar: Mapped[str] = mapped_column(String(120), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False, default="miembro")
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=_ahora, nullable=False)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=_ahora, onupdate=_ahora, nullable=False
    )

    hogar: Mapped[Hogar] = relationship(back_populates="usuarios")
    sesiones: Mapped[list[SesionUsuario]] = relationship(
        back_populates="usuario", cascade="all, delete-orphan"
    )


class SesionUsuario(Base):
    __tablename__ = "sesiones_usuario"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=_ahora, nullable=False)
    expira_en: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    usuario: Mapped[Usuario] = relationship(back_populates="sesiones")

