# Tasks: App_Conta MVP — Contabilidad del hogar por sistema de botes

**Input**: Design documents from `/specs/001-conta-mvp/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: La constitución (Principio III) hace obligatorio TDD en las reglas financieras, por lo que todas las fases incluyen tareas de test escritas ANTES de implementar.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `app_conta/` (paquete) + `tests/` at repository root (ver plan.md, Structure Decision)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project structure per implementation plan: carpetas `app_conta/{models,services,api,static/js/views}`, `migrations/versions`, `tests/{unit,integration,api}` e `git init` en la raíz del proyecto
- [X] T002 Initialize Python 3.11 project with `uv init` + `uv add fastapi uvicorn sqlalchemy alembic openpyxl python-multipart` + `uv add --dev pytest pytest-cov httpx ruff` (pyproject.toml en raíz)
- [X] T003 [P] Configure ruff (lint + format) in pyproject.toml y pytest config (testpaths=`tests`, `--cov=app_conta --cov-report=term-missing`)
- [X] T005 [P] Create `.gitignore` (excluir `.opencode/`, `__pycache__/`, `*.sqlite3`, `.venv/`, `.coverage`, `htmlcov/`)
- [X] T005 [P] Create seed de migración vacío: verificar `uv run alembic init migrations` con `env.py` apuntando a `app_conta/db.py`

**Checkpoint**: Proyecto arrancable con `uv run pytest` ejecutándose (sin tests aún).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Implement `app_conta/db.py`: engine SQLite (`app_conta/conta.db`), `SessionLocal`, `Base` declarativa y dependencia `get_db` para FastAPI
- [X] T007 [P] Write unit tests for money arithmetic in `tests/unit/test_dinero.py`: conversión euros↔céntimos (ROUND_HALF_UP), importe `"0.00"` rechazado, signos gasto/ingreso, importes con >2 decimales
- [X] T008 Implement `app_conta/services/dinero.py` per research.md D-01 (enteros en céntimos; `Decimal` en fronteras; `ROUND_HALF_UP` explícito) — debe hacer pasar T007
- [X] T009 Create todos los modelos del MVP per data-model.md en `app_conta/models/` (un fichero por entidad: `hogar.py`, `cuenta.py`, `categoria.py`, `bote.py`, `movimiento.py`, `auditoria.py`; SIN `persona.py` — fuera del MVP, ver nota en data-model.md), respetando: enums (`banco|tarjeta|efectivo|inversion`; `recurrente|ahorro|proyecto|ajeno`; `manual|importacion`; `creado|editado|eliminado|reasignado`), unicidad de nombre por hogar en Cuenta/Categoria/Bote, `importe_centimos != 0`, flags `marcar_revisar`/`motivo_revision`/`origen`/`eliminado`
- [X] T010 Create Alembic baseline migration `migrations/versions/52cd663949d8_baseline_entidades_del_mvp.py` con TODAS las entidades del data-model (verificable desde BD vacía)
- [X] T011 [P] Implement `app_conta/api/errors.py`: handler de errores con formato `{ "error": { "codigo", "mensaje" } }` y mapeo 400/404/409 (ver contracts/rest-api.md, sección Errores)
- [X] T012 [P] Create `app_conta/main.py`: app FastAPI, montaje de `app_conta/static`, `include_router` futuro bajo `/api/v1` (auto-registro de routers existentes), healthcheck, y **seed al arranque**: si no existe ninguna fila Hogar, crear el Hogar único ("Hogar") del que cuelgan todos los FK
- [X] T013 [P] Create PWA shell: `app_conta/static/index.html`, `static/styles.css`, `static/js/api.js` (cliente fetch con importes en string), `static/js/app.js` (router de vistas), `static/manifest.webmanifest`, `static/sw.js` (caché offline básica)
- [X] T014 Create `tests/conftest.py`: fixture de BD SQLite temporal con migraciones aplicadas + `TestClient` de FastAPI + fixture `hogar`
- [X] T015 Integration test smoke: `tests/integration/test_arranque.py` — levantar migraciones desde BD vacía y crear las 7 entidades del modelo (gate del Principio IV) — ✅ VERDE: 23 tests passing en la sesión anterior

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 2 - Registrar cuentas y movimientos (Priority: P1)

**Goal**: Alta de cuentas (banco/tarjeta/efectivo/inversión) y registro de ingresos/gastos; el saldo de cada cuenta se calcula solo desde movimientos.

**Independent Test**: Crear cuenta con saldo inicial, añadir tres movimientos vía API y comprobar que el saldo mostrado = inicial + ingresos − gastos (céntimo a céntimo, SC-003).

### Tests for User Story 2 ⚠️ (escribir PRIMERO, deben fallar)

- [X] T016 [P] [US2] Unit tests saldo de cuenta: suma con signos mixtos, cuenta sin movimientos = saldo inicial, movimiento con `importe_centimos = 0` rechazado (coverage T007/T008)
- [X] T017 [P] [US2] Contract tests endpoints `/api/v1/cuentas` y `/api/v1/movimientos` in `tests/api/test_cuentas_movimientos.py` per contracts/rest-api.md (CRUD, PATCH, DELETE con 409) — ✍️ escritos 2026-10-28, FALLANDO como corresponde (endpoints sin implementar)
- [X] T018 [P] [US2] Integration test `tests/integration/test_us2_flujo.py`: crear cuenta → 3 movimientos → saldo correcto → editar movimiento → saldo recalculado → auditoría registrada — ✍️ escritos 2026-10-28, FALLANDO como corresponde

### Implementation for User Story 2

- [ ] T019 [US2] Implement `app_conta/services/movimientos.py`: alta con validación (cuenta existente, `importe_centimos != 0` por T008), edición con auditoría (`creado|editado|eliminado`), borrado lógico, cálculo de saldo de cuenta (solo derivado — Principio II)
- [ ] T020 [P] [US2] Implement `app_conta/api/cuentas.py`: GET/POST/PATCH/DELETE `/api/v1/cuentas` (DELETE con `?confirmar_destino=archivar|eliminar_movimientos`, 409 si tiene movimientos activos)
- [ ] T021 [P] [US2] Implement `app_conta/api/movimientos.py`: GET con filtros (desde/hasta/cuenta/bote/categoria) + paginación, POST, PATCH, DELETE per contracts/rest-api.md
- [X] T022 [P] [US2] Create PWA views `static/js/views/cuentas.js` (lista con saldo) y `static/js/views/movimientos.js` (listado + formulario de alta con validación numérica, FR-014) — ✅ 2026-10-28: rejilla de tarjetas de cuenta con icono/tipo/saldo, tabla de movimientos con fechas cortas, importes coloreados, filtros posteriores; alta con segmented control gasto/ingreso (JS formatea "−30,50" → "-30.50")
- [X] T023 [US2] Wire vistas en `static/js/app.js` y ejecutar T016-T018 hasta verde — ✅ 2026-10-28: router ES-modules (`vistas.js` registro compartido + `nav.js` tabs), delegación única de eventos (submit/click), "cargar más" con offset; **45 tests en verde** (23 previos + 20 contract US2 + 2 edge auditoría/uso). Pendiente el gate final: ruff limpio tras formateo + cobertura ≥95 % `services/` (T060)

**Checkpoint**: US2 funcional — cuentas y movimientos operan solos (MVP core).

---

## Phase 4: User Story 1 - Ver el disponible real (Priority: P1) 🎯 MVP

**Goal**: Pantalla principal con saldos por cuenta, totales, movimientos sin asignar y diferencia de conciliación (equivalente hoja CAJA). Los botes se muestran vacíos hasta US3 (degradación graceful).

**Independent Test**: Con cuentas/movimientos de US2, `GET /api/v1/conciliacion` devuelve saldos por cuenta, `sin_asignar` y `diferencia` correctos; estado `cuadrado` cuando diferencia = 0.

### Tests for User Story 1 ⚠️ (escribir PRIMERO, deben fallar)

- [X] T024 [P] [US1] Unit tests `tests/unit/test_conciliacion.py`: sin movimientos → diferencia 0 → `cuadrado`; con movimientos sin asignar → siguen cuadrados (`sin_asignar` informativo); con desfase → diferencia ≠ 0 → `revisar`; saldos con signos mixtos (céntimo a céntimo, SC-003) — ✅ 7 tests (el desfase se simula con bote archivado; desfase real llega con US5)
- [X] T025 [P] [US1] Contract test `tests/api/test_conciliacion.py`: GET `/api/v1/conciliacion` con forma del contrato (`fecha_calculo`, `saldo_total_cuentas`, `saldo_total_botes`, `sin_asignar`, `diferencia`, `estado`) — ✅ 2 tests
- [X] T026 [P] [US1] Integration test `tests/integration/test_us1_pantalla.py`: escenario 2-4 de quickstart.md (cuenta 1000, gastos −30,50 y −12) → totales y diferencia exactos

### Implementation for User Story 1

- [X] T027 [US1] Implement `app_conta/services/conciliacion.py` per FR-007 y fórmula corregida del data-model (`diferencia = saldo_total_cuentas − saldo_inicial_total − (saldo_total_botes + sin_asignar)`; `sin_asignar` = movimientos con `bote_id` null; `sin_asignar` NO rompe la conciliación) — ✅ SOLO LEE; el desfase real detectado por el importador (US5) o botes archivados con movimientos generan `revisar`
- [X] T028 [P] [US1] Implement `app_conta/api/conciliacion.py`: GET `/api/v1/conciliacion` — ✅ importes string de euros
- [X] T029 [P] [US1] Create PWA view `static/js/views/inicio.js`: bloque "Disponible real" (saldos por cuenta, sin asignar, diferencia con badge cuadrado/revisar, objetivo SC-001 <5 s) — ✅ tarjeta con badge 🟢/🔴 + rejilla de cuentas + detalle del cuadre
- [X] T030 [US1] Wire vista inicio en `static/js/app.js` y T024-T026 en verde — ✅ **55 tests + ruff limpio; verificado en vivo (969.50/1000.00/−30.50/0.00 cuadrado)**

**Checkpoint**: US1 + US2 = incremento MVP utilizable (equivalente hoja CAJA sin botes). ✅ ALCANZADO 2026-10-28

---

## Phase 5: User Story 3 - Gestionar botes y asignar dinero (Priority: P1)

**Goal**: Botes con saldo derivado (recurrente/ahorro/proyecto/ajeno), asignación y reasignación de movimientos, objetivo opcional con estado conseguido.

**Independent Test**: Crear dos botes, asignar movimientos y reasignar uno; saldos de ambos exactos; bote con objetivo alcanzado marcado `conseguido`.

### Tests for User Story 3 ⚠️ (escribir PRIMERO, deben fallar)

- [X] T031 [P] [US3] Unit tests `tests/unit/test_botes.py`: saldo = suma de movimientos asignados; reasignación actualiza ambos botes; objetivo alcanzado → estado; nombre duplicado en el hogar rechazado (unique per data-model) — ✅ 8 tests (incluye edge bote negativo visible, tipos inválidos y archivado que libera movimientos)
- [X] T032 [P] [US3] Contract tests `tests/api/test_botes.py`: CRUD `/api/v1/botes` + PATCH `/api/v1/movimientos/{id}/bote` (cuerpo `{ "bote_id": "uuid|null" }`) per contracts/rest-api.md
- [X] T033 [P] [US3] Integration test `tests/integration/test_us3_flujo.py`: crear 2 botes → asignar 3 movimientos → saldos → reasignar 1 → auditoría `reasignado` → bote negativo mostrado sin bloqueo (edge case)

### Implementation for User Story 3

- [X] T034 [US3] Implement `app_conta/services/botes.py`: CRUD con validación de nombre único por hogar, saldo derivado (nunca editable — Principio II), estado `conseguido` cuando `saldo >= objetivo`, reasignación con auditoría (`reasignado`) y recálculo de ambos botes; debe hacer pasar T031 — ✅ + estado `conseguido` con objetivo negativo (presupuesto agotado `saldo <= objetivo`); flush explícitos por `autoflush=False`
- [X] T035 [P] [US3] Implement `app_conta/api/botes.py`: GET/POST/PATCH/DELETE `/api/v1/botes` (DELETE archiva; movimientos pasan a "sin asignar" con confirmación `?confirmar=true`, 409 sin ela) — ✅
- [X] T036 [P] [US3] Extend `app_conta/api/movimientos.py` con PATCH `/api/v1/movimientos/{id}/bote`
- [X] T037 [P] [US3] Create PWA views `static/js/views/botes.js` (lista con saldo/objetivo/estado + barra de progreso) y asignación de bote en `static/js/views/movimientos.js` — ✅ selector de bote en el alta y por fila (change delegado en app.js)
- [X] T038 [US3] Extend `static/js/views/inicio.js` para mostrar saldos por bote en la pantalla de disponible real; ejecutar T031-T033 hasta verde — ✅ **77 tests verdes + ruff limpio; verificado en vivo (bote 30.00/60.00 en_curso, conciliación cuadrada con botes)**

**Checkpoint**: Las 3 historias P1 funcionan — la app reproduce el sistema de botes básico del Excel. ✅ ALCANZADO 2026-10-28

---

## Phase 6: User Story 4 - Categorizar gastos e ingresos (Priority: P2)

**Goal**: CRUD de categorías con color, totales por categoría y periodo, borrado protegido.

**Independent Test**: Crear categoría, asignarla a varios movimientos, consultar total del periodo; intentar borrar una categoría en uso.

### Tests for User Story 4 ⚠️

- [X] T039 [P] [US4] Unit tests `tests/unit/test_categorias.py`: total por categoría y periodo con signos mixtos; borrado de categoría en uso rechazado con lista de movimientos afectados — ✅ 10 tests (activas ordenadas por nombre, unique por hogar, validación de nombre/color, totales sin periodo/con periodo, borrado protegido con recuento y confirmado libera movimientos)
- [X] T040 [P] [US4] Contract tests `tests/api/test_categorias.py`: CRUD `/api/v1/categorias` + totales vía `GET /api/v1/categorias?desde=&hasta=` (DELETE → 409 salvo `?confirmar=true`) — ✅ 8 tests (201/409 dup, totales por periodo, detalle con recuento, PATCH ignora derivados, 409→204, 204 directo)

### Implementation for User Story 4

- [X] T041 [US4] Implement `app_conta/services/categorias.py`: alta/edición/archivado (borrado lógico), total por periodo, protección de borrado con recuento de movimientos afectados
- [X] T042 [P] [US4] Implement `app_conta/api/categorias.py` per contracts/rest-api.md
- [X] T043 [P] [US4] Create PWA view `static/js/views/categorias.js` (lista con totales del periodo) y selector de categoría en el formulario de movimientos — ✅ también selector por fila (PATCH /movimientos/{id} al cambiarlo), alta con `type=color`, edición vía prompt y borrado con confirmación al recibir 409
- [X] T044 [US4] Ejecutar T039-T040 hasta verde — ✅ 18 tests US4 verdes; suite completa 121 passed, ruff check+format limpios, coverage 94%

**Checkpoint**: US4 funcional e independiente.

---

## Phase 7: User Story 5 - Importar el histórico desde OCTUBRE.xlsx (Priority: P2)

**Goal**: Previsualizar y aplicar importación del Excel con resumen, avisos de filas dudosas (#REF! → "revisar") y detección de importación repetida.

**Independent Test**: Previsualizar `docs/OCTUBRE.xlsx`, revisar resumen, aplicar; segunda previsualización del mismo fichero marca `repetido: true`.

### Tests for User Story 5 ⚠️

- [X] T045 [P] [US5] Unit tests `tests/unit/test_importador_mapeo.py`: mapeo hoja→entidad per contracts/importador.md (tarjetas→movimientos, fianzas→bote `ajeno`, AHORROS con motivos), normalización de signos, redondeo >2 decimales con aviso, fila `#REF!` → `marcar_revisar` — ✅ 19 tests sobre hojas sintéticas (los `#REF!` sin importe fiable producen aviso, no movimiento: no hay cifra que no se pueda verificar)
- [X] T046 [P] [US5] Integration test `tests/integration/test_importador.py` con `docs/OCTUBRE.xlsx` real: previsualizar → resumen coherente (20 cuentas / 28 botes / 215 movimientos) → aplicar → saldos por bote coinciden con el Excel (Coche −8052.06, Fondo hipotecas 8083.00, extras 81.00, gastos 2026 −119.08; grupos SC-004 con diferencia "0.00"; la dif. del sueldo de M.José (360.00 = 40€/mes de gasolina del Excel) se lista honesta) → repetido detectado por huella (FR-010) → conciliación `cuadrado` 0.00
- [X] T047 [P] [US5] Contract tests `tests/api/test_importacion.py`: `/importacion/previsualizar`, `/importacion/aplicar` (con `?confirmar_repetido=true`), `/importacion/historial` — ✅ 4 tests

