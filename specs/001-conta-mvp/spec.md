# Feature Specification: App_Conta MVP — Contabilidad del hogar por sistema de botes

**Feature Branch**: `001-conta-mvp`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "App de contabilidad para el hogar basada en el Excel OCTUBRE.xlsx y el documento de diseño `docs/diseno-inicial.md`: sistema de botes donde cada euro de bancos, tarjetas y efectivo está asignado a un propósito, con pantalla de disponible real (hoja CAJA)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el disponible real de un vistazo (Priority: P1)

Como responsable de las finanzas del hogar, quiero abrir la app y ver al instante cuánto dinero hay realmente disponible — el saldo de cada cuenta y el saldo de cada bote, con la diferencia entre ambos — para saber si puedo hacer un gasto sin revisar el Excel.

**Why this priority**: Es el número que consulto cada día (equivalente a la hoja CAJA del Excel) y la razón de ser de la app. Sin esta pantalla no hay valor.

**Independent Test**: Con cuentas y movimientos cargados, abrir la pantalla principal muestra saldos por cuenta, saldos por bote y la diferencia de conciliación; se verifica contra un cálculo manual de los mismos datos.

**Acceptance Scenarios**:

1. **Given** varias cuentas con movimientos registrados, **When** abro la pantalla principal, **Then** veo el saldo actual de cada cuenta, el total de saldos y la fecha del último movimiento.
2. **Given** botes con movimientos asignados, **When** abro la pantalla de botes, **Then** veo el saldo de cada bote, su objetivo (si tiene) y si está por detrás o por delante de lo previsto.
3. **Given** saldos de cuentas y de botes calculados, **When** la app concilia, **Then** muestra la diferencia entre ambos totales y la etiqueta "cuadrado" si es 0, o "revisar" con el importe de la diferencia en caso contrario.

---

### User Story 2 - Registrar cuentas y movimientos (Priority: P1)

Como usuario, quiero dar de alta mis cuentas (bancos, tarjetas, efectivo, inversiones) y registrar cada ingreso y gasto con su fecha, importe, categoría y descripción, para que el saldo de cada cuenta se calcule solo a partir de los movimientos.

**Why this priority**: Los movimientos son la fuente de verdad de todo lo demás; sin ellos no hay saldos ni botes fiables.

**Independent Test**: Crear una cuenta con saldo inicial, añadir tres movimientos y comprobar que el saldo mostrado coincide con el cálculo manual (inicial + ingresos − gastos).

**Acceptance Scenarios**:

1. **Given** una cuenta nueva, **When** introduzco su nombre, tipo, entidad y saldo inicial, **Then** la cuenta queda disponible para registrar movimientos.
2. **Given** una cuenta abierta, **When** registro un gasto de 30 € en supermercado, **Then** el saldo de la cuenta baja 30 € y el movimiento queda listado con fecha, importe, categoría y cuenta.
3. **Given** un movimiento registrado, **When** lo edito o lo elimino, **Then** el saldo de la cuenta se recalcula y queda registrado el cambio.
4. **Given** una cuenta con movimientos, **When** intento eliminarla, **Then** la app me avisa de que tiene movimientos y me pide confirmación explicando qué pasará con ellos.

---

### User Story 3 - Gestionar botes y asignar dinero (Priority: P1)

Como usuario, quiero crear botes (gastos recurrentes, ahorro, proyectos, fianzas), asignar cada movimiento a un bote y ver el saldo de cada uno, para mantener el sistema de sobres que hoy llevo en el Excel.

**Why this priority**: El sistema de botes es la lógica central del Excel actual; la app debe reproducirla con datos fiables.

**Independent Test**: Crear dos botes, registrar movimientos asignados a cada uno y comprobar que el saldo de cada bote es la suma exacta de sus movimientos y que la suma de botes coincide con el total asignado.

**Acceptance Scenarios**:

1. **Given** la sección de botes, **When** creo un bote con nombre, tipo y objetivo opcional, **Then** el bote aparece con saldo 0 y puedo asignarle movimientos.
2. **Given** un movimiento registrado, **When** le asigno un bote, **Then** el saldo del bote se actualiza con el importe del movimiento.
3. **Given** un movimiento ya asignado, **When** lo reasigno a otro bote, **Then** ambos botes quedan con el saldo correcto.
4. **Given** un bote con objetivo, **When** su saldo alcanza o supera el objetivo, **Then** la app lo marca como conseguido.

---

### User Story 4 - Categorizar gastos e ingresos (Priority: P2)

Como usuario, quiero organizar los movimientos en categorías propias (luz, agua, gasolina, ocio…) para saber en qué se va el dinero del hogar.

