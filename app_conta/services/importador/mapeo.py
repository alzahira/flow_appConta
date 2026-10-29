"""Mapeo hoja Excel → entidades del MVP (US5, T049).

Reglas de contracts/importador.md:
- NUNCA corrige: cifra dudosa ("#REF!", importe 0, sin importe) → aviso.
- Signos tal cual tras normalizar gasto negativo / ingreso positivo.
- >2 decimales → ROUND_HALF_UP + aviso agregado por hoja.
- Fechas: meses en español → 2025-MM-01; filas sin fecha → 2025-10-01.
- Todo lo importado (salvo las tarjetas) vive en la cuenta "Historial Excel
  (importación)": los saldos por cuenta del Excel son el estado FINAL del mes
  (saldo_inicial), así que mover el histórico ahí evita doble cómputo; la
  conciliación queda cuadrada por construcción.

Cada función devuelve dicts "propuesta" (no toca la BD):
- movimiento: {fecha, importe_centimos, descripcion, cuenta, bote, categoria,
  marcar_revisar, motivo_revision}
- cuenta: {nombre, tipo, saldo_inicial_centimos}
- bote: {nombre, tipo, seed_centimos (int | None), objetivo_centimos (None)}
- aviso: {hoja, fila (int | None), motivo}
"""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

CTA_HISTORIAL = "Historial Excel (importación)"

TIPOS_CUENTA = ("banco", "tarjeta", "efectivo", "inversion")
TIPOS_BOTE = ("recurrente", "ahorro", "proyecto", "ajeno")

_MESES = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

_CATEGORIAS = [
    (
        "Supermercado",
        ("MERCADONA", "LIDL", "ALDI", "SUPECO", "EROSKI", "FRUTERIA", "PANADERIA", "KEBAB", "DIA "),
    ),
    ("Gasolina", ("GASOIL", "GASOLINA")),
    ("Hipoteca", ("HIPOTECA", "CRÉDITO PISO", "CREDITO PISO")),
    ("Comunidad", ("COMUNIDAD",)),
    ("Seguros", ("SEGURO",)),
    ("Impuestos y tasas", ("IBI", "BASURA", "SELLO", "TASA")),
    ("Luz y telefonía", ("LUZ", "AGUA", "ENDESA", "FINETWORK", "VODAFONE", "MASKOM", "TELEFON")),
    (
        "Restauración",
        ("MCDONALDS", "KFC", "BURGUER", "TO GO", "CAFE", "CAFES", "COMIDA", "CHURROS"),
    ),
    (
        "Ropa y compras",
        (
            "AMAZON",
            "PEPCO",
            "NIKE",
            "HM ",
            "HM-",
            "ADIDAS",
            "CHINOS",
            "SPRINTER",
            "CAMISETA",
            "ZARA",
            "POLO",
        ),
    ),
    (
        "Viajes",
        (
            "HOTEL",
            "TREN",
            "VUELOS",
            "VUELO",
            "VIAJE",
            "BRUJAS",
            "BRUSELAS",
            "GANTE",
            "AMBERES",
            "RABAT",
        ),
    ),
    ("Salud", ("FARMACIA", "DENTISTA", "SALUD")),
    ("Streaming", ("DAZN", "NETFLIX", "GROUPON")),
    ("Sueldo", ("NOMINA", "SUELDO", "SALARIO", "HORAS", "PAGA")),
    ("Donaciones", ("CRUZ ROJA", "HAMBRE")),
    ("Hogar", ("CASA", "CASO")),
]


def redondear_centimos(valor) -> int:
    """Importe Excel → céntimos con ROUND_HALF_UP a 2 decimales (regla 3)."""
    d = Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return int(d * 100)


def necesita_redondeo(valor) -> bool:
    d = Decimal(str(valor)).as_tuple()
    return bool(getattr(d, "exponent", 0) < -2)