### Implementation for User Story 5

- [X] T048 [P] [US5] Implement `app_conta/services/importador/lector.py`: lectura con openpyxl (read_only + data_only) de las 14 hojas + huella sha256 del fichero
- [X] T049 [P] [US5] Implement `app_conta/services/importador/mapeo.py`: mapeo completo per contracts/importador.md (tabla hoja→entidad, reglas del importador: sin recalcular, signos, céntimos ROUND_HALF_UP con aviso agregado por hoja, categorías derivadas, comparativa de saldos por grupos, huella) — decisión de diseño: los saldos por cuenta del Excel son el estado FINAL del mes (van a `saldo_inicial`) y el histórico reconstruido vive en la cuenta "Historial Excel (importación)"; el detalle de recibo de tarjetas va a su cuenta de tarjeta. (Regla 7 de transferencias espejo: no hay transferencias dentro del mes en el fichero real — queda para cuando aparezcan)
- [X] T050 [US5] Implement `app_conta/models/importacion.py` + migración `3f5c0c9f1a10` (huella indexada, NO unique: la confirmación de repetido crea un 2º registro) e `app_conta/api/importacion.py`: previsualizar (resumen + avisos + diferencias_conciliacion, sin tocar BD), aplicar (reutiliza elementos con mismo nombre; movimientos con `origen="importacion"`), historial (FR-009/FR-010)
- [X] T051 [P] [US5] Create PWA view `static/js/views/importar.js`: subida del fichero, resumen con cuadre SC-004 y avisos, botón aplicar con confirmación de repetido (confirm + `?confirmar_repetido=true`), historial — registrada en `app.js`
- [X] T052 [US5] Ejecutar T045-T047 hasta verde contra `docs/OCTUBRE.xlsx` — ✅ 26 tests nuevos; suite completa 103/103, ruff limpio, cobertura 94%

