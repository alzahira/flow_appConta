# AUDITORÍA — Flow (app_conta) · 2026-11-14

Alcance: código en `app_conta/`, migraciones, tests, Docker/nginx y PWA. No se modificó ningún fichero del proyecto; los tests nuevos están en `audit_tests/`.
Herramientas: lectura de código, bandit 1.9.4, pip-audit (sobre `uv.lock`), pytest (suite original + `audit_tests`), ruff.

## 1. Resumen ejecutivo

Flow es una PWA FastAPI + SQLite + JS vanilla con modelo multi-hogar, dinero en céntimos enteros (Decimal en la frontera) y un buen nivel de base en seguridad: scrypt, cookie HttpOnly/SameSite=Strict, sesiones hasheadas en BD, CSP sin `unsafe-inline` en scripts, filtrado por hogar en todos los servicios.

**Lo bueno (verificado con tests):**
- **Aislamiento entre hogares: sin fallos.** 10 recursos × GET/PATCH/PUT/DELETE, 14 acciones con IDs ajenos como referencia y listados. Todo devuelve 404/403.
- Todas las rutas `/api/v1` (salvo login/logout) devuelven 401 sin sesión.
- Aritmética monetaria exacta: 10.000 casos contra `Decimal` HALF_UP, sin `float` en el código, sin deriva.
- Concurrencia de escritura: 200 inserciones simultáneas y 80 traspasos, 0 errores y saldos exactos.
- SQL: consultas parametrizadas. Los avisos de bandit B608 en `backup.py` son falsos positivos (tablas de lista blanca).

**Lo que hay que arreglar antes de abrir a más usuarios / móvil:**
1. El límite de intentos de login se evade con `X-Forwarded-For` en el despliegue documentado (**alta**).
2. Las claves foráneas de SQLite nunca se activan (**alta**).
3. Sin `.dockerignore`: la imagen incluye `.git`, `*.db`, backups y scripts con datos personales (**alta**).
4. Varios 500 por desbordamiento de enteros y fecha sin validar (**media**).
5. El modelo no está preparado para multiusuario real: no hay alta de usuarios/hogares y los nombres reales están en el código (**media, arquitectura**).

Recuento: 0 críticas · 3 altas · 9 medias · 9 bajas.

## 2. Resultados de tests

| Suite | Resultado |
|---|---|
| Original (`tests/`) | 184 tests: **178 ok, 3 fallan, 3 skipped**, 10m49s |
| Nuevos (`audit_tests/`) | 118 tests: **113 ok, 5 fallan** (los 5 son bugs reales), ~95 s |
| pip-audit | 2 paquetes con CVE, ambos transitivos (ver H-17) |
| bandit | 0 altas; 17× B608 (falsos positivos), B104, B110 |
| ruff | avisos de estilo (espacios finales, p. ej. `conciliacion.py:274`) |

**Los 3 fallos de la suite original son tests desactualizados, no bugs de la app:**
- `tests/api/test_auth.py::test_logout_invalida_sesion`: el fixture `client` ya trae una sesión de javier. El test inicia sesión como "mujer" y, tras el logout, `/me` sigue respondiendo como javier. Reproducido en `audit_tests` con un cliente limpio: logout correcto (401).
- `tests/api/test_botes.py::...409_y_confirmacion`: espera que al borrar un bote sus movimientos queden con `bote_id=None`. El commit `019be1f` cambió el comportamiento para preservarlos.
- `tests/integration/test_cuadre_produccion.py:183`: llama a `poner-a-cero` sin contraseña, que ahora es obligatoria (401).

**Los 5 fallos de `audit_tests`** (todos 500 de la app, ver H-04): importe `92233720368547758.08`, id de path `99999999999999999999` o `9223372036854775808`, `offset=99999999999999999999`, y el fuzz global (bote_id fuera de int64 y fecha `1e999` en pagos-recurrentes).

