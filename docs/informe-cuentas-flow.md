# Informe contable de Flow

**Cómo están programadas las cuentas, los botes y el cuadre**

- **Fecha:** 9 de noviembre de 2026
- **Alcance:** Hogar 1 (familia). El Hogar 2 es el modo Demo y queda fuera de este informe.
- **Base de datos analizada:** `app_conta/conta.db` (última modificación: 4 de noviembre de 2026).
- **Código revisado:** `app_conta/services/conciliacion.py`, `movimientos.py`, `botes.py`, `cuentas.py`, `prevision_gastos.py`, `deudas.py`, `prestamos.py`, `inversiones.py`, `api/cuentas.py`, `api/botes.py`, `static/js/views/inicio.js`, `static/js/views/botes.js`, `static/js/modales-acciones.js`, `static/js/app.js`.
- **Formato:** documento Markdown editable. Se puede exportar a PDF o Word cuando haga falta.

---

## 0. Cómo leer este informe

La app maneja tres capas que conviene no mezclar:

1. **Dinero real:** lo que hay en las cuentas (bancos, efectivo, tarjetas), las inversiones y lo que te deben, menos lo que debes.
2. **Etiquetas:** los botes, la previsión de gastos y las tarjetas pendientes de pago. Una etiqueta no es una cuenta: es una marca sobre un movimiento.
3. **Cuadre:** la comparación que hace la app entre “lo que debería tener” (etiquetas) y “lo que tengo” (dinero real).

El problema principal es que **la app está mezclando las capas 1 y 2**. El cuadre sale casi perfecto, pero no porque las cuentas estén bien: sale porque se suman los préstamos como si fueran dinero tuyo y porque los botes están respaldados por una cuenta archivada que la app no cuenta.

---

## 1. Resumen ejecutivo

### 1.1 La conclusión en una frase

**La app no te está enseñando el dinero que tienes: te está enseñando un rompecabezas de etiquetas donde los préstamos y una cuenta archivada compensan el hueco de los botes.**

### 1.2 Las cifras clave (Hogar 1)

| Concepto | Importe | Qué es realmente |
|---|---:|---|
| Patrimonio disponible (hero de Inicio) | **7.452,45 €** | Dinero líquido en cuentas activas, neto de la tarjeta negativa. Es la cifra más “real” de la pantalla. |
| Bancos + efectivo + monederos | **8.018,10 €** | Cuentas activas antes de restar la tarjeta Carrefour Pass. |
| Tarjeta pendiente de pago | **565,65 €** | Saldo negativo de la Tarjeta Carrefour Pass. |
| Botes activos | **22.149,03 €** | Suma de etiquetas de botes. No es dinero aparte. |
| — Botes de hipoteca | **15.923,00 €** | “GUARDADO HIPOTECAS” + “GUARDADO HIPOTECAS 2025”. |
| — Botes generales | **6.226,03 €** | Resto de botes activos. |
| Me deben | **2.919,60 €** | Deudas que la app considera cobrables. Algunas pueden ser facturas pendientes de pagar, no dinero a cobrar. |
| Préstamos pendientes | **9.498,66 €** | Deuda que hay que devolver. La app la **suma** al “Total Real”. |
| Inversiones | **2.196,00 €** | eToro + CRO. Se introdujeron como saldo actual; si el dinero ya había salido de las cuentas, no hay doble conteo. Falta el movimiento histórico. |
| Previsión anual | **−81,60 €** | Diferencia entre provisión acumulada y pagos reales. Es planificación, no dinero. |
| Total Teórico (lo que “debería tener”) | **22.633,08 €** | Botes + tarjeta pendiente + previsión. |
| Total Real (lo que la app llama “real”) | **22.632,36 €** | Bancos + me deben + préstamos + inversiones. |
| Diferencia de la fórmula | **0,72 €** | “Contabilidad al día”. |
| Diferencia técnica del endpoint | **500,00 €** | La app la calcula, pero la pantalla no la usa. |

### 1.3 Diagnóstico rápido

1. **Los préstamos están sumando, no restando.** Son deuda (pasivo), pero la fórmula los mete en el grupo de activos. Sin ellos, el “Total Real” bajaría a **13.133,70 €** y la diferencia sería de **9.499,38 €**.
2. **Los botes están respaldados por una cuenta archivada.** La cuenta 3, “Reserva Botes Históricos”, tiene **22.104,53 €** y está archivada. La app la excluye de las cuentas reales, pero sí cuenta los botes. El hueco lo tapa con los préstamos.
3. **“Meter dinero en un bote” crea dinero nuevo.** El formulario de detalle del bote (`Meter o Sacar Dinero`) no mueve dinero: crea un movimiento nuevo en la cuenta elegida. Si ya tenías el dinero en el banco, lo estás contando dos veces.
4. **Los saldos iniciales de las cuentas activas no están en la fórmula teórica.** Las cuentas activas tienen **6.926,95 €** de saldo inicial, pero el grupo “Lo que debería tener” no los incluye. Solo incluye botes, tarjeta, previsión y movimientos sin bote.
5. **La previsión se trata como dinero.** La previsión es una reserva para recibos futuros; no es dinero que tengas. Meterla en el cuadre como si fuera un saldo confunde.
6. **Hay una diferencia técnica oculta de 500 €.** Un traspaso desde una cuenta archivada entra en la consulta técnica por un lado, pero su cuenta no entra por el otro. La pantalla no la muestra porque usa la otra diferencia.

---

## 2. Cómo funciona la contabilidad por dentro

### 2.1 El principio: los saldos no se guardan, se calculan

En Flow no existe una columna “saldo” en las cuentas ni en los botes. El saldo se calcula cada vez que se pide:

```text
saldo_cuenta = saldo_inicial_centimos + Σ importes de movimientos vivos de esa cuenta
saldo_bote   = Σ importes de movimientos vivos asignados a ese bote
```

- “Movimientos vivos” = `eliminado = 0`. El borrado es lógico: el movimiento no desaparece de la base, pero deja de contar.
- Todo se guarda en **céntimos enteros**. La API devuelve euros como string con dos decimales.
- Esto es correcto y es una buena decisión: evita que un saldo guardado se quede desfasado.

**Código:** `app_conta/services/movimientos.py:385` (`saldo_cuenta`) y `app_conta/services/botes.py:128` (`saldo_bote`).

### 2.2 Fórmulas base

| Cálculo | Fórmula | Dónde está |
|---|---|---|
| Saldo de una cuenta | `saldo_inicial + Σ movimientos de la cuenta` | `services/movimientos.py:385` |
| Saldo de un bote | `Σ movimientos con ese bote_id` | `services/botes.py:128` |
| Total de cuentas activas | `Σ saldo de cuentas no archivadas` | `services/cuentas.py:135` |
| Total de botes activos | `Σ saldo de botes no archivados` | `services/botes.py:155` |
| Previsión por gasto | `round(importe_anual × meses_pagados / 12) − pagado_real` | `services/prevision_gastos.py:253` |
| Total previsión | `Σ saldo de gastos activos` | `services/prevision_gastos.py:293` |
| Me deben | `Σ (importe_inicial − importe_cobrado)` de deudas activas | `services/deudas.py:74` |
| Préstamos pendientes | `Σ importe_pendiente` de préstamos activos | `services/prestamos.py:264` |
| Inversiones | `Σ valor_actual` de inversiones activas | `services/inversiones.py:258` |

