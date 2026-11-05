"""Servicio de Backup, Exportación, Vaciado y Restauración para Flow.

Todas las operaciones están acotadas al hogar del administrador autenticado.
Nunca se exportan, borran ni restauran usuarios, sesiones ni datos de otros
hogares. Las tablas se referencian desde una lista blanca constante y los
nombres de columna se validan antes de construir SQL.
"""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app_conta.services.errors import ErrorValidacion

BACKUPS_DIR = Path(__file__).resolve().parent.parent / "backups"
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

# Tablas del sistema en orden de dependencia (padres antes que hijos).
TABLAS_DATOS = [
    "hogares",
    "cuentas",
    "categorias",
    "botes",
    "movimientos",
    "auditoria_movimientos",
    "deudas",
    "gastos_recurrentes",
    "prevision_gastos_config",
    "inversiones",
    "prestamos",
    "plantillas_reparto",
    "plantillas_reparto_lineas",
    "pagos_recurrentes",
    "importaciones",
]

# Tablas que tienen una columna hogar_id propia.
TABLAS_CON_HOGAR = {
    "cuentas",
    "categorias",
    "botes",
    "movimientos",
    "deudas",
    "gastos_recurrentes",
    "prevision_gastos_config",
    "inversiones",
    "prestamos",
    "plantillas_reparto",
    "pagos_recurrentes",
    "importaciones",
}

_SQL_FILTRO_HOGAR = "CAST(hogar_id AS TEXT) = :hogar_id"
_SQL_AUDITORIA_HOGAR = (
    "movimiento_id IN (SELECT id FROM movimientos WHERE CAST(hogar_id AS TEXT) = :hogar_id)"
)
_SQL_LINEAS_HOGAR = (
    "plantilla_id IN (SELECT id FROM plantillas_reparto WHERE CAST(hogar_id AS TEXT) = :hogar_id)"
)


def _filas_hogar(db: Session, tabla: str, hogar_id: int) -> list[dict[str, Any]]:
    """Devuelve las filas de una tabla que pertenecen al hogar indicado."""
    if tabla == "hogares":
        rows = db.execute(
            text("SELECT * FROM hogares WHERE id = :hogar_id"), {"hogar_id": hogar_id}
        ).mappings().all()
    elif tabla == "auditoria_movimientos":
        rows = db.execute(
            text(f"SELECT * FROM {tabla} WHERE {_SQL_AUDITORIA_HOGAR}"),
            {"hogar_id": str(hogar_id)},
        ).mappings().all()
    elif tabla == "plantillas_reparto_lineas":
        rows = db.execute(
            text(f"SELECT * FROM {tabla} WHERE {_SQL_LINEAS_HOGAR}"),
            {"hogar_id": str(hogar_id)},
        ).mappings().all()
    elif tabla in TABLAS_CON_HOGAR:
        rows = db.execute(
            text(f"SELECT * FROM {tabla} WHERE {_SQL_FILTRO_HOGAR}"),
            {"hogar_id": str(hogar_id)},
        ).mappings().all()
    else:
        rows = []

    resultado: list[dict[str, Any]] = []
    for row in rows:
        fila: dict[str, Any] = {}
        for k, v in row.items():
            fila[k] = v.isoformat() if isinstance(v, datetime) else v
        resultado.append(fila)
    return resultado


def exportar_datos_completos(db: Session, hogar_id: int) -> dict[str, Any]:
    """Exporta todas las tablas de datos del hogar a un diccionario serializable."""
    hogar_id = int(hogar_id)
    db.commit()  # Asegurar transacciones pendientes

    resultado: dict[str, list[dict[str, Any]]] = {}
    for tabla in TABLAS_DATOS:
        resultado[tabla] = _filas_hogar(db, tabla, hogar_id)

    backup_dict = {
        "app": "Flow",
        "version_backup": "2.0",
        "hogar_id": hogar_id,
        "fecha_exportacion": datetime.now(UTC).isoformat(),
        "tablas": resultado,
    }

    # Guardar copia de seguridad preventiva en el servidor (también acotada al hogar).
    try:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        f_auto = BACKUPS_DIR / f"flow_auto_{hogar_id}_{ts}.json"
        with open(f_auto, "w", encoding="utf-8") as f:
            json.dump(backup_dict, f, ensure_ascii=False, indent=2)
    except OSError:
        pass

    return backup_dict


def _borrar_datos_hogar(db: Session, hogar_id: int) -> None:
    """Borra solo los datos del hogar, respetando el orden hijo → padre."""
    for tabla in reversed(TABLAS_DATOS):
        if tabla == "hogares":
            continue
        if tabla == "auditoria_movimientos":
            condicion = _SQL_AUDITORIA_HOGAR
        elif tabla == "plantillas_reparto_lineas":
            condicion = _SQL_LINEAS_HOGAR
        elif tabla in TABLAS_CON_HOGAR:
            condicion = _SQL_FILTRO_HOGAR
        else:
            continue
        db.execute(
            text(f"DELETE FROM {tabla} WHERE {condicion}"),
            {"hogar_id": str(hogar_id)},
        )


