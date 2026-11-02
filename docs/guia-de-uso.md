# 📘 Guía de Uso de App_Conta — Para Todos los Usuarios

Bienvenido a **App_Conta**, la aplicación diseñada para que cualquier persona del hogar pueda llevar las finanzas familiares de forma clara, visual y sin complicaciones, garantizando que **no se pierda ni un solo céntimo**.

---

## 💡 1. La Idea Básica: ¿Cómo Funciona App_Conta?

### El problema de mirar solo la app del banco
Si abres la aplicación de tu banco y ves que tienes **3.000 €**, es fácil pensar: *"¡Genial, tenemos dinero de sobra para darnos un capricho!"*. Pero en realidad:
* 600 € son para la hipoteca que llega la semana que viene.
* 350 € son para el seguro del coche y el IBI.
* 400 € son para la comida de todo el mes.
* 1.000 € son del fondo de emergencias que no se debe tocar.

**En realidad no tenías 3.000 € libres**, ¡sino mucho menos!

### La solución: El método de los "Sobres Virtuales"
App_Conta funciona como si cogieras el dinero que entra en el banco y lo metieras en diferentes **sobres etiquetados**:
* 🍞 **Sobre Dinero del Mes:** Para el pan, el supermercado, la gasolina y el día a día.
* 🍹 **Sobre Dinero de Ocio:** Para salir a cenar, tomar un café o ir al cine.
* 🛡️ **Sobre Emergencias:** Una hucha intocable para imprevistos (averías, dentista...).
* 🏠 **Fondo Ahorro Hipoteca:** Dinero reservado para las cuotas de la hipoteca.

Cuando vas a comprar algo, no miras cuánto dinero hay en el banco: **miras cuánto queda en su sobre**. Si hay dinero en el sobre de ocio, puedes salir a cenar con total tranquilidad.

---

## 🟢 2. ¿Cómo Saber si las Cuentas Están Cuadradas?

En la esquina superior derecha de la pantalla principal verás siempre una píldora:

* **🟢 Contabilidad al día:** Significa que **la suma de todos tus sobres, previsiones y préstamos coincide exactamente con el dinero real que tienes en los bancos y en el bolsillo**. ¡Todo está perfecto!
* **🟡 Diferencia / Revisar:** Si ves este aviso, significa que ha entrado o salido dinero del banco que todavía no has asignado a ningún sobre, o que hay algún recibo pendiente de cuadrar. Puedes pulsar sobre el aviso para ver el desglose en detalle.

---

## 📱 3. Cómo Abrir la Aplicación

### En el ordenador de casa:
1. Ve a la carpeta de la aplicación.
2. Haz doble clic sobre el archivo **`levantar.bat`**.
3. Se abrirá una ventana y tu navegador se abrirá automáticamente en:
   👉 **`http://127.0.0.1:8003`**

### En el móvil o la tablet (conectado a la misma WiFi):
Cuando arranca `levantar.bat` en el ordenador, en la pantalla negra verás una dirección parecida a esta:
👉 **`http://192.168.0.XX:8003`**
Escribe esa dirección en el navegador de tu móvil (Chrome o Safari) y podrás usar la app desde el sofá o mientras haces la compra.

---

## 🧭 4. Recorrido por las Secciones Principales

La barra de arriba tiene los apartados clave:

```
[ 📊 Inicio ]  [ 🛒 Pagos Diarios ]  [ 🎯 Ahorro y Botes ]  [ 📝 Movimientos ]  [ 🏦 Cuentas y Tarjetas ]  [ ⋯ Extras ▾ ]
```

---

### 📊 A. Inicio (Tu panel de mando)

Es la pantalla principal que ves al entrar. Se divide en:

1. **Dinero en Cuentas y Tarjetas (Arriba):**
   Muestra el total de dinero real que tienes sumando tus cuentas corrientes (**CaixaBank, Deutsche Bank, etc.**), el **Efectivo en metálico** y las **Tarjetas**.