**Mediciones:**
- scrypt N=2^16: ~780 ms por login/verify y ~64 MiB de RAM por operación.
- Carga con 20.000 movimientos: `/movimientos` 25 ms; `/conciliacion` ~590 ms; `GET /cuentas/{id}` ~565 ms y 3,2 MB (sin paginar).
- 10 clientes leyendo a la vez con 20k movimientos: ~1 req/s en total (se serializa).
- SQLite: `journal_mode=delete`, `foreign_keys=0`.

## 3. Hallazgos

### ALTA

**H-01 · Rate-limit de login evadible con X-Forwarded-For**
- Dónde: `Dockerfile:52` (`--forwarded-allow-ips='*'`), `deploy/nginx-flow.conf` (`$proxy_add_x_forwarded_for`), `app_conta/services/seguridad.py:133-142`, `app_conta/api/auth.py:65-83`.
- Reproducir: uvicorn con `'*'` toma el primer elemento de `X-Forwarded-For` (`uvicorn/middleware/proxy_headers.py::get_trusted_client_address`, rama `always_trust`). Nginx añade al final de la cabecera que envía el cliente. Mandar `X-Forwarded-For: 1.2.3.<n>` distinto en cada intento da un contador nuevo. Con `APP_CONTA_TRUST_PROXY` activo, el test `test_rate_limit_login_y_bypass_por_xff` confirma que 12 fallos seguidos no dan 429.
- Impacto: fuerza bruta sin límite sobre usuarios conocidos (`javier`, `mujer`, `demo`). Cada intento cuesta ~0,8 s de CPU y 64 MiB, así que también sirve para agotar recursos. El contador es solo por IP, no por cuenta.
- Corrección: `--forwarded-allow-ips=127.0.0.1` (o la IP del proxy). En nginx, `proxy_set_header X-Forwarded-For $remote_addr;`. Añadir bloqueo por usuario con backoff y `limit_req` en nginx para `/api/v1/auth/login`.

**H-02 · Claves foráneas de SQLite desactivadas**
- Dónde: `app_conta/db.py:18-22` (sin `PRAGMA foreign_keys=ON`). `services/backup.py:~155,~318` ejecutan `PRAGMA foreign_keys = OFF/ON` dentro de una transacción, donde SQLite lo ignora.
- Reproducir: `test_integridad_referencial_no_se_aplica` confirma `PRAGMA foreign_keys = 0` en la conexión de la app.
- Impacto: filas huérfanas (movimiento con `cuenta_id` inexistente), `ondelete` sin efecto, y la restauración de backups puede insertar referencias a datos de otro hogar sin que nada lo detecte.
- Corrección: listener `connect` en el engine con `PRAGMA foreign_keys=ON; journal_mode=WAL; busy_timeout=5000; synchronous=NORMAL`. Quitar los PRAGMA de `backup.py` (o ejecutarlos fuera de transacción) y comprobar con `PRAGMA foreign_key_check` antes de activar en producción.

**H-03 · Sin `.dockerignore`: datos personales y `.git` dentro de la imagen**
- Dónde: `Dockerfile:36` (`COPY . /app`); no existe `.dockerignore`.
- Impacto: la imagen incluye `.git` (historial completo), `.env`, `*.db`, `app_conta/backups/` (JSON financieros en claro), `scripts/aplicar_datos_javier.py` y `scripts/actualizar_datos_reales.py` (273 y 325 líneas, ignorados por git pero presentes en disco), `tests/_test_conta.db` y `docs/`. Si la imagen se sube a un registro o se comparte, se filtra todo.
- Corrección: `.dockerignore` con `.git`, `.venv`, `.env*`, `*.db`, `backups/`, `scripts/`, `tests/`, `audit_tests/`, `docs/`, `.cursor`, `.opencode`, `.specify`. Revisar si `scripts/` contiene datos reales antes de ningún push o commit.

### MEDIA

