# Flow — Finanzas Domésticas & Sistema de Botes Virtuales

<p align="center">
  <img src="app_conta/static/icons/icon-192.png" alt="Flow Logo" width="80" height="80" style="border-radius: 20px;" />
</p>

<p align="center">
  <strong>Plataforma moderna, local-first y elegante para el control contable del hogar, basada en el método de sobres virtuales con rigor contable céntimo a céntimo.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20ES%20Modules-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS" />
  <img src="https://img.shields.io/badge/Design-Glassmorphic%20Fintech-7C5CFF?style=flat-square" alt="Glassmorphism" />
  <img src="https://img.shields.io/badge/PWA-Offline%20Ready-5A0FC8?style=flat-square&logo=pwa" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/Tests-183%20passed-2ea44f?style=flat-square" alt="Tests 183 Passed" />
  <img src="https://img.shields.io/badge/Coverage-87%25-brightgreen?style=flat-square" alt="Coverage 87%" />
</p>

---

## 💡 ¿De qué va Flow?

**Flow** nace para solucionar el gran problema de las hojas de cálculo domésticas: las fórmulas se rompen, no hay trazabilidad histórica, las compras con tarjeta de crédito distorsionan la liquidez del banco y nunca se sabe exactamente cuánto dinero real queda para gastar en el día a día.

Flow implementa el **método de los sobres virtuales (*envelope budgeting*)** con una arquitectura contable de partida doble y saldos derivados:
* **El dinero físico y bancario real** (cuentas corrientes, efectivo, depósitos e inversiones) es la base de liquidez.
* **Ese dinero se reparte en "botes" o "sobres"** (*Dinero del Mes*, *Ocio*, *Bote Anual de Impuestos y Seguros*, *Ahorro Emergencias*, *Proyectos*).
* **Las compras diarias descuentan del sobre de gasto**, garantizando que nunca gastes el dinero destinado a la hipoteca o a las facturas venideras.
* **Cero desfases decimales:** Todos los cálculos internos operan en números enteros de céntimos para evitar errores de redondeo de punto flotante.

---

## ✨ Características Principales

### 1. 🎯 Método de Sobres & Botes Virtuales
* Creación de huchas de ahorro con objetivos temporales y presupuestos de gasto con saldo derivado de movimientos.
* Reasignación de fondos y control de desvíos en tiempo real con barras de progreso estilo fintech.

### 2. 💳 Tarjetas de Crédito y Aplazamiento Real
* Registra tus compras cotidianas en comercios y supermercados.
* El dinero se descuenta inmediatamente del sobre de gasto (ej. *Alimentación* o *Mes*), pero **no se deduce de la cuenta bancaria hasta que la tarjeta se liquida a final de mes o fecha de corte**.
* Muestra el gasto dispuesto en positivo como adelanto financiero temporal a liquidar en banco, sin alarmantes números rojos.

### 3. 💼 Reparto de Nóminas en 1 Clic
* Automatiza la distribución del sueldo mensual aplicando plantillas configurables en base de datos.
* Al aplicar la nómina, se abastecen los sobres, se provisiona la cuota mensual de recibos anuales y se amortizan préstamos de manera instantánea.

### 4. 📅 Previsión Anual de Recibos e Impuestos
* Planificador mensual de gastos fijos y tributos (IBI, basuras, seguros, sellos, colegios...).
* Calcula la cuota mensual exacta a apartar para que cuando llegue el recibo anual, el dinero ya esté disponible íntegramente en el sobre.

### 5. 🤝 "Me Deben" & Control de Préstamos
* Módulo especializado para gestionar dinero adelantado a familiares, compras conjuntas o gastos pendientes de reembolso con liquidación parcial.
* Seguimiento de financiaciones (vehículo, personal, hipotecas) con cálculo de amortización y barra de progreso.

### 6. ⚖️ Conciliación Matemática y Auditoría en Tiempo Real
* Servicio de conciliación continua que comprueba la identidad estructural:
  $$\text{Cuentas y Efectivo} + \text{Préstamos} + \text{Me Deben} + \text{Inversiones} \equiv \text{Botes} + \text{Tarjetas Pendientes}$$
* Semáforo vivo en la cabecera: **🟢 Contabilidad al día** (diferencia = 0,00 €).