**Checkpoint**: US5 funcional — el histórico real está dentro de la app (SC-004).

---

## Phase 8: User Story 6 - Copia de seguridad (Priority: P3)

**Goal**: Exportar e importar copia completa (JSON único) con restauración verificable.

**Independent Test**: Exportar, restaurar en instalación limpia, saldos idénticos (SC-006).

### Tests for User Story 6 ⚠️

- [ ] T053 [P] [US6] Integration test `tests/integration/test_backup.py`: exportar → JSON con cuentas/movimientos/categorías/botes → restaurar en BD nueva → saldos idénticos

### Implementation for User Story 6

- [ ] T054 [US6] Implement `app_conta/services/backup.py`: exportación JSON completa + restauración transaccional con validación previa (rechaza fichero ajeno)
- [ ] T055 [P] [US6] Implement `app_conta/api/backup.py`: GET `/api/v1/backup/exportar`, POST `/api/v1/backup/restaurar` (confirmación obligatoria)
- [ ] T056 [P] [US6] Create PWA view `static/js/views/ajustes.js`: botones exportar/restaurar con confirmación
- [ ] T057 [US6] Ejecutar T053 hasta verde

**Checkpoint**: US6 funcional e independiente.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T058 [P] Verify offline PWA: `static/sw.js` cachea app shell + assets; probar en modo avión que registrar movimiento y ver disponible funcionan (SC-005)
- [ ] T059 [P] Document operation in `README.md`: arranque, migraciones, backup (fichero .sqlite) y ejecución de quickstart.md
- [ ] T060 Run full quality gate: `ruff check`, `pytest` con cobertura ≥95 % en `app_conta/services/` (Principio III), corregir hallazgos
- [ ] T061 Run quickstart.md validation end-to-end (secciones 1-7) y registrar resultados
- [X] T062 [P] Seed script `app_conta/scripts/seed_demo.py` (opcional) con datos de demostración para pruebas de usuario