**H-04 · 500 por desbordamiento de enteros y fecha sin validar**
- Dónde: `services/dinero.py:20-30` (sin tope de importe), IDs de path/query/body sin rango (`api/*`), `services/pagos_recurrentes.py:292` (`date.fromisoformat` sin capturar).
- Reproducir: `POST /movimientos` con `importe="92233720368547758.08"` → `OverflowError: Python int too large to convert to SQLite INTEGER` → 500. `GET /cuentas/99999999999999999999` → 500. `?offset=99999999999999999999` → 500. `PATCH /movimientos/{id}/bote {"bote_id": 9223372036854775808}` → 500. `POST /pagos-recurrentes/ejecutar {"fecha":"1e999"}` → `ValueError`, 500.
- Impacto: cualquier usuario autenticado provoca errores 500 y trazas en logs. Sin tope de negocio (acepta 1.000.000.000 €), un importe grande puede desbordar sumas posteriores.
- Corrección: `Annotated[int, Field(ge=1, le=2**31-1)]` para IDs y paginación; tope de importe (p. ej. ±999.999.999,99 €) en `euros_a_centimos`; capturar `ValueError` en la fecha y devolver 422; `Query(le=...)`.

**H-05 · Sin límites de longitud en textos**
- Dónde: schemas Pydantic de `app_conta/api/*.py` (`nombre: str`, `descripcion: str` sin `max_length`).
- Reproducir: `test_texto_enorme_sin_limite`: una descripción de 5 MB devuelve 201; un nombre de cuenta de 100.000 caracteres devuelve 201. Nginx permite 30 MB por petición.
- Impacto: crecimiento de la BD, listados pesados y DoS por usuarios autenticados.
- Corrección: `Field(max_length=...)` (nombre 120, descripción 500, notas 2000) y `client_max_body_size 1m` en las rutas JSON, dejando 30M solo para importar/restaurar.

**H-06 · XSS almacenado en el aviso "deshacer borrado"**
- Dónde: `static/js/app.js:884-891` (`mostrarToastDeshacer`).
- Reproducir: la descripción pasa por `data-concepto="${esc(...)}"` y se lee con `dataset` (decodifica). Después `.replace(/<[^>]*>/g,"")` solo quita etiquetas completas, así que `<img src=x onerror=...` (sin `>`) sobrevive y el `</strong>` posterior cierra la etiqueta. Es una lectura de código (revisión por subagente, confirmada por mí en las líneas 887-891); no se ejecutó en un navegador.
- Impacto: mitigado por `script-src 'self'` (los `onerror` inline quedan bloqueados). Si el CSP cambia o falta, sería ejecución de script al borrar un movimiento creado por otro miembro o importado. Riesgo real en cuanto haya más de un usuario por hogar.
- Corrección: construir el toast con `textContent`, o `esc(concepto)`.

**H-07 · Mensajes de error del servidor inyectados con `innerHTML` sin `esc()`**
- Dónde: `static/js/app.js:107`; `static/js/modales-acciones.js:361, 1046, 1445, 1600, 1783`.
- Impacto: `services/botes.py:84`, `categorias.py:63` y `cuentas.py:79` incluyen el nombre del usuario en el mensaje (`Ya existe un bote llamado '...'`). Si ese mensaje llega a esos sinks, es XSS reflejado. No tracé qué caminos concretos llegan a ellos.
- Corrección: `esc(err.message)` en todos.

**H-08 · Respuestas cortadas por el middleware de auth sin cabeceras de seguridad**
- Dónde: `app_conta/main.py:66` y `:116`. El middleware de auth, registrado en segundo lugar, es el más externo.
- Reproducir: `test_respuestas_401_carecen_de_cabeceras_de_seguridad`: un 401/403 de `proteger_api` no lleva CSP, `no-store` ni `nosniff`.
- Impacto: bajo en datos, pero rompe la política de "no cachear la API" en errores.
- Corrección: invertir el orden de registro o fusionar ambos middlewares.

