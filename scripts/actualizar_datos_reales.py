"""Script para actualizar la base de datos local con los datos exactos del hogar de Javier."""

import sys
from app_conta.db import SessionLocal
from app_conta.models.cuenta import Cuenta
from app_conta.models.bote import Bote
from app_conta.models.deuda import Deuda
from app_conta.models.prestamo import Prestamo
from app_conta.models.inversion import Inversion
from app_conta.models.movimiento import Movimiento
from app_conta.models.gasto_recurrente import GastoRecurrente, PrevisionGastosConfig
from app_conta.services.conciliacion import calcular_conciliacion
from datetime import date

def actualizar():
    with SessionLocal() as db:
        hogar_id = 1
        hoy = date.today()

        print("1. Actualizando Cuentas...")
        # 1.1 Cuentas Bancarias
        c_caixa = db.query(Cuenta).filter(Cuenta.id == 25).first()
        if c_caixa:
            c_caixa.nombre = "La Caixa"
            c_caixa.saldo_inicial_centimos = 273470  # 2.734,70 €
            c_caixa.archivada = False

        c_db = db.query(Cuenta).filter(Cuenta.id == 19).first()
        if c_db:
            c_db.nombre = "Deustche Bank"
            c_db.saldo_inicial_centimos = 434100  # 4.341,00 €
            c_db.archivada = False

        c_bbva = db.query(Cuenta).filter(Cuenta.id == 33).first()
        if c_bbva:
            c_bbva.nombre = "BBVA"
            c_bbva.saldo_inicial_centimos = 3950  # 39,50 €
            c_bbva.archivada = False

        c_efectivo = db.query(Cuenta).filter(Cuenta.id == 23).first()
        if c_efectivo:
            c_efectivo.nombre = "Fondo Bols. (Efectivo)"
            c_efectivo.saldo_inicial_centimos = 50000  # 500,00 €
            c_efectivo.archivada = False

        c_revolut = db.query(Cuenta).filter(Cuenta.id == 21).first()
        if c_revolut:
            c_revolut.nombre = "Revolut"
            c_revolut.saldo_inicial_centimos = 3800  # 38,00 €
            c_revolut.archivada = False

        c_paypal = db.query(Cuenta).filter(Cuenta.id == 22).first()
        if c_paypal:
            c_paypal.nombre = "Paypal"
            c_paypal.saldo_inicial_centimos = 2000  # 20,00 €
            c_paypal.archivada = False

        # 1.2 Tarjetas Regalo y Divisas
        c_cya = db.query(Cuenta).filter(Cuenta.id == 8).first()
        if c_cya:
            c_cya.nombre = "Tarjeta C&A"
            c_cya.saldo_inicial_centimos = 1800  # 18,00 €
            c_cya.archivada = False

        c_sprinter = db.query(Cuenta).filter(Cuenta.id == 9).first()
        if c_sprinter:
            c_sprinter.nombre = "Tarjeta Sprinter"
            c_sprinter.saldo_inicial_centimos = 1800  # 18,00 €
            c_sprinter.archivada = False

        c_carrefour_reg = db.query(Cuenta).filter(Cuenta.id == 10).first()
        if c_carrefour_reg:
            c_carrefour_reg.nombre = "Tarjeta Carrefour"
            c_carrefour_reg.saldo_inicial_centimos = 3100  # 31,00 €
            c_carrefour_reg.archivada = False

        c_coupert = db.query(Cuenta).filter(Cuenta.id == 11).first()
        if c_coupert:
            c_coupert.nombre = "Coupert"
            c_coupert.saldo_inicial_centimos = 3000  # 30,00 €
            c_coupert.archivada = False

        c_florines = db.query(Cuenta).filter(Cuenta.id == 12).first()
        if c_florines:
            c_florines.nombre = "Florines"
            c_florines.saldo_inicial_centimos = 600  # 6,00 €
            c_florines.archivada = False

        c_dirhams = db.query(Cuenta).filter(Cuenta.id == 13).first()
        if c_dirhams:
            c_dirhams.nombre = "Dirhams"
            c_dirhams.saldo_inicial_centimos = 3600  # 36,00 €
            c_dirhams.archivada = False

        # 1.3 Tarjeta de Crédito Carrefour Pass (gasto acumulado)
        c_pass = db.query(Cuenta).filter(Cuenta.id == 28).first()
        if c_pass:
            c_pass.nombre = "Tarjeta Carrefour Pass"
            c_pass.tipo = "tarjeta"
            c_pass.saldo_inicial_centimos = -56565  # -565,65 €
            c_pass.archivada = False

        # Archivar cuentas no usadas
        for cid in [17, 32]:
            c_extra = db.query(Cuenta).filter(Cuenta.id == cid).first()
            if c_extra:
                c_extra.archivada = True

        db.commit()

        print("2. Actualizando Préstamos...")
        p_coche = db.query(Prestamo).filter(Prestamo.hogar_id == str(hogar_id), Prestamo.id == 1).first()
        if p_coche:
            p_coche.nombre = "Coche Hyundai"
            p_coche.importe_pendiente_centimos = 738906  # 7.389,06 €

        p_dam = db.query(Prestamo).filter(Prestamo.hogar_id == str(hogar_id), Prestamo.id == 2).first()
        if p_dam:
            p_dam.nombre = "Ciclo DAM - A pagar con bodas"
            p_dam.importe_pendiente_centimos = 210960  # 2.109,60 €

        db.commit()

        print("3. Actualizando Inversiones...")
        i_etoro = db.query(Inversion).filter(Inversion.hogar_id == hogar_id, Inversion.id == 1).first()
        if i_etoro:
            i_etoro.nombre = "Inversiones Etoro"
            i_etoro.valor_actual_centimos = 150000  # 1.500,00 €
            i_etoro.capital_aportado_centimos = 150000

        i_cro = db.query(Inversion).filter(Inversion.hogar_id == hogar_id, Inversion.id == 2).first()
        if i_cro:
            i_cro.nombre = "Inversiones CRO"
            i_cro.valor_actual_centimos = 69600  # 696,00 €
            i_cro.capital_aportado_centimos = 69600

        db.commit()

        print("4. Actualizando Deudas (Me deben)...")
        # Borrar deudas antiguas de prueba de hogar 1
        db.query(Deuda).filter(Deuda.hogar_id == hogar_id).delete()
        db.flush()

        deudas_exactas = [
            ("Pedro", "HE COGIDO 1600 DE BBVA", 2900),
            ("Tarjeta Visa", "Devolución Tarjeta Visa", 3000),
            ("Endesa", "PENDIENTE", 2800),
            ("Redmi", "Redmi Comprado", 22300),
            ("Mercadona mi suegra", "Compra mercadona y ducha", 3000),
            ("Mi madre", "Nicho Ayto y pagado Loli", 72900),
            ("Juana", "PENDIENTE COBRO JUANA", 44000),
            ("Javier Alzahira", "GASTOS ALZAHIRA PENDIENTES", 42610),
            ("Nexo Exchange", "REPONER DE NEXO - BUDAPEST", 35600),
            ("Amazon", "GALAXY A DEVOLVER", 18900),
            ("Groupon", "GROUPON BENALMADENA", 1500),
            ("Seguro piso Córdoba", "Pagado Ocaso a meter en botes", 16250),
            ("Dazn", "DAZON a descontar", 6000),
            ("Carrefour", "PENDIENTE CARREFOUR", 14000),
            ("Mi madre", "PENDIENTE DE ASIGNAR GASTOS", 5100),
            ("Entradas Aitor", "Entradas Aitor acumulado", 1100),
        ]

        for deudor, concepto, centimos in deudas_exactas:
            d = Deuda(
                hogar_id=hogar_id,
                deudor=deudor,
                concepto=concepto,
                importe_inicial_centimos=centimos,
                importe_cobrado_centimos=0,
                fecha=hoy,
                estado="pendiente",
                archivada=False,
            )
            db.add(d)

        db.commit()

        print("5. Actualizando Previsión de Gastos...")
        g_cuadre = db.query(GastoRecurrente).filter(GastoRecurrente.hogar_id == str(hogar_id), GastoRecurrente.concepto.ilike("%cuadrar%")).first()
        if g_cuadre:
            g_cuadre.pagado_real_centimos = 5398  # Calibrado para dar exactamente -82,54 €
        db.commit()

        print("6. Actualizando Botes y Sobres...")
        # Asegurar botes de Hipotecas separados
        b_h2025 = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.id == 2).first()
        if b_h2025:
            b_h2025.nombre = "GUARDADO HIPOTECAS 2025"
            b_h2025.tipo = "ahorro"
            b_h2025.archivado = False

        b_h2026 = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.nombre.ilike("%hipotecas 2026%")).first()
        if not b_h2026:
            b_h2026 = Bote(
                hogar_id=str(hogar_id),
                nombre="GUARDADO HIPOTECAS",
                tipo="ahorro",
                archivado=False,
            )
            db.add(b_h2026)
            db.flush()

        # Mapa de botes y sus saldos objetivos
        saldos_deseados = {
            "GUARDADO HIPOTECAS": 884700,
            "GUARDADO HIPOTECAS 2025": 707600,
            "Cash para el mes en curso": 29600,
            "Bote ocio": 21422,
            "Gasolina mes": 0,
            "Bote Aitor": -3790,
            "Bote Javi": 32,
            "Acumulado M.Jose": -1900,
            "Bote Arreglos Pisos": -32370,
            "Bote IRPF": 27640,
            "Bote ahorro extras": 18600,
            "Mejoras del Hogar": -16281,
            "Fianzas": 107000,  # Fianza César (580) + Fianza Nerea (490) = 1.070 €
            "Guardado Resto Paro": 266500,
            "Fondo Inversión Aitor": 47000,
            "Viaje Rabat": 1200,
            "Viaje Invierno": 80500,
            "Dentista": 25400,
            "Viaje Navidad": 29100,
            "Kitoli para pagar": 20400,
        }

        # Desarchivar si alguno estaba archivado
        b_mj = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.id == 19).first()
        if b_mj:
            b_mj.nombre = "Bote Maria Jose"
            b_mj.tipo = "ahorro"
            b_mj.archivado = False

        db.commit()

        # Ajustar movimientos para que cada bote tenga su saldo exacto
        # Limpiar movimientos de botes de hogar 1 y recrear 1 apunte de balance base por bote
        db.query(Movimiento).filter(Movimiento.hogar_id == hogar_id).delete()
        db.flush()

        cta_base = c_caixa.id

        # Mapeo de nombres a botes reales
        botes_todos = db.query(Bote).filter(Bote.hogar_id == str(hogar_id)).all()
        for b in botes_todos:
            # Buscar objetivo
            target = None
            for k, val in saldos_deseados.items():
                if k.lower() in b.nombre.lower() or b.nombre.lower() in k.lower():
                    target = val
                    break
            if target is not None and target != 0:
                mov = Movimiento(
                    hogar_id=hogar_id,
                    cuenta_id=cta_base,
                    fecha=hoy,
                    importe_centimos=target,
                    descripcion=f"Saldo consolidado {b.nombre}",
                    bote_id=b.id,
                )
                db.add(mov)

        db.commit()

        print("7. Comprobando conciliación final...")
        conc = calcular_conciliacion(db, hogar_id)
        print("=== RESULTADO DE CONCILIACIÓN ===")
        for k, v in conc.items():
            print(f"  {k}: {v}")

if __name__ == "__main__":
    actualizar()

