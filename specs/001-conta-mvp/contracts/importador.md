# Contrato del Importador (OCTUBRE.xlsx → App_Conta)

**Feature**: 001-conta-mvp | **Date**: 2026-10-13

Mapeo de las 14 hojas del Excel a entidades del MVP (spec FR-009/FR-010). El importador
**nunca corrige** errores del Excel: los detecta y marca. Ver `data-model.md` para
campos.

## Previsualización obligatoria (FR-009)

`POST /importacion/previsualizar` devuelve SIEMPRE este resumen antes de tocar la base de
datos:

```json
{
  "fichero": { "nombre": "OCTUBRE.xlsx", "huella": "sha256…", "repetido": false },
  "resumen": {
    "cuentas": 8, "botes": 21, "movimientos": 412, "categorias": 15,
    "saldo_total_cuentas": "-5860.00"
  },
  "avisos": [
    { "hoja": "HIP. PISO NOV (MENS.)", "fila": 12, "motivo": "fórmula con #REF!; importada como movimiento 'revisar'" }
  ],
  "diferencias_conciliacion": [
    { "bote": "Bote gastos 2026", "excel": "1030.00", "app": "1030.00", "diferencia": "0.00" }
  ]
}
```

`repetido: true` (misma huella ya importada) obliga a `?confirmar_repetido=true` en
`/importacion/aplicar` (FR-010).

## Mapeo hoja → entidad

| Hoja Excel | Entidad destino | Reglas |
|---|---|---|
| CAJA | `Conciliacion` (solo semilla de saldos) | Los saldos por cuenta se toman como `saldo_inicial`; el resto NO se recalcula |
| TARJETA DB / CARREFOUR / CAIXA | `Cuenta` tipo `tarjeta` + `Movimiento`s | Cada línea con comercio e importe → movimiento; signo negativo = gasto |
| GASTOS FIJOS MENSUALES 2025 | `Movimiento`s por recibo contra su cuenta | Cada recibo mensual se regist una vez con su categoría |
| BOTE PARA GASTOS 2026 | `Bote` tipo `recurrente` (semilla) | En el MVP solo se crea el bote y su saldo; el cálculo mensual es fase 2 |
| BOTES PROPIOS | `Bote` tipo `ahorro`/`proyecto`/`ajeno` | Las fianzas (580, 490 €) → tipo `ajeno` |
| COCHE PREST. | `Bote` tipo `proyecto` + movimientos de entregas de 200 € | Costes (IPTV, ITV, seguro, lavado) → movimientos del bote |
| AHORROS | `Bote` tipo `ahorro` + movimientos mensuales | Ajustes por alquiler cobrado de menos (580, 100, 80 €) → movimientos con descripción del motivo |
| SUELDO M.JOSE | `Movimiento`s de nómina (tipo ingreso) | Horas/complementarias → fase 4; en el MVP solo el neto como ingreso mensual |
| HIP. PISO NOV / ESTUDIO / CÓRDOBA | `Movimiento`s de cuota (gasto mensual) | Cuadros con `#REF!` NO se reconstruyen; se marca aviso |
| ANUARIO DE GASTOS TRAS REV. | (fuera del MVP) | Presupuesto → fase 2; se ignora con aviso en el resumen |

## Reglas del importador

1. **Sin recalcular**: un `#REF!` o una cifra dudosa produce movimiento `marcar_revisar`
   con `motivo_revision` textual; la importación NO se aborta (FR-009).
2. **Signos**: se normalizan a gasto negativo / ingreso positivo.
3. **Céntimos**: importes con >2 decimales se redondean con ROUND_HALF_UP y el ajuste se
   registra en el aviso.
4. **Categorías**: se derivan del nombre de la fila cuando es reconocible (Mercadona,
   Aldi, luz…); si no, categoría "Sin clasificar".
5. **Botes**: el saldo final por bote del Excel se compara con el calculado por la app;
   las diferencias se listan en `diferencias_conciliacion` (SC-004).
6. **Repetido**: huella sha256 del fichero; repetición exige confirmación explícita.
7. **Transferencias entre cuentas propias**: las filas de traspaso/transferencia (p. ej.
   "traspaso 200" en CAJA) generan **2 movimientos** —uno negativo en la cuenta origen y
   uno positivo en la destino— con descripción espejo, sin bote asignado; el importador
   los empareja por fecha e importe equivalente. El total de cuentas queda invariado y la
   conciliación sigue cuadrada (FR-016).