**H-09 · Multiusuario no soportado por diseño**
- Dónde: `services/usuarios.py:80-141` (usuarios `javier`/`mujer`/`demo` y hogar "Familia Jaenes" fijos en código); no hay endpoints de alta de usuario, hogar o invitación, ni recuperación de contraseña. Roles `admin`/`miembro`/`demo` sin matriz de permisos documentada.
- Reproducir: `test_rol_demo_puede_escribir_datos` (informativo): el rol `demo` puede crear datos; solo backup e importación exigen admin.
- Impacto: para móvil/multiusuario hay que tocar código y BD a mano por cada hogar. Los datos personales están en el repositorio.
- Corrección: onboarding (registro/invitación), gestión de miembros, recuperación de contraseña, restricción de escritura para el rol demo, usuarios iniciales solo por variables de entorno o script de provisión.

**H-10 · `docker-compose.yml` con contraseñas por defecto que contradicen el código**
- Dónde: `docker-compose.yml:17-18` (`${APP_CONTA_ADMIN_PASSWORD:-flow2026}`) y `usuarios.py:47-55`.
- Impacto: `flow2026` tiene 8 caracteres y en producción el código exige 12+. Sin `.env`, el contenedor falla al arrancar con `RuntimeError`. Y si alguien la alarga a mano, queda una contraseña pública de por vida. Además `flow2026` figura en el historial de git (`068b42f`).
- Corrección: quitar los valores por defecto (`${VAR:?definir}`), rotar cualquier contraseña real que haya sido `flow2026`.

**H-11 · Backups: sin estrategia fiable ni cifrado**
- Dónde: `services/backup.py:21` (`BACKUPS_DIR = app_conta/backups`, dentro del código y fuera del volumen `/data`), `:110-122` (cada exportación escribe un JSON en claro), `deploy/despliegue-vps.md:111` (`cp` del `.db` vivo).
- Impacto: los backups automáticos se pierden al recrear el contenedor, nunca se rotan (en esta auditoría la suite original generó ~150 ficheros) y quedan sin cifrar. El `cp` de un SQLite en uso no es consistente. No hay copia externa. La restauración (`restaurar_datos_completos`) borra los datos del hogar sin hacer antes copia automática, a diferencia de `vaciar`.
- Corrección: `sqlite3 .backup` o `VACUUM INTO` en cron, a `/data/backups` con rotación y copia fuera del VPS (cifrada); backup previo obligatorio en restaurar; prueba periódica de restauración.

**H-12 · Restauración de backup sin validar referencias**
- Dónde: `services/backup.py:~296-321` (`_insertar_filas`).
- Impacto: solo el admin puede restaurar, pero un JSON manipulado puede insertar `cuenta_id`, `bote_id` o `categoria_id` de otro hogar en filas del suyo. Con H-02 abierto nada lo detecta. Las columnas solo se validan por regex, no contra una lista blanca por tabla.
- Corrección: lista blanca de columnas por tabla y verificación de que todo FK apunta a filas del propio hogar (o del propio backup) antes de confirmar.

### BAJA

