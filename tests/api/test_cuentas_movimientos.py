"""Contract tests de /api/v1/cuentas y /api/v1/movimientos (T017, US2).

Escritos ANTES de implementar los endpoints (TDD, Principio III). Verifican la forma
del contrato: importes en string de euros ("−30.50"), errores { error: { codigo,
mensaje } } con 400/404/409, saldos derivados (nunca persistidos).
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("_migrado")

_CUENTA_BASE = {
    "nombre": "",
    "tipo": "banco",
    "entidad": None,
    "saldo_inicial": "1000.00",
    "fecha_apertura": "2026-10-01",
}


def _crear_cuenta(
    client, nombre: str, saldo_inicial: str = "1000.00", tipo: str = "banco"
) -> dict:
    payload = {**_CUENTA_BASE, "nombre": nombre, "saldo_inicial": saldo_inicial, "tipo": tipo}
    resp = client.post("/api/v1/cuentas", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _crear_movimiento(client, cuenta_id: int, importe: str, desc: str) -> dict:
    payload = {
        "fecha": "2026-10-13",
        "importe": importe,
        "descripcion": desc,
        "cuenta_id": cuenta_id,
        "categoria_id": None,
        "bote_id": None,
    }
    resp = client.post("/api/v1/movimientos", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestCuentasContract:
    def test_post_cuenta_201_con_saldo_derivado(self, client):
        resp = client.post(
            "/api/v1/cuentas",
            json={
                "nombre": "Cuenta Nómina",
                "tipo": "banco",
                "entidad": "La Caixa",
                "saldo_inicial": "1000.00",
                "fecha_apertura": "2026-10-01",
            },
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["nombre"] == "Cuenta Nómina"
        assert data["tipo"] == "banco"
        assert data["entidad"] == "La Caixa"
        assert data["saldo_inicial"] == "1000.00"  # string de euros (contrato)
        assert data["fecha_apertura"] == "2026-10-01"
        assert data["archivada"] is False
        assert data["saldo"] == "1000.00"  # derivado = saldo inicial (sin movimientos)

    def test_post_cuenta_400_con_formato_error(self, client, hogar_id):
        resp = client.post(
            "/api/v1/cuentas",
            json={**_CUENTA_BASE, "nombre": "Tipo inválido", "tipo": "chatarra"},
        )
        assert resp.status_code == 400
        assert "error" in resp.json()
        assert set(resp.json()["error"]) >= {"codigo", "mensaje"}

    def test_post_cuenta_409_nombre_duplicado_en_hogar(self, client):
        _crear_cuenta(client, "Duplicada")
        resp = client.post("/api/v1/cuentas", json={**_CUENTA_BASE, "nombre": "Duplicada"})
        assert resp.status_code == 409, resp.text
        assert resp.json()["error"]["codigo"] == "conflicto"

    def test_get_cuentas_lista_con_saldo_y_total(self, client):
        _crear_cuenta(client, "Lista A", "500.00")
        _crear_cuenta(client, "Lista B", "250.50")
        resp = client.get("/api/v1/cuentas")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert isinstance(data["items"], list)
        assert all("saldo" in itu for itu in data["items"])
        assert "total" in data  # suma de saldos de cuentas activas

    def test_get_cuenta_detalle_con_movimientos(self, client):
        cuenta = _crear_cuenta(client, "Detalle")
        _crear_movimiento(client, cuenta["id"], "-30.50", "Mercadona")
        resp = client.get(f"/api/v1/cuentas/{cuenta['id']}")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["saldo"] == "969.50"
        assert [m["importe"] for m in data["movimientos"]] == ["-30.50"]

    def test_get_cuenta_inexistente_404(self, client):
        resp = client.get("/api/v1/cuentas/999999")
        assert resp.status_code == 404
        assert resp.json()["error"]["codigo"] == "no_encontrado"

    def test_patch_cuenta_campos_no_derivados(self, client):
        cuenta = _crear_cuenta(client, "Editable")
        resp = client.patch(
            f"/api/v1/cuentas/{cuenta['id']}",
            json={"entidad": "Deutsche Bank"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["entidad"] == "Deutsche Bank"
        assert data["nombre"] == "Editable"  # sin cambios

    def test_patch_cuenta_no_permite_editar_saldo(self, client):
        cuenta = _crear_cuenta(client, "Saldo Solo Lectura")
        resp = client.patch(f"/api/v1/cuentas/{cuenta['id']}", json={"saldo": "9999.99"})
        assert resp.status_code == 200, resp.text
        assert resp.json()["saldo"] == "1000.00"  # sigue derivado (Principio II)

    def test_delete_cuenta_sin_movimientos_ok(self, client):
        cuenta = _crear_cuenta(client, "Deletable")
        resp = client.delete(f"/api/v1/cuentas/{cuenta['id']}")
        assert resp.status_code == 204, resp.text

    def test_delete_cuenta_con_movimientos_409(self, client):
        cuenta = _crear_cuenta(client, "Con Movs")
        _crear_movimiento(client, cuenta["id"], "-10.00", "Cine")
        resp = client.delete(f"/api/v1/cuentas/{cuenta['id']}")
        assert resp.status_code == 409, resp.text
        assert resp.json()["error"]["codigo"] == "conflicto"

    def test_delete_cuenta_con_movimientos_archivar(self, client):
        cuenta = _crear_cuenta(client, "Archivar Destino")
        _crear_movimiento(client, cuenta["id"], "-10.00", "Cine")
        resp = client.delete(f"/api/v1/cuentas/{cuenta['id']}?confirmar_destino=archivar")
        assert resp.status_code == 204, resp.text
        lista = client.get("/api/v1/cuentas").json()
        archivadas = [itu for itu in lista["items"] if itu["id"] == cuenta["id"]]
        assert archivadas == []  # archivada → fuera de la lista de activas


class TestMovimientosContract:
    def test_post_movimiento_201_formato_contrato(self, client):
        cuenta = _crear_cuenta(client, "Contrato Mov")
        resp = client.post(
            "/api/v1/movimientos",
            json={
                "fecha": "2026-10-13",
                "importe": "-30.50",
                "descripcion": "Mercadona semanal",
                "cuenta_id": cuenta["id"],
                "categoria_id": None,
                "bote_id": None,
            },
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["importe"] == "-30.50"  # string de euros con signo
        assert data["descripcion"] == "Mercadona semanal"
        assert data["cuenta_id"] == cuenta["id"]
        assert data["bote_id"] is None
        assert data["marcar_revisar"] is False
        assert data["origen"] == "manual"

    def test_post_movimiento_importe_cero_400(self, client):
        cuenta = _crear_cuenta(client, "Cero Importe")
        resp = client.post(
            "/api/v1/movimientos",
            json={
                "fecha": "2026-10-13",
                "importe": "0.00",
                "descripcion": "No permitido",
                "cuenta_id": cuenta["id"],
                "categoria_id": None,
                "bote_id": None,
            },
        )
        assert resp.status_code == 400, resp.text
        assert resp.json()["error"]["codigo"] == "validacion"

    def test_post_movimiento_formato_no_numerico_400(self, client, hogar_id):
        cuenta = _crear_cuenta(client, "Formato Malo")
        resp = client.post(
            "/api/v1/movimientos",
            json={
                "fecha": "2026-10-13",
                "importe": "diez euros",
                "descripcion": "No número",
                "cuenta_id": cuenta["id"],
                "categoria_id": None,
                "bote_id": None,
            },
        )
        assert resp.status_code == 400, resp.text

    def test_post_movimiento_cuenta_inexistente_404(self, client):
        resp = client.post(
            "/api/v1/movimientos",
            json={
                "fecha": "2026-10-13",
                "importe": "-10.00",
                "descripcion": "Sin cuenta",
                "cuenta_id": "999999",
                "categoria_id": None,
                "bote_id": None,
            },
        )
        assert resp.status_code == 404, resp.text
        assert resp.json()["error"]["codigo"] == "no_encontrado"

    def test_get_movimientos_filtros_y_paginacion(self, client):
        cuenta = _crear_cuenta(client, "Filtros")
        _crear_movimiento(client, cuenta["id"], "-10.00", "Uno")
        _crear_movimiento(client, cuenta["id"], "-20.00", "Dos")
        _crear_movimiento(client, cuenta["id"], "45.00", "Tres")

        pag = client.get("/api/v1/movimientos", params={"limit": 1})
        assert pag.status_code == 200, pag.text
        assert len(pag.json()["items"]) == 1

        lista = client.get("/api/v1/movimientos", params={"cuenta": cuenta["id"]})
        importes = [m["importe"] for m in lista.json()["items"]]
        assert importes == ["-10.00", "-20.00", "45.00"]

        rango = client.get(
            "/api/v1/movimientos",
            params={"desde": "2026-10-20", "hasta": "2026-10-31"},
        )
        fecha_despues = "2026-11-01"
        resp_hasta = client.get("/api/v1/movimientos", params={"hasta": fecha_despues})
        assert resp_hasta.status_code == 200
        assert rango.json()["items"] == []  # nada en ese rango (fechas son 10-13)

    def test_patch_movimiento_registra_edicion(self, client):
        cuenta = _crear_cuenta(client, "Patch Mov")
        mov = _crear_movimiento(client, cuenta["id"], "-30.50", "Antes")
        resp = client.patch(
            f"/api/v1/movimientos/{mov['id']}",
            json={"importe": "-40.00", "descripcion": "Después"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["importe"] == "-40.00"

        reread = client.get(f"/api/v1/movimientos/{mov['id']}")
        assert reread.status_code == 200
        assert reread.json()["importe"] == "-40.00"

    def test_patch_movimiento_importe_cero_400(self, client):
        cuenta = _crear_cuenta(client, "Patch Cero")
        mov = _crear_movimiento(client, cuenta["id"], "-30.50", "Válido")
        resp = client.patch(f"/api/v1/movimientos/{mov['id']}", json={"importe": "0.00"})
        assert resp.status_code == 400, resp.text

    def test_delete_movimiento_borrado_logico(self, client):
        cuenta = _crear_cuenta(client, "Delete Mov")
        mov = _crear_movimiento(client, cuenta["id"], "-15.00", "Desaparecer")
        resp = client.delete(f"/api/v1/movimientos/{mov['id']}")
        assert resp.status_code == 204, resp.text

        lista = client.get("/api/v1/movimientos", params={"cuenta": cuenta["id"]})
        assert len(lista.json()["items"]) == 0  # borrado lógico: fuera del listado

    def test_liquidar_tarjeta_parcial_y_total(self, client):
        # 1. Banco con 1000 € y Tarjeta con 0 €
        banco = _crear_cuenta(
            client, "Banco Caixa Liquidar", saldo_inicial="1000.00", tipo="banco"
        )
        tarjeta = _crear_cuenta(
            client, "Tarjeta Pass Liquidar", saldo_inicial="0.00", tipo="tarjeta"
        )

        # 2. Gastos en tarjeta: 145 € (saldo -145.00 €)
        _crear_movimiento(client, tarjeta["id"], "-145.00", "Compra Carrefour")
        resp_t = client.get(f"/api/v1/cuentas/{tarjeta['id']}")
        assert resp_t.json()["saldo"] == "-145.00"

        # 3. Liquidación parcial: usuario indica que le cobran 115 € (quedan 30 € pendientes)
        resp_liq = client.post(
            f"/api/v1/cuentas/{tarjeta['id']}/liquidar",
            json={
                "cuenta_origen_id": banco["id"],
                "importe": "115.00",
                "concepto": "Recibo mensual Carrefour",
                "fecha": "2026-11-02",
            },
        )
        assert resp_liq.status_code == 201, resp_liq.text
        data = resp_liq.json()
        assert data["saldo_tarjeta"] == "-30.00"
        assert data["saldo_banco"] == "885.00"

        # 4. Liquidar los 30 € restantes
        resp_liq2 = client.post(
            f"/api/v1/cuentas/{tarjeta['id']}/liquidar",
            json={
                "cuenta_origen_id": banco["id"],
                "importe": "30.00",
            },
        )
        assert resp_liq2.status_code == 201
        assert resp_liq2.json()["saldo_tarjeta"] == "0.00"
        assert resp_liq2.json()["saldo_banco"] == "855.00"

        # 5. Validación: importe inválido o <= 0 devuelve 400
        resp_bad = client.post(
            f"/api/v1/cuentas/{tarjeta['id']}/liquidar",
            json={
                "cuenta_origen_id": banco["id"],
                "importe": "0.00",
            },
        )
        assert resp_bad.status_code == 400