def _num(celda):
    """Decimal fiable de la celda o None (str = #REF!/texto: sin importe)."""
    if isinstance(celda, bool) or celda is None or isinstance(celda, str):
        return None
    if isinstance(celda, (int, float, Decimal)):
        return Decimal(str(celda))
    return None


def _texto(celda) -> str | None:
    if celda is None or not str(celda).strip():
        return None
    return str(celda).strip()


def mes_a_fecha(texto: str) -> date:
    """Nombre de mes en español → primer día de ese mes de 2025."""
    t = texto.lower()
    for nombre, numero in _MESES.items():
        if nombre in t:
            return date(2025, numero, 1)
    return date(2025, 10, 1)


def categoria_para(descripcion: str) -> str:
    """Categoría derivada del nombre de la fila (regla 4) o 'Sin clasificar'."""
    d = descripcion.upper()
    for categoria, claves in _CATEGORIAS:
        if any(clave in d for clave in claves):
            return categoria
    return "Sin clasificar"


def _aviso(hoja: str | None, fila: int | None, motivo: str) -> dict:
    return {"hoja": hoja, "fila": fila, "motivo": motivo}


def _movimiento(
    *, descripcion, importe_centimos, cuenta=CTA_HISTORIAL, bote=None, fecha=None, con_redondeo=None
):
    return {
        "fecha": fecha or date(2025, 10, 1),
        "importe_centimos": importe_centimos,
        "descripcion": descripcion,
        "cuenta": cuenta,
        "bote": bote,
        "categoria": categoria_para(descripcion),
        "marcar_revisar": False,
        "motivo_revision": None,
        "_redondeo": con_redondeo or [],
    }


class _RedondeoCollector:
    """Aviso agregado por hoja: 'N importes redondeados' (evita 100 avisos)."""

    def __init__(self, hoja: str):
        self.hoja = hoja
        self.n = 0

    def marcar(self, valor) -> int:
        importe = redondear_centimos(valor)
        if necesita_redondeo(valor):
            self.n += 1
        return importe

    def avisos(self) -> list[dict]:
        if self.n == 0:
            return []
        return [
            _aviso(
                self.hoja,
                None,
                f"{self.n} importes con más de 2 decimales redondeados "
                "(ROUND_HALF_UP); ajuste registrado",
            )
        ]


# ------------------------------------------------------------------ CAJA


def _tipo_cuenta_caja(nombre: str) -> str:
    if nombre.startswith("INVERSIONES"):
        return "inversion"
    if nombre.startswith("TARJETA"):
        return "tarjeta"
    return "banco"


def mapear_caja(ws) -> dict:
    """Bloques de saldos por cuenta del Excel (CAJA) → cuentas (saldo_inicial).

    Regla del contrato: los saldos por cuenta se toman como `saldo_inicial`
    y el resto NO se recalcula. Los bloques presupuestarios/auxiliares se
    omiten (fase 2).
    """
    cuentas: list[dict] = []
    avisos: list[dict] = []
    modo: str | None = None

    for _fila_idx, fila in enumerate(ws.iter_rows(values_only=True), 1):
        etiqueta = _texto(fila[1]) if len(fila) > 1 else None
        nombre_e = _texto(fila[4]) if len(fila) > 4 else None
        valor_f = _num(fila[5]) if len(fila) > 5 else None
        valor_c = _num(fila[2]) if len(fila) > 2 else None

        # efectivo: fila "COGIDO A CUENTA Y EFECTIVOS" con CAJA (col E) + importe (col F)
        if nombre_e == "CAJA" and valor_f is not None:
            cuentas.append(
                {
                    "nombre": "Efectivo (CAJA)",
                    "tipo": "efectivo",
                    "saldo_inicial_centimos": redondear_centimos(valor_f),
                }
            )
            continue

        if etiqueta in ("GASTOS TARJETAS", "EN BANCOS", "TARJETAS Y OTROS"):
            modo = etiqueta
            continue
        if etiqueta and etiqueta.startswith("TOTAL") and modo:
            modo = None
            continue

        if modo and etiqueta and valor_c is not None:
            cuentas.append(
                {
                    "nombre": etiqueta,
                    "tipo": _tipo_cuenta_caja(etiqueta),
                    "saldo_inicial_centimos": redondear_centimos(valor_c),
                }
            )

    return {"cuentas": cuentas, "avisos": avisos}


