"""Servicio de Backup, Exportación, Vaciado y Restauración para Flow."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app_conta.services.errors import ErrorValidacion
from app_conta.services.hogar import asegurar_hogar_unico

BACKUPS_DIR = Path(__file__).resolve().parent.parent / "backups"
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

# Tablas del sistema en orden de dependencia
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


def exportar_datos_completos(db: Session) -> dict[str, Any]:
    """Exporta todas las tablas de datos a un diccionario serializable."""
    db.commit()  # Asegurar transacciones pendientes
    resultado: dict[str, list[dict[str, Any]]] = {}

    for tabla in TABLAS_DATOS:
        filas = []
        try:
            query = text(f"SELECT * FROM {tabla}")
            rows = db.execute(query).mappings().all()
            for row in rows:
                fila_dict = {}
                for k, v in row.items():
                    if isinstance(v, (datetime,)):
                        fila_dict[k] = v.isoformat()
                    else:
                        fila_dict[k] = v
                filas.append(fila_dict)
        except Exception:
            # Si una tabla no existiese por alguna razón, continúa
            filas = []
        resultado[tabla] = filas

    backup_dict = {
        "app": "Flow",
        "version_backup": "2.0",
        "fecha_exportacion": datetime.now(UTC).isoformat(),
        "tablas": resultado,
    }

    # Guardar copia de seguridad preventiva en el servidor
    try:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        f_auto = BACKUPS_DIR / f"flow_auto_{ts}.json"
        with open(f_auto, "w", encoding="utf-8") as f:
            json.dump(backup_dict, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    return backup_dict


def vaciar_base_de_datos(db: Session, guardar_copia_seguridad: bool = True) -> dict[str, Any]:
    """Vacía todos los datos de usuario y deja la base de datos limpia para pruebas."""
    if guardar_copia_seguridad:
        exportar_datos_completos(db)

    db.execute(text("PRAGMA foreign_keys = OFF;"))

    for tabla in reversed(TABLAS_DATOS):
        try:
            db.execute(text(f"DELETE FROM {tabla};"))
        except Exception:
            pass

    db.execute(text("PRAGMA foreign_keys = ON;"))
    db.commit()

    # Recrear el hogar único para que la app arranque limpia
    hogar = asegurar_hogar_unico(db)
    hogar_id = hogar.id if hasattr(hogar, "id") else int(hogar)

    return {
        "ok": True,
        "mensaje": "Base de datos vaciada con éxito. Ahora está lista para pruebas en limpio.",
        "hogar_id": hogar_id,
    }


def resetear_saldos_a_cero(db: Session, guardar_copia_seguridad: bool = True) -> dict[str, Any]:
    """Pone saldos y movimientos a cero, CONSERVANDO botes, cuentas, categorías y plantillas.

    - Hace copia de seguridad preventiva automática en el servidor.
    - Elimina todos los movimientos y auditoría de movimientos (saldo derivado de botes = 0.00 €).
    - Pone a 0 el saldo_inicial_centimos de todas las cuentas (saldo derivado de cuentas = 0.00 €).
    - Pone a 0 el pagado_real_centimos de los gastos recurrentes (previsión).
    - Pone a 0 importes de inversiones si las hay.
    - Limpia las huellas de importaciones para poder re-importar en limpio.
    - CONSERVA intactos: todos los botes, todas las cuentas, todas las categorías,
      todas las plantillas de reparto y todos los pagos recurrentes.
    """
    if guardar_copia_seguridad:
        exportar_datos_completos(db)

    # 1. Eliminar movimientos y auditoría (los botes quedan con saldo 0.00 € derivado)
    db.execute(text("DELETE FROM auditoria_movimientos;"))
    db.execute(text("DELETE FROM movimientos;"))
    db.execute(text("DELETE FROM importaciones;"))

    # 2. Poner saldo inicial a 0 en todas las cuentas (las cuentas quedan con saldo 0.00 €)
    db.execute(text("UPDATE cuentas SET saldo_inicial_centimos = 0;"))

    # 3. Poner a 0 pagado_real en gastos recurrentes
    try:
        db.execute(text("UPDATE gastos_recurrentes SET pagado_real_centimos = 0;"))
    except Exception:
        pass

    # 4. Poner a 0 capital en inversiones si existen
    try:
        db.execute(
            text(
                "UPDATE inversiones SET capital_aportado_centimos = 0, valor_actual_centimos = 0;"
            )
        )
    except Exception:
        pass

    db.commit()

    return {
        "ok": True,
        "mensaje": (
            "Todos los saldos y movimientos se han puesto a cero. "
            "Tus botes, cuentas, plantillas y recibos se han conservado intactos."
        ),
    }


def restaurar_datos_completos(db: Session, backup_dict: dict[str, Any]) -> dict[str, Any]:
    """Restaura todas las tablas a partir del diccionario de backup con integridad total."""
    if not isinstance(backup_dict, dict) or "tablas" not in backup_dict:
        raise ErrorValidacion("El archivo no tiene el formato de copia de seguridad válido de Flow")

    tablas = backup_dict["tablas"]

    # Desactivar temporalmente foreign keys durante la carga por lotes
    db.execute(text("PRAGMA foreign_keys = OFF;"))

    try:
        # 1. Limpiar tablas actuales
        for tabla in reversed(TABLAS_DATOS):
            try:
                db.execute(text(f"DELETE FROM {tabla};"))
            except Exception:
                pass

        # 2. Reinsertar en orden de dependencias
        total_insertadas = 0
        for tabla in TABLAS_DATOS:
            filas = tablas.get(tabla, [])
            if not filas:
                continue

            for fila in filas:
                columnas = list(fila.keys())
                placeholders = [f":{c}" for c in columnas]
                col_str = ", ".join(columnas)
                val_str = ", ".join(placeholders)

                # Si algún campo es JSON o diccionario, serializarlo
                fila_procesada = {}
                for k, v in fila.items():
                    if isinstance(v, (dict, list)):
                        fila_procesada[k] = json.dumps(v)
                    else:
                        fila_procesada[k] = v

                sql = text(f"INSERT INTO {tabla} ({col_str}) VALUES ({val_str})")
                db.execute(sql, fila_procesada)
                total_insertadas += 1

        db.execute(text("PRAGMA foreign_keys = ON;"))
        db.commit()
    except Exception:
        db.rollback()
        db.execute(text("PRAGMA foreign_keys = ON;"))
        raise

    return {
        "ok": True,
        "mensaje": "Copia de seguridad restaurada correctamente con todos tus datos.",
        "filas_restauradas": total_insertadas,
    }