### 2.3 Qué es un movimiento

Un movimiento es el único evento que cambia el dinero. Tiene:

- `cuenta_id`: la cuenta donde entra o sale.
- `importe_centimos`: positivo = ingreso; negativo = gasto.
- `bote_id`: opcional. Si está, el movimiento queda etiquetado en ese bote.
- `categoria_id`: opcional, para clasificar.
- `descripcion`, `fecha`, `origen`, `eliminado`.

**Regla clave:** un movimiento con `bote_id` cambia **a la vez** el saldo de la cuenta y el saldo del bote. No son dos operaciones: es el mismo movimiento con una etiqueta.

Ejemplo:

```text
Nómina +1.000 € en La Caixa, bote “Cash para el mes en curso”
  → cuenta La Caixa: +1.000 €
  → bote Cash:       +1.000 €
```

Si el mismo movimiento no tuviera bote:

```text
Nómina +1.000 € en La Caixa, sin bote
  → cuenta La Caixa: +1.000 €
  → bote:            sin cambios
  → “sin asignar”:   +1.000 €
```

### 2.4 Traspasos: cuenta ↔ cuenta y bote ↔ bote

Hay dos traspasos distintos y conviene no confundirlos.

#### A. Traspaso entre cuentas (`POST /api/v1/cuentas/traspaso`)

Mueve dinero de una cuenta a otra. Crea **dos movimientos**:

```text
Salida:  cuenta origen  −100 €  (mismo bote_id si se indica)
Entrada: cuenta destino +100 €  (mismo bote_id si se indica)
```

- El saldo total de las cuentas no cambia.
- Si los dos movimientos llevan el **mismo bote**, el saldo del bote tampoco cambia: solo se ha movido el dinero de sitio.
- Si no llevan bote, el dinero queda “sin asignar” en la cuenta destino.
- **Código:** `app_conta/api/cuentas.py:236`.

#### B. Traspaso entre botes (`POST /api/v1/botes/traspaso`)

Mueve dinero de un bote a otro. Crea **dos movimientos en la misma cuenta**:

```text
Salida:  bote origen  −100 €  (misma cuenta)
Entrada: bote destino +100 €  (misma cuenta)
```

- El saldo de la cuenta no cambia.
- El bote origen baja 100 € y el destino sube 100 €.
- **Código:** `app_conta/api/botes.py:147`.

#### C. Reasignar un movimiento de bote

Cambia el `bote_id` de un movimiento existente. No crea dinero ni cambia la cuenta: solo cambia la etiqueta. Es la forma correcta de “apartar” dinero que ya está en la cuenta.

- **Código:** `services/botes.py:206` (`reasignar_bote`).

### 2.5 Previsión de gastos

La previsión no es una cuenta ni un bote. Es una planificación de recibos anuales (IBI, basura, seguros, agua…).

Para cada gasto activo:

```text
provisión acumulada = round(importe_anual × meses_pagados / 12)
saldo previsión     = provisión acumulada − pagado_real
```

- `meses_pagados` es global para el hogar (en la base actual: **11**).
- Si el saldo es positivo, la app lo llama “superávit”; si es negativo, “déficit”.
- El total se suma al grupo “Lo que debería tener” como si fuera dinero disponible.
- **Código:** `services/prevision_gastos.py:225`.

**Problema conceptual:** la previsión es una reserva para pagos futuros, no un saldo bancario. Si ya has pagado los recibos, el dinero ya salió de la cuenta; si no los has pagado, el dinero sigue en la cuenta pero está comprometido. En ninguno de los dos casos es un activo adicional.

### 2.6 Deudas, préstamos e inversiones

#### Deudas (“Me deben”)

- Son derechos de cobro: dinero que un tercero te debe.
- La app calcula `importe_inicial − importe_cobrado`.
- Se suman al “Total Real” como activo.
- **Código:** `services/deudas.py:74`.

**Cuidado:** en la base actual hay conceptos que parecen facturas pendientes de pagar, no dinero a cobrar: “Endesa ** PENDIENTE”, “Carrefour PENDIENTE”, “Tarjeta Visa”, “Seguro piso Córdoba”, “Dazn”. Si son deudas tuyas, la app las está contando al revés.

#### Préstamos

- Son pasivos: dinero que el hogar debe devolver.
- La app calcula `Σ importe_pendiente`.
- **La app los suma al “Total Real”**, no los resta.
- **Código:** `services/prestamos.py:264`.

En la base actual los dos préstamos son “Coche Hyundai” y “Ciclo DAM”, ambos con entidad **“Bote ahorro”**. Eso sugiere que son préstamos internos: el hogar se financió de un bote de ahorro y se los debe a sí mismo. Si es así, el bote debería haber bajado cuando se prestó el dinero. No hay ningún movimiento que lo haga. Por tanto, o el bote está inflado o el préstamo está contado dos veces.

#### Inversiones

- Son activos: dinero invertido en eToro, CRO, fondos…
- La app calcula `Σ valor_actual`.
- Se suman al “Total Real”.
- **Código:** `services/inversiones.py:258`.

En la base actual las inversiones tienen `cuenta_id = None` y no hay un movimiento histórico que saque el dinero de una cuenta. **Si los saldos de las cuentas son los actuales y el dinero ya había salido hace tiempo, la inversión se suma una vez y no hay doble conteo**: el banco de hoy ya no tiene ese dinero. Lo que falta es el movimiento histórico, útil para trazabilidad, no para el saldo actual. Solo habría doble conteo si el saldo del banco todavía incluyera el dinero invertido. Cuidado con el bote “Fondo Inversión Aitor” (470,00 €): si ya está dentro de los 2.196,00 € invertidos, es una etiqueta histórica y no debe contarse además como efectivo disponible; si es un fondo nuevo para invertir, entonces sí necesita su dinero aparte.

### 2.7 Las dos conciliaciones

La app calcula dos “cuadres” distintos:

#### A. Diferencia técnica (`diferencia`)

```text
diferencia = saldo_total_cuentas
           − saldo_inicial_total
           − (saldo_total_botes + sin_asignar)
```

- Es la identidad contable: los movimientos de las cuentas deben coincidir con lo asignado a botes más lo que queda sin asignar.
- **Código:** `services/conciliacion.py:123`.

#### B. Diferencia de la fórmula (`diferencia_formula`)

```text
Total Teórico = botes + tarjeta pendiente + previsión + sin asignar
Total Real    = bancos + me deben + préstamos + inversiones
Diferencia    = Total Teórico − Total Real
```

- Es la que ve el usuario en el modal de cuadre.
- **Código:** `services/conciliacion.py:191` y `:199`.

La pantalla de Inicio y el modal usan la **fórmula B**. La fórmula A se calcula, pero no se muestra. Por eso puede haber una diferencia técnica de 500 € y la pantalla decir “Contabilidad al día”.

### 2.8 Diccionario de datos