# --------------------------------------------------------------- TARJETAS


def mapear_hoja_tarjeta(ws, nombre_cuenta: str) -> tuple[list[dict], list[dict]]:
    """Filas de recibo/comercio → movimientos de esa cuenta tipo `tarjeta`.

    El signo pasa tal cual (regla 2); importe 0 omitido con aviso; sin bote.
    """
    movs: list[dict] = []
    avisos: list[dict] = []
    redondeo = _RedondeoCollector(ws.title)

    for fila_idx, fila in enumerate(ws.iter_rows(values_only=True), 1):
        desc = _texto(fila[1]) if len(fila) > 1 else None
        valor = _num(fila[2]) if len(fila) > 2 else None
        if desc is None and valor is None:
            continue
        if valor is None:
            avisos.append(_aviso(ws.title, fila_idx, f"Fila {desc!r} sin importe fiable; omitida"))
            continue
        if valor == 0:
            avisos.append(_aviso(ws.title, fila_idx, f"Fila {desc!r} con importe 0; omitida"))
            continue
        importe = redondeo.marcar(valor)
        movs.append(_movimiento(descripcion=desc, importe_centimos=importe, cuenta=nombre_cuenta))

    avisos.extend(redondeo.avisos())
    return movs, avisos


# -------------------------------------------------------------- HIPOTECAS


def mapear_hoja_hipoteca(ws) -> list[dict]:
    """Cuadros de amortización con #REF!: aviso agregado, nada se reconstruye.

    La cuota mensual vigente se importa igualmente desde GASTOS FIJOS.
    """
    filas_ref = 0
    for fila in ws.iter_rows(values_only=True):
        if any(isinstance(c, str) and "#REF!" in c for c in fila):
            filas_ref += 1
    if filas_ref == 0:
        return []
    return [
        _aviso(
            ws.title,
            None,
            f"Cuadro de amortización con #REF! en {filas_ref} filas; NO se "
            "reconstruye (FR-009). La cuota mensual actual llega desde "
            "GASTOS FIJOS MENSUALES 2025.",
        )
    ]


# ------------------------------------------------------------ BOTES PROPIOS


def _limpiar_nombre_bote(texto: str) -> str:
    """'Bote Aitor   -- Regalo cumpleaños' → 'Bote Aitor'; máx 100 chars."""
    limpio = texto.strip()
    if " -- " in limpio:
        limpio = limpio.split(" -- ", 1)[0].strip()
    return limpio[:100]


