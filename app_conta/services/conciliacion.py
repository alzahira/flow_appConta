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
from app_conta.models.deuda import Deuda
from app_conta.models.hogar import Hogar
from app_conta.models.inversion import Inversion
from app_conta.models.movimiento import Movimiento
from app_conta.models.prestamo import Prestamo
from app_conta.services.botes import listar_botes_activos
from app_conta.services.movimientos import saldo_cuenta
from app_conta.services.prevision_gastos import obtener_resumen_prevision

ESTADO_CUADRADO = "cuadrado"
ESTADO_REVISAR = "revisar"


def calcular_conciliacion(db: Session) -> dict[str, object]:
    """Calcula el estado de conciliación completo (importes en céntimos enteros).

    Incluye la conciliación contable técnica (por movimientos de cuentas)
    y la Fórmula Global del Hogar del usuario:
      Dinero Teórico = Botes + Previsión - Me Deben - Préstamos
      Diferencia = Dinero Teórico - Dinero Real en Cuentas y Tarjetas
    """
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

    # 2. Fórmula Global del Hogar
    _, tot_botes_formula = listar_botes_activos(db)

    hogar = db.scalars(select(Hogar)).first()
    hogar_id = str(hogar.id) if hogar else "1"
    try:
        prev = obtener_resumen_prevision(db, hogar_id)
        tot_prevision_formula = int(prev.get("total_saldo_centimos", 0))
    except Exception:
        tot_prevision_formula = 0

    deudas = list(db.scalars(select(Deuda).where(Deuda.archivada.is_(False))))
    tot_me_deben_formula = sum(
        d.importe_inicial_centimos - d.importe_cobrado_centimos for d in deudas
    )

    prestamos = list(db.scalars(select(Prestamo).where(Prestamo.activo.is_(True))))
    tot_prestamos_formula = sum(p.importe_pendiente_centimos for p in prestamos)

    inversiones = list(db.scalars(select(Inversion).where(Inversion.activo.is_(True))))
    tot_inversiones_formula = sum(i.valor_actual_centimos for i in inversiones)

    tot_teorico_formula = (
        tot_botes_formula
        + tot_prevision_formula
        - tot_me_deben_formula
        - tot_prestamos_formula
    )

    dif_formula = tot_teorico_formula - saldo_total_cuentas
    dif_con_inversiones = tot_teorico_formula - (saldo_total_cuentas + tot_inversiones_formula)

    estado_formula = "cuadrado" if abs(dif_formula) <= 200 else "revisar"

    return {
        "fecha_calculo": date.today(),
        "saldo_total_cuentas": saldo_total_cuentas,
        "saldo_inicial_total": saldo_inicial_total,
        "saldo_total_botes": saldo_total_botes_saldo,
        "sin_asignar": sin_asignar,
        "diferencia": diferencia,
        "estado": ESTADO_CUADRADO if diferencia == 0 else ESTADO_REVISAR,
        # Fórmula del Usuario
        "total_botes_formula": tot_botes_formula,
        "total_prevision_formula": tot_prevision_formula,
        "total_me_deben_formula": tot_me_deben_formula,
        "total_prestamos_formula": tot_prestamos_formula,
        "total_teorico_formula": tot_teorico_formula,
        "total_cuentas_formula": saldo_total_cuentas,
        "total_inversiones_formula": tot_inversiones_formula,
        "diferencia_formula": dif_formula,
        "diferencia_con_inversiones": dif_con_inversiones,
        "estado_formula": estado_formula,
    }