2. **Las dos tarjetas destacadas:**
   * **🍞 Dinero del Mes:** Tu saldo disponible hoy para comida y gastos básicos del mes en curso.
   * **🍹 Dinero de Ocio:** Lo que tienes libre para salir, disfrutar o darte un capricho.
3. **Botones de Acción Rápida:**
   * **`+ Ingreso`**: Para meter dinero libre o extraordinario en una cuenta o amortizar un préstamo.
   * **`− Gasto`**: Para anotar un gasto manual y elegir de qué sobre se descuenta.
   * **`Reparto Nómina`**: El botón mensual para repartir el sueldo automáticamente.
   * **`Copia & Vaciar`**: Para descargar una copia de seguridad de todos tus datos en 1 clic.
4. **Píldoras Informativas:**
   Te resumen en números claros cuánto hay en sobres, cuánto dinero te deben otras personas, cuánto debes en préstamos y cuánto tienes invertido.

---

### 🛒 B. Pagos Diarios (Para el día a día)

Esta pestaña está pensada para registrar rápidamente lo que compras cada día: **el pan, el supermercado, la gasolina, la farmacia o las cañas**.

#### Tus 3 Tarjetas de Compras:
En la parte superior puedes alternar entre tus tarjetas habituales:
* 💳 **Tarjeta Caixa**
* 💳 **Tarjeta Deutsche Bank**
* 💳 **Tarjeta Pass Carrefour**

#### Atajos Rápidos en 1 Clic:
Para que no tengas que escribir ni seleccionar el sobre cada vez, tienes 4 botones directos:
* 🛒 **Supermercado:** Escribe el concepto y descuenta automáticamente de **Dinero del Mes**.
* ⛽ **Gasoil:** Escribe el concepto y descuenta automáticamente de **Dinero del Mes**.
* 🍹 **Ocio:** Escribe el concepto y descuenta automáticamente de **Bote Ocio**.
* 🏠 **Casa:** Escribe el concepto y descuenta automáticamente de **Mejoras del Hogar**.

> **Detección Automática de Categoría:** Ya no tienes que elegir la categoría a mano. La aplicación la detecta y clasifica automáticamente (*Supermercado*, *Gasolina*, *Ocio*, *Hogar*...) según el concepto o el sobre utilizado.

#### ¿Cómo funciona con tarjetas de crédito (ej. Carrefour Pass)?
Cuando compras 20 € de pan con la tarjeta Carrefour Pass:
1. En la app anotas los 20 € en la tarjeta Carrefour Pass y eliges el sobre *Dinero del Mes*.
2. **El dinero se resta de inmediato del sobre *Dinero del Mes*** (para que sepas que ya te quedan 20 € menos para el mes y no te lo gastes).
3. **Tu cuenta bancaria NO se toca todavía**, porque Carrefour no te cobrará ese dinero en el banco hasta final de mes.
4. Los gastos se van acumulando limpiamente en el extracto de la tarjeta.

#### 💳 Liquidar el recibo a fin de mes (100% a tu medida):
Cuando llega final de mes y el banco te cobra el recibo de la tarjeta:
1. Pulsa en el botón azul **`💳 Liquidar Recibo en Banco`** (lo tienes arriba en Pagos Diarios y en Tarjetas).
2. Se abrirá una ventana donde eliges tu banco (ej. *CaixaBank*) y la tarjeta (*Carrefour Pass*).
3. **Tú decides el importe exacto:** La app te propone el total acumulado, pero **puedes editar la cifra con el teclado**. Esto es vital porque a veces hay compras que hiciste después del día de corte de la tarjeta y que no te las cobran este mes, sino el mes que viene.
4. Al confirmar:
   * El dinero sale de tu banco (`-X €`).
   * La tarjeta reduce su saldo pendiente (`+X €`).
   * **No se vuelve a descontar de ningún sobre** (porque ya se descontó cuando compraste las cosas).
   * Si quedó dinero pendiente por la fecha de corte, **se queda acumulado en la tarjeta para el mes que viene**.

---

### 🎯 C. Ahorro y Botes

Aquí tienes tus huchas y tus cuentas pendientes:

