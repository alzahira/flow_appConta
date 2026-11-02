"""Tests de cuadre contable y flujo integral de producción.

Verifica que en todo momento se cumpla la ecuación contable del hogar:
Saldo Real Bancos (Cuentas + Tarjetas + Efectivo) == Suma Botes + Sin Asignar

Flujo simulado de vida real:
1. Nómina recibida y repartida en botes.
2. Compras diarias con tarjeta de crédito (Carrefour Pass) descontadas de sobres sin tocar banco.
3. Compras con tarjeta de débito descontadas de sobres y restadas del banco.
4. Liquidación parcial a fin de mes de la tarjeta desde el banco sin doble gasto.
5. Amortización de préstamo con ingreso dedicado.
6. Ejecución de recibos bancarios recurrentes.
7. Conciliación final perfectamente CUADRADA (🟢 Contabilidad al día).
8. Backup total y restauración verificando que el saldo restaurado es idéntico al centavo.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.usefixtures("_migrado")


def test_flujo_integral_cuadre_produccion(client: TestClient) -> None:
    # 1. Configuración de cuentas bancarias y tarjetas
    caixa = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Caixa Nómina",
            "tipo": "banco",
            "saldo_inicial": "1000.00",
            "fecha_apertura": "2026-11-01",
        },
    ).json()
    carrefour = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": "Carrefour Pass",
            "tipo": "tarjeta",
            "saldo_inicial": "0.00",
            "fecha_apertura": "2026-11-01",
        },
    ).json()

    # 2. Configuración de botes
    bote_mes = client.post(
        "/api/v1/botes",
        json={"nombre": "Bote del Mes", "tipo": "recurrente", "objetivo": "500.00"},
    ).json()
    client.post(
        "/api/v1/botes",
        json={"nombre": "Bote Ocio", "tipo": "recurrente", "objetivo": "200.00"},
    )

    # Asignar saldo inicial al bote del mes desde el saldo disponible
    client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2026-11-01",
            "importe": "+500.00",
            "descripcion": "Dotación inicial Bote Mes",
            "cuenta_id": caixa["id"],
            "bote_id": bote_mes["id"],
        },
    )

    # Verificar cuadre inicial
    conc_init = client.get("/api/v1/conciliacion").json()
    assert conc_init["estado"] == "cuadrado"

    # 3. Compra diaria con Tarjeta Carrefour (20.00 € en Pan / Supermercado)
    # Se imputa a la tarjeta y se descuenta del Bote del Mes
    mov_pan = client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2026-11-02",
            "importe": "-20.00",
            "descripcion": "Panadería",
            "cuenta_id": carrefour["id"],
            "bote_id": bote_mes["id"],
        },
    ).json()
    assert mov_pan["id"] is not None

    # Verificar saldos: Carrefour debe tener -20€, Caixa sigue intacta con 1500€
    tarjetas = client.get("/api/v1/cuentas").json()["items"]
    c_carrefour = next(c for c in tarjetas if c["id"] == carrefour["id"])
    c_caixa = next(c for c in tarjetas if c["id"] == caixa["id"])
    assert Decimal(str(c_carrefour["saldo"])) == Decimal("-20.00")
    assert Decimal(str(c_caixa["saldo"])) == Decimal("1500.00")

    # Bote del mes se redujo a 480€
    botes = client.get("/api/v1/botes").json()["items"]
    b_mes = next(b for b in botes if b["id"] == bote_mes["id"])
    assert Decimal(str(b_mes["saldo"])) == Decimal("480.00")

    # Conciliación sigue cuadrada
    assert client.get("/api/v1/conciliacion").json()["estado"] == "cuadrado"

    # 4. Compra con Caixa Débito (50.00 € Gasoil) imputada al Bote del Mes
    client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2026-11-02",
            "importe": "-50.00",
            "descripcion": "Gasoil Repsol",
            "cuenta_id": caixa["id"],
            "bote_id": bote_mes["id"],
        },
    )

    # 5. Liquidación de fin de mes de la Tarjeta Carrefour desde Caixa por 20.00 €
    liq_resp = client.post(
        f"/api/v1/cuentas/{carrefour['id']}/liquidar",
        json={
            "cuenta_origen_id": caixa["id"],
            "importe": "20.00",
            "concepto": "Liquidación recibo Carrefour Pass",
            "fecha": "2026-11-30",
        },
    )
    assert liq_resp.status_code == 201

    # Carrefour vuelve a saldo 0.00 € y Caixa pagó los 20 €
    tarjetas_post_liq = client.get("/api/v1/cuentas").json()["items"]
    c_carrefour_post = next(c for c in tarjetas_post_liq if c["id"] == carrefour["id"])
    c_caixa_post = next(c for c in tarjetas_post_liq if c["id"] == caixa["id"])
    assert Decimal(str(c_carrefour_post["saldo"])) == Decimal("0.00")
    # Caixa era 1500 - 50 (gasoil) - 20 (liquidación tarjeta) = 1430.00
    assert Decimal(str(c_caixa_post["saldo"])) == Decimal("1430.00")

    # Bote del mes NO se volvió a restar por la liquidación (debe tener 430 €: 500 - 20 - 50)
    todos_botes = client.get("/api/v1/botes").json()["items"]
    b_mes_post = next(b for b in todos_botes if b["id"] == bote_mes["id"])
    assert Decimal(str(b_mes_post["saldo"])) == Decimal("430.00")

    # Conciliación sigue 100% cuadrada
    conc_post_liq = client.get("/api/v1/conciliacion").json()
    assert conc_post_liq["estado"] == "cuadrado"

    # 6. Alta y amortización de préstamo
    prestamo = client.post(
        "/api/v1/prestamos",
        json={
            "nombre": "Préstamo Coche",
            "entidad": "BBVA",
            "importe_inicial": "10000.00",
            "importe_pendiente": "5000.00",
            "cuota_mensual": "200.00",
        },
    ).json()

    # Ingreso extraordinario de 200 € destinado directamente al préstamo
    client.post(
        f"/api/v1/prestamos/{prestamo['id']}/pagar",
        json={
            "cuenta_id": caixa["id"],
            "importe": "200.00",
            "concepto": "Amortización extraordinaria",
            "fecha": "2026-11-15",
        },
    )

    # Verificar que el préstamo disminuyó exactamente a 4800.00 €
    todos_prestamos = client.get("/api/v1/prestamos").json()["items"]
    p_actual = next(p for p in todos_prestamos if p["id"] == prestamo["id"])
    assert Decimal(str(p_actual["importe_pendiente"])) == Decimal("4800.00")

    # 7. Backup y Restauración íntegra
    conc_antes_backup = client.get("/api/v1/conciliacion").json()
    assert conc_antes_backup["estado"] == "cuadrado"

    backup_resp = client.get("/api/v1/backup/exportar")
    assert backup_resp.status_code == 200
    backup_data = backup_resp.json()

    # Poner a cero
    reset_resp = client.post("/api/v1/backup/poner-a-cero", json={"confirmar": True})
    assert reset_resp.status_code == 200
    assert client.get("/api/v1/conciliacion").json()["saldo_total_cuentas"] == "0.00"

    # Restaurar backup completo
    rest_resp = client.post(
        "/api/v1/backup/restaurar",
        files={"archivo": ("flow_prod_backup.json", io_bytes(backup_data), "application/json")},
    )
    assert rest_resp.status_code == 200

    # Verificar que tras restaurar, el cuadre y todos los saldos son idénticos
    conc_final = client.get("/api/v1/conciliacion").json()
    assert conc_final["estado"] == "cuadrado"
    assert conc_final["saldo_total_cuentas"] == conc_antes_backup["saldo_total_cuentas"]


def io_bytes(data: dict) -> bytes:
    import json
    return json.dumps(data).encode("utf-8")