**Why this priority**: Aporta el control por concepto, pero la app ya es útil con las categorías por defecto.

**Independent Test**: Crear una categoría, asignarla a varios movimientos y ver el total acumulado de la categoría.

**Acceptance Scenarios**:

1. **Given** la sección de categorías, **When** creo una categoría con nombre y color, **Then** está disponible al registrar movimientos.
2. **Given** movimientos de una misma categoría, **When** consulto el total de la categoría, **Then** veo la suma de sus importes en el periodo consultado.
3. **Given** una categoría en uso, **When** intento eliminarla, **Then** la app me avisa de los movimientos que la usan antes de permitirlo.

---

### User Story 5 - Importar el histórico desde el Excel actual (Priority: P2)

Como usuario, quiero cargar el fichero OCTUBRE.xlsx para no empezar de cero, de forma que la app cree las cuentas, categorías, botes y movimientos que reflejan mi situación actual, incluidos los saldos de los botes tal y como están en el Excel.

**Why this priority**: Sin el histórico, la app nace vacía y el usuario debe seguir usando el Excel; con él, la app arranca siendo útil desde el primer día.

**Independent Test**: Importar OCTUBRE.xlsx y comprobar que el disponible real de la app coincide con el de la hoja CAJA del Excel (salvo las diferencias documentadas del Excel).

**Acceptance Scenarios**:

1. **Given** el fichero OCTUBRE.xlsx, **When** ejecuto la importación, **Then** la app muestra un resumen de lo que va a crear (cuentas, botes, movimientos, saldos) antes de aplicarlo.
2. **Given** una importación completada, **When** reviso la pantalla de disponible real, **Then** los saldos por cuenta coinciden con los del Excel y la diferencia de conciliación queda explicada.
3. **Given** filas del Excel sin concepto claro o con errores de cálculo, **When** se importan, **Then** quedan registradas como movimientos marcados "revisar" con el motivo, sin detener la importación.

---

### User Story 6 - Copia de seguridad de mis datos (Priority: P3)

Como usuario, quiero exportar una copia completa de mis datos y poder restaurarla, para no perder el histórico si cambio de dispositivo.

**Why this priority**: Importante para la tranquilidad, pero no bloquea el uso diario de la app.

**Independent Test**: Exportar los datos, restaurarlos en una instalación limpia y comprobar que los saldos son idénticos.

**Acceptance Scenarios**:

1. **Given** datos cargados, **When** exporto una copia, **Then** obtengo un fichero único con cuentas, movimientos, categorías y botes.
2. **Given** un fichero de copia, **When** lo restauro en otra instalación, **Then** todos los saldos y el histórico quedan idénticos al original.

---

### Edge Cases

- Un movimiento sin bote asignado: la app lo muestra como "sin asignar" en el desglose de botes y la conciliación no falla; el usuario decide después a qué bote va.
- Un bote cuyo saldo queda negativo por una asignación errónea: se muestra en negativo con un aviso visual, sin bloquearte.
- Movimiento con fecha anterior a la creación de la cuenta: se permite registrar y la cuenta lo muestra en su histórico desde esa fecha.
- Doble importación del mismo Excel: la app detecta importaciones repetidas y pide confirmación antes de duplicar datos.
- Borrado de una cuenta con movimientos: se exige confirmación y se explica el destino de sus movimientos.
- Cantidades con más de dos decimales al importar: se redondean a céntimos de forma explícita y se registra el ajuste.
- Transferencia entre dos cuentas propias: se registra como dos movimientos espejo (FR-016); si el usuario introduce solo uno, la conciliación muestra diferencia y estado `revisar`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La app MUST permitir crear, editar y eliminar cuentas con: nombre, tipo (banco, tarjeta, efectivo, inversión), entidad, saldo inicial y fecha de apertura.
- **FR-002**: La app MUST calcular el saldo de cada cuenta únicamente a partir de sus movimientos (nunca editable a mano).
- **FR-003**: La app MUST permitir registrar movimientos con fecha, importe, descripción, categoría, cuenta y bote (opcional), usando la convención gasto negativo / ingreso positivo.
- **FR-004**: La app MUST mostrar todos los importes en euros con dos decimales y MUST realizar todos los cálculos monetarios sin pérdida de precisión por redondeo.
- **FR-005**: La app MUST permitir crear, editar y archivar categorías, y MUST impedir borrar una categoría en uso sin avisar de los movimientos afectados.
- **FR-006**: La app MUST permitir crear botes con nombre, tipo (gastos recurrentes, ahorro, proyecto, ajeno/fianza), objetivo opcional (importe y fecha) y MUST calcular el saldo de cada bote como la suma de sus movimientos asignados.
- **FR-007**: La app MUST mostrar el disponible real: saldo por cuenta, saldo por bote y la diferencia de conciliación entre ambos, actualizados al registrar cualquier movimiento.
- **FR-008**: La app MUST permitir reasignar un movimiento de un bote a otro y MUST recalcular ambos saldos.
- **FR-009**: La app MUST permitir importar el fichero OCTUBRE.xlsx mostrando un resumen previo de lo que se va a crear y MUST marcar como "revisar" las filas cuyo concepto no sea claro o contenga errores, sin abortar la importación.
- **FR-010**: La app MUST detectar una importación repetida del mismo fichero y MUST pedir confirmación antes de duplicar datos.
- **FR-011**: La app MUST funcionar sin conexión una vez instalada, almacenando los datos en el dispositivo del usuario.
- **FR-012**: La app MUST permitir exportar una copia completa de los datos (cuentas, movimientos, categorías, botes) a un fichero y MUST permitir restaurarla.
- **FR-013**: La app MUST registrar un histórico de cambios auditable de altas, ediciones y borrados de movimientos.
- **FR-014**: La app MUST impedir que un importe se introduzca como texto o con símbolos; la entrada MUST validar el formato numérico antes de guardar.
- **FR-015**: La app MUST mostrar los totales por categoría en el periodo consultado.
- **FR-016**: La app MUST registrar las transferencias entre cuentas propias como dos movimientos (negativo en la cuenta origen, positivo en la destino) con la misma descripción, de forma que el total del dinero en cuentas quede invariado y la conciliación siga cuadrando.