| Tabla | Qué guarda | Campos clave |
|---|---|---|
| `hogares` | El hogar | `id`, `nombre`, `moneda` |
| `cuentas` | Bancos, efectivo, tarjetas | `nombre`, `tipo`, `entidad`, `saldo_inicial_centimos`, `archivada` |
| `botes` | Etiquetas de ahorro/gasto | `nombre`, `tipo`, `objetivo_centimos`, `archivado` |
| `movimientos` | El evento que mueve dinero | `cuenta_id`, `bote_id`, `importe_centimos`, `fecha`, `descripcion`, `eliminado` |
| `categorias` | Clasificación de movimientos | `nombre`, `color` |
| `deudas` | Dinero a cobrar | `deudor`, `concepto`, `importe_inicial_centimos`, `importe_cobrado_centimos`, `archivada` |
| `prestamos` | Dinero a devolver | `nombre`, `entidad`, `importe_inicial_centimos`, `importe_pendiente_centimos`, `activo` |
| `inversiones` | Activos invertidos | `nombre`, `entidad`, `capital_aportado_centimos`, `valor_actual_centimos`, `activo` |
| `gastos_recurrentes` | Recibos anuales | `concepto`, `importe_anual_centimos`, `cuota_mensual_centimos`, `pagado_real_centimos`, `activo` |
| `prevision_gastos_config` | Meses y año de la previsión | `meses_pagados`, `anio` |
| `plantillas_reparto` | Repartos de nómina | `nombre`, `cuenta_id`, líneas |
| `pagos_recurrentes` | Recibos domiciliados | `cuenta_id`, `concepto`, `importe_centimos`, `dia_mes` |
| `importaciones` | Historial de Excel | `nombre_fichero`, `huella`, `resumen` |
| `auditoria_movimientos` | Trazabilidad | `movimiento_id`, `accion`, `cambios` |

---

## 3. Estructura real de las cuentas

### 3.1 Árbol del Hogar 1

```text
Hogar 1
├── Cuentas activas (14)
│   ├── Bancos (5)
│   │   ├── Deutsche Bank ................ 4.341,00 €
│   │   ├── La Caixa ..................... 2.760,20 €
│   │   ├── BBVA ............................ 39,50 €
│   │   ├── Revolut ......................... 38,00 €
│   │   └── Paypal .......................... 20,00 €
│   ├── Efectivo (1)
│   │   └── Dinero en efectivo ............. 680,40 €
│   └── Tarjetas (8)
│       ├── Tarjeta C&A ..................... 18,00 €
│       ├── Tarjeta Sprinter ................ 18,00 €
│       ├── Tarjeta Carrefour ............... 31,00 €
│       ├── Coupert ......................... 30,00 €
│       ├── Florines ......................... 6,00 €
│       ├── Dirhams ......................... 36,00 €
│       ├── Tarjeta Deutsche Bank ............ 0,00 €
│       └── Tarjeta Carrefour Pass ......... -565,65 €
├── Cuentas archivadas (9)
│   ├── Reserva Botes Históricos ........ 22.104,53 €
│   ├── Caixa (antigua) .................. 2.111,00 €
│   ├── BBVA (antigua) ...................... 39,50 €
│   ├── Paypal (antigua) .................... 20,00 €
│   ├── Tarjeta Visa ........................ 30,00 €
│   ├── Fondo Bols. (Efectivo) ............... 0,00 €
│   ├── Banco temporal ....................... 0,00 €
│   ├── Pass Carr (antigua) .................. 0,00 €
│   └── Tarjeta DB ........................... 0,00 €
├── Botes activos (21) ................. 22.149,03 €
├── Deudas a cobrar (16) ................ 2.919,60 €
├── Préstamos a devolver (2) ............ 9.498,66 €
└── Inversiones (2) ..................... 2.196,00 €
```

### 3.2 Cuentas activas

| ID | Nombre | Tipo | Entidad | Saldo inicial | Movimientos | Saldo actual | Papel |
|---:|---|---|---|---:|---:|---:|---|
| 8 | Tarjeta C&A | tarjeta | C&A (Regalo) | 18,00 € | 0,00 € | **18,00 €** | Monedero/regalo |
| 9 | Tarjeta Sprinter | tarjeta | Sprinter (Regalo) | 18,00 € | 0,00 € | **18,00 €** | Monedero/regalo |
| 10 | Tarjeta Carrefour | tarjeta | Carrefour (Regalo) | 31,00 € | 0,00 € | **31,00 €** | Monedero/regalo |
| 11 | Coupert | tarjeta | Coupert descuentos (Regalo) | 30,00 € | 0,00 € | **30,00 €** | Monedero/regalo |
| 12 | Florines | tarjeta | Florines (Regalo) | 6,00 € | 0,00 € | **6,00 €** | Monedero/regalo |
| 13 | Dirhams | tarjeta | DH (Regalo) | 36,00 € | 0,00 € | **36,00 €** | Monedero/regalo |
| 19 | Deutsche Bank | banco | Deutsche Bank | 4.341,00 € | 0,00 € | **4.341,00 €** | Cuenta principal |
| 21 | Revolut | banco | Revolut | 38,00 € | 0,00 € | **38,00 €** | Cuenta secundaria |
| 22 | Paypal | banco | Paypal | 20,00 € | 0,00 € | **20,00 €** | Cuenta secundaria |
| 23 | Dinero en efectivo | efectivo | Otros | 180,40 € | +500,00 € | **680,40 €** | Caja |
| 25 | La Caixa | banco | Caixa | 2.734,70 € | +25,50 € | **2.760,20 €** | Cuenta principal |
| 28 | Tarjeta Carrefour Pass | tarjeta | Caixa | −565,65 € | 0,00 € | **−565,65 €** | Tarjeta de crédito |
| 33 | BBVA | banco | BBVA | 39,50 € | 0,00 € | **39,50 €** | Cuenta secundaria |
| 34 | Tarjeta Deutsche Bank | tarjeta | Deutsche Bank | 0,00 € | 0,00 € | **0,00 €** | Tarjeta |
| | **Total activas** | | | **6.926,95 €** | **+525,50 €** | **7.452,45 €** | |

**Desglose del hero de Inicio:**

| Grupo | Importe |
|---|---:|
| Bancos | 7.198,70 € |
| Efectivo | 680,40 € |
| Monederos (tarjetas con saldo positivo) | 139,00 € |
| Tarjeta pendiente (Carrefour Pass) | −565,65 € |
| **Patrimonio disponible** | **7.452,45 €** |

### 3.3 Cuentas archivadas

| ID | Nombre | Tipo | Saldo inicial | Movimientos | Saldo actual | Qué contiene |
|---:|---|---|---:|---:|---:|---|
| 3 | Reserva Botes Históricos | banco | 0,00 € | +22.104,53 € | **22.104,53 €** | 20 movimientos de “Saldo consolidado” de botes históricos |
| 6 | Paypal (antigua) | banco | 20,00 € | 0,00 € | **20,00 €** | Saldo antiguo |
| 7 | Banco temporal | banco | 0,00 € | 0,00 € | **0,00 €** | Sin uso |
| 14 | Caixa (antigua) | banco | 2.111,00 € | 0,00 € | **2.111,00 €** | Saldo antiguo |
| 17 | Tarjeta Visa | banco | 30,00 € | 0,00 € | **30,00 €** | Saldo antiguo |
| 20 | BBVA (antigua) | banco | 39,50 € | 0,00 € | **39,50 €** | Saldo antiguo |
| 24 | Fondo Bols. (Efectivo) | efectivo | 500,00 € | −500,00 € | **0,00 €** | Se traspasó a “Dinero en efectivo” |
| 27 | Pass Carr (antigua) | tarjeta | 0,00 € | 0,00 € | **0,00 €** | Sin uso |
| 32 | Tarjeta DB | tarjeta | 0,00 € | 0,00 € | **0,00 €** | Sin uso |
| | **Total archivadas** | | **2.700,50 €** | **+21.604,53 €** | **24.305,03 €** | |