---

## Phase 10: Acceso multi-dispositivo (adenda del 2026-10-28)

**Requisito real del usuario** (no estaba en el spec original): la app debe poder
usarse desde el móvil del marido, el móvil de la mujer y el portátil, **compartiendo
la misma contabilidad del hogar**.

- [X] T063 Acceso LAN: `app_conta.main.run()` escucha en `0.0.0.0` (configurable con
  `APP_CONTA_HOST`/`APP_CONTA_PORT`) e imprime en el arranque la URL con la IP local
  para los móviles; `levantar.bat` e `iniciar_servidor.bat` actualizados con
  `--host 0.0.0.0` y mensajes. Verificada la respuesta de `/health` con binding 0.0.0.0.
- [ ] T064 PWA instalable en móviles con HTTPS local: los service workers exigen
  contexto seguro (`https` o `localhost`), así que en un móvil vía `http://IP:8000`
  la app funciona como web normal pero sin offline/install. Añadir certificado
  autofirmado (generación + arrastre a uvicorn `--ssl-*` o `mkcert`) y guía de
  instalación por dispositivo (Android/iOS) en README.
- [ ] T065 Documentar en README el flujo multi-dispositivo: arrancar servidor,
  IP local, primer uso en móvil (aceptar firewall), y qué pasa con el PC apagado.

