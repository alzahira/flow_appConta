from app_conta.db import get_db
from app_conta.services.conciliacion import calcular_conciliacion
from app_conta.models.movimiento import Movimiento
from datetime import date

db = next(get_db())

test_mov = Movimiento(
    hogar_id=1,
    cuenta_id=8,
    importe_centimos=-33600,
    fecha=date.today(),
    descripcion="Factura previsión: Seguro Coche -Direct Seguros",
    marcar_revisar=False,
    origen="manual"
)
db.add(test_mov)
db.flush()

res = calcular_conciliacion(db, 1)
print("diferencia_formula:", res["diferencia_formula"])
print("sin_asignar:", res["sin_asignar"])
print("total_teorico_formula:", res["total_teorico_formula"])
print("total_real_formula:", res["total_real_formula"])

db.rollback()
db.close()
