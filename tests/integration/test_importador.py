"""Integration tests del importador con el fichero REAL (T046, US5).

docs/OCTUBRE.xlsx con cifras verificadas hoja a hoja contra el Excel:
- Coche: entregas +5347 − costes 13399.06 → saldo −8052.06 (= TOTAL DEBO)
- AHORROS: Fondo hipotecas 8083 por meses + Arreglos Córdoba −373.70 +
  extras 81 → grupo 7790.30 (= BOTE AHORRO 2025 en CAJA)
- Botes propios: Σ semillas + Coche = 1222.86 (fila TOTAL)
- Bote para gastos 2026: −119.08
- Repetición detectada por huella sha256 (FR-010) y conciliación cuadrada.
"""

from __future__ import annotations

from pathlib import Path

import pytest

RUTA_EXCEL = Path(__file__).parent.parent.parent / "docs" / "OCTUBRE.xlsx"
pytestmark = pytest.mark.usefixtures("_migrado")


@pytest.fixture()
def excel():
    if not RUTA_EXCEL.exists():
        pytest.skip("docs/OCTUBRE.xlsx no está disponible")
    return RUTA_EXCEL.read_bytes()


def _subir(client, excel, ruta="/api/v1/importacion/previsualizar", extra=None):
    params = extra or {}
    r = client.post(
        ruta,
        files={
            "fichero": (
                "OCTUBRE.xlsx",
                excel,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        params=params,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_previsualizar_resumen_y_diferencias_cero(client, excel):
    data = _subir(client, excel)

    assert len(data["fichero"]["huella"]) == 64
    assert data["fichero"]["repetido"] is False

    resumen = data["resumen"]
    # 20 cuentas = 19 reales de CAJA (efectivo + tarjetas + bancos + otros)
    # + la cuenta "Historial Excel (importación)"
    assert resumen["cuentas"] == 20
    # 28 botes = 22 de BOTES PROPIOS + 3 de AHORROS + Coche + gastos 2026
    # + salario M.José
    assert resumen["botes"] == 28
    assert resumen["movimientos"] == 215

    # SC-004: estos cuatro grupos cuadran al céntimo
    por_grupo = {d["bote"]: d for d in data["diferencias_conciliacion"]}
    assert por_grupo["Botes propios"]["diferencia"] == "0.00"
    assert por_grupo["Bote ahorro 2025"]["diferencia"] == "0.00"
    assert por_grupo["Bote para gastos recurrente"]["diferencia"] == "0.00"
    assert por_grupo["Coche"]["diferencia"] == "0.00"

    motivos = [a["motivo"] for a in data["avisos"]]
    assert any("ANUARIO" in m for m in motivos)
    assert any("#REF!" in m for m in motivos)  # hipotecas y sueldo
    assert any("redonde" in m.lower() for m in motivos)  # PR 3: céntimos
    assert any("devoluciones" in m.lower() for m in motivos)
    assert len(data["avisos"]) >= 6


def test_aplicar_rellena_la_aplicacion_y_cuadra(client, excel, db_module):
    _ = _subir(client, excel, "/api/v1/importacion/aplicar")

    botes = client.get("/api/v1/botes").json()["items"]
    saldos = {b["nombre"]: b["saldo"] for b in botes}

    assert len(botes) == 28
    assert saldos["Coche"] == "-8052.06"
    assert saldos["Fondo hipotecas"] == "8083.00"
    assert saldos["Bote extras 2025"] == "81.00"
    assert list(saldos.values()).count("-373.70") == 1  # Bote arreglos Córdoba
    assert saldos["Bote para gastos 2026"] == "-119.08"
    assert saldos["Ahorro salario M.José"] == "12016.00"

    movs = client.get("/api/v1/movimientos?limit=1").json()
    assert movs["total"] == 215

    cuentas = client.get("/api/v1/cuentas").json()["items"]
    assert len(cuentas) == 20

    conc = client.get("/api/v1/conciliacion").json()
    assert conc["estado"] == "cuadrado"
    assert conc["diferencia"] == "0.00"


def test_repetido_exige_confirmacion(client, excel):
    _ = _subir(client, excel, "/api/v1/importacion/aplicar")

    r_sin = client.post(
        "/api/v1/importacion/aplicar",
        files={
            "fichero": (
                "OCTUBRE.xlsx",
                excel,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert r_sin.status_code == 409
    assert r_sin.json()["error"]["codigo"] == "conflicto"

    _ = _subir(client, excel, "/api/v1/importacion/aplicar", extra={"confirmar_repetido": "true"})
    movs = client.get("/api/v1/movimientos?limit=1").json()
    assert movs["total"] == 430  # duplicado confirmado a propósito

    historial = client.get("/api/v1/importacion/historial").json()
    assert len(historial["items"]) == 2