---

## Phase 11: Despliegue en VPS (decisión del 2026-10-28 — opción C. Nube)

**Requisito**: la app debe usarse con el portátil apagado. Decisión del usuario:
**VPS en la nube** (~3-6 €/mes, accesible desde cualquier sitio, no solo la WiFi
del hogar). La preparación se hace AL FINAL del MVP (tras T060-T061): primero la
app en verde, luego el despliegue.

- [ ] T066 Elegir VPS + dominio: Hetzner/OVH/Scaleway (~4 €/mes; 1 vCPU y 1 GB
  sobra para 1 hogar con ~8k movimientos/año); dominio barato (~10 €/año) o
  DuckDNS gratis para probar sin dominio. Registrar la elección final aquí.
- [ ] T067 Empaquetar: Dockerfile (uv + FastAPI + volumen persistente para el
  .sqlite) o systemd unit simple; `APP_CONTA_DB` apuntando al volumen; arranque
  con `run()`.
- [ ] T068 HTTPS + reverse proxy: Caddy con Let's Encrypt (renovación automática)
  — resuelve de paso el problema de service workers (T064): PWA instalable y
  offline en los móviles.
- [ ] T069 Seguridad: al estar en internet abierta, añadir acceso simple (PIN o
  token compartido del hogar con cookie de sesión) — mínimo viable, sin
  contraseñas por usuario (YAGNI); 2FA real queda para fase posterior.