### 3.4 Totales y qué cuenta la app

| Universo | Importe | ¿La app lo cuenta? |
|---|---:|---|
| Cuentas activas | 7.452,45 € | Sí, en `total_bancos_formula` (con matices de tarjetas) |
| Cuentas archivadas | 24.305,03 € | **No** |
| Total de todas las cuentas | **31.757,48 €** | No hay una cifra que lo muestre |
| Inversiones | 2.196,00 € | Sí, en `total_inversiones_formula` |
| Me deben | 2.919,60 € | Sí, en `total_me_deben_formula` |
| Préstamos | 9.498,66 € | Sí, pero **sumando** |
| Botes | 22.149,03 € | Sí, en `total_botes_formula` |
| Previsión | −81,60 € | Sí, en `total_prevision_formula` |
| Tarjeta pendiente | 565,65 € | Sí, en `total_tarjetas_formula` |

### 3.5 El caso de la cuenta 3, “Reserva Botes Históricos”

Esta es la pieza que explica casi todo:

- Es una cuenta **archivada**, con **22.104,53 €**.
- Contiene **20 movimientos** del 3 de noviembre de 2026, todos con descripción “Saldo consolidado …” y `origen = manual`.
- 19 de esos movimientos están asignados a botes activos y suman **22.123,53 €**.
- 1 movimiento no tiene bote: “Saldo consolidado BOTE MARIA JOSE”, **−19,00 €**.
- Por tanto: `22.123,53 − 19,00 = 22.104,53 €`.

Los botes activos suman **22.149,03 €**, de los cuales:
- **22.123,53 €** están respaldados por la cuenta 3 (archivada).
- **25,50 €** están respaldados por La Caixa (bote “Mantecados Aitor”).

La app:
- **Sí** cuenta los botes (22.149,03 €).
- **No** cuenta la cuenta 3 (22.104,53 €), porque está archivada.
- **No** ve el movimiento de −19,00 € porque la cuenta 3 no entra en la consulta de saldos y ese movimiento no empieza por “Traspaso”.

Resultado: los botes están “flotando” sin respaldo visible. El hueco se compensa con los préstamos.

**Pregunta que hay que responder:** ¿la cuenta 3 representa dinero real que todavía existe (por ejemplo, un fondo de reserva separado), o es un histórico que ya se repartió entre las cuentas activas? Según la respuesta:
- Si **existe**: hay que desarchivarla o incluir su saldo en el total real. Entonces el patrimonio sube y los botes quedan respaldados.
- Si **no existe**: hay que archivar o poner a cero los botes que dependen de ella. Entonces los botes bajan y el cuadre deja de necesitar los préstamos.

---

## 4. Estructura real de los botes

### 4.1 Tabla de botes activos

| ID | Bote | Tipo | Objetivo | Saldo | Cuenta que lo respalda | Movimiento que lo creó |
|---:|---|---|---:|---:|---|---|
| 2 | GUARDADO HIPOTECAS 2025 | ahorro | — | **7.076,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado GUARDADO HIPOTECAS 2025 |
| 3 | Bote Arreglos Pisos | proyecto | — | **−323,70 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Bote Arreglos Pisos |
| 5 | Bote Aitor | ahorro | — | **−37,90 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Bote Aitor |
| 6 | Bote Javi | ahorro | — | **0,32 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Bote Javi |
| 8 | Guardado Resto Paro | ahorro | — | **2.646,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Guardado Resto Paro |
| 9 | Fondo Inversión Aitor | ahorro | — | **470,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Fondo Inversión Aitor |
| 11 | Viaje Invierno | ahorro | — | **805,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Extra para viaje Invierno |
| 12 | Viaje Navidad | proyecto | — | **291,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Para viaje invierno |
| 13 | Dentista | proyecto | — | **254,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Guardado Dentista |
| 15 | Viaje Rabat | proyecto | — | **12,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Viaje Rabat |
| 17 | Kitoli para pagar | recurrente | — | **204,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Kitoli libro Rafa |
| 18 | Bote ocio | ahorro | 230,00 € | **214,22 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Bote ocio |
| 20 | Gasolina mes | ahorro | — | **0,00 €** | — | Sin movimientos |
| 21 | Cash para el mes en curso | ahorro | 400,00 € | **296,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Cash para el mes en curso |
| 22 | Mejoras del Hogar | ahorro | — | **−162,81 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Mejoras del Hogar |
| 23 | Bote IRPF | ajeno | — | **276,40 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Bote IRPF |
| 24 | Bote emergencias | ahorro | — | **186,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado Bote ahorro extras |
| 29 | GUARDADO HIPOTECAS | ahorro | — | **8.847,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado GUARDADO HIPOTECAS |
| 30 | FIANZA CESAR | ahorro | — | **580,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado FIANZA CESAR |
| 31 | FIANZA NEREA | ahorro | — | **490,00 €** | Reserva Botes Históricos (archivada) | Saldo consolidado FIANZA NEREA |
| 32 | Mantecados Aitor | ajeno | — | **25,50 €** | La Caixa (activa) | Mantecados Pili |
| | **Total** | | | **22.149,03 €** | | |

### 4.2 Totales

| Grupo | Importe |
|---|---:|
| Hipotecas (botes 2 + 29) | **15.923,00 €** |
| Resto de botes | **6.226,03 €** |
| **Total botes activos** | **22.149,03 €** |
| Botes con saldo negativo | **−524,41 €** (Arreglos Pisos, Aitor, Mejoras del Hogar) |
| Botes con objetivo definido | Bote ocio (230 €) y Cash para el mes (400 €) |
| Botes ajenos | Bote IRPF (276,40 €) y Mantecados Aitor (25,50 €) |

**Botes negativos:** no son un error del cálculo; significan que se ha gastado más de lo que había etiquetado en ese bote. La app los muestra en rojo (“En descubierto”). Si el gasto se pagó desde una cuenta, el dinero ya salió; el bote negativo es una señal de que ese sobre está sobrepasado.

**Botes ajenos:** “Bote IRPF” y “Mantecados Aitor” son dinero que no es del hogar (impuestos o encargos). La app los cuenta igual dentro del total de botes. Si no son tuyos, deberían estar fuera del patrimonio o marcados como pasivo.

**Nota sobre inversiones:** el bote “Fondo Inversión Aitor” (470,00 €) puede ser una etiqueta histórica de dinero ya invertido. Si esa cantidad ya está dentro de los 2.196,00 € de inversiones, no la cuentes además como efectivo disponible; de lo contrario, el mismo dinero aparecería como bote y como inversión.

### 4.3 Cómo se mueve un bote

Un bote cambia de saldo solo por movimientos que lleven su `bote_id`. Hay tres formas correctas y una incorrecta muy fácil de usar.

#### Forma correcta 1: crear un ingreso/gasto real con bote