def mapear_botes_propios(ws) -> tuple[list[dict], list[dict], list[dict]]:
    """Filas BOTES/CANTIDAD → botes + movimiento semilla por bote con importe.

    El saldo del bote queda derivado del semilla: == CANTIDAD del Excel.
    La fila "Coche" se salta (se importa desde COCHE PREST., sin duplicar) y
    el bloque DEVOLUCIONES PENDIENTES queda para fase 2 (aviso).
    """
    botes: list[dict] = []
    movs: list[dict] = []
    avisos: list[dict] = []
    redondeo = _RedondeoCollector(ws.title)

    for fila_idx, fila in enumerate(ws.iter_rows(values_only=True), 1):
        desc = _texto(fila[1]) if len(fila) > 1 else None
        valor = _num(fila[2]) if len(fila) > 2 else None

        if desc is None:
            continue
        if desc == "BOTES":  # cabecera
            continue
        if desc.startswith("DEVOLUCIONES PENDIENTES"):
            avisos.append(
                _aviso(ws.title, fila_idx, "Bloque DEVOLUCIONES PENDIENTES omitido (fase 2)")
            )
            break
        if desc.startswith("TOTAL"):
            continue  # el bloque sigue (DEVOLUCIONES PENDIENTES va después)

        nombre = _limpiar_nombre_bote(desc)
        if nombre == "Coche":
            avisos.append(
                _aviso(
                    ws.title,
                    fila_idx,
                    "Bote Coche: se importa desde la hoja COCHE PREST. "
                    "(entregas y costes); fila duplicada omitida",
                )
            )
            continue

        tipo = "ajeno" if nombre.lower().startswith("fianza") else "ahorro"
        seed = redondeo.marcar(valor) if valor is not None else None
        botes.append(
            {
                "nombre": nombre,
                "tipo": tipo,
                "seed_centimos": seed,
                "objetivo_centimos": None,
            }
        )
        if seed is not None:
            movs.append(
                _movimiento(
                    descripcion=f"Semilla bote {nombre} (importado de OCTUBRE.xlsx)",
                    importe_centimos=seed,
                    bote=nombre,
                )
            )

    avisos.extend(redondeo.avisos())
    return botes, movs, avisos


# ------------------------------------------------ BOTE PARA GASTOS 2026


def mapear_bote_gastos_2026(ws) -> tuple[list[dict], list[dict], list[dict]]:
    """Solo el bote y su saldo (contrato: cálculo mensual es fase 2)."""
    avisos: list[dict] = []
    redondeo = _RedondeoCollector(ws.title)
    bote: dict | None = None
    movs: list[dict] = []

    for fila_idx, fila in enumerate(ws.iter_rows(values_only=True), 1):
        desc = _texto(fila[1]) if len(fila) > 1 else None
        if desc == "TOTAL BOTE GASTOS":
            valor = _num(fila[5]) if len(fila) > 5 else None
            if valor is None:
                avisos.append(
                    _aviso(ws.title, fila_idx, "TOTAL BOTE GASTOS sin importe fiable; sin semilla")
                )
                continue
            seed = redondeo.marcar(valor)
            bote = {
                "nombre": "Bote para gastos 2026",
                "tipo": "recurrente",
                "seed_centimos": seed,
                "objetivo_centimos": None,
            }
            movs.append(
                _movimiento(
                    descripcion="Semilla bote Bote para gastos 2026 (importado de OCTUBRE.xlsx)",
                    importe_centimos=seed,
                    bote="Bote para gastos 2026",
                )
            )
            avisos.append(
                _aviso(
                    ws.title,
                    fila_idx,
                    "Tabla CONCEPTO/MENSUAL omitida: el cálculo mensual del bote es fase 2",
                )
            )

    botes = [bote] if bote else []
    avisos.extend(redondeo.avisos())
    return botes, movs, avisos


# ---------------------------------------------------------------- AHORROS


