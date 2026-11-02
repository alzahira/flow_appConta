"""Servicio para plantillas de nómina y repartos mensuales automáticos."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.bote import Bote
from app_conta.models.cuenta import Cuenta
from app_conta.models.deuda import Deuda
from app_conta.models.gasto_recurrente import PrevisionGastosConfig
from app_conta.models.movimiento import Movimiento
from app_conta.models.plantilla_reparto import PlantillaReparto, PlantillaRepartoLinea
from app_conta.models.prestamo import Prestamo
from app_conta.services.botes import saldo_bote
from app_conta.services.dinero import centimos_a_euros, euros_a_centimos
from app_conta.services.errors import ErrorConflicto, ErrorNoEncontrado, ErrorValidacion
from app_conta.services.movimientos import crear_movimiento


def _serializar_linea(linea: PlantillaRepartoLinea) -> dict[str, Any]:
    return {
        "id": linea.id,
        "bote_id": linea.bote_id,
        "bote_nombre": linea.bote.nombre if linea.bote else None,
        "bote_categoria": linea.bote.categoria if linea.bote else None,
        "cuenta_id": linea.cuenta_id,
        "cuenta_nombre": linea.cuenta.nombre if linea.cuenta else None,
        "cuenta_entidad": linea.cuenta.entidad if linea.cuenta else None,
        "concepto": linea.concepto,
        "importe": f"{centimos_a_euros(linea.importe_centimos):.2f}",
        "orden": linea.orden,
    }


def serializar_plantilla(plantilla: PlantillaReparto) -> dict[str, Any]:
    return {
        "id": plantilla.id,
        "nombre": plantilla.nombre,
        "cuenta_id": plantilla.cuenta_id,
        "cuenta_nombre": plantilla.cuenta.nombre if plantilla.cuenta else None,
        "cuenta_entidad": plantilla.cuenta.entidad if plantilla.cuenta else None,
        "importe_estimado": f"{centimos_a_euros(plantilla.importe_estimado_centimos):.2f}",
        "dia_mes": plantilla.dia_mes,
        "activo": plantilla.activo,
        "lineas": [_serializar_linea(linea) for linea in plantilla.lineas],
    }


def sembrar_plantillas_defecto(db: Session, hogar_id: int) -> list[PlantillaReparto]:
    """Siembra la plantilla mensual del hogar con desglose multi-banco y sobres."""
    stmt_cuentas = select(Cuenta).where(Cuenta.hogar_id == hogar_id)
    cuentas = list(db.scalars(stmt_cuentas).all())
    if not cuentas:
        return []

    cuentas_activas = [c for c in cuentas if not getattr(c, "archivada", False)]
    cuentas_banco = [c for c in cuentas_activas if getattr(c, "tipo", None) == "banco"]
    if not cuentas_banco:
        cuentas_banco = cuentas_activas or list(cuentas)

    cta_caixa = next(
        (
            c
            for c in cuentas_banco
            if any(
                k in (c.nombre + " " + (c.entidad or "")).lower()
                for k in ["la caixa", "caixa", "caixabank"]
            )
        ),
        None,
    )
    cta_db = next(
        (
            c
            for c in cuentas_banco
            if any(
                k in (c.nombre + " " + (c.entidad or "")).lower()
                for k in ["deutsche", "deustche", " db"]
            )
        ),
        None,
    )

    if not cta_caixa and not cta_db:
        return []

    if not cta_db:
        cta_db = cta_caixa
    if not cta_caixa:
        cta_caixa = cta_db

    def obtener_o_crear_bote(nombre: str, tipo: str, categoria: str | None = None) -> Bote:
        stmt_b = select(Bote).where(Bote.hogar_id == hogar_id)
        todos_b = list(db.scalars(stmt_b).all())
        for b in todos_b:
            if nombre.lower() in b.nombre.lower() or b.nombre.lower() in nombre.lower():
                return b
        nuevo = Bote(
            hogar_id=hogar_id,
            nombre=nombre,
            tipo=tipo,
            categoria=categoria,
            archivado=False,
        )
        db.add(nuevo)
        db.flush()
        return nuevo

    bote_hipoteca = obtener_o_crear_bote("Amortización Hipoteca", "ahorro")
    bote_emergencias = obtener_o_crear_bote("Bote emergencias", "ahorro", "ahorro")
    bote_arreglos = obtener_o_crear_bote("Bote Arreglos Pisos", "proyecto")
    bote_ocio = obtener_o_crear_bote("Bote ocio", "ahorro")
    bote_mes = obtener_o_crear_bote("Cash para el mes en curso", "ahorro")
    bote_paro = obtener_o_crear_bote("Guardado Resto Paro", "ahorro")

    lineas_datos = [
        # --- BLOQUE LA CAIXA (Total: 860 € = 580 € Alquiler Córdoba + 280 € Alquiler Cañete) ---
        {
            "bote_id": None,
            "cuenta_id": cta_caixa.id,
            "concepto": "Recibos y gastos Caixa",
            "importe": "526.00",
        },
        {
            "bote_id": None,
            "cuenta_id": cta_caixa.id,
            "concepto": "Previsión Gastos Anuales",
            "importe": "176.00",
        },
        {
            "bote_id": bote_emergencias.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Bote emergencias",
            "importe": "110.00",
        },
        {
            "bote_id": bote_arreglos.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Arreglos de pisos",
            "importe": "48.00",
        },
        # --- BLOQUE DEUTSCHE BANK (1.463 € = 490 € Estudio + 973 € Nómina Javier) ---
        {
            "bote_id": None,
            "cuenta_id": cta_db.id,
            "concepto": "Recibos y gastos Deutsche Bank",
            "importe": "548.00",
        },
        {
            "bote_id": bote_mes.id,
            "cuenta_id": cta_db.id,
            "concepto": "Dinero del mes",
            "importe": "400.00",
        },
        {
            "bote_id": bote_ocio.id,
            "cuenta_id": cta_db.id,
            "concepto": "Bote ocio",
            "importe": "100.00",
        },
        {
            "bote_id": None,
            "cuenta_id": cta_db.id,
            "concepto": "Cuota DAZN (Descontar de lo que debe DAZN)",
            "importe": "10.00",
        },
        {
            "bote_id": bote_hipoteca.id,
            "cuenta_id": cta_db.id,
            "concepto": "Bote Hipotecas",
            "importe": "927.00",
        },
        {
            "bote_id": bote_paro.id,
            "cuenta_id": cta_db.id,
            "concepto": "Aporte desde Bote de Paro para Hipotecas",
            "importe": "-522.00",
        },
    ]

    plantilla = crear_plantilla(
        db,
        hogar_id,
        {
            "nombre": "Reparto Mensual Hogar",
            "cuenta_id": cta_db.id,
            "importe_estimado": "2323.00",
            "dia_mes": 28,
            "activo": True,
            "lineas": lineas_datos,
        },
    )

    plantilla_mj = sembrar_plantilla_nomina_mj(db, hogar_id)
    res = [plantilla]
    if plantilla_mj:
        res.append(plantilla_mj)
    return res


def sembrar_plantilla_nomina_mj(db: Session, hogar_id: int) -> PlantillaReparto | None:
    """Siembra la plantilla 'Nómina MJ' (731 € en Caixa) con sus 6 destinos exactos."""
    stmt_c = select(Cuenta).where(Cuenta.hogar_id == hogar_id)
    cuentas = list(db.scalars(stmt_c).all())
    cuentas_activas = [c for c in cuentas if not getattr(c, "archivada", False)]

    cta_caixa = next(
        (
            c
            for c in cuentas_activas
            if "caixa" in c.nombre.lower() or "caixa" in (c.entidad or "").lower()
        ),
        None,
    )
    if not cta_caixa and cuentas_activas:
        cta_caixa = cuentas_activas[0]
    if not cta_caixa:
        return None

    def obtener_o_crear_bote(nombre: str, tipo: str, categoria: str | None = None) -> Bote:
        stmt_b = select(Bote).where(Bote.hogar_id == hogar_id)
        todos_b = list(db.scalars(stmt_b).all())
        for b in todos_b:
            if nombre.lower() in b.nombre.lower() or b.nombre.lower() in nombre.lower():
                return b
        nuevo = Bote(
            hogar_id=hogar_id,
            nombre=nombre,
            tipo=tipo,
            categoria=categoria,
            archivado=False,
        )
        db.add(nuevo)
        db.flush()
        return nuevo

    bote_gasolina = obtener_o_crear_bote("Gasolina mes", "ahorro", "gasolina")
    bote_irpf = obtener_o_crear_bote("Bote IRPF", "ajeno", "reserva")
    bote_paro = obtener_o_crear_bote("Guardado Resto Paro", "ahorro", "reserva")
    bote_ocio = obtener_o_crear_bote("Bote ocio", "ahorro", "ocio")
    bote_mejoras = obtener_o_crear_bote("Mejoras del Hogar", "ahorro", "mantenimiento")

    lineas_datos_mj = [
        {
            "bote_id": bote_gasolina.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Gasolina mes",
            "importe": "40.00",
        },
        {
            "bote_id": bote_irpf.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Provisión IRPF (4%)",
            "importe": "27.64",
        },
        {
            "bote_id": None,
            "cuenta_id": cta_caixa.id,
            "concepto": "Amortización Préstamo Coche (30%)",
            "importe": "199.01",
        },
        {
            "bote_id": bote_paro.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Bote del Paro (30%)",
            "importe": "199.01",
        },
        {
            "bote_id": bote_ocio.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Bote de Ocio (20%)",
            "importe": "132.67",
        },
        {
            "bote_id": bote_mejoras.id,
            "cuenta_id": cta_caixa.id,
            "concepto": "Mejoras de Casa (20%)",
            "importe": "132.67",
        },
    ]

    return crear_plantilla(
        db,
        hogar_id,
        {
            "nombre": "Nómina MJ",
            "cuenta_id": cta_caixa.id,
            "importe_estimado": "731.00",
            "dia_mes": 28,
            "activo": True,
            "lineas": lineas_datos_mj,
        },
    )


def listar_plantillas(db: Session, hogar_id: int) -> list[dict[str, Any]]:
    stmt = (
        select(PlantillaReparto)
        .where(PlantillaReparto.hogar_id == hogar_id)
        .order_by(PlantillaReparto.id)
    )
    plantillas = list(db.scalars(stmt).all())
    if not plantillas:
        plantillas = sembrar_plantillas_defecto(db, hogar_id)
    else:
        nombres = {p.nombre.lower() for p in plantillas}
        if "nómina mj" not in nombres and "nomina mj" not in nombres:
            p_mj = sembrar_plantilla_nomina_mj(db, hogar_id)
            if p_mj:
                plantillas.append(p_mj)
    return [serializar_plantilla(p) for p in plantillas]


def obtener_plantilla(db: Session, plantilla_id: int) -> PlantillaReparto:
    plantilla = db.get(PlantillaReparto, plantilla_id)
    if plantilla is None:
        raise ErrorNoEncontrado(f"Plantilla {plantilla_id} no encontrada")
    return plantilla


def crear_plantilla(db: Session, hogar_id: int, datos: dict[str, Any]) -> PlantillaReparto:
    nombre = str(datos.get("nombre") or "").strip()
    if not nombre:
        raise ErrorValidacion("El nombre de la plantilla es obligatorio")

    cuenta_id = datos.get("cuenta_id")
    if not cuenta_id or db.get(Cuenta, int(cuenta_id)) is None:
        raise ErrorValidacion("Debe indicar una cuenta bancaria válida")

    importe_estimado = datos.get("importe_estimado", "0.00")
    centimos_estimados = euros_a_centimos(importe_estimado)

    dia_mes = datos.get("dia_mes")
    if dia_mes is not None:
        dia_mes = int(dia_mes)
        if not 1 <= dia_mes <= 31:
            raise ErrorValidacion("El día del mes debe estar entre 1 y 31")

    plantilla = PlantillaReparto(
        hogar_id=hogar_id,
        nombre=nombre,
        cuenta_id=int(cuenta_id),
        importe_estimado_centimos=centimos_estimados,
        dia_mes=dia_mes,
        activo=bool(datos.get("activo", True)),
    )
    db.add(plantilla)
    db.flush()

    lineas_datos = datos.get("lineas") or []
    for idx, ld in enumerate(lineas_datos):
        concepto = str(ld.get("concepto") or "").strip()
        if not concepto:
            concepto = f"Línea {idx + 1}"
        importe = ld.get("importe", "0.00")
        centimos_linea = euros_a_centimos(importe)
        bote_id = ld.get("bote_id")
        if bote_id:
            bote_id = int(bote_id)
            if db.get(Bote, bote_id) is None:
                bote_id = None

        cuenta_linea_id = ld.get("cuenta_id")
        if cuenta_linea_id:
            cuenta_linea_id = int(cuenta_linea_id)
            if db.get(Cuenta, cuenta_linea_id) is None:
                cuenta_linea_id = None
        else:
            cuenta_linea_id = None

        linea = PlantillaRepartoLinea(
            plantilla_id=plantilla.id,
            bote_id=bote_id,
            cuenta_id=cuenta_linea_id,
            concepto=concepto,
            importe_centimos=centimos_linea,
            orden=idx,
        )
        db.add(linea)

    db.commit()
    db.refresh(plantilla)
    return plantilla


def actualizar_plantilla(db: Session, plantilla_id: int, datos: dict[str, Any]) -> PlantillaReparto:
    plantilla = obtener_plantilla(db, plantilla_id)

    if "nombre" in datos:
        nombre = str(datos["nombre"]).strip()
        if not nombre:
            raise ErrorValidacion("El nombre de la plantilla es obligatorio")
        plantilla.nombre = nombre

    if "cuenta_id" in datos:
        cuenta_id = int(datos["cuenta_id"])
        if db.get(Cuenta, cuenta_id) is None:
            raise ErrorValidacion("Cuenta bancaria no encontrada")
        plantilla.cuenta_id = cuenta_id

    if "importe_estimado" in datos:
        plantilla.importe_estimado_centimos = euros_a_centimos(datos["importe_estimado"])

    if "dia_mes" in datos:
        dia = datos["dia_mes"]
        if dia is not None:
            dia = int(dia)
            if not 1 <= dia <= 31:
                raise ErrorValidacion("El día del mes debe estar entre 1 y 31")
        plantilla.dia_mes = dia

    if "activo" in datos:
        plantilla.activo = bool(datos["activo"])

    if "lineas" in datos:
        # Reemplazar líneas
        plantilla.lineas.clear()
        db.flush()
        lineas_datos = datos["lineas"] or []
        for idx, ld in enumerate(lineas_datos):
            concepto = str(ld.get("concepto") or "").strip()
            if not concepto:
                concepto = f"Línea {idx + 1}"
            centimos_linea = euros_a_centimos(ld.get("importe", "0.00"))
            bote_id = ld.get("bote_id")
            if bote_id:
                bote_id = int(bote_id)
                if db.get(Bote, bote_id) is None:
                    bote_id = None

            cuenta_linea_id = ld.get("cuenta_id")
            if cuenta_linea_id:
                cuenta_linea_id = int(cuenta_linea_id)
                if db.get(Cuenta, cuenta_linea_id) is None:
                    cuenta_linea_id = None
            else:
                cuenta_linea_id = None

            linea = PlantillaRepartoLinea(
                plantilla_id=plantilla.id,
                bote_id=bote_id,
                cuenta_id=cuenta_linea_id,
                concepto=concepto,
                importe_centimos=centimos_linea,
                orden=idx,
            )
            db.add(linea)

    db.commit()
    db.refresh(plantilla)
    return plantilla


def eliminar_plantilla(db: Session, plantilla_id: int) -> None:
    plantilla = obtener_plantilla(db, plantilla_id)
    db.delete(plantilla)
    db.commit()


def ejecutar_reparto(
    db: Session,
    plantilla_id: int,
    *,
    fecha: str | date,
    cuenta_id: int | None = None,
    lineas: list[dict[str, Any]] | None = None,
    descripcion_general: str | None = None,
    confirmar_repetido: bool = False,
) -> dict[str, Any]:
    """Ejecuta el reparto generando los movimientos de ingreso correspondientes.

    - Protección anti-duplicado: si ya hay un reparto con el mismo nombre en el
      mismo mes, lanza `ErrorConflicto` salvo que `confirmar_repetido=True`.
    - Devuelve `avisos` (sin bloquear) cuando alguna línea negativa deja un bote
      con saldo negativo, para que el cliente pueda avisar al usuario.
    """
    plantilla = obtener_plantilla(db, plantilla_id)
    target_cuenta_id = cuenta_id if cuenta_id is not None else plantilla.cuenta_id

    cuenta = db.get(Cuenta, target_cuenta_id)
    if cuenta is None:
        raise ErrorNoEncontrado(f"Cuenta {target_cuenta_id} no encontrada")

    try:
        fecha_obj = fecha if isinstance(fecha, date) else date.fromisoformat(str(fecha))
    except ValueError as exc:
        raise ErrorValidacion(f"Fecha no válida: {fecha!r}") from exc

    prefijo = str(descripcion_general or plantilla.nombre).strip()

    # Protección anti-duplicado por doble clic: mismo prefijo y mismo mes.
    inicio_mes = fecha_obj.replace(day=1)
    if fecha_obj.month == 12:
        inicio_mes_siguiente = date(fecha_obj.year + 1, 1, 1)
    else:
        inicio_mes_siguiente = date(fecha_obj.year, fecha_obj.month + 1, 1)
    ya_ejecutado = db.scalars(
        select(Movimiento).where(
            Movimiento.eliminado.is_(False),
            Movimiento.descripcion.like(f"{prefijo}: %"),
            Movimiento.fecha >= inicio_mes,
            Movimiento.fecha < inicio_mes_siguiente,
        )
    ).first()
    if ya_ejecutado is not None and not confirmar_repetido:
        raise ErrorConflicto(
            f"Ya existe un reparto «{prefijo}» en {fecha_obj.strftime('%m/%Y')}. "
            "Confirma la acción para repetirlo."
        )

    # Si se pasan líneas personalizadas en la llamada, usamos esas; si no, las de la plantilla
    lineas_a_ejecutar = (
        lineas
        if lineas is not None
        else [
            {
                "bote_id": item.bote_id,
                "cuenta_id": item.cuenta_id,
                "concepto": item.concepto,
                "importe": centimos_a_euros(item.importe_centimos),
            }
            for item in plantilla.lineas
        ]
    )

    # Normalizamos las líneas una sola vez (importes en céntimos y destino resuelto).
    lineas_normalizadas: list[dict[str, Any]] = []
    for ld in lineas_a_ejecutar:
        importe_str = str(ld.get("importe", "0.00")).replace(",", ".").strip()
        centimos = euros_a_centimos(importe_str)
        if centimos == 0:
            continue

        concepto = str(ld.get("concepto") or "").strip()
        bote_id = ld.get("bote_id")
        bote_id = int(bote_id) if bote_id else None

        # Destino de cuenta bancaria: si la línea especifica un banco concreto,
        # se ingresa ahí; si no, al principal.
        linea_cuenta_id = ld.get("cuenta_id")
        destino_cuenta_id = target_cuenta_id
        if linea_cuenta_id:
            cta_test = db.get(Cuenta, int(linea_cuenta_id))
            if cta_test is not None:
                destino_cuenta_id = cta_test.id

        lineas_normalizadas.append(
            {
                "bote_id": bote_id,
                "cuenta_id": destino_cuenta_id,
                "concepto": concepto,
                "centimos": centimos,
            }
        )

    # Aviso (no bloqueante) si una deducción deja un bote en negativo. La regla
    # del hogar permite tirar de la reserva, pero el usuario debe verlo.
    variacion_por_bote: dict[int, int] = {}
    for item in lineas_normalizadas:
        if item["bote_id"]:
            variacion_por_bote[item["bote_id"]] = (
                variacion_por_bote.get(item["bote_id"], 0) + item["centimos"]
            )

    avisos: list[dict[str, Any]] = []
    for bote_id, variacion in variacion_por_bote.items():
        bote = db.get(Bote, bote_id)
        if bote is None:
            continue
        saldo_actual = saldo_bote(db, bote)
        saldo_proyectado = saldo_actual + variacion
        if saldo_proyectado >= 0:
            continue
        avisos.append(
            {
                "bote_id": bote.id,
                "bote_nombre": bote.nombre,
                "saldo_actual": f"{centimos_a_euros(saldo_actual):.2f}",
                "saldo_proyectado": f"{centimos_a_euros(saldo_proyectado):.2f}",
                "mensaje": (
                    f"El bote «{bote.nombre}» quedará en "
                    f"{centimos_a_euros(saldo_proyectado):.2f} € "
                    f"(saldo actual {centimos_a_euros(saldo_actual):.2f} €)."
                ),
            }
        )

    movimientos_creados: list[Movimiento] = []
    total_centimos = 0

    for item in lineas_normalizadas:
        desc = f"{prefijo}: {item['concepto']}" if item["concepto"] else prefijo
        mov = crear_movimiento(
            db,
            fecha=fecha_obj,
            importe=centimos_a_euros(item["centimos"]),
            descripcion=desc,
            cuenta_id=item["cuenta_id"],
            bote_id=item["bote_id"],
        )
        movimientos_creados.append(mov)
        total_centimos += item["centimos"]

        concepto_low = str(item.get("concepto") or "").lower()

        # 1. Si la línea es de previsión anual: sumar 1 mes a Previsión Gastos Anuales
        es_prev = (
            "previsi" in concepto_low
            or "seguros e ibi" in concepto_low
            or "gastos anuales" in concepto_low
        )
        if es_prev:
            cfg_prev = db.scalar(
                select(PrevisionGastosConfig).where(
                    PrevisionGastosConfig.hogar_id == str(cuenta.hogar_id)
                )
            )
            if cfg_prev and cfg_prev.meses_pagados < 12:
                cfg_prev.meses_pagados += 1

        # 2. Si la línea es de amortización de préstamo coche:
        # Descontar el importe directamente de la deuda del préstamo coche
        if "coche" in concepto_low and (
            "prstamo" in concepto_low
            or "prestamo" in concepto_low
            or "amortizaci" in concepto_low
        ):
            prestamo_coche = db.scalar(
                select(Prestamo).where(
                    Prestamo.hogar_id == str(cuenta.hogar_id),
                    Prestamo.activo.is_(True),
                    Prestamo.nombre.ilike("%coche%"),
                )
            )
            if prestamo_coche:
                prestamo_coche.importe_pendiente_centimos = max(
                    0, prestamo_coche.importe_pendiente_centimos - item["centimos"]
                )
                if prestamo_coche.importe_pendiente_centimos == 0:
                    prestamo_coche.activo = False

        # 3. Si la línea es de DAZN: descontar directamente de la deuda de DAZN
        if "dazn" in concepto_low:
            deuda_dazn = db.scalar(
                select(Deuda).where(
                    Deuda.hogar_id == cuenta.hogar_id,
                    Deuda.archivada.is_(False),
                    Deuda.estado != "saldado",
                    (Deuda.deudor.ilike("%dazn%") | Deuda.concepto.ilike("%dazn%")),
                )
            )
            if deuda_dazn:
                deuda_dazn.importe_cobrado_centimos = min(
                    deuda_dazn.importe_inicial_centimos,
                    deuda_dazn.importe_cobrado_centimos + item["centimos"],
                )
                if deuda_dazn.importe_cobrado_centimos >= deuda_dazn.importe_inicial_centimos:
                    deuda_dazn.estado = "saldado"

    db.commit()

    return {
        "ok": True,
        "plantilla_id": plantilla.id,
        "plantilla_nombre": plantilla.nombre,
        "cuenta_id": target_cuenta_id,
        "cuenta_nombre": cuenta.nombre,
        "fecha": fecha_obj.isoformat(),
        "total_ingresado": f"{centimos_a_euros(total_centimos):.2f}",
        "movimientos_count": len(movimientos_creados),
        "movimiento_ids": [m.id for m in movimientos_creados],
        "avisos": avisos,
    }