### Key Entities *(include if feature involves data)*

- **Hogar**: el núcleo de la app; agrupa a las personas y todos los datos. En el MVP, un único hogar por instalación.
- **Cuenta**: dinero real del que se dispone (banco, tarjeta, efectivo, inversión); tiene muchos movimientos; su saldo es siempre derivado.
- **Movimiento**: cualquier ingreso o gasto con fecha, importe, descripción, categoría, cuenta y bote opcional; es la única fuente de verdad de los saldos.
- **Categoría**: clasificación de movimientos (luz, agua, gasolina, ocio…); se puede archivar pero no borrar en silencio si está en uso.
- **Bote**: sobre con saldo derivado de sus movimientos, tipo (recurrente, ahorro, proyecto, ajeno) y objetivo opcional; representa dinero reservado o de terceros (fianzas).
- **Asignación**: la relación explícita entre un movimiento y un bote; reasignable y siempre registrada.
- **Conciliación**: la comprobación entre el saldo real de las cuentas y el saldo repartido en botes, con su diferencia explicada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario ve el disponible real (saldos por cuenta, saldos por bote y diferencia de conciliación) en la pantalla principal en menos de 5 segundos desde que abre la app.
- **SC-002**: Registrar un movimiento completo (fecha, importe, categoría, bote) lleva menos de 30 segundos desde el móvil.
- **SC-003**: El 100 % de los saldos calculados por la app coinciden, céntimo a céntimo, con el cálculo manual sobre los mismos movimientos en las pruebas de aceptación (0 errores de redondeo).
- **SC-004**: Tras importar OCTUBRE.xlsx, el saldo de cada bote en la app coincide con el del Excel con una diferencia máxima de 0,01 € por bote, y las diferencias existentes quedan documentadas en el informe de importación.
- **SC-005**: La app abre y funciona completamente (registrar movimientos, ver disponible) sin conexión a internet.
- **SC-006**: El usuario puede restaurar una copia de seguridad en otra instalación y obtener saldos idénticos al origen.

## Assumptions

- Moneda única: todos los importes están en euros; no se contemplan multimoneda en el MVP.
- Usuario único: la app está pensada para una persona que gestiona las finanzas del hogar; varias personas (p. ej. nómina de M. Jose) se modelan más adelante, no en el MVP.
- Alcance del MVP: cuentas, movimientos, categorías, botes, pantalla de disponible real, importación del Excel y copia de seguridad. Quedan fuera: gastos recurrentes con cuota mensual automática, presupuesto anual, hipotecas y cuadros de amortización, nómina por horas e informes gráficos (fases siguientes).
- El fichero OCTUBRE.xlsx de `docs/` es el origen del histórico; los errores de cálculo que contiene el Excel (#REF!, intereses contradictorios) se importan como datos marcados "revisar", no se recalculan en silencio.
- Dispositivo personal: el usuario usa la app en su móvil y su ordenador; la sincronización entre dispositivos no entra en el MVP.
- Sin servicios externos obligatorios: la app no requiere cuentas en la nube ni conexión para funcionar.
- Los botes de tipo "ajeno" (fianzas) se tratan como botes normales en el MVP; su devolución al propietario se gestiona con movimientos.
