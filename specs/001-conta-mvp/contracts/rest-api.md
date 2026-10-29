# Contrato REST API — App_Conta MVP

**Feature**: 001-conta-mvp | **Date**: 2026-10-13

Base: `/api/v1`. Formato: JSON. Importes siempre como **euros con dos decimales en
string** (p. ej. `"-30.50"`) para evitar any pérdida de precisión en JS; el servidor
convierte a céntimos enteros (research.md D-01). Convención de signos: gasto negativo,
ingreso positivo.

## Errores

Todos los errores usan: `{ "error": { "codigo": "string", "mensaje": "string" } }` con
HTTP 400 (validación), 404 (no encontrado), 409 (conflicto, p. ej. eliminar cuenta con
movimientos).

## Endpoints

### Disponible real

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/conciliacion` | Resultado de conciliación: `fecha_calculo`, `saldo_total_cuentas`, `saldo_inicial_total`, `saldo_total_botes`, `sin_asignar`, `diferencia`, `estado` (FR-007, SC-001) |

### Cuentas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/cuentas` | Lista con saldo calculado por cuenta y total |
| POST | `/cuentas` | Crear (nombre, tipo, entidad, saldo_inicial, fecha_apertura) |
| GET | `/cuentas/{id}` | Detalle con movimientos |
| PATCH | `/cuentas/{id}` | Editar campos no derivados |
| DELETE | `/cuentas/{id}` | 409 si tiene movimientos activos, salvo `?confirmar_destino=archivar\|eliminar_movimientos` (US2-4) |

### Movimientos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/movimientos?desde=&hasta=&cuenta=&bote=&categoria=` | Lista filtrable y paginada |
| POST | `/movimientos` | Crear (fecha, importe, descripcion, cuenta_id, categoria_id?, bote_id?) |
| PATCH | `/movimientos/{id}` | Editar; registra auditoría |
| DELETE | `/movimientos/{id}` | Borrado lógico + auditoría |
| PATCH | `/movimientos/{id}/bote` | Reasigna bote (FR-008); cuerpo: `{ "bote_id": "uuid\|null" }` |

### Botes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/botes` | Lista con saldo derivado, objetivo y estado (`conseguido` cuando saldo ≥ objetivo) |
| POST | `/botes` | Crear (nombre, tipo, objetivo?, objetivo_fecha?) |
| PATCH | `/botes/{id}` | Editar |
| DELETE | `/botes/{id}` | Archiva; los movimientos asignados pasan a "sin asignar" con confirmación |

### Categorías

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/categorias` | Lista con total acumulado en periodo opcional |
| POST | `/categorias` | Crear (nombre, color?) |
| PATCH | `/categorias/{id}` | Editar |
| DELETE | `/categorias/{id}` | 409 si está en uso, salvo `?confirmar=true` (FR-005) |

### Importación

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/importacion/previsualizar` | Sube OCTUBRE.xlsx y devuelve resumen sin aplicar (FR-009) |
| POST | `/importacion/aplicar` | Aplica la importación del resumen aceptado |
| GET | `/importacion/historial` | Importaciones previas (detección de repetidas, FR-010) |

### Copia de seguridad

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/backup/exportar` | Fichero único JSON con cuentas, movimientos, categorías, botes (FR-012) |
| POST | `/backup/restaurar` | Restaura una copia tras confirmación (US6) |

## Ejemplo — POST /movimientos

Request:

```json
{
  "fecha": "2026-10-13",
  "importe": "-30.50",
  "descripcion": "Mercadona semanal",
  "cuenta_id": "…",
  "categoria_id": "…",
  "bote_id": null
}
```

Response 201:

```json
{
  "id": "…",
  "fecha": "2026-10-13",
  "importe": "-30.50",
  "descripcion": "Mercadona semanal",
  "cuenta_id": "…",
  "bote_id": null,
  "marcar_revisar": false
}
```
