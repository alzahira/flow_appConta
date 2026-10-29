"""Lector del Excel: hojas read_only + huella sha256 (FR-010)."""

from __future__ import annotations

import hashlib

import openpyxl


def calcular_huella(datos: bytes) -> str:
    """Huella sha256 hex del fichero (identifica repetidos)."""
    return hashlib.sha256(datos).hexdigest()


def abrir_libro(datos: bytes) -> openpyxl.Workbook:
    """Libro read_only + data_only: fórmulas sin recalcular (regla 1)."""
    import io

    return openpyxl.load_workbook(io.BytesIO(datos), read_only=True, data_only=True)
