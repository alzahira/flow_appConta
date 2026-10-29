"""Tests unitarios de aritmética monetaria (T007, escritos antes de implementar).

Cubren: conversión euros<->céntimos con ROUND_HALF_UP, importes con >2 decimales,
signos, rechazo de cero y formatos inválidos (Principio I).
"""

from decimal import Decimal

import pytest

from app_conta.services.dinero import (
    ErrorImporte,
    centimos_a_euros,
    euros_a_centimos,
    euros_str,
    validar_importe_no_cero,
)


@pytest.mark.parametrize(
    ("euros", "esperado"),
    [
        ("30.50", 3050),
        (Decimal("-30.50"), -3050),
        ("0", 0),
        ("-0.01", -1),
        ("0.01", 1),
        ("1,5", None),  # separador decimal español: se rechaza (la API manda '.')
    ],
)
def test_euros_a_centimos(euros, esperado):
    if esperado is None:
        with pytest.raises(ErrorImporte):
            euros_a_centimos(euros)
    else:
        assert euros_a_centimos(euros) == esperado


@pytest.mark.parametrize(
    ("euros", "esperado"),
    [
        ("30.505", 3051),  # ROUND_HALF_UP: 30.505 € -> 3050.5 ct -> 3051
        ("30.504", 3050),
        ("-30.505", -3051),  # ROUND_HALF_UP también en negativo
        ("2.675", 268),
    ],
)
def test_euros_a_centimos_mas_de_dos_decimales(euros, esperado):
    assert euros_a_centimos(euros) == esperado


@pytest.mark.parametrize(
    ("centimos", "esperado"),
    [(3050, Decimal("30.50")), (-3050, Decimal("-30.50")), (0, Decimal("0.00"))],
)
def test_centimos_a_euros(centimos, esperado):
    assert centimos_a_euros(centimos) == esperado


def test_centimos_a_euros_rechaza_no_enteros():
    with pytest.raises(ErrorImporte):
        centimos_a_euros(30.5)  # float prohibido en frontera monetaria


def test_euros_str_formato_contrato():
    assert euros_str(-3050) == "-30.50"
    assert euros_str(0) == "0.00"


def test_validar_importe_no_cero():
    assert validar_importe_no_cero(-3050) == -3050
    with pytest.raises(ErrorImporte):
        validar_importe_no_cero(0)


@pytest.mark.parametrize("valor", ["abc", "", "NaN", "Infinity", "None"])
def test_euros_a_centimos_invalidos(valor):
    with pytest.raises(ErrorImporte):
        euros_a_centimos(valor)
