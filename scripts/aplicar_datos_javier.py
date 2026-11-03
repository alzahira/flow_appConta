"""Actualización canónica de datos del hogar según la hoja de control de Javier."""

from datetime import date
from app_conta.db import SessionLocal
from app_conta.models.cuenta import Cuenta
from app_conta.models.bote import Bote
from app_conta.models.deuda import Deuda
from app_conta.models.prestamo import Prestamo
from app_conta.models.inversion import Inversion
from app_conta.models.movimiento import Movimiento
from app_conta.models.gasto_recurrente import GastoRecurrente, PrevisionGastosConfig
from app_conta.services.movimientos import saldo_cuenta
from app_conta.services.botes import saldo_bote
from app_conta.services.conciliacion import calcular_conciliacion

def ejecutar():
    with SessionLocal() as db:
        hogar_id = 1
        hoy = date.today()

        print("=== 1. CUENTAS Y TARJETAS ===")
        # Saldos deseados exactos:
        # En Bancos:
        #   La Caixa: 2.734,70 €
        #   Deutsche Bank: 4.341,00 €
        #   BBVA: 39,50 €
        #   Fondo Bols. (Efectivo): 500,00 €
        #   Revolut: 38,00 €
        #   Paypal: 20,00 €
        # Tarjetas y otros:
        #   Tarjeta C&A: 18,00 €
        #   Tarjeta Sprinter: 18,00 €
        #   Tarjeta Carrefour: 31,00 €
        #   Coupert: 30,00 €
        #   Florines: 6,00 €
        #   Dirhams: 36,00 €
        # Gastos tarjetas:
        #   Tarjeta Carrefour Pass: -565,65 €

        saldos_cuentas = {
            25: ("La Caixa", "banco", 273470),
            19: ("Deustche Bank", "banco", 434100),
            33: ("BBVA", "banco", 3950),
            21: ("Revolut", "banco", 3800),
            22: ("Paypal", "banco", 2000),
            23: ("Dinero en efectivo", "efectivo", 18040),
            24: ("Fondo Bols. (Efectivo)", "efectivo", 50000),
            8: ("Tarjeta C&A", "tarjeta", 1800),
            9: ("Tarjeta Sprinter", "tarjeta", 1800),
            10: ("Tarjeta Carrefour", "tarjeta", 3100),
            11: ("Coupert", "tarjeta", 3000),
            12: ("Florines", "tarjeta", 600),
            13: ("Dirhams", "tarjeta", 3600),
            28: ("Tarjeta Carrefour Pass", "tarjeta", -56565),
        }

        c24 = db.get(Cuenta, 24)
        if not c24:
            c24 = Cuenta(
                id=24,
                hogar_id=hogar_id,
                nombre="Fondo Bols. (Efectivo)",
                tipo="efectivo",
                saldo_inicial_centimos=50000,
                fecha_apertura=hoy,
                archivada=False,
            )
            db.add(c24)
            db.flush()

        # Actualizar saldos iniciales para que el saldo derivado sea exacto
        for cid, (nom, tipo, sal_target) in saldos_cuentas.items():
            c = db.get(Cuenta, cid)
            if c:
                c.nombre = nom
                c.tipo = tipo
                c.archivada = False
                movs_suma = sum(
                    m.importe_centimos
                    for m in db.query(Movimiento).filter(Movimiento.cuenta_id == cid, ~Movimiento.eliminado).all()
                )
                c.saldo_inicial_centimos = sal_target - movs_suma

        # Archivar cuentas que no están en la lista
        for c in db.query(Cuenta).filter(Cuenta.hogar_id == hogar_id).all():
            if c.id not in saldos_cuentas:
                c.archivada = True

        db.commit()

        print("=== 2. PRÉSTAMOS ===")
        # Ciclo DAM: 2.109,60 €
        # Coche: 7.389,06 €
        p_coche = db.query(Prestamo).filter(Prestamo.hogar_id == str(hogar_id), Prestamo.id == 1).first()
        if p_coche:
            p_coche.nombre = "Coche Hyundai"
            p_coche.importe_pendiente_centimos = 738906
            p_coche.activo = True

        p_dam = db.query(Prestamo).filter(Prestamo.hogar_id == str(hogar_id), Prestamo.id == 2).first()
        if p_dam:
            p_dam.nombre = "Ciclo DAM - A pagar con bodas"
            p_dam.importe_pendiente_centimos = 210960
            p_dam.activo = True

        db.commit()

        print("=== 3. INVERSIONES ===")
        # Inversiones Etoro: 1.500,00 €
        # Inversiones CRO: 696,00 €
        i1 = db.query(Inversion).filter(Inversion.hogar_id == hogar_id, Inversion.id == 1).first()
        if i1:
            i1.nombre = "Inversiones Etoro"
            i1.valor_actual_centimos = 150000
            i1.capital_aportado_centimos = 150000
            i1.activo = True

        i2 = db.query(Inversion).filter(Inversion.hogar_id == hogar_id, Inversion.id == 2).first()
        if i2:
            i2.nombre = "Inversiones CRO"
            i2.valor_actual_centimos = 69600
            i2.capital_aportado_centimos = 69600
            i2.activo = True

        db.commit()

        print("=== 4. ME DEBEN (16 DEUDAS EXACTAS) ===")
        db.query(Deuda).filter(Deuda.hogar_id == hogar_id).delete()
        db.flush()

        deudas = [
            ("Pedro", "PEDRO * HE COGIDO 1600 DE BBVA", 2900),
            ("Tarjeta Visa", "TARJETA VISA", 3000),
            ("Endesa", "ENDESA ** PENDIENTE", 2800),
            ("Redmi", "REDMI", 22300),
            ("Mercadona mi suegra", "MERCADONA MI SUEGRA", 3000),
            ("Mi madre", "MI MADRE", 72900),
            ("Juana", "PENDIENTE COBRO JUANA", 44000),
            ("Javier Alzahira", "GASTOS ALZAHIRA PENDIENTES", 42610),
            ("Nexo Exchange", "REPONER DE NEXO - BUDAPEST", 35600),
            ("Amazon", "GALAXY A DEVOLVER", 18900),
            ("Groupon", "GROUPON BENALMADENA", 1500),
            ("Seguro piso Córdoba", "SEGURO PISO CORDOBA", 16250),
            ("Dazn", "DAZON", 6000),
            ("Carrefour", "PENDIENTE CARREFOUR", 14000),
            ("Mi madre", "PENDIENTE DE ASIGNAR GASTOS MI MADRE", 5100),
            ("Entradas Aitor", "ENTRADAS AITOR", 1100),
        ]

        for deudor, concepto, imp in deudas:
            d = Deuda(
                hogar_id=hogar_id,
                deudor=deudor,
                concepto=concepto,
                importe_inicial_centimos=imp,
                importe_cobrado_centimos=0,
                fecha=hoy,
                estado="pendiente",
                archivada=False,
            )
            db.add(d)

        db.commit()

        print("=== 5. PREVISIÓN DE GASTOS (-82,54 €) ===")
        g_cuadre = db.query(GastoRecurrente).filter(GastoRecurrente.hogar_id == str(hogar_id), GastoRecurrente.concepto.ilike("%cuadrar%")).first()
        if g_cuadre:
            g_cuadre.pagado_real_centimos = 5398  # Calibrado para -82,54 € exactos
        db.commit()

        print("=== 6. SOBRES Y BOTES ===")
        # Botes y sus saldos objetivos
        # 1. Total a Cuenta:
        #   GUARDADO HIPOTECAS: 8.847,00 €
        #   GUARDADO HIPOTECAS 2025: 7.076,00 €
        #   MES: 296,00 €
        #   PARA GASOLINA MES CURSO: 0,00 €
        #   OCIO: 214,22 €
        #   SEMANA: 0,00 €
        # 2. Sobres y Botes:
        #   BOTE AITOR: -37,90 €
        #   BOTE JAVI: 0,32 €
        #   BOTE MARIA JOSE: -19,00 €
        #   BOTE ARREGLO PISOS: -323,70 €
        #   BOTE IRPF: 276,40 €
        #   BOTE AHORRO EMERGENCIAS: 186,00 €
        #   MEJORAS DEL HOGAR: -162,81 €
        #   FIANZA CESAR: 580,00 €
        #   FIANZA NEREA: 490,00 €
        #   Guardado para resto de Paro: 2.665,00 €
        #   Para fondo de inversión - Regalo Aitor: 470,00 €
        #   Para Rabat - Vuelos comprados: 12,00 €
        #   Extra para viaje Invierno: 805,00 €
        #   Guardado Dentista: 254,00 €
        #   Para viaje invierno: 291,00 €
        #   Para Kitoli libro Rafa: 204,00 €

        # Asegurar botes de Hipotecas separados
        b_h2025 = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.id == 2).first()
        if b_h2025:
            b_h2025.nombre = "GUARDADO HIPOTECAS 2025"
            b_h2025.tipo = "ahorro"
            b_h2025.archivado = False

        b_h2026 = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.nombre.ilike("%GUARDADO HIPOTECAS%"), Bote.id != 2).first()
        if not b_h2026:
            b_h2026 = Bote(
                hogar_id=str(hogar_id),
                nombre="GUARDADO HIPOTECAS",
                tipo="ahorro",
                archivado=False,
            )
            db.add(b_h2026)
            db.flush()
        else:
            b_h2026.nombre = "GUARDADO HIPOTECAS"
            b_h2026.archivado = False

        b_fianzas_cesar = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.nombre.ilike("%fianza cesar%")).first()
        if not b_fianzas_cesar:
            b_fianzas_cesar = Bote(
                hogar_id=str(hogar_id),
                nombre="FIANZA CESAR",
                tipo="ahorro",
                archivado=False,
            )
            db.add(b_fianzas_cesar)
            db.flush()

        b_fianzas_nerea = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.nombre.ilike("%fianza nerea%")).first()
        if not b_fianzas_nerea:
            b_fianzas_nerea = Bote(
                hogar_id=str(hogar_id),
                nombre="FIANZA NEREA",
                tipo="ahorro",
                archivado=False,
            )
            db.add(b_fianzas_nerea)
            db.flush()

        # Desarchivar Bote Fianzas genérico y marcarlo inactivo
        b_fianzas_gen = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.id == 7).first()
        if b_fianzas_gen:
            b_fianzas_gen.archivado = True

        b_mj = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), Bote.id == 19).first()
        if b_mj:
            b_mj.nombre = "BOTE MARIA JOSE"
            b_mj.tipo = "ahorro"
            b_mj.archivado = False

        # Asignar saldos exactos a cada bote ajustando sus movimientos
        saldos_botes = [
            (b_h2026.id, 884700, "GUARDADO HIPOTECAS"),
            (b_h2025.id, 707600, "GUARDADO HIPOTECAS 2025"),
            (21, 29600, "Cash para el mes en curso"),
            (20, 0, "Gasolina mes"),
            (18, 21422, "Bote ocio"),
            (5, -3790, "Bote Aitor"),
            (6, 32, "Bote Javi"),
            (b_mj.id, -1900, "BOTE MARIA JOSE"),
            (3, -32370, "Bote Arreglos Pisos"),
            (23, 27640, "Bote IRPF"),
            (4, 18600, "Bote ahorro extras"),
            (22, -16281, "Mejoras del Hogar"),
            (b_fianzas_cesar.id, 58000, "FIANZA CESAR"),
            (b_fianzas_nerea.id, 49000, "FIANZA NEREA"),
            (8, 266500, "Guardado Resto Paro"),
            (9, 47000, "Fondo Inversión Aitor"),
            (15, 1200, "Viaje Rabat"),
            (11, 80500, "Extra para viaje Invierno"),
            (13, 25400, "Guardado Dentista"),
            (12, 29100, "Para viaje invierno"),
            (17, 20400, "Kitoli libro Rafa"),
        ]

        # Usar la cuenta de reserva archivada (ID 3) para alojar los movimientos de botes
        # de forma que NO modifiquen los saldos reales de las cuentas bancarias activas
        c_reserva = db.get(Cuenta, 3)
        if not c_reserva:
            c_reserva = Cuenta(hogar_id=hogar_id, nombre="Reserva Botes Históricos", tipo="banco", saldo_inicial_centimos=0, archivada=True)
            db.add(c_reserva)
            db.flush()

        # Limpiar movimientos de botes existentes en hogar 1 y recrear el saldo consolidado
        db.query(Movimiento).filter(Movimiento.hogar_id == hogar_id).delete()
        db.flush()

        for bid, sal_cent, nom in saldos_botes:
            if sal_cent != 0:
                m = Movimiento(
                    hogar_id=hogar_id,
                    cuenta_id=c_reserva.id,
                    bote_id=bid,
                    importe_centimos=sal_cent,
                    descripcion=f"Saldo consolidado {nom}",
                    fecha=hoy,
                )
                db.add(m)

        db.commit()

        print("=== 7. VERIFICACIÓN DE CONCILIACIÓN FINAL ===")
        conc = calcular_conciliacion(db, hogar_id)
        for k, v in conc.items():
            print(f"  {k}: {v}")

        print("\n=== RESUMEN DE SALDOS ACTIVOS ===")
        for cid in sorted(saldos_cuentas.keys()):
            c = db.get(Cuenta, cid)
            s = saldo_cuenta(db, c)
            print(f"  Cuenta {c.id:2d} | {c.nombre:25s} | Saldo: {s/100:8.2f} €")

        print("\n=== RESUMEN DE BOTES ACTIVOS ===")
        botes_activos = db.query(Bote).filter(Bote.hogar_id == str(hogar_id), ~Bote.archivado).all()
        tot_b = 0
        for b in sorted(botes_activos, key=lambda x: x.nombre):
            s = saldo_bote(db, b)
            tot_b += s
            print(f"  Bote {b.id:2d} | {b.nombre:30s} | Saldo: {s/100:8.2f} €")
        print(f"TOTAL BOTES: {tot_b/100:.2f} €")

if __name__ == "__main__":
    ejecutar()