### 7. 🛡️ Seguridad, Privacidad y Modo Demo Aislado
* **Multi-hogar:** Separación lógica total por `hogar_id`.
* **Modo Demo independiente:** Los usuarios demo interactúan con una base de datos ficticia aislada, sin acceso ni visibilidad alguna a las cuentas reales.
* **Copia de seguridad protegida:** Exportación en estándar abierto `.json` y restauración blindada con doble confirmación y validación de contraseña de usuario.
* **Sin dependencias externas invasivas:** Ni telemetría, ni conexiones a servidores de terceros. Tus finanzas se quedan en tu servidor o red local.

---

## 🏛️ Arquitectura del Sistema

```
                  ┌────────────────────────────────────────┐
                  │    PWA Frontend (Vanilla ES Modules)   │
                  │  Glassmorphism UI · Light & Dark Theme │
                  │     Service Worker Offline Shell       │
                  └───────────────────┬────────────────────┘
                                      │ REST API (JSON)
                                      ▼
                  ┌────────────────────────────────────────┐
                  │          FastAPI Backend (Python)      │
                  │  Auth JWT/Cookies · Multi-hogar RLS    │
                  │    Rate Limiting · Modelos Pydantic    │
                  └───────────────────┬────────────────────┘
                                      │ SQLAlchemy 2.0
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       SQLite en Modo WAL / Alembic     │
                  │     Saldos derivados en céntimos       │
                  │        (Sin desfase de float)          │
                  └────────────────────────────────────────┘
```

* **Frontend:** Vanilla JavaScript moderno modular (ES Modules), CSS nativo con variables de tema (Modo Claro de luz natural y Modo Noche Fintech), sin herramientas de empaquetado pesadas (sin webpack, sin node_modules, sin npm).
* **Backend:** FastAPI de alto rendimiento con validación estricta en esquemas Pydantic v2.
* **Persistencia:** SQLite optimizado con `WAL mode` y `PRAGMA foreign_keys = ON`, gestionado con migraciones de Alembic.

---

## 🚀 Puesta en Marcha Rápida

### Requisitos Previos
* **Python 3.11+**
* Gestor de paquetes ultrarrápido **[`uv`](https://docs.astral.sh/uv/)** (recomendado) o `pip`.

### Instalación Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/alzahira/flow_appConta.git
cd flow_appConta

# 2. Instalar dependencias con uv
uv sync

# 3. Ejecutar migraciones de la base de datos
uv run alembic upgrade head

# 4. Iniciar el servidor
uv run python start_server.py
```

La aplicación quedará disponible en:
* **Navegador web:** [http://127.0.0.1:8003](http://127.0.0.1:8003)
* **Dispositivos móviles en la misma WiFi:** `http://TU_IP_LOCAL:8003`

### En Windows (1 Clic)
Basta con ejecutar el archivo de arranque incluido:
```cmd
levantar.bat
```

### Despliegue con Docker / VPS
Incluye archivos de configuración listos para producción (`Dockerfile`, `docker-compose.yml`, plantilla de Nginx y guía de configuración con HTTPS / Let's Encrypt en la carpeta `deploy/`).

---

## 🧪 Batería de Pruebas y Cobertura

El proyecto se desarrolla bajo metodología guiada por pruebas rigurosas para proteger la exactitud de los saldos:

```bash
# Ejecutar los 183 tests unitarios, de integración y de seguridad
uv run pytest -q

# Análisis estático y linter con Ruff
uv run ruff check .
```

* **183 tests automatizados** cubriendo: conciliación matemática, inyección SQL, XSS, transacciones de tarjetas, amortizaciones, auth y aislamiento multi-hogar.
* **87% de cobertura global de código**.

---

## 📱 Instalación como PWA (App Móvil)

Flow está diseñado como una **Progressive Web App (PWA)** instalable:
1. Abre la URL en el navegador de tu móvil (Safari en iOS, Chrome en Android).
2. Pulsa en **Compartir / Opciones** → **"Añadir a la pantalla de inicio"**.
3. Se abrirá a pantalla completa como una app nativa, con navegación gestual y caché offline para arranques inmediatos.

---

## 📄 Licencia

Este proyecto está disponible bajo la licencia **MIT**. Siéntete libre de utilizarlo, adaptarlo y personalizarlo para la gestión de las finanzas de tu propio hogar.
