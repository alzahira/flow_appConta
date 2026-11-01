# Bitácora de desarrollo — App_Conta MVP

Registro cronológico de sesiones de trabajo, decisiones y estado de tests.
Las tareas de referencia remiten a [`specs/001-conta-mvp/tasks.md`](../specs/001-conta-mvp/tasks.md).

---

## Sesión del 2026-10-28

### Punto de partida

- Sesión anterior: Fases 1 (Setup) y 2 (Fundacional) completas — T001…T015.
  - Estado verificado: todos los ficheros fundacionales creados (`db.py`,
    `services/dinero.py`, 6 modelos, migración baseline de Alembic
    `52cd663949d8`, handler de errores con formato común, `main.py` con seed
    del Hogar único y auto-registro de routers, shell PWA, conftest).
  - 23 tests en verde (`uv run pytest`).

### Trabajo realizado (Fase 3 — US2: cuentas y movimientos)

1. **T016** (estado): los unit tests de aritmética de importes ya existen en
   `tests/unit/test_dinero.py` (T007). Los tests de saldo por cuenta quedan
   cubiertos vía los contract/integration de US2 (se añadirán unit tests de
   saldo si el coverage de `services/` lo exige en T060).
2. **T017** — `tests/api/test_cuentas_movimientos.py` (contract tests):
   - Cuentas: POST 201 con saldo derivado, 400 tipo inválido, 409 nombre
     duplicado por hogar, GET lista con `items` + `total`, GET detalle con
     movimientos, 404 inexistente, PATCH de campos no derivados (y `saldo`
     ignorado — Principio II), DELETE sin movimientos 204, DELETE con
     movimientos 409 y con `?confirmar_destino=archivar` 204.
   - Movimientos: POST 201 formato contrato (importe string con signo,
     `origen=manual`), `0.00` → 400, formato no numérico → 400, cuenta
     inexistente → 404, GET con filtros (`desde`/`hasta`/`cuenta`) y
     paginación (`limit`), PATCH edita, PATCH `0.00` → 400, DELETE borrado
     lógico (desaparece del listado).
3. **T018** — `tests/integration/test_us2_flujo.py`:
   - Flujo completo: cuenta con 1000.00 € → 3 movimientos (+1500.00 nómina,
     −30.50, −12.00) → saldo exacto `2457.50` (SC-003) → editar movimiento
     (−12.00 → −20.00) → saldo recalculado `2449.50` → auditoría `creado`×3
     y `editado`×1 en DB (FR-013).
   - Edge: saldo inicial negativo permitido (data-model).
   - Auditoría guarda cambios JSON `{"campo": {"anterior": x, "nuevo": y}}`
     con céntimos enteros; tolera JSON como texto (SQLite).

### Gate TDD (Principio III) — verificado

- `uv run pytest tests/api tests/integration/test_us2_flujo.py`
  → **20 failed, 2 passed** (los 2 que pasan son los de 404 que FastAPI
  devuelve por ruta inexistente). Los endpoints aún no existen: correcto.

### Decisiones de diseño esta sesión

- **IDs serializados**: los modelos usan `Integer` autoincremental como PK
  (SQLite), no UUID. La API los expone tal cual (int). El data-model decía
  UUID pero la decisión funcional de la sesión anterior fue int — se mantiene
  para el MVP (YAGNI; la migración baseline ya está construida así).
- **Formato de listados**: `{"items": [...], "total": <número>}` para
  consistencia entre endpoints.
- **Auditoría de cambios**: JSON `{campo: {anterior, nuevo}}` en céntimos.
- **Paginación**: query params `limit` / `offset`.
- **Error de formato importe**: `"diez euros"` o `"1,5"` → 400 `validacion`
  (la API solo acepta punto decimal, ver test_dinero).

### Pendiente (siguiente paso)

- **T019**: `app_conta/services/movimientos.py` (alta validada, edición con
  auditoría, borrado lógico, saldo derivado).
- **T020/T021**: routers `app_conta/api/cuentas.py` y `app_conta/api/movimientos.py`.
- **T022**: vistas PWA `static/js/views/cuentas.js` y `movimientos.js`.
- **T023**: wiring en `static/js/app.js` + llevar T017/T018 a verde.

---

## Sesión anterior (pre-bitácora) — fundaciones

- T001–T015 según `tasks.md`: estructura, uv + FastAPI/SQLAlchemy/Alembic,
  ruff/pytest config, `.gitignore`, migración baseline, modelos, errores API,
  main con seed del Hogar, PWA shell, conftest con BD temporal migrada desde
  cero y smoke test (Principio IV). 23 tests verdes.

> Nota: el repositorio aún NO tiene commits (git init sin commit). Primer
> commit pendiente de hacer cuando US2 esté verde, con mensaje que describa
> el estado.

### Fase 3 (US2) — cierre de implementación (T19–T023)

5. **T019** — `app_conta/services/movimientos.py`: `crear_movimiento` (valida cuenta/
   categoría/bote existentes, importe ≠ 0, origen manual), `editar_movimiento`
   (diff real → auditoría `editado` con `{campo: {anterior, nuevo}}` en céntimos),
   `eliminar_movimiento` (borrado lógico + auditoría `eliminado`),
   `saldo_cuenta` (inicial + Σ importes vivos), `listar_movimientos` (filtros
   desde/hasta/cuenta/bote/categoria, paginación limit/offset ≤500, orden
   fecha asc + id).
   **Bug corregido en el camino**: `Movimiento.hogar_id` era `nullable=False` y
   el primer intento no lo cargaba de la cuenta → `IntegrityError` al crear
   movimientos vía API; fija `hogar_id = cuenta.hogar_id`.
6. **T020/T021** — routers `api/cuentas.py` y `api/movimientos.py` completos por
   contrato: POST 201, GET lista `{items, total}`, detalle con movimientos,
   PATCH (ignora `saldo` — Principio II; suelta 409 por duplicado de nombre), DELETE
   204 / 409 / `?confirmar_destino=archivar|eliminar_movimientos`.
   **Bug corregido**: `crear_cuenta` no hacía `db.add` → `InvalidRequestError
   "Instance is not persistent within this Session"` al refrescar tras commit.
   Diagnóstico hecho con un script mínimo contra el service aislado.
7. **T016-T018 → VERDE**: 45 tests total (23 fundación + 22 US2). Gate TDD
   respetado: los 20 contract + 3 integration fallaron ANTES de implementar.
8. **T022/T023** — PWA: refactor del router a ES modules (`vistas.js` registro
   compartido, `nav.js` tabs, `app.js` delegación única de eventos con `type="module"`
   en index.html). Vista cuentas: rejilla de tarjetas con icono por tipo,
   saldo derivado grande, total global. Vista movimientos: tabla con fechas cortas
   e importes coloreados, filtros básicos, paginación "Cargar más", alta con
   segmented control gasto/ingreso (JS normaliza "30,5" → "-30.50").
   `styles.css` reescrito con tokens, dark mode automático y diseño mobile-first.
   Como extra: `run()` de `main.py` ya publicado en LAN con URL para móviles.
   **Servidor verificado** contra BD temporal: tarjetas/tabla formatos correctos,
   saldo exacto (90.00 = 120.50 − 30.50) en `GET /cuentas/1`.
   Nota: un par de POSTs manuales fallaron por codificación CP1252 de PowerShell
   con acentos en el body — artefacto del script de prueba, no de la API.

### Adenda — despliegue decidido: VPS (opción C)

