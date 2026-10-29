# Implementation Plan: App_Conta MVP — Contabilidad del hogar por sistema de botes

**Branch**: `001-conta-mvp` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-conta-mvp/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

App_Conta MVP reproduce y sustituye la hoja CAJA del Excel OCTUBRE.xlsx: un sistema de
botes (sobres) donde el saldo de cada cuenta y de cada bote se deriva siempre de los
movimientos registrados, con pantalla de "disponible real" (saldos por cuenta, saldos por
bote y diferencia de conciliación), importación del histórico desde el Excel y copia de
seguridad. Enfoque técnico: backend Python que sirve una PWA local-first sobre SQLite,
con las reglas financieras (botes, conciliación) aisladas en servicios de dominio
cubiertos por tests.

## Technical Context

**Language/Version**: Python 3.11 (gestionado con uv)

**Primary Dependencies**: FastAPI + Uvicorn (API y servidor estático), SQLAlchemy 2.x
(ORM), Alembic (migraciones), openpyxl (importador XLSX), pytest + pytest-cov (tests)

**Storage**: SQLite (fichero local único; los importes monetarios se persisten como
enteros en céntimos — ver research.md D-01)

**Testing**: pytest — unitarios de dominio (≥95 % cobertura en servicios), integración de
API con TestClient, tests de aritmética monetaria con valores límite

**Target Platform**: Navegador moderno (PWA instalable en móvil y escritorio) sobre
Windows/macOS/Linux; proceso servidor local único

**Project Type**: Web application (single project: API + PWA servida por el mismo proceso)

**Performance Goals**: Pantalla de disponible real (<5 s desde apertura, normalmente
<1 s con ~10k movimientos); registro de movimiento <30 s percibido por el usuario

**Constraints**: 100 % offline tras instalación; cálculos monetarios sin errores de
redondeo; cero dependencias de servicios en la nube

**Scale/Scope**: 1 hogar, ~4.000-8.000 movimientos/año, 1 usuario concurrente, ~6
pantallas (disponible, movimientos, botes, cuentas, categorías, importar/exportar)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en el diseño | Estado |
|---|---|---|
| I. Correctitud del Dinero | Almacenamiento en céntimos enteros + `Decimal` en fronteras; redondeo explícito ROUND_HALF_UP; convención de signos única | ✅ |
| II. Integridad de Botes | Saldo de bote siempre derivado de movimientos; servicio de conciliación con informe de diferencia | ✅ |
| III. Test-First Reglas Financieras | Tareas ordenan tests antes que implementación; cobertura ≥95 % en servicios de dominio | ✅ |
| IV. Datos Primero | Alembic desde el primer commit; importador como único origen del histórico; ajustes auditables | ✅ |
| V. Local-First y Privacidad | SQLite local, service worker + manifest para offline, export/import de copia | ✅ |
| VI. Sencillez (YAGNI) | Un solo proceso, PWA sin framework de build, sin microservicios ni colas | ✅ |

**Resultado del gate**: sin violaciones. No se requiere Complexity Tracking.

**Re-check post-diseño (Fase 1)**: data-model, contratos y quickstart se han validado
contra los seis principios; sin cambios: los saldos siguen siendo derivados, el
importador no corrige datos y la PWA sigue siendo offline-first. Gate superado.

## Project Structure

### Documentation (this feature)

```text
specs/001-conta-mvp/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── rest-api.md
│   └── importador.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app_conta/                     # paquete Python de la aplicación
├── __init__.py
├── db.py                      # engine, sesión y dependencias FastAPI
├── models/                    # SQLAlchemy (Cuenta, Movimiento, Bote, Categoria, ...)
├── services/                  # reglas de dominio (único lugar con lógica financiera)
│   ├── dinero.py              # Decimal ↔ céntimos, redondeo, signos
│   ├── botes.py               # saldos, asignaciones, objetivos
│   ├── conciliacion.py        # disponible real y diferencia CAJA
│   ├── movimientos.py         # altas/ediciones con auditoría
│   └── importador/            # mapeo OCTUBRE.xlsx → entidades
├── api/                       # rutas FastAPI (sin lógica de negocio)
├── static/                    # PWA: index.html, app.js, styles.css,
│                              #       manifest.webmanifest, sw.js
└── main.py                    # crear app, montar estáticos, arrancar

migrations/                    # Alembic
└── versions/

tests/
├── unit/                      # servicios de dominio (dinero, botes, conciliación)
├── integration/               # dominio + SQLite real de pruebas
└── api/                       # TestClient sobre FastAPI

docs/                          # material de entrada (diseño inicial + Excel)
```

**Structure Decision**: Proyecto único (Opción 1 adaptada a aplicación web): un solo
proceso FastAPI sirve la API JSON y la PWA estática. La lógica financiera vive
exclusivamente en `services/`; `models/` define persistencia; `api/` solo orquesta. La
PWA usa HTML/CSS/JS sin framework de build (Principio VI) y se sirve desde
`app_conta/static/`.

## Complexity Tracking

Sin violaciones de la constitución: la tabla no aplica.
