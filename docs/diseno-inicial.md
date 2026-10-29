# Finanzas del hogar: resumen del Excel OCTUBRE y diseño de la app

Documento de análisis previo al desarrollo. Basado en las 14 hojas del archivo OCTUBRE.xlsx.

## 1. Qué hace el Excel, en una frase

Es un **sistema de botes (sobres de dinero)**: cada euro que hay en bancos, tarjetas y efectivo está asignado a un propósito (gastos recurrentes, ahorro para hipotecas, coche, ocio, fianzas...). La hoja CAJA comprueba que lo que hay en las cuentas coincide con lo que debería haber repartido en los botes, y calcula cuánto dinero queda realmente disponible.

## 2. Mapa de hojas

| Hoja | Para qué sirve |
| --- | --- |
| CAJA | Hoja maestra. Suma 7 bloques (botes, deudas a favor, tarjetas, bancos, otros, Alzahira, ingresos/gastos puntuales) y da el "hay disponible". |
| BOTES PROPIOS | Desglose de dinero ajeno o reservado: fianzas, paro, coche, viajes, dentista, hipotecas ahorradas. |
| BOTE PARA GASTOS 2026 | Gastos anuales (IBI, seguros, basura, agua...) divididos entre 12. Calcula cuánto guardar al mes y si el bote va adelantado o atrasado. |
| GASTOS FIJOS MENSUALES 2025 | Recibos mensuales por banco (La Caixa, Deutsche Bank, otros) y reparto de ahorro. |
| ANUARIO DE GASTOS TRAS REV. | Presupuesto anual mes a mes: gastos por inmueble, ingresos (nómina y alquileres), ahorro mensual y su reparto. |
| AHORROS | Fondo de hipotecas (aportación mensual \~944 €), bote de arreglos y bote de extras (110 €/mes menos gastos). |
| SUELDO M.JOSE | Control semanal de horas, horas extra y complementarias, cálculo del neto y botes de ahorro derivados del sueldo. |
| COCHE PREST. | Coste total del coche, entregas mensuales, deuda pendiente y letras de 200 € que faltan. |
| HIP. PISO NOV (MENS.) | Hipoteca del piso de Torremolinos: capital 93.853 €, cuadro de amortización y adelantos. |
| HIP. ESTUDIO | Hipoteca del estudio: capital 35.000 €. |
| HIP. PISO CÓRDOBA | Hipoteca del piso de Córdoba: capital 40.500 €. |
| TARJETA CARREFOUR / DB / CAIXA | Lista de movimientos de cada tarjeta. El recibo se carga contra la cuenta. |

## 3. Reglas de negocio que hay que conservar

1. **Disponible real** = suma de los 7 bloques de CAJA. Es el número que el usuario mira cada día.
2. **Bote de gastos recurrentes**: para cada gasto anual, mensual = total / 12; saldo del bote = mensual × meses pagados − lo ya gastado. Hoy hay 10 meses pagados.
3. **Fondo de hipotecas**: aportación mensual fija que se descuenta cuando hay incidencias (alquiler cobrado de menos, cuotas extra de comunidad).
4. **Bote de extras**: 110 € al mes menos los gastos que se cargan contra él (dentista, cumpleaños, averías).
5. **Sueldo por horas**: las horas complementarias se pagan a 10,01 €/h y las extra a 15,05 €/h; el neto aplica una retención (\~4,66 % en una fórmula, 5 % en otra). Hay además un acumulado semanal de horas frente a la base.
6. **Coche**: deuda = coste total − suma de entregas. Letras pendientes = deuda / 200.
7. **Hipotecas**: cuota por sistema francés (capital, interés anual, plazo), con amortizaciones anticipadas en meses concretos.
8. **Anuario**: ahorro mensual = ingresos − gastos; se reparte entre ocio, fondo hipotecas, bote mes y bote arreglos.
9. **Tarjetas**: el recibo mensual de cada tarjeta es la suma de sus movimientos y se refleja como gasto en CAJA.

## 4. Problemas del Excel que la app debe resolver

- **Errores #REF!** en todos los cuadros de amortización de las tres hipotecas y en el cálculo del salario base de SUELDO M.JOSE. Esos cálculos hoy no funcionan.
- **Números metidos a mano dentro de fórmulas**, por ejemplo `=-21-1.7-37.4-20-16-86.2-10+200`. No se puede saber a qué corresponde cada cifra.
- **Datos repetidos y contradictorios**: la hipoteca del piso aparece como 483 € en gastos fijos y 450 € en el anuario; el interés aplicado es 5,82 % en un sitio y 2,99 % en el simulador.
- **El año está en el nombre de las hojas** (2025, 2026), y cada año habría que duplicar el libro.
- **Signos inconsistentes**: unos importes negativos son gasto y otros son deuda o saldo.
- **Conceptos mezclados**: dinero propio, dinero ajeno (fianzas), deudas con familiares y un negocio (Alzahira) conviven en la misma hoja.
- El total "hay disponible" sale negativo (-5.860 €), porque las tarjetas y los botes se restan de forma que cuesta interpretarlo.

## 5. Entidades del dominio

Cada concepto del Excel pasa a ser una entidad con sus datos y sus reglas:

