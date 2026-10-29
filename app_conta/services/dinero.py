"""Aritmética monetaria exacta: euros (Decimal, 2 decimales) <-> céntimos (int).

research.md D-01 + Principio I de la constitución: nunca float, redondeo explícito.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

CENTIMOS_POR_EURO = 100
_EXPONENTE = Decimal("0.01")


class ErrorImporte(ValueError):
    """Importe no válido (formato o valor cero)."""


def euros_a_centimos(importe: Decimal | str) -> int:
    """Convierte euros a céntimos enteros con ROUND_HALF_UP explícito.

    Acepta Decimal o string. Rechaza valores no parseables y NaN/Inf.
    """
    try:
        valor = Decimal(str(importe).strip())
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ErrorImporte(f"Importe no válido: {importe!r}") from exc
    if not valor.is_finite():
        raise ErrorImporte(f"Importe no finito: {importe!r}")
    return int((valor * CENTIMOS_POR_EURO).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def centimos_a_euros(centimos: int) -> Decimal:
    """Convierte céntimos enteros a euros Decimal con dos decimales."""
    if not isinstance(centimos, int):
        raise ErrorImporte(f"Se esperaba un entero de céntimos: {centimos!r}")
    return (Decimal(centimos) / CENTIMOS_POR_EURO).quantize(_EXPONENTE)


def euros_str(centimos: int) -> str:
    """Formato de string para API/JSON: '−30.50', '0.00' (contrato REST)."""
    return f"{centimos_a_euros(centimos):.2f}"


def validar_importe_no_cero(centimos: int) -> int:
    """Regla del data-model: importe_centimos != 0."""
    if centimos == 0:
        raise ErrorImporte("El importe no puede ser 0")
    return centimos