El usuario elige **VPS en la nube** para poder usar la app con el portátil
apagado (también fuera de casa). Añadida **Fase 11 (T066-T071)** en `tasks.md`
con el plan: elección VPS+dominio al final del MVP, empaquetado (Docker o
systemd), HTTPS con Caddy/Let's Encrypt (resuelve de paso T064 — PWA offline en
móviles), acceso simple con PIN/token (la app queda en internet), backup remoto
y runbook de migración del `conta.db` del PC al VPS. Los datos siguen siendo un
fichero SQLite autoalojado; solo cambia la máquina donde vive el proceso (adenda
al principio de "cero nube" de la constitución).

### US1 iniciada (Fase 4) — tests escritos (TDD)

- **T024** `tests/unit/test_conciliacion.py` (8 tests): vacía/cuadrado, solo
  cuentas (inicial − inicial = 0), movimientos sin bote no rompen el cuadre
  (sin_asignar informativo), bote activo encaja, desfase con bote archivado →
  `revisar`, ignora eliminados y cuentas archivadas, signos mixtos con inicial
  negativo.
- **T025** `tests/api/test_conciliacion.py` (2 tests): forma del contrato exacta
  (fecha_calculo + 5 saldos + estado; importes como string de euros) e
  integración con datos vía API (969.50 / 1000.00 / −30.50 / 0.00 / cuadrado).
- **T026** `tests/integration/test_us1_pantalla.py`: escenario 2-4 del
  quickstart (cuenta 1000.00 → gastos −30.50 y −12.00 → 957.50, diferencial 0,
  cuadrado; botes 0.00 por degradación graceful hasta US3).
- **Gate TDD verificado**: los tests no pueden importar
  `app_conta.services.conciliacion` (aún no existe) → fallan. Sin la
  implementación, la suite completa queda en 45 verdes + estos pendientes.