1. **Sobres y Botes:**
   * **Bote emergencias:** El colchón de seguridad unificado para imprevistos.
   * **Dinero del mes en curso** y **Bote ocio**.
   * Huchas para viajes, proyectos, etc.
   * Cada bote tiene su propia barra de progreso y puedes pinchar en él para ver su historial.
2. **Dinero que me deben:**
   * Si le has prestado dinero a alguien, has hecho una compra compartida o te deben cuotas (como DAZN o adelantos familiares), se anota aquí.
   * Cuando te devuelven parte o el total, lo registras con un botón y el dinero entra directo a tu banco.
3. **Fondo Ahorro Hipoteca:**
   * Apartado dedicado a vigilar el colchón para el pago de cuotas futuras de la hipoteca.

> **💡 Consejo visual:** Todos los formularios para crear botes o fondos nuevos están recogidos bajo un botón con el signo `+`. Solo se abren si pinchas en ellos, dejando la pantalla limpia y ordenada.

---

### 📝 D. Movimientos

Es el libro diario donde queda constancia de absolutamente todas las operaciones:
* Puedes filtrar por cuenta bancaria, por sobre/bote o por fechas.
* Cada movimiento te indica claramente la fecha, el concepto, el importe y de qué sobre salió el dinero.
* Si te equivocaste al meter un gasto, puedes pulsar el icono de la papelera para borrarlo.

---

### 🏦 E. Cuentas y Tarjetas

El panel donde administras dónde está depositado físicamente tu dinero:
* **Cuentas y Depósitos:** Cuentas corrientes en CaixaBank, Deutsche Bank, BBVA, Revolut y efectivo físico en cartera.
* **Inversiones:** Capital total que has aportado a fondos o planes de inversión.
* **Tarjetas Bancarias:** Estado de tus tarjetas con acceso al botón de liquidación bancaria.
* **Tarjetas Regalo:** Si tienes tarjetas prepago o cheques regalo de Amazon, El Corte Inglés, etc., puedes anotar su saldo aquí para no olvidarte de gastarlo.

---

### ⋯ F. Menú «Extras»

En el desplegable de arriba a la derecha encontrarás las herramientas avanzadas:

1. **Previsión Gastos Anuales:**
   Aquí se planifican los recibos grandes que no vienen todos los meses pero que siempre llegan: **IBI, impuesto de circulación, seguro del hogar, seguros del coche, tasa de basuras...**
   * En lugar de llevarte un susto de 400 € de golpe en mayo, la app calcula cuánto suponen al mes (ej. unos 170 €/mes).
   * Cada mes que cobras la nómina, se marca como aportado un mes más. Cuando llega la factura real, se anota como pagada y el sistema te dice si vas con superávit o con déficit.
2. **Recibos Fijos / Domiciliaciones:**
   Para revisar los recibos domiciliados habituales del hogar (comunidad, internet, suministros) repartidos entre Caixa y Deutsche Bank.
3. **Categorías:**
   Para organizar tus gastos con etiquetas de colores e iconos (Alimentación, Transporte, Ocio, Suministros...).
4. **Copia de Seguridad:**
   Para descargar un archivo con todos tus datos protegidos o restaurarlo si cambias de ordenador.

---

## 📅 5. El Gran Día: Cómo Repartir la Nómina en 1 Clic

Cuando cobras el sueldo a primeros de mes:

1. Entra a **Inicio**.
2. Pulsa en el botón azul **`Reparto Nómina`** (o en `+ Ingreso` y pestaña *Reparto Nómina*).
3. Selecciona la plantilla que toque (por ejemplo, **Nómina MJ** o **Reparto Mensual Hogar**).
4. La pantalla es muy sencilla: te dice cuánto dinero entra y dónde se va a mover.
5. Pulsa en **`Aplicar Reparto Nómina`**.

### ¿Qué hace la app automáticamente por detrás?
* Ingresa el sueldo en la cuenta bancaria correspondiente.
* Llena los sobres del mes (*Dinero del mes*, *Ocio*, *Bote emergencias*...).
* **Suma +1 mes a la Previsión de Gastos Anuales** (para que los seguros e IBI queden cubiertos).
* **Descuenta la cuota del coche** directamente del préstamo pendiente en la tabla de deudas.
* **Descuenta la cuota de DAZN** de la deuda pendiente que tienen contigo.
* ¡Y todo queda exactamente cuadrado con el banco sin tener que hacer cálculos a mano!