- [ ] T070 Backup remoto: cron diario que copia el fichero .sqlite y guía de
  restauración (enlaza con US6).
- [ ] T071 Runbook en README: provisionar el VPS, DNS, despliegue, firewall,
  actualizaciones (`git pull` + rebuild) y migración del `conta.db` actual del
  PC al VPS.

**Nota**: la constitución del MVP decía "cero dependencias de servicios en la
nube" (local-first). Con esta decisión del usuario se ajusta: la base de datos
SIGUE siendo un único fichero SQLite autoalojado (los datos nunca van a un
SaaS); solo cambia la máquina donde vive el proceso. Documentado como adenda.

**Nota de arquitectura**: NO hay usuarios ni cuentas de acceso en el MVP (YAGNI,
Principio VI): dos personas abren la misma app y ven el mismo Hogar. La entidad
`Persona` (nóminas por persona) sigue planificada para la fase 4 de la feature
de nómina, separada de este requisito de acceso físico multi-dispositivo.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US2 (P1, Phase 3)**: tras Foundacional — sin dependencias; es la base de datos (cuentas/movimientos)
- **US1 (P1, Phase 4)**: tras Foundacional; **necesita US2** (la conciliación lee movimientos/saldos). Se implementa después de US2 aunque ambos sean P1 — orden de entrega por dependencia real de datos
- **US3 (P1, Phase 5)**: tras US2 (asigna movimientos a botes); extiende la pantalla de US1
- **US4 (P2, Phase 6)**: independiente tras US2 (categorías sobre movimientos)
- **US5 (P2, Phase 7)**: tras US2+US3 (importa cuentas, movimientos y botes; compara saldos)
- **US6 (P3, Phase 8)**: independiente tras Foundacional (exporta lo existente)

