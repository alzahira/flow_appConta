"""Router GET /api/v1/conciliacion (T028, US1) — contrato en contracts/rest-api.md.

Devuelve los importes como string de euros con dos decimales (frontera única de
conversión: el servicio trabaja en céntimos enteros).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.services.conciliacion import calcular_conciliacion
from app_conta.services.dinero import euros_str

router = APIRouter(prefix="/conciliacion", tags=["conciliacion"])


@router.get("")
def get_conciliacion(db: Session = Depends(get_db)) -> dict:
    r = calcular_conciliacion(db)
    return {
        "fecha_calculo": r["fecha_calculo"].isoformat(),
        # Campos heredados
        "saldo_total_cuentas": euros_str(int(r["saldo_total_cuentas"])),
        "saldo_inicial_total": euros_str(int(r["saldo_inicial_total"])),
        "saldo_total_botes": euros_str(int(r["saldo_total_botes"])),
        "sin_asignar": euros_str(int(r["sin_asignar"])),
        "diferencia": euros_str(int(r["diferencia"])),
        "estado": r["estado"],
        # Fórmula Global del Hogar
        "total_botes_formula": euros_str(int(r["total_botes_formula"])),
        "total_prevision_formula": euros_str(int(r["total_prevision_formula"])),
        "total_me_deben_formula": euros_str(int(r["total_me_deben_formula"])),
        "total_prestamos_formula": euros_str(int(r["total_prestamos_formula"])),
        "total_teorico_formula": euros_str(int(r["total_teorico_formula"])),
        "total_cuentas_formula": euros_str(int(r["total_cuentas_formula"])),
        "total_inversiones_formula": euros_str(int(r["total_inversiones_formula"])),
        "diferencia_formula": euros_str(int(r["diferencia_formula"])),
        "diferencia_con_inversiones": euros_str(int(r["diferencia_con_inversiones"])),
        "estado_formula": r["estado_formula"],
    }
