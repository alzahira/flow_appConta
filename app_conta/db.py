"""Infraestructura de base de datos SQLite local (Principio V)."""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "app_conta" / "conta.db"
# APP_CONTA_DB permite apuntar a otra BD (tests de integración).
DB_PATH = Path(os.environ.get("APP_CONTA_DB", str(DEFAULT_DB_PATH)))
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base declarativa de todos los modelos."""


def get_db() -> Iterator[Session]:
    """Dependencia FastAPI: sesión por petición."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