```text
Ingreso: +300 € en La Caixa, bote “Cash para el mes”
  → La Caixa +300 €
  → Cash +300 €
```

Es correcto si el dinero **entra de verdad** (nómina, devolución, venta). El movimiento es único.

#### Forma correcta 2: reasignar un movimiento existente

```text
Ya tienes +300 € sin bote en La Caixa.
Reasignas ese movimiento al bote “Cash para el mes”.
  → La Caixa: sin cambios
  → Cash: +300 €
  → Sin asignar: −300 €
```

Es la forma correcta de “apartar” dinero que ya estaba en la cuenta. **No crea dinero nuevo.**

#### Forma correcta 3: traspasar entre botes

```text
Mover 100 € de “Cash para el mes” a “Bote ocio”:
  → Movimiento −100 € en Cash (misma cuenta)
  → Movimiento +100 € en Ocio (misma cuenta)
  → Cuenta: sin cambios
  → Cash −100 €, Ocio +100 €
```

Es correcto para reorganizar etiquetas.

#### Forma incorrecta: “Meter o Sacar Dinero de este Bote”

La pantalla de detalle de un bote tiene un formulario llamado **“Meter o Sacar Dinero de este Bote”**. Al guardar:

- “Meter” crea un **movimiento positivo nuevo** en la cuenta elegida.
- “Sacar” crea un **movimiento negativo nuevo** en la cuenta elegida.

**No es un traspaso.** Si usas “Meter” para pasar dinero que ya estaba en el banco al bote, estás sumando el dinero dos veces: una en el saldo del banco (que ya lo tenía) y otra en el bote. Si usas “Sacar” para devolverlo al banco, estás creando un gasto.

**Código:** `app_conta/static/js/views/botes.js:182` (formulario) y `app_conta/static/js/app.js:245` (handler que hace `POST /movimientos`).

**Recomendación:** cambiar ese formulario por “Asignar/Desasignar movimiento existente” (reasignación) o, si se quiere un traspaso real, crear dos movimientos con contrapartida. Mientras no se cambie, usarlo solo para ingresos/gastos reales, nunca para “mover” dinero que ya está en una cuenta.

### 4.4 Ejemplos prácticos

#### Ejemplo A: cobras la nómina y quieres apartar 300 €

Incorrecto (con el formulario actual):
```text
1. Creas +1.000 € sin bote en La Caixa.          → La Caixa +1.000 €
2. Usas “Meter 300 €” en Cash.                    → La Caixa +300 € (¡otra vez!)
Resultado: La Caixa +1.300 €, Cash +300 €. Estás contando 300 € dos veces.
```

Correcto:
```text
1. Creas +300 € en La Caixa con bote Cash.
2. Creas +700 € en La Caixa sin bote.
Resultado: La Caixa +1.000 €, Cash +300 €, sin asignar +700 €.
```

O bien:
```text
1. Creas +1.000 € sin bote.
2. Reasignas 300 € de ese movimiento al bote Cash (si el movimiento se puede dividir;
   si no, create dos movimientos desde el principio).
```

#### Ejemplo B: pagas 50 € de ocio con la tarjeta Carrefour Pass

```text
Movimiento: −50 € en Tarjeta Carrefour Pass, bote “Bote ocio”.
  → Tarjeta Pass −50 € (más deuda)
  → Bote ocio −50 €
```

Cuando pagas la tarjeta desde el banco:
```text
Traspaso: 50 € de La Caixa a Tarjeta Carrefour Pass.
  → La Caixa −50 €
  → Tarjeta Pass +50 € (la deuda baja)
  → El bote no cambia (ya lo hizo el gasto).
```

#### Ejemplo C: mueves 100 € de efectivo a La Caixa

```text
Traspaso entre cuentas:
  → Dinero en efectivo −100 €
  → La Caixa +100 €
  → El bote no cambia.
```

#### Ejemplo D: archivas un bote con saldo

La app avisa y recomienda traspasar el saldo antes de archivarlo. Si lo archivas con movimientos:

- El bote deja de aparecer en la lista de botes activos.
- Sus movimientos siguen existiendo y siguen contando en las cuentas.
- La suma de botes activos baja, pero las cuentas no. Eso puede abrir una diferencia técnica.
- **Código:** `services/botes.py:231` (`archivar_bote`).

### 4.5 Botes negativos y botes ajenos

- **Negativos:** Arreglos Pisos (−323,70 €), Aitor (−37,90 €), Mejoras del Hogar (−162,81 €). Son sobres en descubierto. No son dinero que tengas; son gasto ya hecho.
- **Ajenos:** Bote IRPF (276,40 €) y Mantecados Aitor (25,50 €). Si son dinero de terceros o impuestos, no deberían formar parte de tu patrimonio. La app los suma igual.

---

## 5. La fórmula del cuadre, paso a paso

### 5.1 La fórmula que muestra la app

```text
GRUPO 1 — “Lo que debería tener”
  Botes de ahorro y gastos ............. 6.226,03 €
  Guardado Hipoteca ................... 15.923,00 €
  Tarjetas (pendiente pagar) ............. 565,65 €
  Saldo previsión anual .................. −81,60 €
  Sin asignar ............................. 0,00 €
  ───────────────────────────────────────────────
  Total Teórico ....................... 22.633,08 €

GRUPO 2 — “Lo que tengo real”
  Bancos y Efectivo .................... 8.018,10 €
  Me deben ............................. 2.919,60 €
  Préstamos (asumidos) ................. 9.498,66 €
  Inversiones .......................... 2.196,00 €
  ───────────────────────────────────────────────
  Total Real .......................... 22.632,36 €

Diferencia ................................ 0,72 €
```

**Nota:** “Bancos y Efectivo” (8.018,10 €) incluye los monederos de tarjetas con saldo positivo (139,00 €) y **no** resta la tarjeta negativa (565,65 €). La tarjeta negativa está en el Grupo 1. Por eso el “Total Real” no coincide con el “Patrimonio disponible” del hero (7.452,45 €).

### 5.2 Por qué sale 0,72 €

La coincidencia es aritmética, no económica:

- Los botes (22.149,03 €) están respaldados en su mayoría por la cuenta 3 (22.104,53 €), que no entra en el Grupo 2.
- La tarjeta negativa (565,65 €) se suma al Grupo 1.
- La previsión (−81,60 €) resta un poco.
- Los préstamos (9.498,66 €) se suman al Grupo 2.
- Las inversiones (2.196,00 €) y los “me deben” (2.919,60 €) también se suman.

El resultado es 22.633,08 − 22.632,36 = **0,72 €**. Si cambias una sola pieza (por ejemplo, si restas los préstamos), el cuadre se rompe y aparece el hueco real.

### 5.3 La diferencia técnica de 500 €

El endpoint `/api/v1/conciliacion` también devuelve:

```text
saldo_total_cuentas ..... 7.452,45 €
saldo_inicial_total ..... 6.926,95 €
saldo_total_botes ......... 25,50 €
sin_asignar ................ 0,00 €
diferencia ................ 500,00 €
estado ................... revisar
```

¿De dónde sale el 500?

