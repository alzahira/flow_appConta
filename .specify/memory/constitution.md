<!--
Sync Impact Report (scratch — remove before commit):
- Version change: initial draft template → 1.0.0
- Modified principles: none (template placeholders replaced)
- Added sections: Core Principles (I–VI), Arquitectura y Stack, Flujo de Desarrollo y Calidad, Governance
- Removed sections: none
- Follow-up TODOs: none
-->

# App_Conta Constitution

## Core Principles

### I. Correctitud del Dinero (NON-NEGOTIABLE)

Todo importe se almacena y calcula como `Decimal` con dos cifras decimales; se prohíbe el
uso de `float`/`double` en operaciones monetarias. Convención única de signos: **gasto
negativo, ingreso positivo**; las deudas se modelan como entidades, no como signos.
Queda prohibido incrustar importes dentro de fórmulas o código: cada cifra proviene de un
movimiento, cuota o gasto recurrente registrado. Todo redondeo debe ser explícito
(`ROUND_HALF_UP` por defecto). *Rationale: la app reemplaza un Excel con errores `#REF!` y
cifras manuales; el dinero nunca puede calcularse mal.*

### II. Integridad de Botes (Envelope Integrity)

Cada movimiento pertenece exactamente a una cuenta, y su asignación a botes es explícita
(nula solo para movimientos sin asignar). El saldo de un bote se deriva siempre de sus
movimientos; nunca se edita a mano. La conciliación (equivalente a la hoja CAJA) debe
poder ejecutarse en cualquier momento y reportar la diferencia entre saldo real y saldo
de botes. Un bote con saldo insuficiente para su obligación debe reflejarlo como aviso,
no como error silencioso.

### III. Test-First en Reglas Financieras (NON-NEGOTIABLE)

Las reglas de negocio (cuota por sistema francés, cuadro de amortización, bote de gastos
recurrentes, conciliación, neto de nómina) se desarrollan con TDD: test escrito y validado
→ implementación → refactor. Cada regla tiene casos de borde documentados (meses
parciales, adelantos, alquileres cobrados de menos). La cobertura de los servicios de
dominio debe ser ≥ 95 % y ninguna regla financiera se mergea sin test.

### IV. Datos Primero

El esquema se versiona mediante migraciones (Alembic). La base de datos local es la
fuente de verdad del usuario; el Excel actual y cualquier importación futura se tratan
como orígenes externos, nunca como ediciones directas. El histórico nunca se destruye:
los movimientos se corrigen con movimientos de ajuste o edición auditable.

### V. Local-First y Privacidad

La aplicación funciona sin conexión: PWA instalable en móvil y escritorio con una única
base de datos SQLite local. No se requiere ningún servicio externo para funcionar. La
copia de seguridad es trivial (un archivo) y debe estar documentada. Los datos
financieros del hogar son privados por defecto.

### VI. Sencillez (YAGNI)

Un solo proceso servidor (API que sirve también la PWA), framework mínimo, sin
microservicios ni colas. Toda dependencia nueva debe justificarse frente a la
alternativa de no usarla. El alcance se gobierna por fases: MVP primero, el resto cuando
el MVP esté converge.

## Arquitectura y Stack

- **Backend**: Python 3.11 + FastAPI + SQLAlchemy 2.x sobre SQLite (PostgreSQL solo si
  más adelante se comparte entre varios dispositivos).
- **Frontend**: PWA (HTML/CSS/JS sin framework de build complejo) servida por el backend.
- **Capas**: interfaz (API + PWA) → servicios de dominio (botes, cuotas, conciliación) →
  repositorios. Las reglas de negocio viven SOLO en la capa de servicios.
- **Tests**: pytest; pruebas unitarias de dominio y de API; scripts reproducibles.
- **Importador**: feature de primera clase para cargar el histórico desde `OCTUBRE.xlsx`.

## Flujo de Desarrollo y Calidad

- Spec-Driven Development con Spec Kit: constitución → especificación → plan → tareas →
  análisis → implementación → convergencia, un artefacto revisado antes de pasar al
  siguiente.
- Idioma del producto y de la documentación: **español**; identificadores de código en
  inglés.
- Puertas de calidad antes de dar una fase por convergida: tests en verde, migraciones
  aplicables desde cero, importador verificado contra datos reales, conciliación sin
  diferencias inexplicadas.
- Revisión humana obligatoria de cada artefacto `.specify/` antes de implementar.

## Governance

Esta constitución prevalece sobre cualquier otra práctica del proyecto. Las enmiendas
requieren: propuesta escrita, revisión, aprobación explícita del usuario, actualización
de versión (MAJOR si se elimina o redefine un principio, MINOR si se añade, PATCH si solo
se clarifica) y validación de cumplimiento en cada revisión de tarea. El incumplimiento
de un principio debe documentarse como desviación aprobada, nunca ignorarse.

**Version**: 1.0.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-13
