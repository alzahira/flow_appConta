# Research: App_Conta MVP

**Feature**: 001-conta-mvp | **Date**: 2026-10-13

## D-01: Representación de importes monetarios

- **Decision**: Persistir todos los importes como enteros en **céntimos** (BIGINT) y
  convertirlos a `Decimal` con dos decimales en la frontera (servicios/API). El redondeo
  al convertir es siempre explícito (`ROUND_HALF_UP`).
- **Rationale**: SQLite almacena valores con afinidad numérica como INTEGER o REAL; un
  REAL puede introducir errores de representación binaria que rompen la regla "céntimo a
  céntimo" de la constitución (Principio I). Los enteros son exactos y la conversión es
  única y centralizada.
- **Alternatives considered**:
  - `Numeric(12,2)` de SQLAlchemy sobre SQLite → afinidad NUMERIC que degrada a REAL en
    valores no enteros; riesgo de errores silenciosos.
  - Almacenar como TEXT de decimales → exacto pero inutiliza sumas/ordenaciones en SQL y
    complica los informes.

## D-02: Framework de frontend para la PWA

- **Decision**: PWA con HTML/CSS/JavaScript estándar (sin framework de build), un
  service worker en `static/` para caché offline y `manifest.webmanifest` para
  instalación.
- **Rationale**: Principio VI (Sencillez) y V (Local-First): ~6 pantallas con formularios
  y listas no justifican una cadena de build; menos dependencias = menos superficie de
  fallo y arranque inmediato desde el mismo proceso Python.
- **Alternatives considered**:
  - Vite + React → mejor para UIs complejas, pero introduce node, build step y muchas
    más dependencias para el alcance del MVP.
  - Plantillas Jinja renderizadas en servidor → se descarta: la app debe funcionar
    offline tras la primera carga (service worker sobre estáticos).

## D-03: Base de datos y migraciones

- **Decision**: SQLite como único almacén desde el día 1; esquema versionado con Alembic.
- **Rationale**: Principios IV y V: fichero local, backup trivial (copiar el .sqlite),
  sin servidor de BD que mantener. Alembic garantiza que el esquema evoluciona igual en
  móvil y escritorio.
- **Alternatives considered**:
  - PostgreSQL → solo si más adelante se comparte entre dispositivos; violaría el
    Principio VI para el alcance actual.
  - Sin migraciones (crear tablas al arrancar) → rechazado: rompe la trazabilidad de
    cambios de esquema y los datos existentes.

## D-04: Estructura de capas y ubicación de las reglas

- **Decision**: `services/` contiene TODA la lógica financiera (dinero, botes,
  conciliación, importador); `api/` solo valida entrada y llama a servicios; `models/`
  solo define persistencia.
- **Rationale**: Principios I-III: las reglas se testean de forma aislada sin HTTP ni BD,
  y los tests unitarios corren en milisegundos.
- **Alternatives considered**:
  - Lógica en rutas FastAPI → pruebas acopladas a HTTP y a la BD; rechazado.
  - Lógica en el cliente JS → el dinero no puede calcularse en dos sitios distintos;
    rechazado (riesgo de divergencia móvil/escritorio).

## D-05: Lectura del Excel de histórico

- **Decision**: Leer `docs/OCTUBRE.xlsx` con **openpyxl** (modo lectura, valores
  calculados cuando estén disponibles) en un módulo `services/importador/` que produce
  primero un **resumen** (cuentas, botes, movimientos, saldos detectados) y solo aplica
  cambios tras confirmación.
- **Rationale**: FR-009/FR-010 exigen resumen previo y detección de importación
  repetida; el Excel contiene errores (#REF!) y cifras manuales que deben marcarse
  "revisar" en lugar de recalcularse en silencio.
- **Alternatives considered**:
  - Reintroducir los datos a mano → rechazado: lento y repetiría los errores actuales.
  - Recalcular/arreglar los cálculos del Excel durante la importación → viola la
    especificación (los errores se importan como "revisar", no se corrigeen en
    silencio).

## D-06: Tests y estrategia de validación

- **Decision**: pytest con tres niveles: `tests/unit` (servicios puros, incl. casos de
  redondeo y signos), `tests/integration` (servicios contra SQLite temporal con Alembic
  aplicado), `tests/api` (TestClient de FastAPI). Cobertura ≥95 % obligatoria en
  `services/`.
- **Rationale**: Principio III: las reglas financieras (cuotas, botes, conciliación) son
  exactamente donde un bug cuesta dinero real al usuario.
- **Alternatives considered**:
  - Tests solo a nivel API → cobertura engañosa y fallos menos diagnósticos; rechazado.

## Resolución de unknowns

No quedan `NEEDS CLARIFICATION` en el Technical Context: todas las decisiones de stack
provienen de la constitución (v1.0.0) y de las asunciones de la especificación. Las dos
condiciones de contorno abiertas quedan documentadas como trabajo futuro, no como
unknowns: sincronización multi-dispositivo y fases 2-5 (recurrentes, hipotecas, nómina,
informes).
