# Flow — Finanzas & Botes

<p align="center">
  <img src="app_conta/static/favicon.svg" alt="Flow Logo" width="72" height="72" />
</p>

<p align="center">
  <strong>Aplicación web progresiva (PWA) de finanzas domésticas basada en el método de sobres virtuales, diseñada para automatizar la contabilidad del hogar con cuadre exacto céntimo a céntimo.</strong>
</p>

---

## 🎯 ¿Cómo funciona Flow?

Flow sustituye las hojas de cálculo tradicionales por un sistema contable visual donde **cada euro tiene una función asignada**:

### 1. El dinero en bancos es la liquidez, los botes son el plan
No se gasta a ciegas de la cuenta corriente. El dinero real disponible en bancos y efectivo se distribuye en **botes virtuales**:
* **Botes de gasto diario:** Dinero del mes (alimentación, supermercado, suministros cotidianos).
* **Botes de disfrute:** Ocio, salidas, vacaciones y proyectos personales.
* **Botes de reserva:** Ahorro de emergencias, mejoras del hogar, fianzas e hipoteca.

### 2. Tarjetas de crédito sin desajustes
Cuando pagas con tarjeta de crédito en el supermercado o la gasolinera:
* El importe se descuenta inmediatamente del bote correspondiente (*Mes* o *Gasolina*).
* **Tu cuenta bancaria no se altera** hasta que el banco liquida el recibo a fin de mes.
* En la app, el saldo de la tarjeta se muestra en positivo como **dinero adelantado pendiente de cobro en banco**, eliminando los falsos saldos negativos o descubiertos.

### 3. Reparto de Nómina en un solo clic
Al ingresar la nómina o los ingresos mensuales:
* La aplicación aplica la plantilla de reparto configurada.
* Se nutren los botes del mes, se aparta la provisión de recibos y se amortizan automáticamente los préstamos.

### 4. Bote Anual de Recibos e Impuestos
Los gastos grandes que no llegan todos los meses (seguros de coche, IBI, basuras, sellos) se dividen entre 12 meses:
* Cada mes se guarda automáticamente su cuota en el bote anual.
* Cuando llega el cargo de la aseguradora o del ayuntamiento, el dinero ya está acumulado y no descuadra el presupuesto mensual.

### 5. Control de "Me Deben" y Préstamos
* **Dinero que te deben:** Registro de adelantos a terceros, compras compartidas o gastos pendientes de reintegro con liquidación total o parcial.
* **Préstamos:** Seguimiento del capital pendiente y amortización paulatina con barras de progreso.

### 6. Cuadre Matemático en Tiempo Real
Un motor de conciliación verifica continuamente la identidad contable del hogar:
$$\text{Bancos y Efectivo} + \text{Préstamos} + \text{Me Deben} + \text{Inversiones} \equiv \text{Botes} + \text{Tarjetas Pendientes}$$

Si la contabilidad encaja al céntimo, la cabecera muestra el estado **🟢 Contabilidad al día** (diferencia 0,00 €).

---

## 🧭 Vistas y Módulos de la Aplicación

* **Inicio (Dashboard):** Posición global consolidada (bancos, efectivo, monederos y gasto dispuesto en tarjetas), semáforo de cuadre, accesos rápidos y botes destacados.
* **Botes & Sobres:** Listado de huchas con barras de progreso, metas de ahorro y extracto de movimientos de cada sobre.
* **Cuentas y Tarjetas:** Saldo en cada entidad bancaria, efectivo en mano, tarjetas monedero y detalle de tarjetas de crédito pendientes de liquidación.
* **Pagos Diarios:** Registro rápido de compras del día a día por comercio y liquidación del extracto de tarjeta al banco.
* **Previsión Anual:** Panel de control de tributos y recibos anuales con selector de mes transcurrido y cálculo de cuota mensual.
* **Movimientos:** Historial cronológico con filtros analíticos por cuenta, bote y tipo de operación.
* **Modo Demo Integrado:** Sistema multi-hogar que permite conmutar a un usuario de demostración con datos ficticios para presentaciones sin exponer finanzas reales.