- La consulta de movimientos incluye las cuentas activas **o** cualquier movimiento cuya descripción empiece por “Traspaso ”.
- El movimiento 57 (+500 €, “Traspaso desde Fondo Bols. (Efectivo)”) está en la cuenta activa 23. Se cuenta en el saldo de la cuenta.
- El movimiento 56 (−500 €, “Traspaso a Dinero en efectivo”) está en la cuenta **archivada** 24. No se cuenta en el saldo de la cuenta, pero sí entra en `sin_asignar` porque su descripción empieza por “Traspaso”.
- Los dos traspasos se cancelan en `sin_asignar` (0 €), pero el +500 € de la cuenta activa se queda sin contrapartida en el saldo.
- Resultado: 500 € de diferencia técnica.

**Es un bug de simetría:** o se incluyen las dos cuentas (activa y archivada) o no se incluye ninguna. Lo correcto sería calcular `sin_asignar` solo con movimientos de cuentas activas, o incluir el saldo de las cuentas archivadas en `saldo_total_cuentas`.

**Código:** `services/conciliacion.py:76-85` (consulta) y `:104-123` (`sin_asignar` y diferencia).

### 5.4 Escenarios

| Escenario | Total Real | Diferencia | Lectura |
|---|---:|---:|---|
| Fórmula actual (con préstamos sumados) | 22.632,36 € | **0,72 €** | “Cuadrado” artificial |
| Sin préstamos | 13.133,70 € | **9.499,38 €** | Aparece el hueco de los préstamos |
| Restando préstamos | 3.635,04 € | **18.998,04 €** | El hueco es aún mayor |
| Incluyendo la cuenta 3 y sin préstamos | 35.238,23 € | **−12.605,15 €** | Los botes quedan respaldados, pero el resto de etiquetas descuadra |
| Patrimonio neto razonable (cuentas activas + inversiones + me deben − préstamos) | **3.069,39 €** | — | Lo que te quedaría si no contaras las cuentas archivadas |
| Patrimonio neto incluyendo cuentas archivadas | **27.374,42 €** | — | Lo que te quedaría si las cuentas archivadas fueran reales |

La diferencia entre 3.069,39 € y 27.374,42 € es exactamente **24.305,03 €**, el saldo de las cuentas archivadas. Esa es la pregunta que hay que resolver: ¿ese dinero existe o es histórico?

---

## 6. Problemas detectados

### P0 — Críticos (afectan a la interpretación del dinero)

#### P0.1. Los préstamos se suman como activo

- **Qué pasa:** `total_real_formula` suma `total_prestamos_formula`.
- **Por qué está mal:** un préstamo es una deuda. Si debes 9.498,66 €, tu patrimonio baja, no sube.
- **Efecto:** el “Total Real” está inflado en 9.498,66 € (o en 18.997,32 € si lo comparas con restarlos).
- **Código:** `services/conciliacion.py:199-204`.
- **Excepción:** si el préstamo es interno (el hogar se lo debe a un bote), entonces el préstamo es un activo **solo si el bote bajó** cuando se prestó el dinero. En la base actual no hay movimiento que lo demuestre.
- **Decisión necesaria:** ¿son deudas externas o internas? Si externas, restar. Si internas, crear el movimiento que baja el bote y documentarlo.

#### P0.2. Los botes están respaldados por una cuenta archivada

- **Qué pasa:** la cuenta 3 tiene 22.104,53 € y está archivada; los botes activos suman 22.149,03 €. La app cuenta los botes pero no la cuenta.
- **Efecto:** el Grupo 1 incluye 22.149,03 € que no tienen respaldo visible en el Grupo 2. El hueco se tapa con los préstamos.
- **Código:** `services/conciliacion.py:65-72` (solo cuentas no archivadas) y `:137-151` (botes activos).
- **Decisión necesaria:** desarchivar la cuenta 3 o archivar/poner a cero los botes históricos.

#### P0.3. “Meter dinero en un bote” crea dinero nuevo

- **Qué pasa:** el formulario de detalle del bote crea un movimiento nuevo en la cuenta, no un traspaso.
- **Efecto:** si se usa para asignar dinero que ya estaba en la cuenta, el saldo de la cuenta sube y el bote sube: doble conteo.
- **Código:** `static/js/views/botes.js:182` y `static/js/app.js:245`.
- **Solución:** cambiar el formulario por reasignación de un movimiento existente o por un traspaso con contrapartida.

### P1 — Altos (distorsionan el cuadre)

#### P1.1. Los saldos iniciales no están en la fórmula teórica

- **Qué pasa:** las cuentas activas tienen 6.926,95 € de saldo inicial. El Grupo 1 no los incluye; solo incluye botes, tarjeta, previsión y movimientos sin bote.
- **Efecto:** si el dinero inicial no está etiquetado en un bote o en un movimiento, el Grupo 1 lo ignora y el Grupo 2 lo cuenta.
- **Código:** `services/conciliacion.py:89` y `:191-196`.
- **Solución:** incluir `saldo_inicial_total` en el Grupo 1, o crear un movimiento de “Saldo inicial” por cada cuenta y asignarlo a un bote/sin asignar.

#### P1.2. La previsión se trata como dinero

- **Qué pasa:** el saldo de previsión (−81,60 €) se suma al Grupo 1.
- **Por qué está mal:** es una provisión para recibos futuros, no un saldo bancario. Puede ser positiva o negativa y no representa dinero disponible.
- **Efecto:** el Grupo 1 cambia según los meses pagados y los recibos, sin que cambie el dinero real.
- **Código:** `services/conciliacion.py:159-166` y `:191-196`.
- **Solución:** mostrar la previsión como un objetivo/reserva separado, no como una partida del cuadre de caja.

#### P1.3. Traspaso asimétrico y diferencia técnica de 500 €

- **Qué pasa:** la consulta incluye movimientos “Traspaso” de cuentas archivadas, pero el saldo de esas cuentas no se cuenta.
- **Efecto:** la diferencia técnica es 500 € y el endpoint devuelve `estado: revisar` aunque la pantalla diga “cuadrado”.
- **Código:** `services/conciliacion.py:76-85` y `:104-123`.
- **Solución:** filtrar `sin_asignar` solo por cuentas activas o incluir las archivadas de forma consistente.

#### P1.4. Inversiones sin movimiento histórico (no siempre es doble conteo)

- **Qué pasa:** las inversiones (2.196,00 €) no tienen `cuenta_id` ni movimiento de salida.
- **Efecto:** si los saldos de las cuentas son los actuales y el dinero ya salió hace tiempo, **no hay doble conteo**: la inversión es un activo y el banco ya refleja la salida. Solo habría doble conteo si el saldo del banco todavía incluyera el dinero invertido.
- **Código:** `services/inversiones.py` (`crear_inversion` con `crear_movimiento_inicial`).
- **Solución:** si quieres trazabilidad histórica, crear el movimiento de salida al crear la inversión; si los saldos ya son actuales, no es necesario para el patrimonio. Revisar el bote “Fondo Inversión Aitor” para que no cuente dos veces el mismo dinero.

### P2 — Medios (claridad y clasificación)

#### P2.1. Deudas que no son deudas

- “Endesa ** PENDIENTE”, “Carrefour PENDIENTE”, “Tarjeta Visa”, “Seguro piso Córdoba” y “Dazn” parecen facturas o deudas tuyas, no dinero que te deben.
- Si son pasivos, la app los está sumando como activos. Hay que revisar cada deuda y separar “me deben” de “debo”.

