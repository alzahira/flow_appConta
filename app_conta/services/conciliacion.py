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


def calcular_conciliacion(db: Session, hogar_id: int | None = None) -> dict[str, object]:
    """Calcula el estado de conciliación completo (importes en céntimos enteros).

    Fórmula Exacta del Hogar:
      GRUPO 1 (Dinero que debería tener):
        + Botes generales
        + Guardado Hipoteca (Botes con 'hipoteca')
        + Tarjetas (saldo dispuesto de crédito pendiente de liquidar)
        + Saldo de previsión anual (aportado - pagado)
        Total Teórico = botes + guardado_hipoteca + tarjetas + prevision

      GRUPO 2 (Dinero que tengo real / Activos):
        + Bancos y Efectivo (cuentas de banco, efectivo y monederos)
        + Me deben (deudas activas pendientes de cobro)
        + Préstamos (préstamos internos asumidos de botes de ahorro)
        + Inversiones (eToro, crypto, fondos)
        Total Real = bancos_efectivo + me_deben + prestamos + inversiones

      Diferencia = Total Teórico - Total Real
      (Cuadrado si abs(diferencia) <= 100 céntimos / 1 € por redondeos mensuales)
    """
    stmt_c = select(Cuenta).where(Cuenta.archivada.is_(False))
    stmt_b = select(Bote).where(Bote.archivado.is_(False))
    if hogar_id is not None:
        stmt_c = stmt_c.where(Cuenta.hogar_id == hogar_id)
        stmt_b = stmt_b.where((Bote.hogar_id == str(hogar_id)) | (Bote.hogar_id == hogar_id))

    cuentas = list(db.scalars(stmt_c))
    botes = list(db.scalars(stmt_b))

    ids_cuentas = [c.id for c in cuentas]
    if ids_cuentas:
        stmt_m = select(Movimiento).where(
            Movimiento.eliminado.is_(False),
            (
                Movimiento.cuenta_id.in_(ids_cuentas)
                | Movimiento.descripcion.like("Traspaso %")
            ),
        )
        if hogar_id is not None:
            stmt_m = stmt_m.where(Movimiento.hogar_id == hogar_id)
        movimientos = list(db.scalars(stmt_m))
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

    # 1. Cuentas bancarias y tarjetas
    tot_bancos_efectivo = 0
    tot_tarjetas_credito = 0

    for c in cuentas:
        sc = saldo_cuenta(db, c)
        if c.tipo in ("banco", "efectivo") or (c.tipo == "tarjeta" and sc >= 0):
            tot_bancos_efectivo += sc
        elif c.tipo == "tarjeta" and sc < 0:
            tot_tarjetas_credito += abs(sc)

    # 2. Botes y Guardado Hipoteca
    pares_todos, tot_botes_formula = listar_botes_activos(db)
    if hogar_id is not None:
        botes_activos_pares = [
            (b, s)
            for b, s in pares_todos
            if (str(b.hogar_id) == str(hogar_id) or b.hogar_id == hogar_id) and not b.archivado
        ]
        tot_botes_formula = sum(s for _b, s in botes_activos_pares)
    else:
        botes_activos_pares = pares_todos

    tot_guardado_hipoteca = sum(
        s for b, s in botes_activos_pares if "hipoteca" in (b.nombre or "").lower()
    )
    tot_botes_generales = tot_botes_formula - tot_guardado_hipoteca

    # 3. Saldo Previsión Anual
    hogar_target_id = hogar_id
    if hogar_target_id is None:
        hogar_obj = db.scalars(select(Hogar)).first()
        hogar_target_id = hogar_obj.id if hogar_obj else 1

    tot_prevision_formula = 0
    if hogar_target_id is not None:
        try:
            prev = obtener_resumen_prevision(db, str(hogar_target_id))
            tot_prevision_formula = int(prev.get("total_saldo_centimos", 0))
        except Exception:
            db.rollback()
            tot_prevision_formula = 0

    # 4. Deudas (Me deben), Préstamos e Inversiones
    stmt_d = select(Deuda).where(Deuda.archivada.is_(False))
    stmt_p = select(Prestamo).where(Prestamo.activo.is_(True))
    stmt_i = select(Inversion).where(Inversion.activo.is_(True))
    if hogar_id is not None:
        stmt_d = stmt_d.where(Deuda.hogar_id == hogar_id)
        stmt_p = stmt_p.where(
            (Prestamo.hogar_id == str(hogar_id)) | (Prestamo.hogar_id == hogar_id)
        )
        stmt_i = stmt_i.where(Inversion.hogar_id == hogar_id)

    deudas = list(db.scalars(stmt_d))
    tot_me_deben_formula = sum(
        d.importe_inicial_centimos - d.importe_cobrado_centimos for d in deudas
    )

    prestamos = list(db.scalars(stmt_p))
    tot_prestamos_formula = sum(p.importe_pendiente_centimos for p in prestamos)

    inversiones = list(db.scalars(stmt_i))
    tot_inversiones_formula = sum(i.valor_actual_centimos for i in inversiones)

    # GRUPO 1: Total Teórico (Lo que debería tener / asignado y libre para recibos)
    tot_teorico_formula = (
        tot_botes_formula
        + tot_tarjetas_credito
        + tot_prevision_formula
        + sin_asignar
    )

    # GRUPO 2: Total Real (Lo que tengo real / Activos)
    tot_real_formula = (
        tot_bancos_efectivo
        + tot_me_deben_formula
        + tot_prestamos_formula
        + tot_inversiones_formula
    )

    # Diferencia de balance
    dif_formula = tot_teorico_formula - tot_real_formula

    # Cuadre estricto (tolerancia de 1 € por redondeos acumulados en divisiones mensuales)
    estado_formula = "cuadrado" if abs(dif_formula) <= 100 else "revisar"

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
        "botes_generales_formula": tot_botes_generales,
        "guardado_hipoteca_formula": tot_guardado_hipoteca,
        "total_tarjetas_formula": tot_tarjetas_credito,
        "total_prevision_formula": tot_prevision_formula,
        "total_me_deben_formula": tot_me_deben_formula,
        "total_prestamos_formula": tot_prestamos_formula,
        "total_inversiones_formula": tot_inversiones_formula,
        "total_bancos_formula": tot_bancos_efectivo,
        "total_real_formula": tot_real_formula,
        "deduccion_inversiones_formula": tot_inversiones_formula,
        "deduccion_etoro_formula": tot_inversiones_formula,
        "deduccion_extras_formula": 0,
        "total_teorico_base": tot_teorico_formula,
        "total_teorico_formula": tot_teorico_formula,
        "total_cuentas_formula": tot_bancos_efectivo,
        "diferencia_formula": dif_formula,
        "diferencia_con_inversiones": dif_formula,
        "estado_formula": estado_formula,
    }