- Los tests unitarios usan el `db` fixture (commit implícito no necesario: el
  service consulta la misma sesión; recordatorio de diseño para T027: la
  conciliación SOLO LEE, nunca escribe (Principio II).

## 🎯 Sesión 2026-10-28 (continuación) — US1 completa y MVP CAJA funcional

### US1 (Fase 4) — Disponible real: implementación

1. **T027** `services/conciliacion.py`: calcula los 5 saldos + diferencia +
   estado leyendo el universo de cuentas activas y sus movimientos vivos
   (SOLO LEE, Principio II). Reutiliza saldo_cuenta de movimientos.py.
2. **T028** `api/conciliacion.py`: GET único con importes en string euros.
3. **T029/T030** PWA: `inicio.js` real — tarjeta destacada con saldo grande y
   badge 🟢 Cuadrado / 🔴 Revisar (aviso con importe sin explicar), rejilla de
   mini-tarjetas de cuenta, tabla "Detalle del cuadre" (inicial / botes /
   sin asignar / diferencia). Nueva clase `tarjeta-ok`/`tarjeta-alerta` en el
   CSS. Inicio es la pantalla de arranque del router.
4. **Verificación el mundo real**: BD temporal + servidor → POST cuenta
   (1000.00) + movimiento (−30.50) → GET conciliacioa → 969.50 / 1000.00 /
   −30.50 / diferencia 0.00 / `cuadrado`; `inicio.js` servida con 200.

**Corrección de infraestructura de tests (importante)**: al tener la conciliación
un cálculo agregado, se detectó contaminación entre tests (los datos creados por
el `client` de un test anterior sobreviven al `db.rollback()` porque el router
hace `commit`). Añadido fixture `autouse _aislar_bd` en `conftest.py` que borra
todas las tablas tras cada test (recreando el Hogar al vuelo cuando hace falta
cada test). Los 55 tests ahora son estables.

**Estado**: 55 tests verdes, ruff limpio, checkpoints US1+US2 alcanzados.
Los botes quedan en 0.00 (degradación graceful) hasta US3.

## 🎉 Sesión 2026-10-28 ( tercera ronda) — US3 COMPLETA: MVP contable terminado

### US3 (Fase 5) — Botes: implementación

1. **Tests primero** (gate TDD cumplido: pytest no encontraba
   `app_conta.services.botes`):
   - T031 unit (8): saldo = Σ asignados; reasignación actualiza ambos; objetivo
     conseguido (regla 5 del data-model); duplicado → 409; tipo inválido → 400;
     bote NEGATIVO visible sin bloqueo; archivado libera movimientos.
   - T032 contract (11): CRUD botes + PATCH reasignación + alta directa con
     `bote_id` en POST /movimientos + DELETE con `?confirmar=true`.
   - T033 integration: flujo 2 botes/3 movs + auditoría `reasignado` + edge.
2. **T034** `services/botes.py`: CRUD, `saldo_bote` (SUM vivos), `estado_de_bote`
   (con sentido decto para objetivos negativos = presupuesto: agotado cuando
   `saldo <= objetivo`), `reasignar_bote` con auditoría `reasignado`, `archivar_bote`
   (409 si asignados sin confirmar; libera → sin asignar).
   **Idea clave del depurado**: `SessionLocal(autoflush=False)` exige FLUSH
   explícito tras las mutations para que las consultas SUM las vean (bug que
   explicaba saldos = 0 en los tests unitarios).
3. **T035/T036** routers: botes completos + PATCH `/movimientos/{id}/bote`
   con cuerpo `{ "bote_id": int|null }`.
4. **T037/T038** PWA: vista Botes con tarjetas y barra de progreso (roja al
   sobrepasar), selector de bote en el alta de movimientos y **por fila** (change
   delegado), sección "🎯 Botes del hogar" en Inicio. CSS: `.progreso`,
   `.sel-bote`.

**Decisión contable documentada**: `conseguido` sí hace cola con la regla 5
(`saldo >= objetivo`) para botes de ahorro (aportaciones positivas), y para
objetivos NEGATIVOS (presupuestos de gasto) se considera agotado cuando
`saldo <= objetivo` — el coeficiente altura/dirección es del propio objetivo.
Los unit tests T031 cubren ambos sentidos.

**Estado final de la ronda**: **77 tests verdes**, ruff limpio y coverage 89 %.
**MVP CONTABLE COMPLETO (US1+US2+US3 = hoja CAJA + botes)** — verificado el
mundo real con BD temporal: bote Vacaciones 30.00/60.00 `en_curso`,
conciliación `cuadrado` con `saldo_total_botes` 30.00 y `sin_asignar` 0.00.

### Incidente de uso (2026-10-28) — "Windows no puede encontrar uvicorn"

El usuario ejecutó `levantar.bat` y Windows abrió el error *"Windows no puede
encontrar el archivo uvicorn"*. Causa: el `.bat` llamaba a `uvicorn` directamente,
pero el ejecutable vive en el entorno virtual del proyecto (`.venv`), no en el
PATH del sistema. **Corregido** en ambos `.bat`: ahora arrancan con
`uv run uvicorn ...` (a través de `uv`, que gestiona el venv) y con
`start "App_Conta" cmd /k ...` para que la ventana **permanezca abierta** y se
puedan leer la URL de los móviles o un error si lo hubiera. Lección anotada:
los scripts de acceso directo SIEMPRE via `uv run`, nunca ejecutables sueltos.

### Pendiente (siguiente sesión)

- **US4 (categorías, P2)** T039-T044 — puede seguir en paralelo con US6.
- **US5 (importador OCTUBRE.xlsx, P2)** T045-T052 — los datos reales en la app.
- **US6 (backup, P3)** T053-T057.
- Primer commit de git (el repositorio sigue sin commits).
- **Despliegue VPS** (Fase 11, T066-T071) — para que tu mujer accedan con el
  portátil apagado.
- Gate final T060: cobertura ≥95 % en `services/` (hoy 89 % global).

### Adenda de la misma sesión — requisito multi-dispositivo

El usuario confirma el requisito real: **usar la app ambos cónyuges desde sus
móviles y desde el portátil**, compartiendo la misma contabilidad. Implicaciones:

- La arquitectura elegida (servidor local + PWA) ya es la adecuada: un solo
  proceso serve la misma BD a todos los dispositivos de la red del hogar.
- Cambios aplicados: `run()` de `app_conta.main` escucha `0.0.0.0`
  (`APP_CONTA_HOST`/`APP_CONTA_PORT` ajustables) e imprime la URL con la IP
  local para los móviles; `levantar.bat` + `iniciar_servidor.bat` pasan
  `--host 0.0.0.0`. Verificado: `/health` responde con binding 0.0.0.0.
  45 tests siguen en verde.
- Pendiente documentado como nuevas tareas T064 (HTTPS local para PWA
  instalable en móvil — los service workers exigen contexto seguro) y T065
  (README flujo multi-dispositivo). Detalle: sin HTTPS, la app en el móvil
  por IP funciona como web normal (sin offline). Decisión sobre "PC apagado"
  diferida (opciones: dejarlo así / mini-PC o NAS siempre encendido / cloud).
- Sin usuarios ni login en el MVP (YAGNI): los dos móviles abren la misma
  app y ven el mismo Hogar.

## Sesion 2026-10-28 (cuarta ronda) - US5 COMPLETA: importador OCTUBRE.xlsx

### US5 (Fase 7) - Importador: implementacion (T045-T052)

1. **Recon del Excel real** (`docs/OCTUBRE.xlsx`, 14 hojas): verificacion hoja
   a hoja de cada bloque que se importa (recuentos y cifras de cierre) y de
   las columnas REALES (las etiquetas de SUELDO van en col C y sus importes de
   EXTRA en col F; el efectivo de CAJA esta en col E/F; TOTAL BOTE GASTOS en
   col B/F del bote 2026). Volcado de referencia:
   `$env:TEMP\opencode\octubre_dump.txt`.
2. **TDD** (tests primero, gate verificado rojo → verde):
   - T045 `tests/unit/test_importador_mapeo.py` — 19 tests sobre hojas
     SINTETICAS (signos, redondeo ROUND_HALF_UP + aviso, `#REF!` → aviso sin
     movimiento, importe 0 omitido con aviso, fianza → `ajeno`, mes en
     espanol → fecha 2025-MM-01, dedup del bote Coche, DEVOLUCIONES
     omitidas...).
   - T046 `tests/integration/test_importador.py` — el fichero REAL:
     20 cuentas / 28 botes / 215 movimientos; botes clave:
     Coche −8052.06 · Fondo hipotecas 8083.00 · extras 81.00 ·
     arreglos Cordoba −373.70 · gastos 2026 −119.08 · salario M.Jose
     12016.00; grupos de `diferencias_conciliacion` a "0.00" (SC-004);
     repetido 409 → confirmado duplica (430); conciliacion `cuadrado`
     diferencia "0.00".
   - T047 `tests/api/test_importacion.py` — 4 contract tests del router.
3. **Implementacion**: `services/importador/` (`lector.py` con huella sha256,
   `mapeo.py` ~760 lineas, `importador.py` orquestador), modelo
   `models/importacion.py`, migracion **manual** `3f5c0c9f1a10`
   (down_revision 52cd663949d8), router `api/importacion.py` (auto-registro)
   y vista PWA `views/importar.js` con previsualizacion/cuadre/avisos y
   confirmacion de repetido via `confirm()` + `?confirmar_repetido=true`.
4. **Verificacion en vivo** contra BD TEMPORAL (`$env:TEMP\demo_us5.db`,
   puerto 8013, borrada despues): previsualizar 200 (huella e34f7f7cbe0f…,
   21 avisos), aplicar 200 → conciliacion cuadrada "0.00", 2o aplicar 409
   `conflicto`, historial 1 entrada. El bote 2026 y el sueldo de M.Jose
   salen exactos.

### Decisiones de diseno esta ronda

- **Saldos por cuenta = estado FINAL del mes** (regla del contrato). La
  reconstruccion del historico va a una cuenta "Historial Excel (importacion)"
  (saldo_inicial 0): evita doble computo y hace el cuadre exacto por
  construccion (todo movimiento vive en una cuenta activa → cada importe cae
  en un bote activo o en `sin_asignar`). El detalle de RECIBO de tarjetas va
  directo a la cuenta de su tarjeta. Las tarjetas conservan su deuda
  (−59.10, −5108.95, 0) como saldo_inicial por encima del detalle del mes.
- **Bote de ahorro 2025** se descompone en 3 botes de la hoja AHORROS
  (Fondo hipotecas por aportaciones mensuales; Arreglos Cordoba por semilla;
  extras por aportaciones + gastos reales): su suma (8083 −373.70 + 81)
  reproduce el "BOTE AHORRO 2025" 7790.30 de CAJA al centimo (SC-004).
- **Duplicados evitados por diseno**: la fila "Coche" de BOTES PROPIOS se
  omite (su saldo viene de entregas−costes de COCHE PREST.), el plan
  "BOTES PARA AHORRO" de GASTOS FIJOS se omite (las aportaciones reales estan
  en AHORROS), el bloque copiado de AHORROS al final de COCHE PREST. se
  omite: siempre con aviso (FR-009, nunca se corrige en silencio).
- **Huella NO unique** en `importaciones`: la deteccion es por consulta y la
  confirmacion de repetido crea un 2o registro del mismo fichero.
- **Diferencia listada, no silenciada**: Ahorro salario M.Jose difiere
  360.00 € del Excel porque la hoja descuenta 40 €/mes de gasolina que no se
  importa: queda a la vista en la previsualizacion para que el usuario decida.
- Los movimientos importados NO generan filas de auditoria individual (decenas
  de miles serian ruido); la trazabilidad vive en el registro `importaciones`
  con su resumen y avisos JSON.
- Recuentos guardados en notices del task checklist: aplicador reutiliza
  elementos por nombre (2a importacion a misma BD no crea duplicados de
  cuentas/botes, solo duplica movimientos).

### Estado

- Suite completa: **103 tests en verde**, ruff 0 errores, coverage 94%.
- Migracion aplicada al `conta.db` real (`alembic upgrade head`): ya tiene la
  tabla `importaciones`. La BD de tests (`_test_conta.db`) se regenera sola.
- Pendiente de siguiente sesion: US4 categorias (T039-T044: orden/reorden),
  edicion/borrado de movimientos en PWA, US6 backup (T053-T057), cobertura
  de services >= 95% (T060), PRIMER commit de git, VPS (T066-T071).

### Resolucion de incidencia (2026-10-28) - "Not Found" al previsualizar

El usuario ve `Not Found` al pulsar Previsualizar en Importar Excel. Diagnostico:
el codigo es correcto (verificado en vivo con BD temporal + servidor recien
arrancado: POST /api/v1/importacion/previsualizar con el OCTUBRE.xlsx real →
200). La causa es que el PROCESO del servidor en el PC esta desactualizado: los
routers se registran al arrancar, y las vistas estaticas se sirven frescas del
disco, de modo que la pantalla aparece pero el endpoint no existe en el proceso
antiguo → 404. **Solucion para el usuario: cerrar la ventana de App_Conta y
volver a ejecutar levantar.bat**. Mejora aplicada en `views/importar.js`
(postArchivo): un 404 ahora muestra el mensaje de "reinicia el servidor" en vez
del criptico "Not Found".

## Sesion 2026-10-28 (quinta ronda) - US4 COMPLETA: categorias

### US4 (Fase 6) - Categorias: implementacion (T039-T044)

1. **TDD primero** (gate verificado: ImportError de `app_conta.services.
   categorias`):
   - T039 unit (10): activas ordenadas por nombre, nombre unico por hogar
     (incluidas archivadas, como la constraint BD), validacion de nombre/color,
     total con signos mixtos, total respeta periodo [desde, hasta], totales
     multiples (categoria sin movimientos → 0), borrado protegido con recuento
     en el mensaje (FR-005), confirmado libera movimientos (categoria_id null)
     y archivada desaparece del dominio activo, editar nombre/color,
     obtener inexistente/archivada → 404.
   - T040 contract (8): POST 201 forma completa (`total`, 
     `movimientos_asignados`), duplicado 409, importe 0 via movimiento 400,
     lista con totales sin y con periodo, detalle con recuento + 404, PATCH
     ignora `total` (Principio II), DELETE 409→204 con `?confirmar=true`
     (movimiento queda vivo sin categoria) y 204 directo sin movimientos.
2. **T041** `services/categorias.py`: `_validar_color` (≤20 chars, strip),
   `_checar_nombre_unico`, `listar_categorias_con_totales` (GROUP BY una
   sola consulta + categorias con 0 derivado en Python), `archivar_categoria`
   (patron de botes: sin confirmar → ErrorConflicto con recuento; confirmado
   → `archivada=True` + libera movimientos, sin filas de auditoria, igual que
   archivar_bote), `total_categoria`/`_filtro_periodo` reusan
   `_parsear_fecha` de movimientos.
3. **T042** `api/categorias.py`: POST/GET/PATCH/DELETE; GET acepta
   `?desde=&hasta=`; DELETE con `confirmar: bool = Query(default=False)`;
   PATCH deja que `color` venga a null (sin color) pero nombre nunca.
4. **T043** PWA:
   - Vista nueva `views/categorias.js`: tabla categoria/total/movs/acciones,
     filtro de periodo (`desde`/`hasta` + "Aplicar periodo" guardado en estado
     de modulo), alta con nombre + `input type=color`, ✎ editar via prompt
     (nombre+color → PATCH), 🗑 borrar: primero sin confirmar y, si 409,
     `confirm()` con el mensaje y reintento con `?confirmar=true`.
   - `views/movimientos.js`: selector de categoria **por fila** (change
     delegado → PATCH /movimientos/{id} {categoria_id}) y en el alta; carga
     `/categorias` en el Promise.all.
   - `app.js`: registro de la vista, acciones `crear-categoria` y
     `filtrar-categorias`, delegacion de click para editar/borrar categoria.
   - `styles.css`: `.sel-categoria` compacto, `button.mini(.peligro)`,
     `.punto-color` (dot con el color de la categoria).
5. **T044 verde**: 18 tests US4; suite completa **121 passed**, ruff
   check+format 0 incidencias, coverage 94%.
6. **Verificacion en vivo** (BD temporal `smoke_us4.db`, puerto 8014, borrada
   al acabar): cuenta + categoria + movimiento −30.50 → total "−30.50";
   DELETE en uso → 409 con recuento; periodo julio → "0.00";
   `?confirmar=true` → 204 y movimiento con `categoria_id: null`;
   `/static/js/views/categorias.js` servida 200. Nota del entorno: la BD
   temporal necesita `alembic upgrade head` ANTES de arrancar uvicorn, y
   `app_conta.main:app` es el modulo correcto (no `.app`).

### Estado

- **121 tests en verde** (103 previos + 18 de US4), ruff limpio, coverage 94%.
- Pendiente: edicion/borrado de movimientos en PWA, US6 backup (T053-T057),
  cobertura services ≥95% (T060), PRIMER commit de git, VPS (T066-T071).

---

## Sesión del 2026-10-29 — Rediseño Fintech UI/UX, Reestructuración de Navegación y Reseteo de Base de Datos

### 1. Rediseño visual completo (Fintech Design System)

- **Tipografía**: Incorporadas Google Fonts `Plus Jakarta Sans` (interfaz, encabezados y navegación) y `JetBrains Mono` (formato tabular de alta precisión para todos los importes monetarios).
- **Iconografía vectorial**: Eliminados los emojis planos de chat de todo el frontend. Sustituidos por un set completo de iconos vectoriales SVG limpios en `app_conta/static/js/vistas.js` (cuentas, tarjetas, bancos específicos, botes, categorías, acciones).
- **Estilo y Tokens (`styles.css`)**:
  - Estética *Obsidian / Slate* con paleta HSL/Hex refinada, cabecera con efecto de cristal translúcido (*glassmorphism*, desenfoque de fondo de 20px).
  - Tarjetas de cuentas elevadas, tarjetas de crédito digitales con chip dorado y brillo sutil.
  - Formulario de movimientos con control segmentado (Gasto en carmín / Ingreso en esmeralda).
  - Barras de progreso de botes con porcentaje y desbordamiento visual.

### 2. Reestructuración de la arquitectura de pantallas y navegación

A petición expresa del usuario para alinear la app con su flujo mental:
- **Pestaña 1 — Resumen (`views/inicio.js`)**:
  - El encabezado superior se actualiza de *"Posición Global del Hogar"* a **"Dinero en caja"**, mostrando el saldo real disponible en caja y cuentas con su indicador vivo de cuadre.
- **Pestaña 2 — Cuentas y Depósitos (`views/cuentas.js`)**:
  - Filtrada para excluir tarjetas.
  - Agrupación por entidades bancarias: **Caixa**, **Deutsche Bank**, **BBVA**, **Revolut** y **Otros** (efectivo, inversiones y otros depósitos no-tarjeta), cada una con su icono, recuento de cuentas y subtotal bancario.
- **Pestaña 3 — Tarjetas (`views/tarjetas.js`)**:
  - Nueva vista dedicada exclusivamente a la visualización y alta de tarjetas de crédito y débito.
  - Muestra saldo dispuesto / deuda actual, saldo inicial y fecha.
- **Pestaña 4 — Gastos Tarjetas (`views/gastos-tarjetas.js`)**:
  - Nueva vista dedicada al seguimiento de compras y recibos de tarjetas.
  - Barra superior de píldoras interactivas para filtrar por **Tarjeta Caixa**, **Tarjeta Deutsche Bank**, **Tarjeta Carrefour** u otras.
  - Listado de movimientos de la tarjeta seleccionada y formulario para imputar un gasto directamente.
- **Pestañas complementarias**: Se mantienen `Botes`, `Movimientos`, `Categorías` e `Importar Excel` en el orden de navegación.

### 3. Reseteo integral de la base de datos

- Vaciado completo de la base de datos local `conta.db` a petición del usuario para empezar con la app en blanco:
  - Eliminación de registros en: `auditoria_movimientos`, `movimientos`, `importaciones`, `botes`, `categorias`, `cuentas`, `hogares`.
  - Regeneración del `Hogar` único requerido para integridad referencial.
  - Ejecución de `VACUUM` en SQLite para compactar el archivo a cero datos.
  - Verificado vía API: `/cuentas` devuelve 0 ítems, `/conciliacion` 0.00 € (cuadrado).

### 4. Estado de Calidad y Tests

- **121 tests en verde (`uv run pytest`)**: Cero regresiones en la suite de backend y API.
- Coverage global de `app_conta` al 94%.
- Servidor verificado y en funcionamiento en puerto 8003.

### Incidente de uso (2026-10-29) — "[Errno 10048] Puerto 8003 ocupado"

- **Síntoma**: El usuario ejecuta `levantar.bat` y la consola devuelve:
  `ERROR: [Errno 10048] error while attempting to bind on address ('0.0.0.0', 8003): solo se permite un uso de cada dirección de socket`
- **Diagnóstico**: Uvicorn ya estaba en ejecución desde las 13:20 (PID 12580) escuchando en el puerto 8003 en una ventana previa de consola. Al abrir un segundo `levantar.bat`, Windows rechaza la duplicidad de puerto.
- **Resolución**: El servidor original sigue activo y respondiendo correctamente en `http://127.0.0.1:8003` (`/health` devuelve `ok`). Si se desea reiniciar de cero, basta con cerrar la ventana de consola previa o finalizar el proceso antes de relanzar el script.

### 5. Segregación Financiera: Dinero en Caja vs. Dinero Disponible (2026-10-29)

- **Regla de negocio requerida por el usuario**:
  - *"En dinero en caja solo podemos enseñar el dinero efectivo, el de bancos no está en caja está en bancos. En todo caso podemos poner otro que sea dinero disponible, donde salga lo que hay en caja y en bancos."*
- **Implementación en Frontend (`views/inicio.js` y `styles.css`)**:
  - **Gran Saldo Principal (Hero)**: Pasa a denominarse **"Dinero disponible"** y calcula con precisión matemática en céntimos la suma total de dinero líquido (`dineroCaja + dineroBancos`).
  - **Métrica "Dinero en caja"**: Filtrado estricto para sumar **exclusivamente cuentas de tipo `efectivo`** (`c.tipo === "efectivo"`). No incluye saldos bancarios ni tarjetas.
  - **Métrica "Dinero en bancos"**: Nueva tarjeta estadística que suma las cuentas corrientes y depósitos bancarios (`c.tipo === "banco"`).
  - **Métricas complementarias de conciliación**: Se mantienen visibles las píldoras de **"Asignado a botes"** (fondos comprometidos) y **"Libre sin reservar"** (fondos sin asignar).
  - **Detalle del Cuadre**: La tabla analítica desglosa en filas independientes:
    1. *Dinero Disponible (Caja + Bancos)*
    2. *— Dinero en caja (efectivo)*
    3. *— Dinero en bancos*
    4. *Suma de saldos iniciales*, *Dinero reservado en botes*, *Disponible sin asignar* y *Diferencia neta*.
- **Estado de Calidad**:
  - Test suite verificado: **121 tests pasados** (`uv run pytest`), 0 fallos, 94% coverage.

### 6. Nueva pestaña "Ahorro" y Gestión Integral de Borrado (2026-10-29)

- **Pestaña "Ahorro" (`views/ahorro.js`, `nav.js`)**:
  - Creada vista especializada para previsión futura de pagos importantes (**amortización de hipotecas**, cuotas futuras, colchón de emergencia de 3-6 meses).
  - Indicador de **Total Ahorro Acumulado** y progreso porcentual contra la meta total de ahorro fijada.
  - Píldoras de sugerencias rápidas para autocompletar nombres habituales (*"Amortización Hipoteca"*, *"Reserva Cuotas Hipoteca"*, *"Colchón de Emergencia"*).
  - Formulario ágil para dar de alta fondos de ahorro con objetivo y fecha meta opcional.
- **Auditoría e Implementación de Borrado en toda la aplicación**:
  - **Botes y Fondos de Ahorro**: Botón de eliminación directa en cada tarjeta (`data-accion="borrar-bote"`). Si el bote tiene movimientos asignados, la app solicita confirmación y reubica los fondos automáticamente en *"Libre sin asignar"*, impidiendo cualquier descuadre.
  - **Cuentas y Tarjetas**: Botón de eliminación directa en cada tarjeta (`data-accion="borrar-cuenta"`). Si tiene movimientos, la app permite archivarla para preservar el histórico de auditoría sin romper la integridad referencial.
  - **Movimientos**: Botón de eliminación en cada fila de tabla (`movimientos.js` y `gastos-tarjetas.js`) mediante `data-accion="borrar-movimiento"` (borrado lógico `eliminado = True`).
- **Verificación**: Suite de 121 tests en verde (`uv run pytest`).

### 7. Reestructuración del Menú de Navegación y Pestaña "Tarjetas Regalo" (2026-10-29)

- **Reestructuración de la Navegación Superior (`nav.js`, `styles.css`)**:
  - Eliminada la saturación horizontal provocada por 9 pestañas consecutivas.
  - Implementada arquitectura limpia de menú superior en dos niveles funcionales:
    1. **Pestañas Principales Visibles**: *Resumen*, *Cuentas y Depósitos*, *Tarjetas*, *Tarjetas Regalo*, *Ahorro*, *Botes*, *Movimientos*.
    2. **Menú Desplegable "Más"**: Agrupa de forma elegante las herramientas secundarias (*Categorías* e *Importar Excel*) con ventana flotante glassmorphism y cierre interactivo automático.
    3. Integración de *Gastos de Tarjetas* como sub-vista enlazada directamente desde *Tarjetas*.
- **Pestaña "Tarjetas Regalo" (`views/tarjetas-regalo.js`, `styles.css`)**:
  - Vista especializada para el control del saldo prepagado en tarjetas regalo (**Amazon**, **El Corte Inglés**, **Carrefour**, **IKEA**, **Decathlon**, etc.).
  - Totalizador de saldo positivo disponible listo para compras.
  - Tarjetas con diseños personalizados por comercio (paleta de color, lazo de regalo y saldo disponible destacado).
  - Píldoras de selección rápida de comercios y formulario de alta.
  - Filtrado cruzado: `views/tarjetas.js` gestiona tarjetas bancarias (crédito/débito) y `views/tarjetas-regalo.js` gestiona tarjetas prepago/regalo.
- **Estado de Calidad**:
  - **121 tests en verde (`uv run pytest`)**, 0 fallos, 94% coverage.

### 8. Menú Superior Consolidado en 5 Secciones y Eliminación Definitiva de la Barra de Scroll (2026-10-29)

- **Problema reportado por el usuario**:
  - *"Sigue saliendo varios en el menú y una línea para desplazar, eso no me gusta"*.
  - Al coexistir 8 pestañas individuales en la cabecera con `overflow-x: auto;`, el navegador en Windows dibujaba una barra horizontal de desplazamiento ("línea para desplazar"), saturando visualmente la parte superior.
- **Solución implementada**:
  1. **Consolidación en 5 Pestañas Maestras en la Barra Superior (`nav.js`)**:
     - **📊 Resumen** (`#/inicio`): Panel global del hogar, dinero en caja (efectivo), dinero disponible (caja + bancos), botes y movimientos recientes.
     - **🏦 Cuentas y Tarjetas** (`#/cuentas`): Agrupación financiera integral. Enlaza directamente a cuentas y activa la navegación secundaria interna.
     - **🎯 Ahorro y Botes** (`#/ahorro`): Hub central de fondos futuros (hipotecas, amortizaciones) y botes periódicos.
     - **📝 Movimientos** (`#/movimientos`): Registro contable de ingresos y gastos.
     - **⋯ Más** (`#btn-nav-mas`): Desplegable elegante con *Categorías* e *Importar Excel*.
  2. **Subnavegación por Píldoras en las Vistas Agrupadas (`vistas.js`, `styles.css`)**:
     - En el bloque financiero (*Cuentas y Tarjetas*), una barra de píldoras permite alternar con un solo clic entre:
       `[ 🏦 Cuentas y Depósitos ]  [ 💳 Tarjetas Bancarias ]  [ 🎁 Tarjetas Regalo ]  [ 🏷️ Gastos Tarjetas ]`
     - En el bloque de previsión (*Ahorro y Botes*), la subnavegación permite alternar entre:
       `[ 🎯 Fondos de Ahorro e Hipotecas ]  [ 🏺 Botes y Gastos Periódicos ]`
     - Al estar en cualquiera de las sub-vistas, la pestaña principal del menú superior permanece resaltada mediante `data-nav-group` en `app.js`.
  3. **Eliminación Definitiva de la Barra de Scroll (`styles.css`)**:
     - `.nav-bar` pasa a `overflow: visible;`, `scrollbar-width: none;`, `-ms-overflow-style: none;` y `::-webkit-scrollbar { display: none; }`.
     - El ancho total de las 5 pestañas (~580px) encaja holgadamente en el contenedor de 1080px, suprimiendo de raíz cualquier necesidad de desplazamiento horizontal.
  4. **Actualización de Service Worker (`sw.js`)**:
     - Incrementada la versión de caché a `app-conta-shell-v5` para forzar la actualización inmediata en navegadores locales y móviles.
- **Estado de Calidad**:
  - **121 tests pasados** (`uv run pytest`), 0 fallos, 94% coverage global.

### 9. Extracto Individual de Botes y Nuevo Módulo "Dinero que me deben" (2026-10-29)

- **Requerimientos del usuario**:
  1. *"Lo que pongo en los botes no se ve separado, ¿no puedo acceder a la info de los botes?"*
  2. *"Quiero también un lugar donde pueda poner el dinero que me deben."*
- **Soluciones implementadas**:
  1. **Acceso y Extracto Detallado de Botes y Fondos de Ahorro (`views/botes.js` y `views/ahorro.js`)**:
     - Cada sobre cuenta con un botón directo `📄 Ver movimientos y extracto →` y toda la tarjeta es interactiva.
     - Al entrar a un bote o fondo de ahorro, se despliega una vista exclusiva con:
       - **Saldo actual**, **Total aportaciones recibidas (+)** y **Total gastos imputados (−)**.
       - Barra de progreso interactiva contra la meta u objetivo fijado.
       - **Formulario integrado "+ Añadir dinero o gasto a este bote"**: permite ingresar dinero (+ aportación) o retirar fondos (− gasto) seleccionando cuenta de origen/destino y concepto sin salir del extracto.
       - **Tabla separada de movimientos**: muestra cronológicamente todos los movimientos asignados a ese sobre concreto, con fecha, concepto, cuenta origen, importe coloreado (+ verde / - rojo) y botón de eliminación.
       - Botón `← Volver` para regresar al listado general en un clic.
     - En `views/inicio.js` (Resumen), las tarjetas de botes ahora son clicables para abrir su extracto directamente.
  2. **Nuevo Módulo "Dinero que me deben" (`views/deben.js`, `app_conta/models/deuda.py`, `app_conta/api/deudas.py`)**:
     - Cumplimiento estricto del Principio I de la Constitución contable (*"las deudas se modelan como entidades, no como signos"*).
     - **Modelo relacional `Deuda`** con migración Alembic `4a8e2b7c6d91`: registra deudor, concepto, importe inicial en céntimos, importe cobrado, fecha, fecha límite opcional, estado (`pendiente`, `parcial`, `saldado`) y notas.
     - **Subnavegación en Ahorro y Botes**: integrada limpiamente como tercera pestaña en la barra de píldoras:
       `[ 🎯 Fondos de Ahorro e Hipotecas ]  [ 🏺 Botes y Gastos Periódicos ]  [ 🤝 Dinero que me deben ]`
     - **KPIs**: Total pendiente de cobro, total recuperado y total prestado.
     - **Control de Cobros**: botón `Registrar devolución / cobro` con opción de crear automáticamente un movimiento de ingreso en la cuenta bancaria o efectivo elegida cuando el deudor te devuelve el dinero.
     - **Métrica viva en Resumen (`views/inicio.js`)**: tarjeta destacada con el total pendiente que te deben con enlace directo.
  3. **Calidad y Tests**:
     - Suite ampliada con tests unitarios y de contrato (`tests/unit/test_deudas.py`, `tests/api/test_deudas.py`).
     - **127 tests en verde (`uv run pytest`)**, 0 fallos, 93% de cobertura.
     - Caché de Service Worker actualizada a `app-conta-shell-v6`.

### 10. Módulo de Previsión de Gastos Anuales y Bote Periódico (2026-10-29)

- **Propósito y Reglas de Negocio (equivalente a la hoja GASTOS 2026 del Excel)**:
  - Planificación y control de tributos, seguros y recibos periódicos del hogar (IBI Cañete, IBI Piso, IBI Córdoba, Basura, Seguros de hogar, vida, coche, sellos de coche, agua...).
  - Reparto homogéneo en cuotas fijas mensuales ("Total a guardar al mes": 176,54 €/mes) para alimentar el bote anual de gastos.
  - Provisión acumulada dinámica según los meses aportados/transcurridos (`meses_pagados`: 1 a 12).
  - Comparativa céntimo a céntimo entre la provisión acumulada y las facturas reales cobradas por bancos o tarjetas, determinando con exactitud el superávit o déficit del bote.
- **Backend & Base de Datos**:
  - Modelos relacionales `GastoRecurrente` y `PrevisionGastosConfig` en `app_conta/models/gasto_recurrente.py`.
  - Migración Alembic `8b7c3d2e1f05_gastos_recurrentes.py` aplicada a `conta.db`.
  - Servicio `app_conta/services/prevision_gastos.py` con plantilla semilla canónica de los 16 recibos del hogar, cálculo de cuotas y acumulados, registro de facturas pagadas y CRUD completo.
  - Router `/api/v1/prevision-gastos` en `app_conta/api/prevision_gastos.py` con endpoints para consultar resumen, actualizar meses/año de provisión (`PATCH /config`), CRUD de gastos recurrentes, registro de facturas cobradas (`POST /{id}/pagar`) y restablecimiento de plantilla.
- **Frontend PWA Fintech UI**:
  - Nueva vista dedicada `views/prevision-gastos.js` accesible desde la subnavegación de Ahorro y Botes:
    `[ 🎯 Fondos de Ahorro e Hipotecas ]  [ 🏺 Sobres y Botes ]  [ 📋 Previsión Gastos Anuales ]  [ 🤝 Dinero que me deben ]`
  - **Tarjeta Stepper Interactiva**: control del mes de provisión acumulada con botones rápidos `[ − ]` y `[ + ]` y selector directo de mes (Enero a Diciembre).
  - **Panel de KPIs Financieros**: Total Anual presupuestado, Cuota Mensual Fija a guardar, Provisión acumulada hasta el mes activo, Facturas pagadas reales y Saldo neto del bote (Superávit / Déficit).
  - **Tabla Analítica Fintech**: desglose fila a fila con estado visual, concepto, fecha de cobro, anual, cuota/mes, provisión acumulada, pagado real con botón para imputar recibos cobrados, saldo y acciones de edición/borrado.
  - **Formulario Integrado**: alta ágil de nuevos gastos o recibos periódicos.
  - **Métrica en Dashboard Resumen (`views/inicio.js`)**: tarjeta directa con el saldo del bote de gastos anuales y estado de meses provistos.
  - **Service Worker**: actualizado a versión `app-conta-shell-v7`.
- **Calidad y Tests**:
  - Suite completa ampliada a **136 tests en verde (`uv run pytest`)**, 0 fallos.
  - Ruff check y ruff format limpios (0 errores).
  - Cobertura global del 92%.

### 11. Módulo y Pestaña de Inversiones y Patrimonio (2026-10-30)

- **Propósito y Reglas de Negocio (Segregación de Patrimonio Invertido)**:
  - En finanzas personales e ingeniería contable rigurosa, las inversiones (fondos indexados, acciones/ETFs, renta fija/letras del tesoro, planes de pensiones y criptoactivos) no constituyen liquidez inmediata ("Dinero en caja" ni "Dinero disponible").
  - Constituyen **Patrimonio Neto Invertido**, cuyo valor fluctúa en función de cotizaciones y valoraciones de mercado.
  - Separar las inversiones de las cuentas corrientes bancarias permite mantener la pureza de la fórmula de conciliación bancaria diaria mientras se obtiene visibilidad total sobre la rentabilidad real de la cartera.
- **Backend & Base de Datos**:
  - **Modelo relacional `Inversion`** en `app_conta/models/inversion.py`: registra `id`, `hogar_id`, `nombre`, `entidad` (MyInvestor, Trade Republic, Indexa, Tesoro Público, etc.), `tipo_activo` (`fondos`, `acciones_etfs`, `renta_fija`, `pensiones`, `cripto`, `inmobiliario`, `otros`), `capital_aportado_centimos`, `valor_actual_centimos`, `cuenta_id` (vinculación opcional con cuenta bancaria), `fecha_inicio`, `notas` / ISIN y `activo`.
  - Properties calculadas: `plusvalia_centimos` y `rentabilidad_pct` (ROI % ponderado).
  - **Migración Alembic `9c8d7e6f5a4b_inversiones.py`** creada y aplicada cleanly sobre `conta.db`.
  - **Servicio `app_conta/services/inversiones.py`**:
    - `crear_inversion` con opción de crear movimiento inicial automático de salida en la cuenta bancaria de origen para conciliar aportaciones de efectivo.
    - `actualizar_valoracion` para actualizar el valor de mercado periódicamente sin alterar el capital aportado.
    - `registrar_aportacion` y `registrar_reembolso` con movimiento bancario bidireccional opcional.
    - `resumen_inversiones` con cómputo de valor total de mercado, capital neto aportado, plusvalía global, rentabilidad ponderada total y distribuciones por tipo de activo y entidad.
  - **Router `/api/v1/inversiones`** en `app_conta/api/inversiones.py` con endpoints REST completos y validación Pydantic estricta.
- **Frontend PWA Fintech UI**:
  - **Pestaña integrada en Subnavegación de Cuentas y Tarjetas (`subnavCuentas`)**:
    `[ 🏦 Cuentas y Depósitos ]  [ 📈 Inversiones ]  [ 💳 Tarjetas Bancarias ]  [ 🎁 Tarjetas Regalo ]  [ 🏷️ Gastos Tarjetas ]`
  - **Vista dedicada `views/inversiones.js`**:
    - **Hero KPIs**: Valor de Mercado Total, Capital Invertido, Plusvalía Neta (+€ / −€) y Rentabilidad Ponderada (ROI %).
    - **Barra Visual de Asset Allocation**: proporción porcentual por tipo de activo (fondos, acciones, renta fija, pensiones, cripto) con leyenda detallada.
    - **Filtros rápidos por tipo**: botones píldora para filtrar al instante por categoría de activo.
    - **Tarjetas de Posiciones**: tarjeta fintech completa con acento de color según clase de activo, métricas de valoración y rentabilidad, botón rápido para actualizar cotización de mercado, y desplegable para aportar o reembolsar capital vinculado a cuenta bancaria.
    - **Formulario Integrado de Alta**: formulario para registrar nuevas inversiones con soporte para fecha, ISIN/notas y movimiento de cargo inicial.
  - **Métrica en Dashboard Resumen (`views/inicio.js`)**: nueva tarjeta en la fila principal del hero con el patrimonio invertido y rentabilidad global enlazando a `#/inversiones`.
  - **Service Worker**: actualizado a versión `app-conta-shell-v8`.
- **Calidad y Tests**:
  - **145 tests en verde (`uv run pytest`)**, 0 fallos.
  - Cobertura global del 90%.
  - Ruff check y ruff format al 100% limpios.

### 12. Módulo de Copias de Seguridad, Respaldo JSON y Vaciado Seguro (2026-10-30)

- **Propósito y Reglas de Negocio**:
  - Garantizar la soberanía total y seguridad de los datos financieros del usuario.
  - Capacidad de exportar toda la base de datos a un archivo JSON autónomo y fechado con un solo clic.
  - Posibilidad de vaciar la base de datos de pruebas o restaurar instantáneamente desde un backup previo con validación de integridad referencial.
- **Backend & Base de Datos**:
  - Servicio `app_conta/services/backup.py` que serializa/deserializa todas las tablas relacionales respetando dependencias foráneas (`Hogar`, `Cuenta`, `Categoria`, `Bote`, `Movimiento`, `Prestamo`, `Deuda`, `Inversion`, `GastoRecurrente`, `PrevisionGastosConfig`, `PlantillaReparto`, `PagoRecurrente`).
  - Endpoints en `app_conta/api/backup.py`: `GET /api/v1/backup/exportar`, `POST /api/v1/backup/restaurar` y `POST /api/v1/backup/vaciar`.
- **Frontend PWA**:
  - Sección integrada en el menú flotante `⋯ Más` (`#/backup`) con botones de acción rápida para descargar copia de seguridad, subir archivo JSON de restauración y diálogo de confirmación para vaciado de datos.

### 13. Modales de Acción Rápida y Motor de Plantillas de Reparto de Nómina (2026-10-30)

- **Propósito y Automatización del Flujo Mensual**:
  - Sustituir la distribución manual de nóminas e ingresos periódicos por un motor de plantillas configurable.
  - Automatizar el reparto de la nómina y rentas de alquiler hacia cuentas bancarias y sobres/botes de ahorro en un solo paso.
- **Backend & Modelos**:
  - Modelos relacionales `PlantillaReparto` y `PlantillaRepartoLinea` en `app_conta/models/plantilla_reparto.py`.
  - Migración Alembic `c3d4e5f6a7b8_plantillas_reparto.py` aplicada a la base de datos.
  - Servicio `app_conta/services/plantillas_reparto.py` con soporte para:
    - Ejecución atómica de repartos (`ejecutar_reparto`), generando movimientos etiquetados y conciliados.
    - Soporte multi-banco en una única plantilla (líneas asignadas a Caixa o Deutsche Bank independientemente).
    - Gestión de líneas con destino a cuenta libre (`bote_id=None`) o asignadas a sobres específicos.
  - Router `/api/v1/plantillas-reparto` con CRUD completo y ejecución directa.
- **Frontend PWA**:
  - Botones destacados en cabecera y barra flotante `[ ➕ Ingreso ]` y `[ ➖ Gasto ]` (`modales-acciones.js`).
  - Modal de ingreso con selector de pestaña: «Ingreso Libre» o «Reparto de Nómina».
  - Previsualización en vivo de totales por banco y asignaciones a sobres con selector de destino y recálculo automático.

### 14. Módulo de Pagos Recurrentes y Recibos Bancarios Domiciliados (2026-10-30)

- **Propósito y Separación de Recibos Fijos**:
  - Separar los recibos fijos domiciliados que el banco cobra automáticamente (hipotecas mensuales, suministros de luz, telecomunicaciones, seguros, comunidades de propietarios) de los gastos corrientes diarios.
  - Evitar confusiones entre el dinero provisionado en botes y los cobros domiciliados directos.
- **Backend & Modelos**:
  - Modelo relacional `PagoRecurrente` en `app_conta/models/pago_recurrente.py`.
  - Migración Alembic `e5f6a7b8c9d0_crear_tabla_pagos_recurrentes.py` aplicada a `conta.db`.
  - Servicio `app_conta/services/pagos_recurrentes.py`:
    - Siembra canónica de los 12 recibos domiciliados del hogar:
      - **La Caixa (526,00 €)**: Hipoteca Estudio (140 €), Hipoteca Córdoba (153 €), Seguro Hogar Córdoba (28 €), Cruz Roja (3 €), Comunidad Los Verdiales (55 €), Comunidad Córdoba (20 €), Luz piso (65 €), Finetwork (19 €), Vodafone (43 €).
      - **Deutsche Bank (548,00 €)**: Hipoteca Piso (483 €), Seguro Hogar Cañete (13 €), Comunidad Piso (52 €).
    - Endpoint `POST /api/v1/pagos-recurrentes/ejecutar` para ejecutar todos los recibos fijos del mes generando sus 12 movimientos bancarios correspondientes de salida.
- **Frontend PWA**:
  - Vista dedicada `views/pagos-recurrentes.js` accesible desde el menú `⋯ Más` (`#/pagos-recurrentes`).
  - Desglose visual por entidad bancaria con totales agregados y botón `⚡ Ejecutar Pagos del Mes`.
  - Integración en el modal de reparto de nómina para ejecutar simultáneamente el reparto y los recibos en una sola acción coordinada.

### 15. Conciliación Bancaria Exacta y Deducciones Internas en Reparto (2026-10-31)

- **Ajuste Fino de la Lógica Contable y Aportación de Botes**:
  - El usuario especificó la regla de negocio para la amortización de capital de hipotecas:
    - El sobre `Amortización Hipoteca` es una reserva mensual acumulativa para amortizaciones futuras de capital (independiente de las cuotas domiciliadas de las hipotecas).
    - Debe recibir **+927,00 €** cada mes.
    - Se financia combinando **+405,00 €** procedentes del remanente de nómina con **+522,00 €** traspasados desde el bote de reserva `Guardado Resto Paro`.
- **Implementación de Importes Negativos / Deducciones en Repartos**:
  - **Backend**: En `plantillas_reparto.py`, se habilitó el procesamiento de líneas con signo negativo (`centimos != 0`), permitiendo deducciones que reducen un bote previo (`Guardado Resto Paro`: −522,00 €) y aumentan la liquidez de reparto hacia el bote de hipotecas (+927,00 €) dentro de Deutsche Bank, manteniendo un flujo de caja neto bancario idéntico a la entrada real de efectivo (+1.463,00 € en DB).
  - **Frontend**: Modificación de inputs en `modales-acciones.js` para admitir valores negativos, visualización semántica en rojo (`#ef4444`) con etiqueta explícita `📤 Descuenta del sobre: Guardado Resto Paro`.
  - **Filtro de Cuentas Activas**: Corrección en los sembrados por defecto para asegurar la asignación a la cuenta activa de Caixa (#25) y Deutsche Bank (#19), ignorando cuentas archivadas.
- **Cuadre Matemático Exacto Verificado**:
  - **La Caixa (#25)**: Saldo inicial 2.880,50 € + 860,00 € (Alquileres 580 € + 280 €) − 526,00 € (9 recibos) = **3.214,50 €** ✅ *(Cuadre exacto con calculadora Caixa)*.
  - **Deutsche Bank (#19)**: Saldo inicial 4.396,75 € + 1.463,00 € (Alquiler Estudio 490 € + Nómina 973 €) − 548,00 € (3 recibos) = **5.311,75 €** ✅ *(Cuadre exacto con calculadora DB)*.
- **Cache y Calidad**:
  - Cache de Service Worker y assets actualizada a `app-conta-shell-v31`.
  - **158 tests en verde (`uv run pytest`)**, 0 fallos, 88% de cobertura global.
  - Ruff linter 100% limpio en `app_conta` y `tests`.

### 16. Rediseño Fintech Ejecutivo de Movimientos y Experiencia Visual (2026-11-01)

- **Propósito y Detección de Fricción Visual**:
  - El usuario indicó que la interfaz se sentía monótona, plana y uniforme («se confunde un poco todo tan igual»), solicitando una experiencia mucho más profesional donde los movimientos, procedencias y destinos sean inmediatamente reconocibles.
- **Avatares Temáticos Inteligentes y Badges**:
  - Clasificación automática por conceptos y comercios en `app_conta/static/js/vistas.js` (`clasificarMovimientoVisual`):
    - 💼 **Nóminas y Alquileres**: avatares en esmeralda con icono de ingresos.
    - 🛒 **Supermercados y Comida** (Mercadona, Carrefour, Lidl, Día): avatares en naranja con carrito.
    - 🏠 **Hipotecas y Hogar** (Hipoteca, Comunidad): avatares en índigo con casa.
    - ⚡ **Luz y Suministros** (Endesa, Iberdrola, Agua): avatares en cielo/azul con rayo.
    - 📶 **Telefonía e Internet** (Vodafone, Finetwork): avatares en violeta con señal/wifi.
    - 🍿 **Suscripciones y Ocio** (DAZN, Netflix, Cine): avatares en rosa con ticket.
    - 🚗 **Vehículos y Gasolina** (Repsol, Cepsa, Parking): avatares en ámbar con coche.
    - 🛡️ **Seguros e Impuestos** (IBI, Mutua, Seguros, Cruz Roja): avatares en pizarra con escudo.
  - **Insignias Bancarias de Origen** (`renderInsigniaCuenta`):
    - Cada movimiento muestra visualmente la entidad de pago con su logotipo y color corporativo (CaixaBank azul, Deutsche Bank azul marino, BBVA azul rey, Revolut grafito, Efectivo esmeralda, Tarjetas púrpura).
  - **Chips Interactivos de Sobres y Categorías**:
    - Reemplazo de los desplegables planos por píldoras semánticas (`📦 Sobre: <Nombre>` / `🏷️ Categoría`) con selector integrado de cambio instantáneo.
- **Feed Cronológico con Agrupación Diaria**:
  - Las transacciones se agrupan en bloques por fecha (`fechaTituloGrupo`) mostrando el desglose del día (`+Ingresos`, `−Gastos`, `Neto del día`).
- **Toolbar Interactiva con Búsqueda y Filtros en Tiempo Real**:
  - Búsqueda en vivo (`filtro-mov-buscar`) por texto, comercio, concepto, importe o fecha.
  - Píldoras segmentadas: `[ Todos ] [ 🟢 Solo Ingresos ] [ 🔴 Solo Gastos ]`.
  - Filtros directos por cuenta y por sobre con recálculo dinámico en pantalla.
  - Panel superior de KPIs: número de movimientos, total ingresado, total gastado y balance neto filtrado.
- **Sección «Últimos Movimientos» en Dashboard de Inicio**:
  - Inclusión en `#/inicio` de las últimas transacciones registradas con acceso directo al libro mayor.
  - Integración del mismo componente de fila en fondos de ahorro (`#/ahorro`), sobres (`#/botes`) y compras con tarjeta (`#/gastos-tarjetas`).
- **Cache y Versión**:
  - Service worker y assets actualizados a `app-conta-shell-v32`.
  - 158 tests en verde, 0 fallos, ruff 100% limpio.







