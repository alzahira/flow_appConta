# App_Conta — Control Financiero del Hogar y Sistema de Botes

**App_Conta** es una aplicación web local-first para la gestión contable doméstica basada en el **sistema de sobres/botes virtuales**. Diseñada para sustituir y automatizar hojas de cálculo complejas, garantiza la integridad contable céntimo a céntimo (principio de saldo derivado, almacenamiento en números enteros de céntimos y cero desfase decimal).

---

## 🌟 Filosofía y Características Principales

* **El Método de los Sobres Virtuales:** Tu dinero real en el banco o en efectivo se reparte en "huchas" o sobres virtuales (*Dinero del Mes*, *Ocio*, *Emergencias*, *Fondo Hipotecas*...). Así siempre sabes exactamente cuánto puedes gastar sin tocar los ahorros ni comprometer los recibos.
* **Pagos Diarios con Tarjeta y Crédito Real:** Registra compras del día a día (pan, comida, gasolina, ocio) con tarjetas bancarias (**CaixaBank**, **Deutsche Bank**, **Carrefour Pass**). El gasto se descuenta inmediatamente del sobre correspondiente pero **no toca el dinero del banco hasta que liquidas el recibo a fin de mes**.
* **Liquidación a Fin de Mes Controlada:** Permite especificar el importe exacto que liquida el banco en cada ciclo de facturación, arrastrando al mes siguiente aquellas compras que entraron después de la fecha de corte.
* **Reparto de Nómina en 1 Clic:** Distribuye automáticamente las nóminas mensuales abonando gastos anuales (+1 mes de previsión de seguros e IBI), amortizando préstamos (cuota de coche) y cobrando deudas (DAZN) de forma transparente.
* **Identidad Contable en Tiempo Real:** El panel de control comprueba continuamente que todo el dinero físico y bancario coincide con la suma de tus botes, previsiones y obligaciones: **🟢 Contabilidad al día**.
* **Privacidad y Multi-dispositivo:** Todo se ejecuta en tu red local. Abre la aplicación desde el ordenador o desde cualquier móvil/tablet conectado a la misma WiFi.

---

## 🧭 Mapa de la Aplicación

La navegación superior está diseñada con accesos directos limpios, homogéneos y sin barras de desplazamiento innecesarias:

1. **📊 Inicio (`#/inicio`)**:
   - Saldo consolidado total con desglose de Bancos, Efectivo físico y Tarjetas.
   - Semáforo vivo de cuadre contable (**🟢 Contabilidad al día** / 🟡 Revisar).
   - Acciones rápidas: `[ + Ingreso ]`, `[ − Gasto ]`, `[ Reparto Nómina ]` y `[ Copia & Vaciar ]`.
   - Tarjetas destacadas: **Dinero del Mes** (compras cotidianas y alimentación) y **Dinero de Ocio** (cenas, salidas y disfrute).
   - Píldoras de resumen: Sobres y Botes, Dinero sin asignar, Bote Gastos Anuales, Dinero que me deben, Préstamos que debo y Capital Invertido.
2. **🛒 Pagos Diarios (`#/pagos-diarios`)**:
   - Gestión ágil de compras con **Tarjeta Caixa**, **Tarjeta Deutsche Bank** y **Tarjeta Pass Carrefour**.
   - Atajos rápidos con 1 clic: *Pan y desayuno*, *Supermercado*, *Gasolina*, *Bar / Ocio*, *Farmacia*.
   - Botón directo **`💳 Liquidar Recibo en Banco`** para saldar el extracto bancario con importe 100% editable.
3. **🎯 Ahorro y Botes (`#/botes`)**:
   - **Sobres y Botes**: Huchas activas (*Bote emergencias*, *Dinero del mes*, *Ocio*, *Proyectos*...) con barras de progreso y extracto individual.
   - **Dinero que me deben**: Control de personas que te deben dinero, cobros parciales y liquidación.
   - **Fondo Ahorro Hipoteca**: Reserva específica para la cuota y amortizaciones hipotecarias.
4. **📝 Movimientos (`#/movimientos`)**:
   - Historial cronológico global de todas las transacciones, con filtros por cuenta, bote y fecha.
   - Formulario plegado para registrar movimientos manuales y botón para amortizar préstamos directamente.
5. **🏦 Cuentas y Tarjetas (`#/cuentas`)**:
   - **Cuentas y Depósitos**: Saldos reales de CaixaBank, Deutsche Bank, BBVA, Revolut y efectivo físico.
   - **Inversiones**: Registro de capital total aportado a carteras de inversión.
   - **Tarjetas Bancarias**: Tarjetas de crédito y débito con botón de liquidación de recibo.
   - **Tarjetas Regalo**: Control de saldo en tarjetas prepago (Amazon, Carrefour, ECI...).
6. **⋯ Extras (`#/extras`)**:
   - **Previsión Gastos Anuales (`#/prevision-gastos`)**: Planificador mensual de seguros, IBIs y tributos anuales.
   - **Categorías (`#/categorias`)**: Etiquetas analíticas con iconos vectoriales.
   - **Recibos Fijos / Domiciliaciones (`#/pagos-recurrentes`)**: Ejecución masiva mensual de recibos fijos del hogar.
   - **Copia de Seguridad (`#/copia-seguridad`)**: Exportación e importación en JSON y vaciado seguro.
   - **Importar Excel (`#/importar`)**: Carga de extractos y conciliación automática.

---

## 🚀 Cómo Poner en Marcha la Aplicación

### En Windows (Acceso en 1 Clic)
Haz doble clic sobre el archivo ejecutable en la raíz del proyecto:
```cmd
levantar.bat
```
El script levantará el servidor local y abrirá la aplicación en el puerto `8003`:
* **En el ordenador:** [http://127.0.0.1:8003](http://127.0.0.1:8003)
* **En el móvil o tablet (misma WiFi):** `http://TU_IP_LOCAL:8003` (la IP exacta se imprime en pantalla al arrancar).

### Desde la Terminal (PowerShell / Bash)
Requiere Python 3.11+ y el gestor de paquetes [`uv`](https://docs.astral.sh/uv/):
```bash
# 1. Sincronizar dependencias
uv sync

# 2. Aplicar migraciones a la base de datos SQLite
uv run alembic upgrade head

# 3. Iniciar el servidor
uv run python start_server.py
```

---

## 🧪 Calidad, Tests y Robustez

El software sigue el principio estricto de **Test-Driven Development (TDD)** para garantizar que ningún movimiento altere un céntimo de la contabilidad:

```bash
# Ejecutar toda la batería de tests unitarios, contratos API e integración
uv run pytest

# Verificación de sintaxis y buenas prácticas con Ruff
uv run ruff check .
```

* **167 tests en verde** (0 fallos).
* **88% de cobertura de código global** en servicios, modelos y endpoints.

---

## 📚 Documentación Adicional

* 📖 **[Guía de Uso para Nuevos Usuarios](file:///c:/Users/JAVIER/Documents/Programacion/App_Conta/docs/guia-de-uso.md)**: Manual amigable paso a paso para aprender a usar la app en 5 minutos.
* 📝 **[Bitácora de Desarrollo](file:///c:/Users/JAVIER/Documents/Programacion/App_Conta/docs/bitacora.md)**: Historial cronológico de cambios, decisiones de arquitectura y resolución de incidencias.
* 📊 **[Diseño Inicial y Modelo Contable](file:///c:/Users/JAVIER/Documents/Programacion/App_Conta/docs/diseno-inicial.md)**: Explicación forense de la hoja de cálculo original y su equivalencia en la app.