- **H-13 · `mismo_hogar(valor, None)` devuelve True** (`services/hogar.py:28-30`). `hogar_id` es opcional en casi todos los servicios (`botes.py:119`, `cuentas.py:116`, …); si un endpoint futuro lo olvida, el filtro falla abierto. Hoy todos los endpoints probados lo pasan. Hacerlo obligatorio.
- **H-14 · Tipos mezclados de `hogar_id`**: `Cuenta.hogar_id` es `str` y `Movimiento.hogar_id` es `int`. Hay parches (`CAST(hogar_id AS TEXT)` en `backup.py`, `| str` en `api/importacion.py` historial). Migrar a `Integer` con FK.
- **H-15 · Logout público y sin CSRF** (`main.py:53-56`): un sitio externo puede cerrar la sesión. Impacto mínimo.
- **H-16 · CSRF sin Origin/Sec-Fetch-Site**: solo protege `SameSite=Strict` (`main.py:139-148`). Suficiente en navegadores modernos; mantener.
- **H-17 · Dependencias**: `certifi 2026.7.22` (PYSEC-2026-4320, corregido en 2026.10.18) vía httpx (dev); `opentelemetry-api 1.45.1` (CVE-2026-126360, corregido en 1.45.2). Ninguna afecta al runtime de producción. No se revisaron versiones obsoletas más allá de pip-audit.
- **H-18 · `datetime.utcnow()` deprecado** (25 usos, p. ej. `services/usuarios.py:25`) y fechas naive. Usar `datetime.now(UTC)`.
- **H-19 · Sesiones**: 30 días sin caducidad por inactividad ni rotación; tope de 10 sesiones por usuario (la más antigua se expulsa; en los tests esto invalidó una sesión). Reducir a 7-14 días con renovación, y mostrar "dispositivos".
- **H-20 · Servidor de desarrollo expuesto**: `main.py:307` escucha en `0.0.0.0` por defecto (bandit B104) e imprime contraseñas generadas en consola (`usuarios.py:60`).
- **H-21 · nginx**: sin `limit_req`; cabecera `X-XSS-Protection "1; mode=block"` frente a `0` en la app; `Upgrade`/`Connection "upgrade"` fijos sin necesidad; HSTS con `preload` sin haber validado el dominio.
- **H-22 · XLSX con `openpyxl` sin `defusedxml`** (`services/importador/lector.py`): el límite de ZIP ayuda; riesgo bajo (solo admin). Instalar `defusedxml`.
- **H-23 · Logs con nombre de usuario** (`auth.py:69,79`): logs de intentos fallidos con el username introducido, que puede ser una contraseña tecleada en el campo equivocado. No se registran contraseñas ni tokens.
- **H-24 · Accesibilidad / PWA**: `lang="es"`, `viewport` y `aria-label` básicos presentes (31 `aria-label` en JS), pero solo 1 regla `:focus-visible`/`prefers-reduced-motion` en 4.386 líneas de CSS, el manifest solo tiene icono SVG (sin PNG 192/512 ni `apple-touch-icon`), y los avisos dinámicos (toasts) sin `role="status"`. No se probó con lector de pantalla.

## 4. Arquitectura y deuda técnica

- **Capas:** `api/` → `services/` → `models/` bien separadas. Los servicios lanzan excepciones propias (`ErrorNoEncontrado`, `ErrorValidacion`) mapeadas por `api/errors.py`. Falta mapear `OverflowError` y `ValueError` genéricos (H-04).
- **Tamaño:** `modales-acciones.js` (3.107 líneas), `styles.css` (4.386), `plantillas_reparto.py` (704) y `importador/mapeo.py` (812) concentran la complejidad. Candidatos a dividir.
- **Duplicación:** `exigir_hogar` se repite manualmente en cada `obtener_*`. Mejor un repositorio base con `hogar_id` obligatorio (resuelve H-13).
- **Escalabilidad:**
  - SQLite con una conexión sin WAL ni `busy_timeout`; con 10 hilos de escritura funcionó, pero sin margen.
  - Rate-limit y estado en memoria del proceso: no sirve con varios workers.
  - `conciliacion` y `cuentas/{id}` calculan todo en cada petición (O(n) en movimientos; ~0,6 s con 20k) y `cuentas/{id}` devuelve todos los movimientos sin paginar (3,2 MB). `/cuentas` calcula el saldo cuenta a cuenta (N+1).
  - Para multiusuario real con móvil: PostgreSQL, saldos materializados o cacheados, paginación.