def vaciar_base_de_datos(
    db: Session, hogar_id: int, guardar_copia_seguridad: bool = True
) -> dict[str, Any]:
    """Vacía los datos del hogar y deja la base lista para empezar en limpio."""
    hogar_id = int(hogar_id)
    if guardar_copia_seguridad:
        exportar_datos_completos(db, hogar_id)

    db.execute(text("PRAGMA foreign_keys = OFF;"))
    try:
        _borrar_datos_hogar(db, hogar_id)
        db.commit()
    finally:
        db.execute(text("PRAGMA foreign_keys = ON;"))

    return {
        "ok": True,
        "mensaje": "Datos del hogar vaciados con éxito. Ahora está listo para pruebas en limpio.",
        "hogar_id": hogar_id,
    }


def resetear_saldos_a_cero(
    db: Session, hogar_id: int, guardar_copia_seguridad: bool = True
) -> dict[str, Any]:
    """Pone saldos y movimientos a cero conservando botes, cuentas y plantillas."""
    hogar_id = int(hogar_id)
    parametros = {"hogar_id": str(hogar_id)}
    if guardar_copia_seguridad:
        exportar_datos_completos(db, hogar_id)

    # 1. Eliminar movimientos, auditoría e importaciones del hogar.
    db.execute(
        text(f"DELETE FROM auditoria_movimientos WHERE {_SQL_AUDITORIA_HOGAR}"), parametros
    )
    db.execute(text(f"DELETE FROM movimientos WHERE {_SQL_FILTRO_HOGAR}"), parametros)
    db.execute(text(f"DELETE FROM importaciones WHERE {_SQL_FILTRO_HOGAR}"), parametros)

    # 2. Saldo inicial a 0 en las cuentas del hogar.
    db.execute(
        text(f"UPDATE cuentas SET saldo_inicial_centimos = 0 WHERE {_SQL_FILTRO_HOGAR}"),
        parametros,
    )

    # 3. Previsión de gastos y recibos del hogar.
    db.execute(
        text(
            "UPDATE prevision_gastos_config SET meses_pagados = 0 "
            f"WHERE {_SQL_FILTRO_HOGAR}"
        ),
        parametros,
    )
    db.execute(
        text(
            "UPDATE gastos_recurrentes SET pagado_real_centimos = 0 "
            f"WHERE {_SQL_FILTRO_HOGAR}"
        ),
        parametros,
    )

    # 4. Inversiones del hogar.
    db.execute(
        text(
            "UPDATE inversiones SET capital_aportado_centimos = 0, "
            f"valor_actual_centimos = 0 WHERE {_SQL_FILTRO_HOGAR}"
        ),
        parametros,
    )

    # 5. Préstamos del hogar.
    db.execute(
        text(
            f"UPDATE prestamos SET importe_pendiente_centimos = 0 WHERE {_SQL_FILTRO_HOGAR}"
        ),
        parametros,
    )

    # 6. Deudas del hogar (dinero que me deben) saldadas.
    db.execute(
        text(
            "UPDATE deudas SET importe_inicial_centimos = 0, "
            f"importe_cobrado_centimos = 0, estado = 'saldado' WHERE {_SQL_FILTRO_HOGAR}"
        ),
        parametros,
    )

    # 7. Pagos recurrentes del hogar.
    db.execute(
        text(f"UPDATE pagos_recurrentes SET ultimo_pago = NULL WHERE {_SQL_FILTRO_HOGAR}"),
        parametros,
    )

    db.commit()
    return {
        "ok": True,
        "mensaje": (
            "Todos los saldos y movimientos del hogar se han puesto a cero. "
            "Tus botes, cuentas, plantillas y recibos se han conservado intactos."
        ),
    }


def _filtrar_filas_restauracion(
    tablas: dict[str, Any], hogar_id: int
) -> dict[str, list[dict[str, Any]]]:
    """Selecciona solo las filas del hogar y sus tablas hijas."""
    filtradas: dict[str, list[dict[str, Any]]] = {t: [] for t in TABLAS_DATOS}

    for tabla in TABLAS_DATOS:
        if tabla == "hogares":
            continue
        filas = tablas.get(tabla, [])
        if not isinstance(filas, list):
            raise ErrorValidacion(f"La tabla {tabla!r} de la copia no es una lista")
        for fila in filas:
            if not isinstance(fila, dict):
                raise ErrorValidacion(f"La tabla {tabla!r} contiene filas no válidas")
            if tabla in TABLAS_CON_HOGAR:
                if str(fila.get("hogar_id")) == str(hogar_id):
                    filtradas[tabla].append(fila)
            elif tabla == "auditoria_movimientos":
                # Se filtra después de conocer los movimientos del hogar.
                filtradas[tabla].append(fila)
            elif tabla == "plantillas_reparto_lineas":
                filtradas[tabla].append(fila)

    movimientos_ids = {f.get("id") for f in filtradas["movimientos"]}
    plantillas_ids = {f.get("id") for f in filtradas["plantillas_reparto"]}
    filtradas["auditoria_movimientos"] = [
        f for f in filtradas["auditoria_movimientos"] if f.get("movimiento_id") in movimientos_ids
    ]
    filtradas["plantillas_reparto_lineas"] = [
        f for f in filtradas["plantillas_reparto_lineas"] if f.get("plantilla_id") in plantillas_ids
    ]
    return filtradas