- **Hogar** y **Persona**: quién usa la app y de quién es cada dinero.
- **Cuenta**, con subtipos banco, efectivo, tarjeta e inversión (Caixa, Deutsche Bank, BBVA, Revolut, PayPal, eToro...).
- **Movimiento**: cualquier ingreso o gasto, con fecha, importe, categoría, cuenta y, opcionalmente, bote.
- **Bote**: sobre con saldo y objetivo. Subtipos: gastos recurrentes, ahorro, proyecto (coche, viaje, dentista) y ajeno (fianzas).
- **GastoRecurrente**: importe anual, mes de cobro y cuota mensual calculada.
- **Propiedad**: estudio, piso de Torremolinos, piso de Córdoba y casa de Cañete, con sus gastos y alquileres.
- **Préstamo**, con subtipos hipoteca y préstamo del coche; **Cuota** y **Amortización**.
- **Deuda**: lo que te deben y lo que debes a personas.
- **ParteSemanal** y **Nómina**: horas, extras y neto.
- **Presupuesto**: previsión anual por categoría y mes.
- **Conciliación**: la comprobación de CAJA entre saldo real y saldo de botes.

## 6. Arquitectura propuesta para la app

- **Aplicación web instalable (PWA)**: funciona en el móvil y en el ordenador con un único código, y se puede usar sin conexión.
- **Base de datos relacional** (SQLite al empezar; PostgreSQL si luego se comparte entre varios usuarios).
- **Capas**: interfaz, servicios con las reglas de negocio (cálculo de botes, cuotas, conciliación) y repositorios de datos.
- **Importador del Excel actual** para no empezar de cero.

## 7. Fases sugeridas

1. **MVP**: cuentas, movimientos, categorías, botes y pantalla de disponible real (la hoja CAJA).
2. **Gastos recurrentes** y presupuesto anual (BOTE PARA GASTOS y ANUARIO).
3. **Hipotecas y préstamos** con cuadros de amortización correctos.
4. **Nómina por horas** y conciliación automática.
5. **Informes**, gráficos y aviso de desvíos.

## 8. Diagrama de clases

&#91;embedded content: modelo de clases · 10 clases, 9 relaciones\]

Una Cuenta registra muchos Movimientos, y cada Movimiento afecta a un Bote y usa una Categoría. Los Préstamos (con sus Cuotas) y los Gastos recurrentes generan Movimientos; la conciliación de CAJA será un servicio que compara el saldo de las Cuentas con el de los Botes.

## 9. Modelo de clases detallado

El diagrama de la sección 8 es una vista general y no recoge todas las clases. El modelo completo se reparte en cuatro diagramas por zonas: núcleo, gastos e inmuebles, préstamos y trabajo con conciliación. Las cajas de línea discontinua son clases definidas en otro diagrama. En los tipos, Dinero es un decimal con dos cifras y el signo ? marca un dato opcional.

### 9.1 Núcleo: cuentas, movimientos y botes

&#91;embedded content: núcleo · 9 clases\]

Cuenta, Bote y Categoría se juntan en Movimiento. Tarjeta y CuentaInversion son tipos de Cuenta (por ejemplo Carrefour, DB y eToro); BoteAjeno guarda el dinero de terceros, como las fianzas.

### 9.2 Gastos, alquileres y presupuesto

&#91;embedded content: gastos e inmuebles · 7 clases\]

GastoRecurrente reproduce la hoja BOTE PARA GASTOS (importe anual / 12) y BoteRecurrente calcula si el bote va adelantado o atrasado. Alquiler, Presupuesto y PlanAhorro cubren el ANUARIO y el reparto del ahorro mensual.

### 9.3 Préstamos, hipotecas y coche

&#91;embedded content: préstamos · 6 clases + 1 referencia\]

Las tres hipotecas son instancias de Hipoteca con su cuadro de Cuotas, y el coche es un PrestamoVehiculo con pagos irregulares (PagoPrestamo) en lugar de cuotas fijas. Vehiculo y GastoVehiculo recogen el coste total de la hoja COCHE PREST. (IPTV, tasas, ITV, seguro).

### 9.4 Trabajo, deudas, negocio y conciliación

&#91;embedded content: trabajo, deudas y conciliación · 6 clases + 3 referencias\]

Empleo, ParteSemanal y LiquidacionMensual reproducen la hoja SUELDO M.JOSE. Deuda cubre los apartados ME DEBEN y los cobros pendientes de Alzahira (Negocio). Conciliacion es la comprobación de la hoja CAJA entre el saldo de las cuentas y el de los botes.

### 9.5 Cobertura hoja por hoja

Cada hoja del Excel tiene al menos una clase que la sustituye. Lo que queda fuera son informes y cálculos, que serán servicios de la app y no clases de datos.

| Hoja del Excel | Clases que la cubren |
| --- | --- |
| CAJA | Conciliacion, Hogar (disponibleReal), Cuenta, Tarjeta, CuentaInversion, Deuda, Negocio |
| BOTES PROPIOS | Bote, BoteAjeno (fianzas) |
| BOTE PARA GASTOS 2026 | GastoRecurrente, BoteRecurrente |
| GASTOS FIJOS MENSUALES 2025 | GastoRecurrente, PlanAhorro, Movimiento |
| ANUARIO DE GASTOS TRAS REV. | Presupuesto, Alquiler, Propiedad (beneficioNeto), PlanAhorro |
| AHORROS | Bote, PlanAhorro, Movimiento |
| SUELDO M.JOSE | Empleo, ParteSemanal, LiquidacionMensual |
| COCHE PREST. | PrestamoVehiculo, PagoPrestamo, Vehiculo, GastoVehiculo, Bote |
| HIP. PISO, HIP. ESTUDIO, HIP. PISO CÓRDOBA | Hipoteca, Prestamo, Cuota, Propiedad |
| TARJETA CARREFOUR, DB y CAIXA | Tarjeta, Movimiento, Categoria |

Quedan como servicios: el cálculo de la cuota por sistema francés, la generación del cuadro de amortización, los informes anuales y los avisos de desvío.