#### P2.2. Nombres y etiquetas confusas

- `total_bancos_formula` no es “bancos”: incluye efectivo y monederos, y excluye la tarjeta negativa.
- `total_real_formula` no es “real”: mezcla activos y pasivos.
- `total_teorico_formula` no es “lo que debería tener”: incluye previsiones y deudas de tarjeta.
- `botes_generales_formula` + `guardado_hipoteca_formula` = `total_botes_formula`; el docstring dice “botes + guardado hipoteca”, lo que parece doble conteo, pero el código no lo hace. Conviene aclararlo.

#### P2.3. Dos definiciones de “real”

- El hero muestra **7.452,45 €** (líquido neto de tarjeta).
- El modal muestra **22.632,36 €** (fórmula con préstamos e inversiones).
- Son dos cosas distintas con nombres parecidos. El usuario no puede compararlas.

#### P2.4. El “Cuadrar a finales de año” de 1 €

- Hay un gasto recurrente con importe anual de 1,00 € y pagado real de 53,98 €, que genera −53,06 € de previsión.
- Es un ajuste de redondeo que distorsiona la previsión. Conviene eliminarlo o documentarlo.

---

## 7. Cómo debería quedar

### 7.1 Una sola ecuación de patrimonio

La forma más clara es separar **patrimonio** de **etiquetas**:

```text
PATRIMONIO NETO =
    Σ saldos de cuentas activas
  + Σ valor actual de inversiones
  + Σ deudas a cobrar
  − Σ préstamos pendientes
```

Con los datos actuales (solo cuentas activas):

```text
7.452,45 + 2.196,00 + 2.919,60 − 9.498,66 = 3.069,39 €
```

Si las cuentas archivadas son reales:

```text
7.452,45 + 24.305,03 + 2.196,00 + 2.919,60 − 9.498,66 = 27.374,42 €
```

Los botes **no se suman** al patrimonio: son etiquetas sobre el dinero. Se muestran aparte:

```text
DINERO ETIQUETADO = Σ botes activos = 22.149,03 €
DINERO LIBRE      = patrimonio líquido − botes (si los botes están respaldados)
```

### 7.2 Tres cifras separadas en la pantalla

En lugar de un “Total Real” que mezcla todo, mostrar tres bloques:

1. **Dinero líquido disponible**
   - Cuentas activas netas de tarjetas.
   - Ejemplo actual: 7.452,45 €.

2. **Dinero etiquetado**
   - Botes + previsión.
   - Ejemplo actual: 22.149,03 € en botes; −81,60 € de previsión.
   - Mostrar también **cuánto está respaldado** y **cuánto no**.

3. **Patrimonio neto**
   - Cuentas + inversiones + me deben − préstamos.
   - Ejemplo actual: 3.069,39 € (solo activas) o 27.374,42 € (con archivadas).

### 7.3 Reglas de oro para que no vuelva a descuadrar

1. **Un bote no es una cuenta.** Es una etiqueta.
2. **Crear un movimiento cambia dinero; reasignar un bote solo cambia la etiqueta.**
3. **Traspaso entre cuentas:** dos movimientos, mismas etiquetas.
4. **Traspaso entre botes:** dos movimientos en la misma cuenta, etiquetas distintas.
5. **No uses “Meter dinero” para asignar dinero existente.** Usa reasignación.
6. **Los préstamos son deuda:** réstalos del patrimonio.
7. **Los saldos iniciales son dinero:** inclúyelos en la ecuación.
8. **La previsión es un plan:** no la trates como caja.
9. **Las cuentas archivadas siguen teniendo saldo:** o las incluyes o las pones a cero, pero no las ignores.
10. **Cada inversión debe tener su movimiento de salida** o marcar que es externa.

### 7.4 Plan de corrección propuesto

#### Fase 1 — Decidir qué es real (sin tocar código)

1. Confirmar si la cuenta 3 (“Reserva Botes Históricos”) existe hoy o es histórica.
2. Confirmar si los botes históricos siguen vigentes o son etiquetas antiguas.
3. Confirmar si los préstamos “Coche Hyundai” y “Ciclo DAM” son deuda externa o interna.
4. Confirmar si el dinero de las inversiones ya había salido de las cuentas cuando se introdujeron los saldos actuales.
5. Revisar las deudas que parecen facturas.

#### Fase 2 — Corregir los datos

- Si la cuenta 3 es real: desarchivarla o incluir su saldo en el total.
- Si es histórica: archivar/poner a cero los botes que dependen de ella y eliminar el “Saldo consolidado”.
- Si los préstamos son externos: restarlos.
- Si son internos: crear el movimiento que baja el bote y documentar el préstamo.
- Si quieres trazabilidad histórica de las inversiones: crear el movimiento de salida; si los saldos ya son actuales, no hace falta para el patrimonio.
- Reclasificar las deudas que sean facturas.

#### Fase 3 — Corregir el código

1. **`services/conciliacion.py`**
   - Restar `total_prestamos_formula` en lugar de sumarlo.
   - Incluir `saldo_inicial_total` en el Grupo 1 o eliminarlo de la ecuación.
   - Sacar la previsión del cuadre de caja y mostrarla aparte.
   - Corregir la consulta de “Traspaso” para que sea simétrica.
   - Renombrar los campos para que digan lo que son.

2. **Formulario de botes**
   - Sustituir “Meter o Sacar Dinero” por “Asignar/Desasignar movimiento existente”.
   - Si se quiere un traspaso, crear dos movimientos con contrapartida.

3. **Inicio**
   - Mostrar tres cifras: líquido, etiquetado y patrimonio neto.
   - No usar “Total Real” para el hero.
   - Mostrar la diferencia técnica si no es cero.

4. **Modal de cuadre**
   - Explicar que los botes son etiquetas, no cuentas.
   - Mostrar qué parte de los botes está respaldada por cada cuenta.
   - Mostrar los préstamos como pasivo, no como activo.

#### Fase 4 — Tests de invariantes

Añadir tests que fallen si el cuadre se rompe:

```text
1. saldo_cuenta = saldo_inicial + Σ movimientos vivos.
2. saldo_bote = Σ movimientos vivos con ese bote_id.
3. Σ saldos de cuentas activas = Σ movimientos de cuentas activas + Σ saldos iniciales.
4. patrimonio_neto = cuentas + inversiones + deudas − préstamos.
5. Σ botes activos ≤ Σ saldo de las cuentas que los respaldan.
6. Si un movimiento se reasigna de bote, el saldo de la cuenta no cambia.
7. Si se hace un traspaso entre cuentas, el total de cuentas no cambia.
8. Si se hace un traspaso entre botes, el total de botes no cambia.
9. La diferencia técnica es 0 cuando todas las cuentas están activas.
10. No se puede crear un movimiento con bote de otro hogar.
```

---

## 8. Anexos

### A. Movimientos que crearon los botes (Hogar 1)

