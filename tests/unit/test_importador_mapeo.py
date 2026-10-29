"""Tests unitarios del mapeo del importador (T045, US5) — escritos antes de implementar.

Cada regla de contracts/importador.md comprobada sobre hojas SINTÉTICAS
(pequeñas, construidas con openpyxl en memoria):
- signos: pasan tal cual (gasto negativo / ingreso positivo)
- >2 decimales → ROUND_HALF_UP + aviso
- #REF! → aviso (hoja/fila/motivo), sin movimiento
- importe 0 → omitido + aviso
- fianzas → bote tipo `ajeno`
- nombres de mes → fecha 2025-MM-01
- el bote Coche NO se duplica entre BOTES PROPIOS y COCHE PREST.
"""

from __future__ import annotations

from decimal import Decimal

import openpyxl

from app_conta.services.importador import mapeo


def _wb(titulo: str, filas: list[list[object]]):
    """Hoja sintética: filas de listas indexadas desde la columna A."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = titulo
    for fila in filas:
        ws.append(fila)
    return ws


# ---------------------------------------------------------------- CAJA


def test_caja_cuenta_efectivo_desde_bloque():
    ws = _wb(
        "CAJA",
        [
            [None, "COGIDO A CUENTA Y EFECTIVOS", None, None, "CAJA", Decimal("165.7")],
        ],
    )
    resultado = mapeo.mapear_caja(ws)
    efectivo = next(c for c in resultado["cuentas"] if c["nombre"] == "Efectivo (CAJA)")
    assert efectivo["tipo"] == "efectivo"
    assert efectivo["saldo_inicial_centimos"] == 16570


def test_caja_bloques_tarjetas_bancos_y_otros():
    ws = _wb(
        "CAJA",
        [
            [None, "GASTOS TARJETAS", None],
            [None, "TARJETA CAIXA", 0],
            [None, "TARJETA DB.", Decimal("-59.1")],
            [None, "TOTAL", Decimal("-59.1")],
            [None, "EN BANCOS", None],
            [None, "DISPONIBLE CAIXA", Decimal("-2132")],
            [None, "TOTAL", Decimal("-2132")],
            [None, "TARJETAS Y OTROS", None],
            [None, "INVERSIONES ETORO", Decimal("-1500")],
            [None, "FLORINES", Decimal("-6")],
            [None, "TOTAL", Decimal("-1506")],
        ],
    )
    resultado = mapeo.mapear_caja(ws)
    por_nombre = {c["nombre"]: c for c in resultado["cuentas"]}
    assert por_nombre["TARJETA DB."]["tipo"] == "tarjeta"
    assert por_nombre["TARJETA CAIXA"]["saldo_inicial_centimos"] == 0
    assert por_nombre["DISPONIBLE CAIXA"]["tipo"] == "banco"
    assert por_nombre["INVERSIONES ETORO"]["tipo"] == "inversion"
    assert por_nombre["FLORINES"]["tipo"] != "inversion"  # divisa pequeña, no inversión
    assert all(c["nombre"] != "TOTAL" for c in resultado["cuentas"])  # agregados fuera


# ---------------------------------------------------------------- TARJETAS


def test_tarjeta_signo_passthrough_y_actual():
    ws = _wb(
        "TARJETA DB",
        [
            [None, "RECIBO TARJETA DB", Decimal("59.1")],
            [None, "Pepco", Decimal("-11.5")],
        ],
    )
    movs, _avisos = mapeo.mapear_hoja_tarjeta(ws, "TARJETA DB.")
    assert movs[0]["importe_centimos"] == 5910  # positivo tal cual
    assert movs[1]["importe_centimos"] == -1150  # gasto negativo
    assert movs[1]["cuenta"] == "TARJETA DB."
    assert movs[0]["bote"] is None  # las tarjetas no llevan bote


def test_tarjeta_redondeo_half_up_con_aviso():
    ws = _wb("TARJETA CARREFOUR", [[None, "SUPECO", Decimal("-37.309999999999995")]])
    movs, avisos = mapeo.mapear_hoja_tarjeta(ws, "TARJETA CARREFOUR")
    assert movs[0]["importe_centimos"] == -3731  # ROUND_HALF_UP
    assert any("redonde" in a["motivo"] for a in avisos)


def test_tarjeta_importe_cero_omitido_con_aviso():
    ws = _wb("TARJETA CAIXA", [[None, "RECIBO TARJETA CAIXA", 0]])
    movs, avisos = mapeo.mapear_hoja_tarjeta(ws, "TARJETA CAIXA")
    assert movs == []
    assert any("0" in a["motivo"] for a in avisos)


# ---------------------------------------------------------------- HIPOTECAS


def test_hipoteca_ref_genera_un_aviso_agregado_y_nada_mas():
    ws = _wb(
        "HIP. PISO NOV (MENS.)",
        [
            [None, "Mes", "Cuota", "Interes"],
            ["2025-06-01", "#REF!", "#REF!", "#REF!"],
            ["2025-07-01", "#REF!", "#REF!", "#REF!"],
        ],
    )
    avisos = mapeo.mapear_hoja_hipoteca(ws)
    ref = next(a for a in avisos if "#REF!" in a["motivo"])
    assert ref["hoja"] == "HIP. PISO NOV (MENS.)"
    assert ref["fila"] is None  # aviso agregado, no por fila


# ---------------------------------------------------------------- BOTES PROPIOS


def test_botes_propios_tipos_y_semillas():
    ws = _wb(
        "BOTES PROPIOS",
        [
            [None, "BOTES", "CANTIDAD"],
            [None, "Bote Javi", Decimal("20.32")],
            [None, "Fianza César Piso Córdoba", Decimal("580")],
            [None, "TOTAL", Decimal("600.32")],
        ],
    )
    botes, movs, _avisos = mapeo.mapear_botes_propios(ws)
    por_nombre = {b["nombre"]: b for b in botes}
    assert por_nombre["Bote Javi"]["tipo"] == "ahorro"
    assert por_nombre["Fianza César Piso Córdoba"]["tipo"] == "ajeno"
    # bote con importe → semilla con el importe del Excel (saldo derivado exacto)
    assert len(movs) == 2
    assert por_nombre["Bote Javi"]["seed_centimos"] == 2032
    assert por_nombre["Fianza César Piso Córdoba"]["seed_centimos"] == 58000


def test_botes_propios_abreviatura_fianza_vacia_y_bloque_devoluciones():
    ws = _wb(
        "BOTES PROPIOS",
        [
            [None, "BOTES", "CANTIDAD"],
            [None, "Bote Aitor   -- Regalo cumpleaños", Decimal("-140.40")],
            [None, "Fianza Cañete está en la Caja Fuerte", None],
            [None, "Fianza Nerea", Decimal("490")],
            [None, "TOTAL", Decimal("349.6")],
            [None, "DEVOLUCIONES PENDIENTES", None],
            [None, "Café - 2 Paquetes", Decimal("-10")],
        ],
    )
    botes, movs, avisos = mapeo.mapear_botes_propios(ws)
    aitor = next(b for b in botes if b["nombre"] == "Bote Aitor")
    cañete = next(b for b in botes if b["nombre"].startswith("Fianza Cañete"))
    assert aitor["seed_centimos"] == -14040  # nombre recortado en " -- "
    assert cañete["seed_centimos"] is None  # sin importe: bote a 0
    assert len(movs) == 2  # Aitor + Nerea; Cañete sin semilla
    assert any("devoluciones" in a["motivo"].lower() for a in avisos)


def test_botes_propios_coche_no_duplica():
    ws = _wb(
        "BOTES PROPIOS",
        [
            [None, "BOTES", "CANTIDAD"],
            [None, "Coche", Decimal("-8052.06")],
            [None, "TOTAL", Decimal("-8052.06")],
        ],
    )
    botes, _movs, avisos = mapeo.mapear_botes_propios(ws)
    assert botes == []
    assert any("Coche" in a["motivo"] for a in avisos)


# ------------------------------------------------- BOTE PARA GASTOS 2026


def test_bote_gastos_2026_semilla_redondeada():
    ws = _wb(
        "BOTE PARA GASTOS  2026",
        [
            [None, "CONCEPTO", "FECHA COBRO", "TOTAL", "MENSUAL", None],
            [
                None,
                "Basura Cañete",
                "Marzo / Julio",
                Decimal("140"),
                Decimal("11.666666666666666"),
                None,
            ],
            [None, "TOTAL BOTE GASTOS", None, None, None, Decimal("-119.08333333333343")],
        ],
    )
    botes, movs, avisos = mapeo.mapear_bote_gastos_2026(ws)
    assert len(botes) == 1
    assert botes[0]["tipo"] == "recurrente"
    assert botes[0]["seed_centimos"] == -11908  # ROUND_HALF_UP de −119.083…
    assert len(movs) == 1
    assert any(bool(a) for a in avisos)  # la tabla mensual queda para fase 2


# ---------------------------------------------------------------- AHORROS


def test_ahorros_meses_a_fechas_2025():
    ws = _wb(
        "AHORROS",
        [
            [None, "BOTE DE AHORRO PARA HIPO..", None],
            [None, "Enero   ** EXTRA COMUNION", Decimal("914")],
            [None, "Septiembre  **Este mes llega", Decimal("797")],
            [None, "TOTAL FONDO HIPOTECAS", Decimal("2211")],
        ],
    )
    botes, movs, _avisos = mapeo.mapear_ahorros(ws)
    assert botes[0]["nombre"] == "Fondo hipotecas"
    por_fecha = {m["fecha"].isoformat(): m for m in movs}
    assert por_fecha["2025-01-01"]["importe_centimos"] == 91400
    assert por_fecha["2025-09-01"]["importe_centimos"] == 79700
    assert por_fecha["2025-01-01"]["bote"] == "Fondo hipotecas"
    assert len(movs) == 2  # el TOTAL no es movimiento


def test_ahorros_bote_extras_con_gastos_y_arreglos():
    ws = _wb(
        "AHORROS",
        [
            [None, "BOTE ARREGLOS CÓRDOBA - Iphone", Decimal("-373.70000000000005")],
            [None, "BOTE DE AHORRO PARA EXTR", None],
            [None, "Enero", Decimal("110")],
            [None, "Gastado", Decimal("-110")],
            [None, "TOTAL AHORRO", Decimal("0")],
            [None, "GASTOS DESDE BOTE EXTRA", None],
            [None, "Patronato", Decimal("-69")],
            [None, "Dentista", Decimal("-65")],
        ],
    )
    botes, movs, _avisos = mapeo.mapear_ahorros(ws)
    nombres = {b["nombre"] for b in botes}
    assert nombres == {"Bote arreglos Córdoba", "Bote extras 2025"}
    extras = [m for m in movs if m["bote"] == "Bote extras 2025"]
    assert len(extras) == 3  # Enero + 2 gastos; Gastado/TOTAL omitidos
    assert sum(m["importe_centimos"] for m in extras) == 11000 - 6900 - 6500


# ---------------------------------------------------------------- COCHE


def test_coche_entregas_y_costes_hacen_total_debo():
    ws = _wb(
        "COCHE PREST.",
        [
            [None, "TOTAL DEBO", Decimal("-8052.060000000001")],
            [None, "GASTADO COCHE", None],
            [None, "Coste coche", Decimal("12700")],
            [None, "Lavado", Decimal("35")],
            [None, "COSTE TOTAL", Decimal("12735")],
            [None, "ENTREGADO", None],
            [None, "Febrero", Decimal("200")],
            [None, "Octubre", Decimal("828")],
            [None, "TOTAL ENTREGADO", Decimal("1028")],
            [None, "PENDIENTE POR PAGAR", Decimal("-8052.06")],
        ],
    )
    botes, movs, _avisos = mapeo.mapear_coche(ws)
    assert botes[0]["nombre"] == "Coche"
    assert botes[0]["tipo"] == "proyecto"
    assert len(movs) == 4  # 2 costes + 2 entregas
    # normalizado: entregas positivas y costes negativos
    assert sum(m["importe_centimos"] for m in movs) == 20000 + 82800 - 1270000 - 3500


# ---------------------------------------------------------------- SUELDO


def test_sueldo_complementarias_extras_y_base_ref():
    ws = _wb(
        "SUELDO M.JOSE",
        [
            [None, "AGOSTO", "1 al 2", None, None, None, None, None, None],
            [None, None, "HORAS COMPLEMENTARIAS", 40, None, None, None, None, Decimal("400.4")],
            [None, None, "HORAS EXTRA", Decimal("14.55"), Decimal("218.97750000000002")],
            [None, None, "SALARIO BASE + PRODUCTIV", None, None, None, None, "#REF!", "#REF!"],
        ],
    )
    movs, _botes, avisos = mapeo.mapear_sueldo(ws)
    por_desc = {m["descripcion"]: m for m in movs}
    assert por_desc["Horas complementarias (AGOSTO 2025)"]["importe_centimos"] == 40040
    assert por_desc["Horas extra (AGOSTO 2025)"]["importe_centimos"] == 21898
    assert por_desc["Horas complementarias (AGOSTO 2025)"]["bote"] is None
    # SALARIO BASE con #REF! → aviso, SIN movimiento (no hay importe fiable)
    assert len(movs) == 2
    assert any("#REF!" in a["motivo"] and (a["hoja"] or "").startswith("SUELDO") for a in avisos)


def test_sueldo_bote_salario_con_meses_y_extras():
    ws = _wb(
        "SUELDO M.JOSE",
        [
            [None, None, "BOTE DE AHORRO SALARIO M.JOSE"],
            [None, None, "Total año 2025", None, None, None, None, None, 5081],
            [None, None, "Extras 2025", None, None, None, None, None, 2658],
            [None, None, "Enero", None, None, None, None, None, 731],
            [None, None, "Extra Enero", None, None, None, None, None, 928],
            [None, None, "TOTAL GANADO", None, None, None, None, None, 6219],
        ],
    )
    movs, botes, _avisos = mapeo.mapear_sueldo(ws)
    assert botes[0]["nombre"] == "Ahorro salario M.José"
    assert botes[0]["tipo"] == "ahorro"
    bote_movs = [m for m in movs if m["bote"] == "Ahorro salario M.José"]
    assert len(bote_movs) == 2  # Enero + Extra Enero; agregados fuera
    assert sum(m["importe_centimos"] for m in bote_movs) == 73100 + 92800


# ---------------------------------------------------------------- ANUARIO


def test_anuario_fuera_del_mvp():
    ws = _wb("ANUARIO DE GASTOS TRAS REV.", [[None, "GASTOS", None]])
    avisos = mapeo.mapear_anuario(ws)
    assert len(avisos) == 1
    assert "MVP" in avisos[0]["motivo"]


# --------------------------------------------------------------- utilidades


def test_redondeo_centimos_half_up():
    assert mapeo.redondear_centimos(Decimal("-119.08333333333343")) == -11908
    assert mapeo.redondear_centimos(Decimal("218.97750000000002")) == 21898
    assert mapeo.redondear_centimos(Decimal("-1.7")) == -170
    assert mapeo.redondear_centimos(Decimal("0.005")) == 1  # half-up


def test_mes_espanol_a_fecha():
    assert mapeo.mes_a_fecha("Enero   ** EXTRA").isoformat() == "2025-01-01"
    assert mapeo.mes_a_fecha("Septiembre  **Este").isoformat() == "2025-09-01"
    assert mapeo.mes_a_fecha("Diciembre").isoformat() == "2025-12-01"


def test_categorias_derivadas():
    assert mapeo.categoria_para("MERCADONA semanal") == "Supermercado"
    assert mapeo.categoria_para("GASOLINA") == "Gasolina"
    assert mapeo.categoria_para("Hipoteca Piso") == "Hipoteca"
    assert mapeo.categoria_para("lo que sea raro") == "Sin clasificar"