def mapear_ahorros(ws) -> tuple[list[dict], list[dict], list[dict]]:
    """Tres botes del bloque de ahorro (regla 5, SC-004):

    - Fondo hipotecas: aportaciones mensuales (Enero 914… saldo derivado 8083).
    - Bote arreglos Córdoba: seed −373.70.
    - Bote extras 2025: aportaciones 110 €/mes + gastos reales del bloque
      GASTOS DESDE BOTE EXTRA (saldo derivado 81).
    """
    botes: list[dict] = []
    movs: list[dict] = []
    avisos: list[dict] = []
    redondeo = _RedondeoCollector(ws.title)
    modo: str | None = None

    def _bote(nombre):
        existente = next((b for b in botes if b["nombre"] == nombre), None)
        if existente is None:
            existente = {
                "nombre": nombre,
                "tipo": "ahorro",
                "seed_centimos": None,
                "objetivo_centimos": None,
            }
            botes.append(existente)
        return existente

    for _fila_idx, fila in enumerate(ws.iter_rows(values_only=True), 1):
        desc = _texto(fila[1]) if len(fila) > 1 else None
        valor = _num(fila[2]) if len(fila) > 2 else None

        if desc is None:
            continue
        if desc.startswith("BOTE DE AHORRO PARA HIPO"):
            modo = "fondo"
            continue
        if desc.startswith("BOTE DE AHORRO PARA EXTR"):
            modo = "extras"
            continue
        if desc.startswith("BOTE ARREGLOS"):
            seed = redondeo.marcar(valor) if valor is not None else None
            bote_arreglos = _bote("Bote arreglos Córdoba")
            if seed is not None:
                bote_arreglos["seed_centimos"] = seed
                movs.append(
                    _movimiento(
                        descripcion="Semilla bote Bote arreglos Córdoba "
                        "(importado de OCTUBRE.xlsx)",
                        importe_centimos=seed,
                        bote="Bote arreglos Córdoba",
                    )
                )
            modo = None
            continue
        if desc.startswith("GASTOS DESDE BOTE"):
            modo = "extras"  # los gastos reales del bote (mismo destino)
            continue
        if desc.startswith("TOTAL"):
            modo = None
            continue
        if modo is None:
            continue

        if modo == "fondo" and valor is not None:
            _bote("Fondo hipotecas")
            importe = redondeo.marcar(valor)
            movs.append(
                _movimiento(
                    descripcion=f"Aportación mensual fondo hipotecas: {desc}",
                    importe_centimos=importe,
                    bote="Fondo hipotecas",
                    fecha=mes_a_fecha(desc),
                )
            )
        elif modo == "extras":
            if desc.startswith("Gastado"):
                continue  # subtotal, no movimiento (sino doble cómputo)
            if valor is not None:
                _bote("Bote extras 2025")
                importe = redondeo.marcar(valor)
                movs.append(
                    _movimiento(
                        descripcion=f"Bote extras 2025: {desc}",
                        importe_centimos=importe,
                        bote="Bote extras 2025",
                        fecha=mes_a_fecha(desc),
                    )
                )

    avisos.extend(redondeo.avisos())
    return botes, movs, avisos


# ------------------------------------------------------------------ COCHE


def mapear_coche(ws) -> tuple[list[dict], list[dict], list[dict]]:
    """Bote `proyecto` Coche con entregas (+) y costes (−).

    SC-004: saldo derivado = entregas − costes = TOTAL DEBO (−8052.06).
    El bloque inferior duplicado de AHORROS se omite con aviso.
    """
    botes = [
        {"nombre": "Coche", "tipo": "proyecto", "seed_centimos": None, "objetivo_centimos": None}
    ]
    movs: list[dict] = []
    avisos: list[dict] = []
    redondeo = _RedondeoCollector(ws.title)
    modo: str | None = None
    terminado = False

    for fila_idx, fila in enumerate(ws.iter_rows(values_only=True), 1):
        desc = _texto(fila[1]) if len(fila) > 1 else None
        valor = _num(fila[2]) if len(fila) > 2 else None

        if desc is None:
            continue
        if desc.startswith("GASTADO COCHE"):
            modo = "costes"
            continue
        if desc.startswith("COSTE TOTAL"):
            modo = None
            continue
        if desc.startswith("ENTREGADO"):
            modo = "entregas"
            continue
        if desc.startswith("TOTAL ENTREGADO"):
            modo = None
            terminado = True
            continue
        if desc.startswith("TOTAL") or desc.startswith("PENDIENTE"):
            continue
        if terminado:
            if desc.startswith("BOTE DE AHORRO") or desc.startswith("GASTOS DESDE"):
                avisos.append(
                    _aviso(
                        ws.title,
                        fila_idx,
                        "Bloque duplicado de la hoja AHORROS al final de "
                        "COCHE PREST.; omitido para no importar movimientos "
                        "repetidos",
                    )
                )
            if modo is None:
                continue

        if valor is None:
            continue

        if modo == "costes":
            importe = redondeo.marcar(valor)
            movs.append(
                _movimiento(
                    descripcion=f"Coste coche: {desc}",
                    importe_centimos=-abs(importe),  # normalizado: gasto
                    bote="Coche",
                )
            )
        elif modo == "entregas":
            importe = redondeo.marcar(valor)
            movs.append(
                _movimiento(
                    descripcion=f"Entrega coche: {desc}",
                    importe_centimos=importe,
                    bote="Coche",
                    fecha=mes_a_fecha(desc),
                )
            )

    avisos.extend(redondeo.avisos())
    return botes, movs, avisos