| Movimiento | Fecha | Cuenta | Bote | Importe | Descripción |
|---:|---|---|---|---:|---|
| 35 | 2026-11-03 | Reserva Botes Históricos (archivada) | GUARDADO HIPOTECAS | +8.847,00 € | Saldo consolidado GUARDADO HIPOTECAS |
| 36 | 2026-11-03 | Reserva Botes Históricos (archivada) | GUARDADO HIPOTECAS 2025 | +7.076,00 € | Saldo consolidado GUARDADO HIPOTECAS 2025 |
| 37 | 2026-11-03 | Reserva Botes Históricos (archivada) | Cash para el mes en curso | +296,00 € | Saldo consolidado Cash para el mes en curso |
| 38 | 2026-11-03 | Reserva Botes Históricos (archivada) | Bote ocio | +214,22 € | Saldo consolidado Bote ocio |
| 39 | 2026-11-03 | Reserva Botes Históricos (archivada) | Bote Aitor | −37,90 € | Saldo consolidado Bote Aitor |
| 40 | 2026-11-03 | Reserva Botes Históricos (archivada) | Bote Javi | +0,32 € | Saldo consolidado Bote Javi |
| 41 | 2026-11-03 | Reserva Botes Históricos (archivada) | — | −19,00 € | Saldo consolidado BOTE MARIA JOSE |
| 42 | 2026-11-03 | Reserva Botes Históricos (archivada) | Bote Arreglos Pisos | −323,70 € | Saldo consolidado Bote Arreglos Pisos |
| 43 | 2026-11-03 | Reserva Botes Históricos (archivada) | Bote IRPF | +276,40 € | Saldo consolidado Bote IRPF |
| 44 | 2026-11-03 | Reserva Botes Históricos (archivada) | Bote emergencias | +186,00 € | Saldo consolidado Bote ahorro extras |
| 45 | 2026-11-03 | Reserva Botes Históricos (archivada) | Mejoras del Hogar | −162,81 € | Saldo consolidado Mejoras del Hogar |
| 46 | 2026-11-03 | Reserva Botes Históricos (archivada) | FIANZA CESAR | +580,00 € | Saldo consolidado FIANZA CESAR |
| 47 | 2026-11-03 | Reserva Botes Históricos (archivada) | FIANZA NEREA | +490,00 € | Saldo consolidado FIANZA NEREA |
| 48 | 2026-11-03 | Reserva Botes Históricos (archivada) | Guardado Resto Paro | +2.646,00 € | Saldo consolidado Guardado Resto Paro |
| 49 | 2026-11-03 | Reserva Botes Históricos (archivada) | Fondo Inversión Aitor | +470,00 € | Saldo consolidado Fondo Inversión Aitor |
| 50 | 2026-11-03 | Reserva Botes Históricos (archivada) | Viaje Rabat | +12,00 € | Saldo consolidado Viaje Rabat |
| 51 | 2026-11-03 | Reserva Botes Históricos (archivada) | Viaje Invierno | +805,00 € | Saldo consolidado Extra para viaje Invierno |
| 52 | 2026-11-03 | Reserva Botes Históricos (archivada) | Dentista | +254,00 € | Saldo consolidado Guardado Dentista |
| 53 | 2026-11-03 | Reserva Botes Históricos (archivada) | Viaje Navidad | +291,00 € | Saldo consolidado Para viaje invierno |
| 54 | 2026-11-03 | Reserva Botes Históricos (archivada) | Kitoli para pagar | +204,00 € | Saldo consolidado Kitoli libro Rafa |
| 55 | 2026-11-03 | La Caixa (activa) | Mantecados Aitor | +25,50 € | Mantecados Pili |

### B. Glosario

| Término | Significado |
|---|---|
| **Cuenta** | Donde está el dinero: banco, efectivo o tarjeta. |
| **Bote** | Etiqueta que reserva una parte del dinero para un fin. No es una cuenta. |
| **Movimiento** | Ingreso o gasto. Es el único evento que cambia el dinero. |
| **Saldo inicial** | Dinero que había en la cuenta al empezar. No es un movimiento. |
| **Saldo derivado** | Saldo calculado: inicial + movimientos. No se guarda. |
| **Traspaso entre cuentas** | Mover dinero de una cuenta a otra con dos movimientos. |
| **Traspaso entre botes** | Mover etiqueta de un bote a otro con dos movimientos en la misma cuenta. |
| **Reasignación** | Cambiar el bote de un movimiento existente. |
| **Previsión** | Reserva planificada para recibos anuales. No es caja. |
| **Deuda** | Dinero que te deben. Activo. |
| **Préstamo** | Dinero que debes. Pasivo. |
| **Inversión** | Activo financiero. |
| **Cuadre** | Comparación entre etiquetas y dinero real. |
| **Diferencia técnica** | Identidad contable de movimientos vs botes + sin asignar. |
| **Diferencia de fórmula** | La que muestra el modal: Total Teórico − Total Real. |

### C. Referencias de código

| Tema | Archivo | Línea aproximada |
|---|---|---:|
| Saldo de cuenta | `app_conta/services/movimientos.py` | 385 |
| Saldo de bote | `app_conta/services/botes.py` | 128 |
| Listar cuentas activas | `app_conta/services/cuentas.py` | 135 |
| Listar botes activos | `app_conta/services/botes.py` | 155 |
| Cálculo de conciliación | `app_conta/services/conciliacion.py` | 44 |
| Diferencia técnica | `app_conta/services/conciliacion.py` | 123 |
| Fórmula teórica | `app_conta/services/conciliacion.py` | 191 |
| Fórmula real | `app_conta/services/conciliacion.py` | 199 |
| Previsión | `app_conta/services/prevision_gastos.py` | 225 |
| Deudas | `app_conta/services/deudas.py` | 74 |
| Préstamos | `app_conta/services/prestamos.py` | 264 |
| Inversiones | `app_conta/services/inversiones.py` | 258 |
| Traspaso entre cuentas | `app_conta/api/cuentas.py` | 236 |
| Traspaso entre botes | `app_conta/api/botes.py` | 147 |
| Reasignar bote | `app_conta/services/botes.py` | 206 |
| Formulario “Meter/Sacar” | `app_conta/static/js/views/botes.js` | 182 |
| Handler “Meter/Sacar” | `app_conta/static/js/app.js` | 245 |
| Hero de Inicio | `app_conta/static/js/views/inicio.js` | 52 |
| Modal de cuadre | `app_conta/static/js/modales-acciones.js` | 1454 |
| Nota del importador | `app_conta/services/importador/mapeo.py` | 8 |

---

## 9. Conclusión

La app tiene una base técnica sólida: céntimos enteros, saldos derivados, movimientos auditables y una separación correcta entre cuentas, botes y categorías. El problema no es el cálculo de cada saldo, sino **la definición de qué se compara con qué** en el cuadre.

Ahora mismo el cuadre mezcla:

- dinero real (cuentas, inversiones, deudas),
- deuda (préstamos),
- etiquetas (botes, previsión),
- y una cuenta archivada que contiene el respaldo de los botes.

Eso produce una cifra que “cuadra” por compensación, pero que no responde a la pregunta que tú te haces: **¿cuánto dinero tengo realmente y cuánto está comprometido?**

La corrección no requiere rehacer la app. Requiere:

1. Decidir qué es real (cuenta 3, botes históricos, préstamos, inversiones).
2. Cambiar la fórmula para que los préstamos resten y los saldos iniciales cuenten.
3. Arreglar el formulario de “meter/sacar” de los botes.
4. Mostrar tres cifras claras: líquido, etiquetado y patrimonio neto.

Con esos cuatro cambios, el número de Inicio y el número del modal contarían la misma historia.