### Within Each User Story

- Tests escritos primero DEBEN fallar antes de implementar (Principio III)
- Models before services; services before endpoints; endpoints before PWA wiring
- Cada historia se valida en su checkpoint antes de seguir

### Parallel Opportunities

- T003-T005 (Setup) en paralelo
- T007/T011/T012/T013 (Foundacional) en paralelo tras T006
- Tests de una historia marcados [P] se escriben en paralelo
- T020/T021/T022 (US2) en paralelo tras T019; T028/T029 (US1) en paralelo tras T027; T035/T036/T037 (US3) tras T034
- US4 y US6 pueden trabajar en paralelo una vez US2 está verde

---

## Parallel Example: User Story 2

```bash
# Escribir todos los tests de US2 juntos (deben fallar):
Task: "Unit tests saldo de cuenta in tests/unit/test_saldos_cuenta.py"
Task: "Contract tests endpoints cuentas/movimientos in tests/api/test_cuentas_movimientos.py"

# Tras T019 (servicio), implementar en paralelo:
Task: "API cuentas in app_conta/api/cuentas.py"
Task: "API movimientos in app_conta/api/movimientos.py"
Task: "Vistas PWA en static/js/views/cuentas.js y movimientos.js"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3, todas P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: US2 (cuentas y movimientos)
4. Complete Phase 4: US1 (disponible real) y Phase 5: US3 (botes)
5. **STOP and VALIDATE**: quickstart.md secciones 1-4 + gate de calidad
6. Demo: la app ya sustituye el uso diario de la hoja CAJA

### Incremental Delivery

1. Setup + Foundational → base lista
2. US2 → movimientos operativos
3. US1 → pantalla CAJA 🎯
4. US3 → sistema de botes completo
5. US4 → control por categorías
6. US5 → histórico del Excel dentro
7. US6 → copias de seguridad

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group (git se inicializa en T001)
- Convención de importes: string `"-30.50"` en API/JSON, céntimos enteros en BD (research.md D-01)
- Nunca editar saldos a mano: siempre derivados de movimientos (Principio II)
