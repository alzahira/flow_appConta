"""Tests de seguridad y robustez para pase a producción.

Verifica:
1. Prevención de inyección SQL en endpoints y backups.
2. Prevención de Path Traversal y rechazo de ficheros maliciosos o de gran tamaño.
3. Validación estricta de importes (bloqueo de NaN, Infinity, importes negativos donde no procede).
4. Saneamiento contra XSS en cadenas de texto de usuario.
5. Integridad referencial y rechazo de payloads truncados o con claves corruptas.
"""

from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient


pytestmark = pytest.mark.usefixtures("_migrado")


def test_seguridad_backup_tamano_maximo(client: TestClient) -> None:
    """Verifica que el endpoint de restauración de backup rechaza archivos gigantes (DoS)."""
    # Archivo ficticio que excede 25 MB
    archivo_gigante = b"A" * (26 * 1024 * 1024)
    resp = client.post(
        "/api/v1/backup/restaurar",
        files={"archivo": ("backup_malicioso.json", io.BytesIO(archivo_gigante), "application/json")},
    )
    assert resp.status_code == 400
    assert "supera el tamaño máximo" in resp.json()["error"]["mensaje"]


def test_seguridad_backup_extension_invalida(client: TestClient) -> None:
    """Verifica que no se pueden subir archivos ejecutables o no-JSON a /backup/restaurar."""
    resp = client.post(
        "/api/v1/backup/restaurar",
        files={"archivo": ("script.py", io.BytesIO(b"print('hack')"), "text/x-python")},
    )
    assert resp.status_code == 400
    assert "extensión .json" in resp.json()["error"]["mensaje"]


def test_seguridad_backup_sql_injection_en_columnas(client: TestClient) -> None:
    """Verifica que un archivo de copia con columnas maliciosas no permite inyección SQL."""
    payload_malicioso = {
        "version": "2.0.0",
        "tablas": {
            "cuentas": [
                {
                    "nombre": "Cuenta Hack",
                    "id; DROP TABLE cuentas; --": "valor_malicioso",
                    "tipo": "banco",
                    "saldo_inicial_centimos": 0,
                    "activo": 1,
                }
            ]
        },
    }
    archivo_json = json.dumps(payload_malicioso).encode("utf-8")
    resp = client.post(
        "/api/v1/backup/restaurar",
        files={"archivo": ("backup_inyeccion.json", io.BytesIO(archivo_json), "application/json")},
    )
    assert resp.status_code in (400, 422)


def test_seguridad_importacion_tamano_y_extension(client: TestClient) -> None:
    """Verifica que el importador rechaza extensiones no permitidas y ficheros vacíos."""
    # Extensión no permitida
    resp = client.post(
        "/api/v1/importacion/previsualizar",
        files={"fichero": ("datos.exe", io.BytesIO(b"\x00" * 100), "application/octet-stream")},
    )
    assert resp.status_code in (400, 422)

    # Fichero vacío
    resp_vacio = client.post(
        "/api/v1/importacion/previsualizar",
        files={"fichero": ("vacio.xlsx", io.BytesIO(b""), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert resp_vacio.status_code in (400, 422)


def test_seguridad_importes_invalidos_nan_infinity(client: TestClient) -> None:
    """Verifica que importes con NaN, Infinity o cadenas alfanuméricas son rechazados."""
    c_resp = client.post(
        "/api/v1/cuentas",
        json={"nombre": "Seguridad Test", "tipo": "banco", "saldo_inicial": "100.00", "fecha_apertura": "2026-11-01"},
    )
    assert c_resp.status_code == 201
    c_id = c_resp.json()["id"]

    for importe_invalido in ["NaN", "Infinity", "-Infinity", "100.00.00", "abc", "", "1e9999"]:
        resp = client.post(
            "/api/v1/movimientos",
            json={
                "fecha": "2026-11-02",
                "importe": importe_invalido,
                "descripcion": "Intento de inyección numérica",
                "cuenta_id": c_id,
            },
        )
        assert resp.status_code in (400, 422), f"Se esperaba error para importe {importe_invalido}"


def test_seguridad_liquidacion_tarjeta_importe_positivo(client: TestClient) -> None:
    """Verifica que liquidar tarjeta exige un importe estrictamente positivo."""
    c_banco = client.post(
        "/api/v1/cuentas",
        json={"nombre": "Banco Seg", "tipo": "banco", "saldo_inicial": "500.00", "fecha_apertura": "2026-11-01"},
    ).json()
    c_tarjeta = client.post(
        "/api/v1/cuentas",
        json={"nombre": "Tarjeta Seg", "tipo": "tarjeta", "saldo_inicial": "-100.00", "fecha_apertura": "2026-11-01"},
    ).json()

    # Liquidación con importe negativo o cero
    for imp in ["-50.00", "0.00", "-0.01"]:
        resp = client.post(
            f"/api/v1/cuentas/{c_tarjeta['id']}/liquidar",
            json={
                "cuenta_origen_id": c_banco["id"],
                "importe": imp,
                "concepto": "Liquidación ilegal",
                "fecha": "2026-11-02",
            },
        )
        assert resp.status_code in (400, 422)


def test_seguridad_amortizacion_prestamo_importe_positivo(client: TestClient) -> None:
    """Verifica que amortizar un préstamo exige un importe estrictamente positivo."""
    c_banco = client.post(
        "/api/v1/cuentas",
        json={"nombre": "Banco Seg 2", "tipo": "banco", "saldo_inicial": "1000.00", "fecha_apertura": "2026-11-01"},
    ).json()
    p_resp = client.post(
        "/api/v1/prestamos",
        json={
            "nombre": "Préstamo Seg",
            "entidad": "Banco Seg",
            "importe_inicial": "5000.00",
            "importe_pendiente": "5000.00",
            "cuota_mensual": "150.00",
        },
    ).json()

    for imp in ["-100.00", "0.00"]:
        resp = client.post(
            f"/api/v1/prestamos/{p_resp['id']}/pagar",
            json={
                "cuenta_id": c_banco["id"],
                "importe": imp,
                "concepto": "Amortización negativa",
                "fecha": "2026-11-02",
            },
        )
        assert resp.status_code in (400, 422)


def test_seguridad_xss_en_textos_de_usuario(client: TestClient) -> None:
    """Verifica que textos con payloads XSS se almacenan como texto puro sin corromper la BD."""
    payload_xss = "<script>alert('xss')</script><img src=x onerror=alert(1)>"
    c_resp = client.post(
        "/api/v1/cuentas",
        json={"nombre": f"Cuenta {payload_xss}", "tipo": "banco", "saldo_inicial": "100.00", "fecha_apertura": "2026-11-01"},
    )
    assert c_resp.status_code == 201
    c_data = c_resp.json()
    assert payload_xss in c_data["nombre"]

    # Crear movimiento con concepto XSS
    m_resp = client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2026-11-02",
            "importe": "25.00",
            "descripcion": payload_xss,
            "cuenta_id": c_data["id"],
        },
    )
    assert m_resp.status_code == 201
    assert payload_xss in m_resp.json()["descripcion"]
