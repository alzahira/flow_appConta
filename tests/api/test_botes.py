"""Contract tests de /api/v1/botes y PATCH /movimientos/{id}/bote (T032, US3).

Per contracts/rest-api.md: GET lista con saldo derivado/objetivo/estado,
POST/PATCH/DELETE (archiva con confirmación) y reasignación de bote.
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("_migrado")


def _crear_cuenta(client, nombre="Banco", saldo_inicial="1000.00") -> dict:
    r = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": nombre,
            "tipo": "banco",
            "entidad": None,
            "saldo_inicial": saldo_inicial,
            "fecha_apertura": "2026-10-01",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _crear_bote(client, nombre, tipo="ahorro", objetivo=None) -> dict:
    r = client.post(
        "/api/v1/botes",
        json={"nombre": nombre, "tipo": tipo, "objetivo": objetivo, "objetivo_fecha": None},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _crear_movimiento(client, cuenta_id: int, importe: str, desc: str, bote_id=None) -> dict:
    r = client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2026-10-25",
            "importe": importe,
            "descripcion": desc,
            "cuenta_id": cuenta_id,
            "bote_id": bote_id,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


class TestBotesContract:
    def test_post_bote_201(self, client):
        bote = _crear_bote(client, "Vacaciones", tipo="ahorro", objetivo="60.00")
        assert bote["nombre"] == "Vacaciones"
        assert bote["tipo"] == "ahorro"
        assert bote["objetivo"] == "60.00"
        assert bote["saldo"] == "0.00"  # derivado, empieza a 0
        assert bote["estado"] == "en_curso"
        assert bote["archivado"] is False

    def test_post_bote_nombre_duplicado_409(self, client):
        _crear_bote(client, "Duplicado")
        r = client.post(
            "/api/v1/botes",
            json={"nombre": "Duplicado", "tipo": "ahorro"},
        )
        assert r.status_code == 409, r.text
        assert r.json()["error"]["codigo"] == "conflicto"

    def test_post_bote_tipo_invalido_400(self, client):
        r = client.post("/api/v1/botes", json={"nombre": "X", "tipo": "chatarra"})
        assert r.status_code == 400, r.text

    def test_get_botes_con_saldo_derivado(self, client):
        cuenta = _crear_cuenta(client)
        bote = _crear_bote(client, "Con saldo")
        mov = _crear_movimiento(client, cuenta["id"], "1500.00", "aportación")
        r = client.patch(f"/api/v1/movimientos/{mov['id']}/bote", json={"bote_id": bote["id"]})
        assert r.status_code == 200, r.text

        data = client.get("/api/v1/botes").json()
        assert isinstance(data["items"], list)
        bote_lista = next(b for b in data["items"] if b["id"] == bote["id"])
        assert bote_lista["saldo"] == "1500.00"
        assert "total" in data

    def test_get_bote_inexistente_404(self, client):
        r = client.get("/api/v1/botes/999999")
        assert r.status_code == 404
        assert r.json()["error"]["codigo"] == "no_encontrado"

    def test_patch_bote_edita_campos_no_derivados(self, client):
        bote = _crear_bote(client, "Editable", objetivo="60.00")
        r = client.patch(
            f"/api/v1/botes/{bote['id']}", json={"nombre": "Editable 2", "objetivo": "80.00"}
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["nombre"] == "Editable 2"
        assert data["objetivo"] == "80.00"

    def test_patch_bote_no_permite_editar_saldo(self, client):
        bote = _crear_bote(client, "Saldo fijo")
        r = client.patch(f"/api/v1/botes/{bote['id']}", json={"saldo": "999.00"})
        assert r.status_code == 200, r.text
        assert r.json()["saldo"] == "0.00"  # Principio II: nunca editable

    def test_delete_bote_sin_movimientos(self, client):
        bote = _crear_bote(client, "Vacío")
        r = client.delete(f"/api/v1/botes/{bote['id']}")
        assert r.status_code == 204, r.text

    def test_delete_bote_con_movimientos_409_y_confirmacion(self, client):
        cuenta = _crear_cuenta(client)
        bote = _crear_bote(client, "Con movs")
        mov = _crear_movimiento(client, cuenta["id"], "-30.00", "gasto")
        client.patch(f"/api/v1/movimientos/{mov['id']}/bote", json={"bote_id": bote["id"]})

        r = client.delete(f"/api/v1/botes/{bote['id']}")
        assert r.status_code == 409, r.text

        r = client.delete(f"/api/v1/botes/{bote['id']}?confirmar=true")
        assert r.status_code == 204, r.text

        # el movimiento queda "sin asignar" (visible en listado general)
        lista = client.get("/api/v1/movimientos").json()
        assert any(mo["id"] == mov["id"] and mo["bote_id"] is None for mo in lista["items"])


class TestReasignarBoteContract:
    def test_patch_mov_bote_reasigna(self, client):
        cuenta = _crear_cuenta(client)
        bote1 = _crear_bote(client, "Desde")
        bote2 = _crear_bote(client, "Hacia")
        mov = _crear_movimiento(client, cuenta["id"], "-20.00", "vía API", bote_id=bote1["id"])

        r = client.patch(f"/api/v1/movimientos/{mov['id']}/bote", json={"bote_id": bote2["id"]})
        assert r.status_code == 200, r.text
        assert r.json()["bote_id"] == bote2["id"]

    def test_patch_mov_bote_null_sin_asignar(self, client):
        cuenta = _crear_cuenta(client)
        bote = _crear_bote(client, "Temporal")
        mov = _crear_movimiento(client, cuenta["id"], "-20.00", "va a salir", bote_id=bote["id"])
        r = client.patch(f"/api/v1/movimientos/{mov['id']}/bote", json={"bote_id": None})
        assert r.status_code == 200, r.text
        assert r.json()["bote_id"] is None

    def test_patch_mov_bote_inexistente_404(self, client):
        cuenta = _crear_cuenta(client)
        mov = _crear_movimiento(client, cuenta["id"], "-20.00", "suelto")
        r = client.patch(f"/api/v1/movimientos/{mov['id']}/bote", json={"bote_id": 999999})
        assert r.status_code == 404, r.text

    def test_post_mov_permite_bote_id_directo(self, client):
        cuenta = _crear_cuenta(client)
        bote = _crear_bote(client, "Alta directa")
        mov = _crear_movimiento(client, cuenta["id"], "-10.00", "nace asignado", bote_id=bote["id"])
        assert mov["bote_id"] == bote["id"]