# ----------------------------------------------------------------- SUELDO


def mapear_sueldo(ws) -> tuple[list[dict], list[dict], list[dict]]:
    """Nómina M.José (regla del contrato: MVP solo lo reconocible automatico).

    - HORAS COMPLEMENTARIAS (col I) y HORAS EXTRA (col F) → ingresos.
    - SALARIO BASE + PRODUCTIVIDAD con #REF! → aviso, sin movimiento.
    - Bloque BOTE DE AHORRO SALARIO M.JOSE → bote `ahorro` con aportaciones
      mensuales y extras (los agregados TOTAL se omiten).
    - Sub-plan final (Mejoras/Ocio) → aviso de fase 2.
    """
    movs: list[dict] = []
    botes: list[dict] = []
    avisos: list[dict] = []
    redondeo = _RedondeoCollector(ws.title)
    mes_actual = None
    modo_bote = False
    aviso_subplan_dado = False

    for fila_idx, fila in enumerate(ws.iter_rows(values_only=True), 1):
        etiqueta_b = _texto(fila[1]) if len(fila) > 1 else None
        etiqueta_c = _texto(fila[2]) if len(fila) > 2 else None

        if etiqueta_b:
            for nombre in _MESES:
                if nombre in etiqueta_b.lower():
                    mes_actual = nombre
                    break

        if etiqueta_c is None:
            continue

        if etiqueta_c.startswith("GASTOS DESDE BOTE"):
            # sub-plan final (Mejoras/Ocio/Atrasos): fase 2, solo aviso
            if not aviso_subplan_dado:
                avisos.append(
                    _aviso(
                        ws.title,
                        fila_idx,
                        "Sub-plan de sueldo (Mejoras/Ocio/Atrasos) omitido: es fase 2",
                    )
                )
                aviso_subplan_dado = True
            continue

        if etiqueta_c.startswith("HORAS COMPLEMENTARIAS"):
            valor = _num(fila[8]) if len(fila) > 8 else None
            if valor in (None, 0):
                continue
            importe = redondeo.marcar(valor)
            movs.append(
                _movimiento(
                    descripcion=f"Horas complementarias ({mes_actual.upper()} 2025)",
                    importe_centimos=importe,
                )
            )
            continue

        if etiqueta_c.startswith("HORAS EXTRA"):
            valor = _num(fila[4]) if len(fila) > 4 else None
            if valor in (None, 0):
                continue
            importe = redondeo.marcar(valor)
            movs.append(
                _movimiento(
                    descripcion=f"Horas extra ({mes_actual.upper()} 2025)",
                    importe_centimos=importe,
                )
            )
            continue

        if etiqueta_c.startswith("SALARIO BASE"):
            avisos.append(
                _aviso(
                    ws.title,
                    fila_idx,
                    "SALARIO BASE + PRODUCTIVIDAD con #REF!: sin importe "
                    "fiable (FR-009); no se importa ningún movimiento",
                )
            )
            continue

        if etiqueta_c.startswith("BOTE DE AHORRO SALARIO"):
            modo_bote = True
            continue

        if modo_bote:
            if etiqueta_c.startswith("TOTAL"):
                modo_bote = False
                continue
            if etiqueta_c.startswith(("Total año", "Extras 2025", "GUARDADO", "CADA MES")):
                continue  # agregados
            if etiqueta_c.startswith(("Letra Coche", "Bote Paro", "Extras ya usados")):
                continue
            if (
                etiqueta_c.startswith("GASTOS DESDE BOTE")
                or etiqueta_c.startswith("Atrasos")
                or etiqueta_c.startswith("ATRASOS")
                or etiqueta_c.startswith("Regalo")
                or etiqueta_c.startswith("Cuchillo")
                or etiqueta_c.startswith("Desde")
            ):
                if not aviso_subplan_dado:
                    avisos.append(
                        _aviso(
                            ws.title,
                            fila_idx,
                            "Sub-plan de sueldo (Mejoras/Ocio/Atrasos) omitido: es fase 2",
                        )
                    )
                    aviso_subplan_dado = True
                continue

            valor = _num(fila[8]) if len(fila) > 8 else None
            if valor in (None, 0):
                continue
            nombre_bote = "Ahorro salario M.José"
            if not botes:
                botes.append(
                    {
                        "nombre": nombre_bote,
                        "tipo": "ahorro",
                        "seed_centimos": None,
                        "objetivo_centimos": None,
                    }
                )
            importe = redondeo.marcar(valor)
            movs.append(
                _movimiento(
                    descripcion=f"Ahorro salario M.José: {etiqueta_c}",
                    importe_centimos=importe,
                    bote=nombre_bote,
                    fecha=mes_a_fecha(etiqueta_c),
                )
            )

    if not botes:
        pass  # sin filas del bote en la hoja: no se crea

    avisos.extend(redondeo.avisos())
    return movs, botes, avisos


