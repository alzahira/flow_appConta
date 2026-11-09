import sqlite3

con = sqlite3.connect('/data/conta.db')
cur = con.cursor()
cur.execute("UPDATE movimientos SET descripcion = 'Factura previsión: Seguro Coche -Direct Seguros' WHERE id = 89")
con.commit()
print("Updated changes:", con.total_changes)
con.close()