---

## 🛠️ 6. Guía Rápida: "¿Qué tengo que hacer si...?"

### Caso 1: "He bajado a comprar el pan (2,20 €) con la tarjeta Carrefour Pass"
1. Abre la app en el móvil y pulsa en **Pagos Diarios**.
2. Toca en la tarjeta **Carrefour Pass**.
3. En los botones de atajo, pulsa **🍞 Pan y Desayuno**.
4. Escribe `2.20` en el importe.
5. Pulsa **Registrar Pago**. Listo: el dinero se resta de tu sobre de comida y el banco no se toca.

### Caso 2: "He salido a cenar con amigos (35,00 €)"
1. Ve a **Pagos Diarios**.
2. Elige la tarjeta con la que pagaste (Caixa o DB).
3. Pulsa en el atajo **🍹 Bar / Ocio** (o elige el sobre *Dinero de Ocio*).
4. Pon `35.00` y confirma.

### Caso 3: "Me ha llegado el cargo del recibo de Carrefour Pass en el banco (115,00 €)"
1. Ve a **Pagos Diarios** (o a **Tarjetas**).
2. Pulsa el botón **`💳 Liquidar Recibo en Banco`**.
3. Elige tu cuenta de CaixaBank y la tarjeta Carrefour Pass.
4. En importe pon los `115.00` € que te han cobrado en el banco.
5. Pulsa **Confirmar Pago del Recibo**. El banco baja 115 €, la tarjeta reduce su deuda en 115 € y los sobres no se tocan.

### Caso 4: "Tengo un dinero extra y quiero amortizar parte del préstamo del coche"
1. En Inicio, pulsa en el botón verde **`+ Ingreso`**.
2. En la pestaña *Ingreso Libre / Extra*, escribe el importe.
3. En el desplegable de destino, verás una sección destacada: **🚗 Préstamos y Financiaciones**.
4. Selecciona **Préstamo Coche Hyundai**.
5. Al guardar, el dinero entra en tu banco y la deuda pendiente del coche baja al instante.

### Caso 5: "Me han devuelto un dinero que me debían (ej. 50 €)"
1. Ve a **Ahorro y Botes** y entra en la pestaña **Dinero que me deben**.
2. Busca la persona en la lista y pulsa **Cobrar / Abonar**.
3. Elige tu cuenta bancaria y el importe devuelto. El dinero se suma al banco y la deuda de esa persona se reduce.

### Caso 6: "Quiero guardar una copia de seguridad por si acaso"
1. Despliega el menú **Extras** y entra en **Copia de Seguridad** (o desde el botón *Copia & Vaciar* de Inicio).
2. Pulsa en **`Descargar Copia de Seguridad (JSON)`**.
3. Se descargará un archivo con toda tu contabilidad completa. Guárdalo en tu ordenador, en un pendrive o en la nube.

---

## ❓ 7. Preguntas Frecuentes

**¿Por qué no uso simplemente Excel?**
Excel no avisa si borras una fórmula por error, no sabe gestionar tarjetas de crédito con cobro a mes vencido sin descuadrar la caja, y es muy incómodo de consultar desde el móvil en la cola del supermercado. App_Conta está blindada para que las cuentas nunca se rompan.

**¿Se conecta la app a internet o a los bancos?**
No. App_Conta funciona de forma 100% privada en tu propio ordenador (local-first). Ningún dato bancario viaja a servidores externos ni sale de tu casa.

**¿Qué pasa si me equivoco al meter un gasto?**
Ve a la pestaña **Movimientos**, busca la fila correspondiente y pulsa el icono de eliminar (papelera). El dinero volverá inmediatamente tanto al banco como al sobre correspondiente, dejándolo todo como estaba.

---

*¡Disfruta de la tranquilidad de tener la economía de tu hogar perfectamente controlada y al día!* 🏡✨

