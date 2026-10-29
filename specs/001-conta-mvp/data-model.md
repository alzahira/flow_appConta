# Data Model: App_Conta MVP

**Feature**: 001-conta-mvp | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

Convenciones globales: los importes se persisten como enteros en céntimos (`centimos`
BIGINT) y se exponen como euros con dos decimales (research.md D-01). Convención de
signos: **gasto negativo, ingreso positivo**. Todas las entidades llevan `id` (UUID
string) y `creado_en`/`actualizado_en` (timestamp). Los saldos NUNCA se persisten: se
calculan a partir de movimientos.

## Entidades

### Hogar

Raíz que agrupa todos los datos. En el MVP existe exactamente uno por instalación.

| Campo | Tipo | Reglas |
|---|---|---|
| id | UUID | PK |
| nombre | texto | obligatorio (p. ej. "Hogar Jaenes") |
| moneda | texto | fija "EUR" en el MVP |

> **Nota**: `Persona` (p. ej. la nómina de M. Jose) vuelve en la feature de nómina
> (fase 4 del diseño). Fuera del MVP por Principio VI (YAGNI).

### Cuenta

Dinero real disponible (Principio II: saldo derivado).

| Campo | Tipo | Reglas |
|---|---|---|
| id | UUID | PK |
| hogar_id | UUID | FK → Hogar |
| nombre | texto | obligatorio, único dentro del hogar |
| tipo | enum | `banco` \| `tarjeta` \| `efectivo` \| `inversion` |
| entidad | texto | opcional (p. ej. "La Caixa", "Deutsche Bank") |
| saldo_inicial_centimos | entero | obligatorio; puede ser negativo |
| fecha_apertura | fecha | obligatoria |
| archivada | bool | por defecto false |

**Invariantes**: nombre único por hogar; no se puede eliminar si tiene movimientos (la
app obliga a archivarla o a reasignar/borrar movimientos tras confirmación, FR-002/US2).

### Categoria

| Campo | Tipo | Reglas |
|---|---|---|
| id | UUID | PK |
| hogar_id | UUID | FK → Hogar |
| nombre | texto | obligatorio, único |
| color | texto | opcional (para la PWA) |
| archivada | bool | borrado lógico; no se permite eliminar con movimientos sin aviso (FR-005) |

### Bote

Sobre con saldo derivado (Principio II).

| Campo | Tipo | Reglas |
|---|---|---|
| id | UUID | PK |
| hogar_id | UUID | FK → Hogar |
| nombre | texto | obligatorio, único dentro del hogar |
| tipo | enum | `recurrente` \| `ahorro` \| `proyecto` \| `ajeno` |
| objetivo_centimos | entero \| null | opcional |
| objetivo_fecha | fecha \| null | opcional |
| archivado | bool | por defecto false |

**Invariantes**: saldo = suma de los movimientos asignados (nunca editable). El saldo
puede mostrarse en negativo con aviso, sin bloqueo (US3/edge cases).

### Movimiento

Única fuente de verdad de los saldos (FR-002, FR-003).

| Campo | Tipo | Reglas |
|---|---|---|
| id | UUID | PK |
| hogar_id | UUID | FK → Hogar |
| cuenta_id | UUID | FK → Cuenta |
| fecha | fecha | obligatoria |
| importe_centimos | entero | obligatorio, ≠ 0; signo = convención global |
| descripcion | texto | obligatoria |
| categoria_id | UUID \| null | FK → Categoria (opcional al registrar, obligatoria para informes) |
| bote_id | UUID \| null | FK → Bote (asignación opcional) |
| marcar_revisar | bool | true para filas dudosas del importador (FR-009) |
| motivo_revision | texto \| null | por qué se marcó "revisar" |
| origen | enum | `manual` \| `importacion` |
| eliminado | bool | borrado lógico con auditoría |

**Invariantes**: `importe_centimos ≠ 0`; la fecha puede ser anterior a `fecha_apertura`
de la cuenta (permitido, ver edge cases); toda edición/borrado queda registrado en
`AuditoriaMovimiento`.

### AuditoriaMovimiento

Historial auditable (FR-013).

| Campo | Tipo | Reglas |
|---|---|---|
| id | UUID | PK |
| movimiento_id | UUID | FK → Movimiento |
| accion | enum | `creado` \| `editado` \| `eliminado` \| `reasignado` |
| cambios | JSON | campos anteriores/nuevos |
| fecha | timestamp | automática |

### Conciliacion *(entidad de resultado, no persistida)*

Resultado del servicio de conciliación (FR-007). Nota contable: los saldos iniciales no
son movimientos, por lo que la identidad es
`Σ saldos_cuentas = Σ saldos_iniciales + Σ movimientos` y, como cada movimiento está
asignado a un bote o sin asignar, `Σ movimientos = saldo_total_botes + sin_asignar`.

| Campo | Reglas |
|---|---|
| fecha_calculo | fecha del cálculo |
| saldo_total_cuentas | Σ saldos de cuentas activas |
| saldo_inicial_total | Σ `saldo_inicial_centimos` de las cuentas activas |
| saldo_total_botes | Σ saldos de botes activos |
| sin_asignar | Σ importes de movimientos sin bote |
| diferencia | `saldo_total_cuentas − saldo_inicial_total − (saldo_total_botes + sin_asignar)` |
| estado | `cuadrado` si diferencia = 0, `revisar` en caso contrario |

`sin_asignar` es informativo: tener dinero sin asignar es normal (disponible sin
reservar) y NO rompe la conciliación. La diferencia solo se aparta de 0 cuando existen
movimientos reales no registrados (p. ej. desfase detectado al importar el Excel), que
es exactamente el aviso que debe mostrar el estado `revisar`.

## Relaciones

```text
Hogar 1───* Cuenta 1───* Movimiento *───1 Categoria (opcional)
Hogar 1───* Bote   1───* Movimiento (opcional, vía bote_id)
Movimiento 1───* AuditoriaMovimiento
```

## Reglas de validación (resumen para implementación)

1. Crear movimiento requiere cuenta existente y `importe_centimos ≠ 0` (FR-014 valida
   formato numérico en la entrada).
2. Reasignar movimiento a otro bote recalcula ambos saldos (FR-008) y registra auditoría
   `reasignado`.
3. Eliminar cuenta con movimientos: bloqueado salvo confirmación explícita con
   explicación del destino (US2 escenario 4).
4. Eliminar categoría en uso: requiere aviso de movimientos afectados (FR-005).
5. Bote marcado conseguido cuando `saldo ≥ objetivo` (US3 escenario 4).
6. Importación: detecta fichero repetido por huella (nombre+tamaño+fecha) y pide
   confirmación antes de duplicar (FR-010); filas dudosas → `marcar_revisar` +
   `motivo_revision` sin abortar (FR-009).
7. Redondeo: cualquier conversión a céntimos usa ROUND_HALF_UP explícito y queda
   registrada si produce ajuste (edge case del spec).
