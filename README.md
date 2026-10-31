# App_Conta — Finanzas del Hogar y Sistema de Botes

Aplicación web local-first para la gestión contable doméstica basada en el sistema de sobres/botes virtuales, diseñada para sustituir y automatizar hojas de cálculo complejas garantizando la integridad contable céntimo a céntimo (Principio de saldo derivado, almacenamiento en céntimos y cero pérdida de precisión decimal).

---

## Estructura de la Aplicación

La navegación principal organiza el flujo financiero en **5 secciones maestras sin saturación ni barras de desplazamiento**, complementadas con botones de acción rápida `[ ➕ Ingreso ]` y `[ ➖ Gasto ]` en la cabecera:

1. **📊 Resumen (`#/inicio`)**: Panel de control con el **Dinero disponible** (suma total de efectivo en caja + cuentas bancarias), desglose explícito de **Dinero en caja** (estrictamente dinero efectivo físico) y **Dinero en bancos** (cuentas corrientes y depósitos), indicador vivo de cuadre contable (🟢 Cuadrado / 🔴 Revisar), métricas globales de botes y tabla de conciliación analítica.
2. **🏦 Cuentas y Tarjetas (`#/cuentas`)**: Hub financiero integral que agrupa todas tus cuentas y plásticos mediante una barra de píldoras secundaria:
   - **Cuentas y Depósitos**: Visión agrupada por entidad (**Caixa**, **Deutsche Bank**, **BBVA**, **Revolut** y **Otros**).
   - **Inversiones**: Patrimonio neto invertido (fondos indexados, acciones/ETFs, renta fija, pensiones, cripto) con plusvalías y ROI % ponderado.
   - **Tarjetas Bancarias**: Tarjetas de crédito y débito bancarias con control de deuda o saldo disponible.
   - **Tarjetas Regalo**: Dinero en tarjetas prepago y regalo (**Amazon**, **El Corte Inglés**, **Carrefour**, etc.).
   - **Gastos Tarjetas**: Registro detallado de compras por tarjeta.
3. **🎯 Ahorro y Botes (`#/ahorro`)**: Centro de planificación y previsión del hogar:
   - **Fondos de Ahorro e Hipotecas**: Reserva para pagar hipotecas a futuro, amortizaciones de préstamo y colchón de seguridad, con extracto individual de movimientos.
   - **Sobres y Botes**: Sobres virtuales con extracto detallado de aportaciones y gastos separados.
   - **Previsión Gastos Anuales**: Planificación homogénea en cuotas fijas mensuales de tributos, seguros y recibos periódicos del hogar (IBIs, basuras, seguros de hogar y vehículos) con control de meses provistos y facturas reales cobradas.
   - **Dinero que me deben**: Control de préstamos a terceros, dinero adelantado, estados de cobro y registro de devoluciones automáticas en cuenta.
4. **📝 Movimientos (`#/movimientos`)**: Historial general cronológico de flujos de caja con chips de botes/categorías y opción de borrado.
5. **⋯ Más**: Menú desplegable flotante con las herramientas avanzadas:
   - **Pagos Recurrentes / Domiciliaciones**: Gestión de los 12 recibos domiciliados mensuales (hipotecas, comunidades, suministros) organizados por banco (Caixa: 526 € / Deutsche Bank: 548 €) con ejecución en un solo clic.
   - **Reparto de Nómina**: Motor de plantillas multi-banco para automatizar la distribución de nóminas y alquileres hacia cuentas y sobres (incluyendo deducciones internas como aporte desde Paro a Hipotecas).
   - **Categorías**: Clasificación analítica de gastos e ingresos con códigos de color e iconos.
   - **Copia de Seguridad**: Exportación/importación completa en formato JSON y vaciado seguro de la base de datos.
   - **Importar Excel**: Conciliación e importación de extractos bancarios.

---

## Cómo Arrancar la Aplicación

### En Windows (Acceso Rápido)
Haz doble clic sobre el script de inicio en la carpeta raíz:
```cmd
levantar.bat
```
El script levantará el servidor automáticamente en el puerto `8003` y mostrará:
* **En el PC:** `http://127.0.0.1:8003`
* **En móviles / tablets (misma WiFi):** `http://TU_IP_LOCAL:8003` (la IP local se imprime en la consola al arrancar).

### Desde la Terminal
Requiere Python 3.11+ y [`uv`](https://docs.astral.sh/uv/):
```bash
# Sincronizar dependencias
uv sync

# Aplicar migraciones sobre la base de datos local
uv run alembic upgrade head

# Arrancar el servidor
uv run uvicorn app_conta.main:app --host 0.0.0.0 --port 8003
```

---

## Tests y Calidad

El proyecto aplica TDD riguroso en todas las reglas financieras (Constitución, Principio III):
```bash
# Ejecutar toda la suite de tests (unitarios, contratos API e integración)
uv run pytest

# Verificación de estilo y formateo con Ruff
uv run ruff check .
```

* Estado actual: **158 tests en verde** (0 fallos).
* Cobertura de tests: **88% global** en todo el backend y lógica contable.


---

## Documentación del Proyecto

* **[docs/bitacora.md](file:///c:/Users/JAVIER/Documents/Programacion/App_Conta/docs/bitacora.md)**: Diario cronológico de sesiones de trabajo, decisiones arquitectónicas y resolución de incidencias.
* **[docs/diseno-inicial.md](file:///c:/Users/JAVIER/Documents/Programacion/App_Conta/docs/diseno-inicial.md)**: Análisis forense del Excel `OCTUBRE.xlsx`, mapa de las 14 hojas y reglas de negocio del hogar.
* **[.specify/memory/constitution.md](file:///c:/Users/JAVIER/Documents/Programacion/App_Conta/.specify/memory/constitution.md)**: Principios no negociables del proyecto (precisión monetaria, integridad de botes, TDD, datos primero).
* **[specs/001-conta-mvp/](file:///c:/Users/JAVIER/Documents/Programacion/App_Conta/specs/001-conta-mvp/)**: Especificación formal de historias de usuario, modelo de datos relacional, contratos REST y plan de tareas.