- **Migraciones:** 11 versiones de Alembic, aplicadas desde BD vacía sin errores. `alembic upgrade head` se ejecuta en cada arranque del contenedor, lo que está bien con un solo contenedor. No se comprobó `alembic check` (deriva entre modelos y migraciones).
- **Estructura confusa:** `src/app_conta/__init__.py` es un paquete fantasma que choca con `app_conta/`. El `.pth` del venv apunta a `src/`, así que `import app_conta.main` falla fuera de la raíz del proyecto y el entry point `app-conta` instalado probablemente no arranca (no probado). Además `start_server.py` apunta a la ruta antigua `App_Conta`, y hay `.bat`/`.ps1` y dos BD vacías en la raíz (`app_conta.db`, `conta.db`).
- **Tests:** ~11 s de scrypt por test que inicia sesión (la suite tarda 10m49s). Añadir un hook de test para bajar `SCRYPT_N`. Los tests de backup escriben en `app_conta/backups/` real (hay que aislar `BACKUPS_DIR`).
- **PWA/Service worker:** `sw.js` hace network-first, no cachea `/api/` y solo guarda el shell estático; no guarda datos privados. Correcto. `skipWaiting` + `cache:"reload"` sin versionado de assets.
- **Configuración:** 100% por variables de entorno (`APP_CONTA_*`), sin `.env.example`. `pyproject.toml` usa `>=` sin tope (el `uv.lock` fija versiones, bien).
- **Integridad financiera:** céntimos enteros, `ROUND_HALF_UP`, sin floats. Se permiten botes en negativo (`conciliacion` cuadra igualmente con un bote en −12,34 €); decidir si es regla de negocio.

## 5. Plan de acción priorizado

**Ahora (1-2 días)**
1. H-01: `--forwarded-allow-ips`, `X-Forwarded-For $remote_addr`, bloqueo por usuario y `limit_req`.
2. H-03: crear `.dockerignore` y revisar `scripts/` antes de cualquier push de imagen.
3. H-10: quitar contraseñas por defecto de `docker-compose.yml` y rotar las reales.
4. H-02: PRAGMAs de conexión (FK, WAL, busy_timeout) tras ejecutar `foreign_key_check`.

**Corto plazo (1-2 semanas)**
5. H-04 y H-05: validación de rangos y longitudes en Pydantic; manejador global de excepciones.
6. H-06 y H-07: `esc()`/`textContent` en el toast y en los mensajes de error.
7. H-11 y H-12: backup consistente fuera del contenedor con rotación y copia externa; validación de FKs en restaurar.
8. Arreglar los 3 tests desactualizados y aislar `BACKUPS_DIR` en tests.

**Medio plazo (antes de abrir a más usuarios / móvil)**
9. H-09: alta de usuarios/hogares, invitaciones, recuperación de contraseña y matriz de roles.
10. Paginación y cacheo de saldos; evaluar PostgreSQL.
11. H-13/H-14: `hogar_id` obligatorio y de tipo entero con FK.
12. Limpieza: paquete `src/`, scripts obsoletos, H-18/H-19/H-24.

## 6. Qué se ejecutó y cómo reproducirlo

```
.venv\Scripts\python -m pytest -c audit_tests/pytest.ini --rootdir=audit_tests audit_tests -s
.venv\Scripts\python -m pytest -p no:cacheprovider --no-cov            # suite original
```
`audit_tests/` usa una BD temporal propia y acelera scrypt solo dentro de esos tests. Los 5 fallos esperados reproducen H-04.

**Efectos secundarios de la auditoría:** la suite original creó `tests/_test_conta.db` y unos 150 ficheros en `app_conta/backups/` (todos ignorados por git). No los he borrado. `git status` solo muestra `audit_tests/` y `AUDITORIA.md` como nuevos, más tus cambios previos en `docs/`.

**Limitaciones:** el XSS (H-06/H-07) se confirmó leyendo el código, no en un navegador. Los hallazgos de nginx/Docker son de configuración leída, no desplegada. No se hizo una prueba de carga con red real ni pruebas de lector de pantalla.

---
Pendiente de tu confirmación: **no he aplicado ningún arreglo.**
