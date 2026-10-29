# Quickstart de validación — App_Conta MVP

**Feature**: 001-conta-mvp | **Date**: 2026-10-13

Guía para validar que el MVP cumple la especificación de extremo a extremo. Es una guía
de verificación: los detalles de implementación viven en `tasks.md`.

## Requisitos previos

- Python 3.11 y `uv` instalados.
- Repositorio en la carpeta del proyecto con las dependencias instaladas
  (`uv sync` o equivalente definido en tasks).
- Fichero de histórico en `docs/OCTUBRE.xlsx`.

## 1. Arranque

1. Aplicar migraciones sobre la BD local (comando definido en tasks).
2. Arrancar el proceso único (API + PWA).
3. Abrir la PWA en el navegador; verificar que se instala (manifest) y que tras la
   primera carga funciona sin red (**SC-005**).

**Resultado esperado**: la pantalla principal muestra el bloque "Disponible real".

## 2. Alta manual de datos (US2 + US3)

1. Crear cuenta "La Caixa" tipo `banco`, saldo inicial 1.000 €.
2. Crear bote "Bote gastos" tipo `recurrente`.
3. Registrar un gasto de −30,50 € (Mercadona) asignado al bote.
4. Registrar un gasto de −12 € (Pepco) **sin** bote.

**Resultado esperado**: saldo de la cuenta = 957,50 €; saldo del bote = −30,50 €;
"sin asignar" = −12,00 € (informativo, no rompe la conciliación); con la identidad
corregida (`saldo_cuentas − saldos_iniciales − (botes + sin asignar)` =
957,50 − 1.000 − (−42,50) = 0), **diferencia 0,00 € y estado `cuadrado`** (SC-003,
céntimo a céntimo).

## 3. Categorías y totales (US4)

1. Crear categoría "Supermercado" y asignarla al movimiento de Mercadona.
2. Consultar el total de la categoría del mes.

**Resultado esperado**: "Supermercado" = −30,50 €.

## 4. Reasignación de bote (FR-008)

1. Reasignar el movimiento de Mercadona al bote "Ahorro viaje".

**Resultado esperado**: "Bote gastos" vuelve a 0,00 €; "Ahorro viaje" = −30,50 €; la
conciliación muestra auditoría `reasignado`.

## 5. Importación del Excel (US5)

1. `POST /importacion/previsualizar` con `docs/OCTUBRE.xlsx`.
2. Revisar el resumen: recuento de cuentas/botes/movimientos y la lista de avisos.
3. Aplicar la importación.
4. Repetir la previsualización del mismo fichero.

**Resultado esperado**: el segundo intento marca `repetido: true` y exige confirmación
(FR-010); los saldos por bote coinciden con el Excel con diferencia ≤ 0,01 €
(**SC-004**); las filas con `#REF!` aparecen como movimientos "revisar" (FR-009).

## 6. Copia de seguridad (US6)

1. Exportar copia; restaurarla en una instalación limpia.

**Resultado esperado**: saldos idénticos tras la restauración (**SC-006**).

## 7. Puertas de calidad (Principio III)

1. Ejecutar la suite de tests (`pytest`).
2. Comprobar cobertura de `services/` ≥ 95 %.

**Resultado esperado**: suite en verde y cobertura cumplida; los tests de
`services/dinero.py` incluyen los casos de redondeo (más de 2 decimales) y signos.
