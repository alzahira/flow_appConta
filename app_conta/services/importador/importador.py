"""Orquestador del importador (US5, T048/T050): previsualizar y aplicar.

FR-009: previsualización SIEMPRE obligatoria antes de escribir nada.
FR-010: huella sha256; repetición exige confirmación explícita.
Regla de conciliación: todos los movimientos importados viven en cuentas
activas, así que `Σ movimientos = botes + sin_asignar` y el cuadre es
exacto por construcción.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.bote import Bote
from app_conta.models.categoria import Categoria
from app_conta.models.cuenta import Cuenta
from app_conta.models.hogar import Hogar  # noqa: F401  (FK carga)
from app_conta.models.importacion import Importacion
from app_conta.models.movimiento import Movimiento
from app_conta.services.cuentas import obtener_hogar_unico
from app_conta.services.dinero import euros_str
from app_conta.services.errors import ErrorConflicto
from app_conta.services.importador import lector, mapeo

_TARJETAS = (
    ("TARJETA DB", "TARJETA DB."),
    ("TARJETA CARREFOUR", "TARJETA CARREFOUR"),
    ("TARJETA CAIXA", "TARJETA CAIXA"),
)

_NOMBRES_AHORROS = ("Fondo hipotecas", "Bote arreglos Córdoba", "Bote extras 2025")


def _hoja(wb, nombre):
    return wb[nombre] if nombre in wb.sheetnames else None


def _valor_de_hoja(ws, buscado_en_b: str, indice_col: int):
    """Primera fila con texto EXACTO en col B → Decimal de la col dada."""
    for fila in ws.iter_rows(values_only=True):
        etiqueta = mapeo._texto(fila[1]) if len(fila) > 1 else None
        if etiqueta == buscado_en_b:
            return mapeo._num(fila[indice_col]) if len(fila) > indice_col else None
    return None


def _valor_por_col_d(ws, buscado_en_d: str, indice_col: int):
    """Primera fila con texto en col C que EMPIEZA por el buscado → Decimal."""
    for fila in ws.iter_rows(values_only=True):
        col_c = mapeo._texto(fila[2]) if len(fila) > 2 else None
        if col_c and col_c.startswith(buscado_en_d):
            return mapeo._num(fila[indice_col]) if len(fila) > indice_col else None
    return None


def _construir_plan(nombre_fichero: str, datos: bytes) -> dict:
    """Mapea el libro completo → propuestas (sin tocar la BD)."""
    wb = lector.abrir_libro(datos)
    cuentas: list[dict] = []
    botes: list[dict] = []
    movimientos: list[dict] = []
    avisos: list[dict] = []

    nombres_botes_propios: list[str] = []
    ws_caja = _hoja(wb, "CAJA")
    if ws_caja is not None:
        caja = mapeo.mapear_caja(ws_caja)
        cuentas.extend(caja["cuentas"])
        avisos.extend(caja["avisos"])

    for hoja, nombre_cuenta in _TARJETAS:
        ws = _hoja(wb, hoja)
        if ws is not None:
            movs, avisos_t = mapeo.mapear_hoja_tarjeta(ws, nombre_cuenta)
            movimientos.extend(movs)
            avisos.extend(avisos_t)

    ws_gastos = _hoja(wb, "GASTOS FIJOS MENSUALES 2025")
    if ws_gastos is not None:
        movs, avisos_g = mapeo.mapear_gastos_fijos(ws_gastos)
        movimientos.extend(movs)
        avisos.extend(avisos_g)

    ws_botes_propios = _hoja(wb, "BOTES PROPIOS")
    if ws_botes_propios is not None:
        botes_hoja, movs, avisos_h = mapeo.mapear_botes_propios(ws_botes_propios)
        botes.extend(botes_hoja)
        movimientos.extend(movs)
        avisos.extend(avisos_h)
        nombres_botes_propios = [b["nombre"] for b in botes_hoja]

    ws_bote26 = _hoja(wb, "BOTE PARA GASTOS  2026")
    if ws_bote26 is not None:
        botes_hoja, movs, avisos_h = mapeo.mapear_bote_gastos_2026(ws_bote26)
        botes.extend(botes_hoja)
        movimientos.extend(movs)
        avisos.extend(avisos_h)

    ws_ahorros = _hoja(wb, "AHORROS")
    if ws_ahorros is not None:
        botes_hoja, movs, avisos_h = mapeo.mapear_ahorros(ws_ahorros)
        botes.extend(botes_hoja)
        movimientos.extend(movs)
        avisos.extend(avisos_h)

    ws_coche = _hoja(wb, "COCHE PREST.")
    if ws_coche is not None:
        botes_hoja, movs, avisos_h = mapeo.mapear_coche(ws_coche)
        botes.extend(botes_hoja)
        movimientos.extend(movs)
        avisos.extend(avisos_h)

    ws_sueldo = _hoja(wb, "SUELDO M.JOSE")
    if ws_sueldo is not None:
        movs, botes_hoja, avisos_h = mapeo.mapear_sueldo(ws_sueldo)
        movimientos.extend(movs)
        botes.extend(botes_hoja)
        avisos.extend(avisos_h)

    for hoja in ("HIP. PISO NOV (MENS.)", "HIP. ESTUDIO", "HIP. PISO CÓRDOBA"):
        ws = _hoja(wb, hoja)
        if ws is not None:
            avisos.extend(mapeo.mapear_hoja_hipoteca(ws))

    ws_anuario = _hoja(wb, "ANUARIO DE GASTOS TRAS REV.")
    if ws_anuario is not None:
        avisos.extend(mapeo.mapear_anuario(ws_anuario))

    # El histórico reconstruido vive en su propia cuenta (decisión de diseño:
    # los saldos por cuenta del Excel son el estado FINAL del mes; mover el
    # histórico aquí evita doble cómputo mientras las tarjetas conservan el
    # detalle de recibo del mes).
    cuentas.append({"nombre": mapeo.CTA_HISTORIAL, "tipo": "banco", "saldo_inicial_centimos": 0})

    return {
        "cuentas": cuentas,
        "botes": botes,
        "movimientos": movimientos,
        "avisos": avisos,
        "nombres_botes_propios": nombres_botes_propios,
    }


def _diferencias_conciliacion(plan: dict, datos: bytes) -> list[dict]:
    """Comparación SC-004: saldo del Excel (grupo) vs derivado en la app."""
    saldo_por_bote: dict[str, int] = {}
    for mov in plan["movimientos"]:
        if mov["bote"] is not None:
            saldo_por_bote[mov["bote"]] = (
                saldo_por_bote.get(mov["bote"], 0) + mov["importe_centimos"]
            )

    wb = lector.abrir_libro(datos)
    grupos: list[tuple[str, int | None, int]] = []

    # Botes propios: fila TOTAL de BOTES PROPIOS incluye al bote Coche
    ws_bp = _hoja(wb, "BOTES PROPIOS")
    if ws_bp is not None:
        total = _valor_de_hoja(ws_bp, "TOTAL", 2)
        names = plan["nombres_botes_propios"] + ["Coche"]
        app = sum(saldo_por_bote.get(n, 0) for n in names)
        if total is not None:
            grupos.append(("Botes propios", total, app))

    # AHORROS: fila BOTE AHORRO 2025 de CAJA = fondo + arreglos + extras
    ws_caja = _hoja(wb, "CAJA")
    if ws_caja is not None:
        total = _valor_de_hoja(ws_caja, "BOTE AHORRO 2025", 2)
        app = sum(saldo_por_bote.get(n, 0) for n in _NOMBRES_AHORROS)
        if total is not None:
            grupos.append(("Bote ahorro 2025", total, app))

    ws_bote26 = _hoja(wb, "BOTE PARA GASTOS  2026")
    if ws_bote26 is not None:
        total = _valor_de_hoja(ws_bote26, "TOTAL BOTE GASTOS", 5)
        app = saldo_por_bote.get("Bote para gastos 2026", 0)
        if total is not None:
            grupos.append(("Bote para gastos recurrente", total, app))

    ws_coche = _hoja(wb, "COCHE PREST.")
    if ws_coche is not None:
        total = _valor_de_hoja(ws_coche, "TOTAL DEBO", 2)
        app = saldo_por_bote.get("Coche", 0)
        if total is not None:
            grupos.append(("Coche", total, app))

    # Sueldo M.José: los agregados del Excel descuentan 40 €/mes de gasolina
    # que aquí no importamos como gasto del bote → diferencia listada igual.
    ws_sueldo = _hoja(wb, "SUELDO M.JOSE")
    if ws_sueldo is not None:
        ganado = _valor_por_col_d(ws_sueldo, "TOTAL GANADO", 8)
        extras = _valor_por_col_d(ws_sueldo, "TOTAL EXTRAS", 8)
        app = saldo_por_bote.get("Ahorro salario M.José")
        if ganado is not None and extras is not None and app is not None:
            grupos.append(("Ahorro salario M.José", ganado + extras, app))

    resultado = []
    for etiqueta, excel_cent, app_cent in grupos:
        excel_redondo = mapeo.redondear_centimos(excel_cent)
        resultado.append(
            {
                "bote": etiqueta,
                "excel": euros_str(excel_redondo),
                "app": euros_str(app_cent),
                "diferencia": euros_str(app_cent - excel_redondo),
            }
        )
    return resultado


def _resumen(plan: dict) -> dict:
    return {
        "cuentas": len(plan["cuentas"]),
        "botes": len(plan["botes"]),
        "movimientos": len(plan["movimientos"]),
        "categorias": len({m["categoria"] or "Sin clasificar" for m in plan["movimientos"]}),
        "saldo_total_cuentas": euros_str(sum(c["saldo_inicial_centimos"] for c in plan["cuentas"])),
    }


def _es_repetido(db: Session, huella: str) -> bool:
    return db.scalar(select(Importacion).where(Importacion.huella == huella)) is not None


def previsualizar(db: Session, nombre_fichero: str, datos: bytes) -> dict:
    plan = _construir_plan(nombre_fichero, datos)
    huella = lector.calcular_huella(datos)
    return {
        "fichero": {
            "nombre": nombre_fichero,
            "huella": huella,
            "repetido": _es_repetido(db, huella),
        },
        "resumen": _resumen(plan),
        "avisos": plan["avisos"],
        "diferencias_conciliacion": _diferencias_conciliacion(plan, datos),
    }


def _categorizar(db: Session, hogar_id: int, nombre: str) -> Categoria:
    row = db.scalar(
        select(Categoria).where(Categoria.hogar_id == hogar_id, Categoria.nombre == nombre)
    )
    if row is None:
        row = Categoria(hogar_id=hogar_id, nombre=nombre)
        db.add(row)
        db.flush()
    return row


def aplicar(
    db: Session,
    nombre_fichero: str,
    datos: bytes,
    confirmar_repetido: bool = False,
) -> dict:
    """Persiste cuentas/botes/categorías/movimientos + registro de importación.

    Con `confirmar_repetido=True`, los elementos que ya existen (mismo nombre)
    se reutilizan y los movimientos se añaden otra vez: es la duplicación
    explícita que pide FR-010.
    """
    huella = lector.calcular_huella(datos)
    if _es_repetido(db, huella) and not confirmar_repetido:
        raise ErrorConflicto(
            "El fichero ya se ha importado (misma huella sha256). "
            "Repite con ?confirmar_repetido=true para duplicarlo igualmente."
        )

    plan = _construir_plan(nombre_fichero, datos)
    hogar_id = obtener_hogar_unico(db)

    mapas: dict[str, Cuenta] = {}
    for cuenta in plan["cuentas"]:
        existente = db.scalar(select(Cuenta).where(Cuenta.nombre == cuenta["nombre"]))
        if existente is None:
            existente = Cuenta(
                hogar_id=hogar_id,
                nombre=cuenta["nombre"],
                tipo=cuenta["tipo"],
                saldo_inicial_centimos=cuenta["saldo_inicial_centimos"],
                fecha_apertura=date(2025, 10, 1),
            )
            db.add(existente)
            db.flush()
        mapas[cuenta["nombre"]] = existente

    botes_bd: dict[str, Bote] = {}
    for bote in plan["botes"]:
        existente = db.scalar(select(Bote).where(Bote.nombre == bote["nombre"]))
        if existente is None:
            existente = Bote(
                hogar_id=hogar_id,
                nombre=bote["nombre"],
                tipo=bote["tipo"],
                objetivo_centimos=bote.get("objetivo_centimos"),
            )
            db.add(existente)
            db.flush()
        botes_bd[bote["nombre"]] = existente

    categorias_bd: dict[str, Categoria] = {}

    for mov in plan["movimientos"]:
        nombre_cat = mov["categoria"] or "Sin clasificar"
        if nombre_cat not in categorias_bd:
            categorias_bd[nombre_cat] = _categorizar(db, hogar_id, nombre_cat)
        db.add(
            Movimiento(
                hogar_id=hogar_id,
                cuenta_id=mapas[mov["cuenta"]].id,
                fecha=mov["fecha"],
                importe_centimos=mov["importe_centimos"],
                descripcion=mov["descripcion"][:300],
                categoria_id=categorias_bd[nombre_cat].id,
                bote_id=botes_bd[mov["bote"]].id if mov["bote"] else None,
                marcar_revisar=mov["marcar_revisar"],
                motivo_revision=mov["motivo_revision"],
                origen="importacion",
            )
        )
    db.flush()

    resumen = _resumen(plan)
    registro = Importacion(
        hogar_id=hogar_id,
        nombre_fichero=nombre_fichero,
        huella=huella,
        resumen=resumen,
        avisos=plan["avisos"],
    )
    db.add(registro)
    db.flush()

    return {
        "fichero": {
            "nombre": nombre_fichero,
            "huella": huella,
            "repetido": True,
        },
        "resumen": resumen,
        "avisos": plan["avisos"],
        "diferencias_conciliacion": _diferencias_conciliacion(plan, datos),
        "importacion_id": registro.id,
    }
