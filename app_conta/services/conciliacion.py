"""Servicio de conciliación (US1, FR-007): la identidad contable del hogar.

Fórmula del data-model.md (nota contable): los saldos iniciales no son
movimientos, así que la identidad es Σ saldos_cuentas = Σ saldos_iniciales +
Σ movimientos y, como cada movimiento cae en un bote activo o queda sin
asignar, `Σ movimientos = saldo_total_botes + sin_asignar` cuando el cuadre es
perfecto:

    diferencia = saldo_total_cuentas − saldo_inicial_total
                 − (saldo_total_botes + sin_asignar)

- `sin_asignar` (Σ importes de movimientos sin bote) es INFORMATIVO: dinero
  disponible sin reservar, NO rompe el cuadre.
- La diferencia se aparta de 0 solo con movimientos "fuera de los saldos
  activos" (p. ej., de un bote archivado con movimientos, o el desfase real
  que detectará el importador del Excel en US5).
- El servicio SOLO LEE: nunca escribe (saldos derivados, Principio II).

Universo de cálculo: cuentas NO archivadas y sus movimientos NO eliminados.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.models.bote import Bote
from app_conta.models.cuenta import Cuenta
from app_conta.models.movimiento import Movimiento
from app_conta.services.movimientos import saldo_cuenta

ESTADO_CUADRADO = "cuadrado"
ESTADO_REVISAR = "revisar"


def calcular_conciliacion(db: Session) -> dict[str, object]:
    """Calcula el estado de conciliación completo (importes en céntimos enteros)."""
    cuentas = list(db.scalars(select(Cuenta).where(Cuenta.archivada.is_(False))))
    botes = list(db.scalars(select(Bote).where(Bote.archivado.is_(False))))

    ids_cuentas = [c.id for c in cuentas]
    if ids_cuentas:
        movimientos = list(
            db.scalars(
                select(Movimiento).where(
                    Movimiento.eliminado.is_(False),
                    Movimiento.cuenta_id.in_(ids_cuentas),
                )
            )
        )
    else:
        movimientos = []

    saldo_inicial_total = sum(c.saldo_inicial_centimos for c in cuentas)
    saldo_total_cuentas = sum(saldo_cuenta(db, c) for c in cuentas)

    saldo_total_botes_saldo = sum(
        m.importe_centimos
        for m in movimientos
        if m.bote_id is not None and any(b.id == m.bote_id for b in botes)
    )
    sin_asignar = sum(m.importe_centimos for m in movimientos if m.bote_id is None)

    diferencia = saldo_total_cuentas - saldo_inicial_total - (saldo_total_botes_saldo + sin_asignar)

    return {
        "fecha_calculo": date.today(),
        "saldo_total_cuentas": saldo_total_cuentas,
        "saldo_inicial_total": saldo_inicial_total,
        "saldo_total_botes": saldo_total_botes_saldo,
        "sin_asignar": sin_asignar,
        "diferencia": diferencia,
        "estado": ESTADO_CUADRADO if diferencia == 0 else ESTADO_REVISAR,
    }
