"""Contract tests de /api/v1/categorias (T040, US4) — escritos antes de implementar.

Per contracts/rest-api.md:
- POST   /categorias            → 201 (nombre, color?)
- GET    /categorias            → lista con `total` acumulado (periodo opcional
                                  via ?desde=&hasta=)
- GET    /categorias/{id}       → detalle con movimientos_asignados
- PATCH  /categorias/{id}       → editar (nombre/color); `total` ignorado
- DELETE /categorias/{id}       → 409 si en uso, salvo ?confirmar=true (FR-005)
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("_migrado")


def _crear_cuenta(client, nombre="Banco cat") -> dict:
    r = client.post(
        "/api/v1/cuentas",
        json={
            "nombre": nombre,
            "tipo": "banco",
            "entidad": None,
            "saldo_inicial": "1000.00",
            "fecha_apertura": "2026-10-01",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _crear_categoria(
    client,
    nombre,
    color=None,
) -> dict:
    r = client.post("/api/v1/categorias", json={"nombre": nombre, "color": color})
    assert r.status_code == 201, r.text
    return r.json()


def _crear_movimiento(
    client,
    cuenta_id,
    importe,
    desc,
    categoria_id=None,
    fecha="2025-06-01",
) -> dict:
    r = client.post(
        "/api/v1/movimientos",
        json={
            "fecha": fecha,
            "importe": importe,
            "descripcion": desc,
            "cuenta_id": cuenta_id,
            "categoria_id": categoria_id,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_post_crea_y_devuelve_el_contrato(client):
    r = client.post("/api/v1/categorias", json={"nombre": "Supermercado", "color": "#22c55e"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["nombre"] == "Supermercado"
    assert body["color"] == "#22c55e"
    assert body["total"] == "0.00"
    assert body["movimientos_asignados"] == 0


def test_post_duplicado_409(client):
    assert client.post("/api/v1/categorias", json={"nombre": "Comida"}).status_code == 201
    r = client.post("/api/v1/categorias", json={"nombre": "Comida"})
    assert r.status_code == 409
    assert r.json()["error"]["codigo"] == "conflicto"


def test_post_importe_invalido_via_movimiento(client):
    cuenta = _crear_cuenta(client)
    cat = _crear_categoria(client, "Ocio")
    r = client.post(
        "/api/v1/movimientos",
        json={
            "fecha": "2025-06-01",
            "importe": "0.00",
            "descripcion": "nada",
            "cuenta_id": cuenta["id"],
            "categoria_id": cat["id"],
        },
    )
    assert r.status_code == 400  # regla compartida con movimientos


def test_get_lista_con_totales_y_periodo(client):
    cuenta = _crear_cuenta(client)
    cat = _crear_categoria(client, "Ocio")
    otra = _crear_categoria(client, "Gasolina")
    _crear_movimiento(client, cuenta["id"], "-30.00", "cine", cat["id"], fecha="2025-06-01")
    _crear_movimiento(client, cuenta["id"], "-50.00", "gasolina", otra["id"], fecha="2025-06-02")

    total = {c["nombre"]: c["total"] for c in client.get("/api/v1/categorias").json()["items"]}
    assert total["Ocio"] == "-30.00"
    assert total["Gasolina"] == "-50.00"

    periodo = client.get("/api/v1/categorias?desde=2025-06-02&hasta=2025-06-30").json()
    total_p = {c["nombre"]: c["total"] for c in periodo["items"]}
    assert total_p["Ocio"] == "0.00"
    assert total_p["Gasolina"] == "-50.00"


def test_get_detalle_con_recuento(client):
    cuenta = _crear_cuenta(client)
    cat = _crear_categoria(client, "Salud")
    _crear_movimiento(client, cuenta["id"], "-15.00", "farmacia", cat["id"])
    r = client.get(f"/api/v1/categorias/{cat['id']}")
    assert r.status_code == 200
    assert r.json()["movimientos_asignados"] == 1
    assert client.get("/api/v1/categorias/9999").status_code == 404


def test_patch_edita_e_ignora_derivados(client):
    cat = _crear_categoria(client, "Viejo")
    r = client.patch(f"/api/v1/categorias/{cat['id']}", json={"nombre": "Nuevo", "total": "999.00"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nombre"] == "Nuevo"
    assert body["total"] == "0.00"  # derivado: nunca editable (Principio II)


def test_delete_protegido_y_confirmado(client):
    cuenta = _crear_cuenta(client)
    cat = _crear_categoria(client, "En uso")
    _crear_movimiento(client, cuenta["id"], "-10.00", "x", cat["id"])

    r = client.delete(f"/api/v1/categorias/{cat['id']}")
    assert r.status_code == 409
    assert r.json()["error"]["codigo"] == "conflicto"

    r = client.delete(f"/api/v1/categorias/{cat['id']}?confirmar=true")
    assert r.status_code == 204
    assert client.get("/api/v1/categorias").json()["items"] == []
    # el movimiento queda sin categoría (pero vivo)
    mov = client.get("/api/v1/movimientos").json()["items"][0]
    assert mov["categoria_id"] is None


def test_delete_sin_movimientos_pasa_directo(client):
    cat = _crear_categoria(client, "Libre")
    assert client.delete(f"/api/v1/categorias/{cat['id']}").status_code == 204