# --------------------------------------------------------------- GASTOS FIJOS


def mapear_gastos_fijos(ws) -> tuple[list[dict], list[dict]]:
    """Recibos mensuales fijos → movimientos sin bote (regla del contrato).

    El plan BOTES PARA AHORRO se omite con aviso: las aportaciones reales al
    bote están en la hoja AHORROS (evita doble cómputo, FR-009).
    """
    movs: list[dict] = []
    avisos: list[dict] = []
    modo: str | None = None
    redondeo = _RedondeoCollector(ws.title)

    for fila_idx, fila in enumerate(ws.iter_rows(values_only=True), 1):
        desc = _texto(fila[1]) if len(fila) > 1 else None
        valor = _num(fila[2]) if len(fila) > 2 else None

        if desc is None:
            continue
        if desc.startswith("LA CAIXA"):
            modo = "caixa"
            continue
        if desc.startswith("DEUSTCHE BANK"):
            modo = "db"
            continue
        if desc.startswith("OTROS GASTOS"):
            modo = "otros"
            continue
        if desc.startswith("BOTES PARA AHORRO"):
            avisos.append(
                _aviso(
                    ws.title,
                    fila_idx,
                    "Plan BOTES PARA AHORRO omitido: las aportaciones "
                    "reales están en la hoja AHORROS (evita doble cómputo)",
                )
            )
            modo = None
            continue
        if desc.startswith("Total") or desc.startswith("TOTAL"):
            modo = None
            continue
        if modo is None or valor is None:
            continue

        importe = redondeo.marcar(valor)
        movs.append(
            _movimiento(
                descripcion=desc,
                importe_centimos=importe,
                bote=None,
            )
        )

    avisos.extend(redondeo.avisos())
    return movs, avisos


# ---------------------------------------------------------------- ANUARIO


def mapear_anuario(_ws) -> list[dict]:
    """Presupuesto anual: fuera del MVP (contrato); solo aviso."""
    return [
        _aviso(
            "ANUARIO DE GASTOS TRAS REV.",
            None,
            "Hoja ANUARIO fuera del MVP (presupuesto anual → fase 2); se omite",
        )
    ]
