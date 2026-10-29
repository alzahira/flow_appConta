"""Contract tests de /api/v1/importacion (T047, US5) per contracts/importador.md.

Estructura JSON de previsualizar/applyo/historial y el gate de repetición.
Usa un xlsx SINTÉTICO mínimo (el fichero real se cubre en tests/integration).
"""

from __future__ import annotations

import io

import openpyxl
import pytest

pytestmark = pytest.mark.usefixtures("_migrado")


def _xlsx_minimo() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CAJA"
    ws.append([None, "COGIDO A CUENTA Y EFECTIVOS", None, None, "CAJA", 165.7])
    ws.append([None, "GASTOS TARJETAS", None])
    ws.append([None, "TARJETA CAIXA", 0])
    ws.append([None, "TOTAL", 0])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _subir(client, datos, ruta="/api/v1/importacion/previsualizar", extra=None):
    r = client.post(
        ruta,
        files={"fichero": ("MINI.xlsx", datos, "application/octet-stream")},
        params=extra or {},
    )
    return r


def test_previsualizar_estructura_del_contrato(client):
    r = _subir(client, _xlsx_minimo())
    assert r.status_code == 200, r.text
    data = r.json()
    assert set(data) == {"fichero", "resumen", "avisos", "diferencias_conciliacion"}
    assert set(data["fichero"]) == {"nombre", "huella", "repetido"}
    assert set(data["resumen"]) == {
        "cuentas",
        "botes",
        "movimientos",
        "categorias",
        "saldo_total_cuentas",
    }
    for aviso in data["avisos"]:
        assert "hoja" in aviso and "fila" in aviso and "motivo" in aviso


def test_aplicar_guarda_y_devuelve_resumen(client):
    r = _subir(client, _xlsx_minimo(), "/api/v1/importacion/aplicar")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["resumen"]["cuentas"] >= 2  # 1 real + Historial
    assert data["resumen"]["botes"] == 0

    cuentas = client.get("/api/v1/cuentas").json()["items"]
    nombres = [c["nombre"] for c in cuentas]
    assert "Efectivo (CAJA)" in nombres


def test_historial_registra_huella(client):
    _subir(client, _xlsx_minimo(), "/api/v1/importacion/aplicar")
    r = client.get("/api/v1/importacion/historial")
    assert r.status_code == 200, r.text
    historial = r.json()
    assert historial["total"] == 1
    item = historial["items"][0]
    assert item["nombre_fichero"] == "MINI.xlsx"
    assert len(item["huella"]) == 64


def test_repetido_409_y_confirmado_200(client):
    datos = _xlsx_minimo()
    assert _subir(client, datos, "/api/v1/importacion/aplicar").status_code == 200
    assert _subir(client, datos, "/api/v1/importacion/aplicar").status_code == 409
    r = _subir(client, datos, "/api/v1/importacion/aplicar", extra={"confirmar_repetido": "true"})
    assert r.status_code == 200, r.text