def _comprobar_colisiones(db: Session, tabla: str, filas: list[dict[str, Any]]) -> None:
    """Evita reinsertar IDs que ahora pertenecen a otro hogar."""
    for fila in filas:
        row_id = fila.get("id")
        if row_id is None:
            continue
        existe = db.execute(
            text(f"SELECT 1 FROM {tabla} WHERE id = :id LIMIT 1"), {"id": row_id}
        ).first()
        if existe is not None:
            raise ErrorValidacion(
                "La copia contiene identificadores que ya existen en otro hogar. "
                "No se ha restaurado nada para evitar corromper los datos."
            )


def _insertar_filas(db: Session, tabla: str, filas: list[dict[str, Any]], hogar_id: int) -> int:
    """Inserta filas validando nombres de columna y acotando hogar_id."""
    insertadas = 0
    for fila in filas:
        fila_procesada: dict[str, Any] = {}
        for k, v in fila.items():
            if not re.match(r"^[a-zA-Z0-9_]+$", k):
                raise ErrorValidacion("Nombres de columna no válidos en el archivo de copia")
            if k == "hogar_id":
                fila_procesada[k] = int(hogar_id)
            elif isinstance(v, (dict, list)):
                fila_procesada[k] = json.dumps(v)
            else:
                fila_procesada[k] = v

        columnas = list(fila_procesada.keys())
        if not columnas:
            continue
        placeholders = [f":{c}" for c in columnas]
        sql = text(
            f"INSERT INTO {tabla} ({', '.join(columnas)}) "
            f"VALUES ({', '.join(placeholders)})"
        )
        db.execute(sql, fila_procesada)
        insertadas += 1
    return insertadas


def restaurar_datos_completos(
    db: Session, backup_dict: dict[str, Any], hogar_id: int
) -> dict[str, Any]:
    """Restaura una copia acotada al hogar del administrador autenticado."""
    if not isinstance(backup_dict, dict) or "tablas" not in backup_dict:
        raise ErrorValidacion("El archivo no tiene el formato de copia de seguridad válido de Flow")
    if not isinstance(backup_dict["tablas"], dict):
        raise ErrorValidacion("El archivo no tiene el formato de copia de seguridad válido de Flow")

    hogar_id = int(hogar_id)
    backup_hogar = backup_dict.get("hogar_id")
    if backup_hogar is not None and str(backup_hogar) != str(hogar_id):
        raise ErrorValidacion(
            "La copia pertenece a otro hogar. Solo puedes restaurar copias de tu propio hogar."
        )

    tablas = backup_dict["tablas"]
    hogares = tablas.get("hogares", [])
    if isinstance(hogares, list) and hogares:
        ids_hogar = {str(f.get("id")) for f in hogares if isinstance(f, dict)}
        if str(hogar_id) not in ids_hogar:
            raise ErrorValidacion(
                "La copia no contiene el hogar actual y no se puede restaurar aquí."
            )

    filtradas = _filtrar_filas_restauracion(tablas, hogar_id)
    if not any(filas for tabla, filas in filtradas.items() if tabla != "hogares"):
        raise ErrorValidacion("La copia no contiene datos del hogar actual.")

    # Se desactivan las FK mientras se reemplaza el contenido del hogar.
    db.execute(text("PRAGMA foreign_keys = OFF;"))
    try:
        _borrar_datos_hogar(db, hogar_id)

        # Tras borrar lo del hogar, cualquier ID que quede pertenece a otro hogar.
        for tabla in TABLAS_DATOS:
            if tabla == "hogares":
                continue
            _comprobar_colisiones(db, tabla, filtradas[tabla])

        total_insertadas = 0
        for tabla in TABLAS_DATOS:
            if tabla == "hogares":
                continue
            total_insertadas += _insertar_filas(db, tabla, filtradas[tabla], hogar_id)

        db.execute(text("PRAGMA foreign_keys = ON;"))
        db.commit()
    except Exception:
        db.rollback()
        try:
            db.execute(text("PRAGMA foreign_keys = ON;"))
        except Exception:
            pass
        raise

    return {
        "ok": True,
        "mensaje": "Copia de seguridad restaurada correctamente con todos tus datos.",
        "filas_restauradas": total_insertadas,
    }
