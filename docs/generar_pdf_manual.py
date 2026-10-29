"""Generador del Manual de Arquitectura y Guía Técnica de App_Conta en formato PDF.

Genera un documento profesional de alta calidad que explica toda la aplicación:
- Stack tecnológico y justificación técnica.
- Estructura de carpetas y ficheros.
- Modelos de datos y base de datos relacional SQLite con Alembic.
- Capa de servicios y reglas contables fundamentales (Principio I, II y III).
- API REST con FastAPI y endpoints.
- Frontend PWA Vanilla JS, diseño fintech y arquitectura de componentes.
- Batería de pruebas automatizadas (136 tests).
- Guía operativa y flujo de ejecución.
"""

from __future__ import annotations

import os
import shutil
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasadas para calcular dinámicamente 'Página X de Y' y pintar cabeceras."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self.saveState()
                self.setFont("Helvetica-Bold", 8)
                self.setFillColor(colors.HexColor("#0f172a"))
                self.drawString(40, 812, "App_Conta")

                self.setFont("Helvetica", 8)
                self.setFillColor(colors.HexColor("#64748b"))
                self.drawString(88, 812, "|  Manual de Arquitectura y Guía Técnica del Sistema")

                # Línea superior de cabecera
                self.setStrokeColor(colors.HexColor("#e2e8f0"))
                self.setLineWidth(0.6)
                self.line(40, 804, 555, 804)

                # Línea inferior de pie
                self.line(40, 42, 555, 42)
                self.drawString(40, 30, "Contabilidad del Hogar por Sistema de Botes  •  Confidencial / Uso Personal")
                page_text = f"Página {self._pageNumber} de {num_pages}"
                self.drawRightString(555, 30, page_text)
                self.restoreState()
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)


def crear_caja_destacada(titulo: str, texto: str, estilo_tit, estilo_txt, bg_color="#f8fafc", border_color="#cbd5e1"):
    """Crea una tarjeta de llamada/alerta con borde y fondo suaves."""
    contenido = [
        Paragraph(f"<b>{titulo}</b>", estilo_tit),
        Spacer(1, 4),
        Paragraph(texto, estilo_txt),
    ]
    t = Table([[contenido]], colWidths=[515])
    t.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg_color)),
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(border_color)),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ])
    )
    return t


def generar_pdf(ruta_destino: str):
    doc = SimpleDocTemplate(
        ruta_destino,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=48,
        bottomMargin=48,
    )

    styles = getSampleStyleSheet()

    # Colores base
    c_primary = colors.HexColor("#0f172a")     # Slate 900
    c_brand = colors.HexColor("#0284c7")       # Sky 600
    c_emerald = colors.HexColor("#059669")     # Emerald 600
    c_text = colors.HexColor("#1e293b")        # Slate 800
    c_muted = colors.HexColor("#475569")       # Slate 600
    c_border = colors.HexColor("#e2e8f0")      # Slate 200

    # Estilos tipográficos
    title_style = ParagraphStyle(
        "CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=30,
        textColor=c_primary,
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        fontName="Helvetica",
        fontSize=12,
        leading=17,
        textColor=c_muted,
        alignment=0,
    )
    h1_style = ParagraphStyle(
        "Heading1_Custom",
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )
    h2_style = ParagraphStyle(
        "Heading2_Custom",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=c_brand,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )
    h3_style = ParagraphStyle(
        "Heading3_Custom",
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=c_primary,
        spaceBefore=6,
        spaceAfter=2,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "Body_Custom",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.2,
        textColor=c_text,
        spaceAfter=5,
    )
    body_bold = ParagraphStyle(
        "Body_Bold",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12.2,
        textColor=c_text,
    )
    bullet_style = ParagraphStyle(
        "Bullet_Custom",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=c_text,
        leftIndent=14,
        spaceAfter=3,
    )
    code_style = ParagraphStyle(
        "Code_Custom",
        fontName="Courier",
        fontSize=7.2,
        leading=9.5,
        textColor=colors.HexColor("#0f172a"),
    )
    callout_tit = ParagraphStyle(
        "Callout_Title",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=c_primary,
    )
    callout_txt = ParagraphStyle(
        "Callout_Text",
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=c_text,
    )
    table_cell = ParagraphStyle(
        "TableCell",
        fontName="Helvetica",
        fontSize=7.8,
        leading=10.5,
        textColor=c_text,
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=10.5,
        textColor=c_text,
    )
    table_cell_mono = ParagraphStyle(
        "TableCellMono",
        fontName="Courier",
        fontSize=7.2,
        leading=9.5,
        textColor=c_primary,
    )
    table_header = ParagraphStyle(
        "TableHeader",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10.5,
        textColor=colors.white,
    )

    story = []

    # =========================================================================
    # PORTADA / ENCABEZADO PRINCIPAL
    # =========================================================================
    story.append(Spacer(1, 20))
    story.append(Paragraph("APP_CONTA — MANUAL INTEGRAL DEL SISTEMA", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Guía completa de arquitectura, stack tecnológico, modelo de datos, API y frontend PWA", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=2, color=c_primary, spaceBefore=0, spaceAfter=14))

    # Ficha técnica de resumen en portada
    ficha_data = [
        [
            Paragraph("<b>Proyecto:</b> App_Conta (Control Financiero del Hogar)", table_cell),
            Paragraph("<b>Entorno:</b> Python 3.11 + Gestor 'uv'", table_cell),
        ],
        [
            Paragraph("<b>Arquitectura:</b> SPA/PWA Local + API REST FastAPI", table_cell),
            Paragraph("<b>Base de Datos:</b> SQLite Relacional ('conta.db')", table_cell),
        ],
        [
            Paragraph("<b>Estado de Calidad:</b> 136 Tests Verdes (100% Passing)", table_cell),
            Paragraph("<b>Cobertura Global:</b> 92% (Core Services al 94%)", table_cell),
        ],
        [
            Paragraph("<b>Migraciones:</b> Alembic (4 revisiones versionadas)", table_cell),
            Paragraph("<b>Diseño UI:</b> Fintech Obsidian/Slate (Vanilla JS/CSS)", table_cell),
        ],
    ]
    t_ficha = Table(ficha_data, colWidths=[257, 258])
    t_ficha.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.8, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_ficha)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 1: QUÉ ES Y FILOSOFÍA DEL PROYECTO
    # =========================================================================
    story.append(Paragraph("1. ¿Qué es App_Conta y qué problema resuelve?", h1_style))
    story.append(Paragraph(
        "App_Conta nace para sustituir de forma definitiva el libro de control familiar en Excel (<b>OCTUBRE.xlsx</b> de 14 hojas) "
        "por una solución moderna, visual y rápida, ejecutable en red local (LAN) o en un servidor personal (VPS), permitiendo que "
        "ambos cónyuges utilicen la misma aplicación desde sus teléfonos móviles y desde el ordenador con sincronización instantánea.",
        body_style
    ))
    story.append(Paragraph(
        "A diferencia de las apps bancarias comerciales (que solo muestran saldos brutos) o las apps de finanzas genéricas "
        "(que fuerzan suscripciones y suben tus datos bancarios a servidores desconocidos), App_Conta se rige bajo el principio "
        "de <b>soberanía de datos y contabilidad por sistema de botes y sobres virtuales</b>.",
        body_style
    ))

    # Los 5 Principios de la Constitución Contable
    story.append(Paragraph("Los 5 Principios Fundacionales de la Aplicación", h2_style))
    principios = [
        ("Principio I — Las deudas se modelan como entidades, no como signos:",
         "Un préstamo, un anticipo o una cantidad pendiente no es un saldo negativo ficticio en una cuenta bancaria. Es una entidad con deudor, concepto, fecha y control estricto de cobros parciales o totales."),
        ("Principio II — Los saldos son siempre derivados por construcción:",
         "El saldo de una cuenta o de un sobre NUNCA se escribe ni se edita a mano. Se calcula automáticamente sumando el saldo inicial más todos los movimientos vivos no eliminados. Esto hace matemáticamente imposible el descuadre contable."),
        ("Principio III — Aritmética exacta en céntimos enteros (Dinero seguro):",
         "Los ordenadores sufren el problema de punto flotante de IEEE 754 (donde 0.1 + 0.2 = 0.30000000000000004). En App_Conta, TODO el dinero se almacena y calcula internamente como <b>enteros de céntimos</b> (ej. 30,50 € = 3050). Se usa Decimal con redondeo ROUND_HALF_UP únicamente en las fronteras."),
        ("Principio IV — Base de datos local, portable y sin dependencias:",
         "Toda la contabilidad reside en un único archivo SQLite (<code>conta.db</code>). Hacer una copia de seguridad es tan fácil como copiar ese archivo. Si formateas el PC o cambias de máquina, te llevas tu contabilidad intacta."),
        ("Principio V — Cero Nube obligatoria y Privacidad Absoluta:",
         "La app funciona 100% aislada de internet. No requiere APIs bancarias externas, no comparte tus gastos con terceros y no tiene trackers ni telemetría."),
    ]
    for tit, desc in principios:
        story.append(Paragraph(f"• <b>{tit}</b> {desc}", bullet_style))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECCIÓN 2: EL STACK TECNOLÓGICO
    # =========================================================================
    story.append(Paragraph("2. Stack Tecnológico: ¿Con qué está construida y por qué?", h1_style))
    story.append(Paragraph(
        "Se seleccionó una combinación tecnológica de alto rendimiento, bajo consumo de memoria y nula necesidad de configuración pesada:",
        body_style
    ))

    stack_table_data = [
        [
            Paragraph("Tecnología", table_header),
            Paragraph("Versión", table_header),
            Paragraph("Rol en el Sistema", table_header),
            Paragraph("¿Por qué se eligió? (Ventaja clave)", table_header),
        ],
        [
            Paragraph("<b>Python</b>", table_cell),
            Paragraph("3.11.x", table_cell_mono),
            Paragraph("Backend & Reglas contables", table_cell),
            Paragraph("Tipado estricto, gran ecosistema matemático y rendimiento un 25% superior a versiones previas.", table_cell),
        ],
        [
            Paragraph("<b>uv</b> (Astral)", table_cell),
            Paragraph("0.5+", table_cell_mono),
            Paragraph("Gestor de paquetes y venv", table_cell),
            Paragraph("Escrito en Rust. 10x más rápido que pip. Bloqueo determinista en <code>uv.lock</code>.", table_cell),
        ],
        [
            Paragraph("<b>FastAPI</b>", table_cell),
            Paragraph("0.115+", table_cell_mono),
            Paragraph("Servidor API REST HTTP", table_cell),
            Paragraph("Asíncrono, auto-documentación OpenAPI (/docs) y validación de tipos vía Pydantic.", table_cell),
        ],
        [
            Paragraph("<b>Uvicorn</b>", table_cell),
            Paragraph("0.32+", table_cell_mono),
            Paragraph("Servidor web ASGI", table_cell),
            Paragraph("Servidor de producción ultrarrápido con soporte de sockets y binding en <code>0.0.0.0</code>.", table_cell),
        ],
        [
            Paragraph("<b>SQLAlchemy</b>", table_cell),
            Paragraph("2.0+", table_cell_mono),
            Paragraph("ORM Relacional de BD", table_cell),
            Paragraph("Modelado tipado con <code>Mapped</code>. Claves foráneas reales e integridad referencial.", table_cell),
        ],
        [
            Paragraph("<b>SQLite</b>", table_cell),
            Paragraph("3.x", table_cell_mono),
            Paragraph("Motor de Base de Datos", table_cell),
            Paragraph("Embebido en fichero <code>conta.db</code>. Cero mantenimiento, transacciones ACID reales y máxima velocidad.", table_cell),
        ],
        [
            Paragraph("<b>Alembic</b>", table_cell),
            Paragraph("1.14+", table_cell_mono),
            Paragraph("Migraciones de esquema", table_cell),
            Paragraph("Evoluciona las tablas sin perder datos. Cada cambio tiene script de subida (upgrade) y bajada.", table_cell),
        ],
        [
            Paragraph("<b>OpenPyXL</b>", table_cell),
            Paragraph("3.1+", table_cell_mono),
            Paragraph("Lector del Excel real", table_cell),
            Paragraph("Lectura de las 14 hojas de <code>OCTUBRE.xlsx</code> en modo <code>data_only</code> para importar fórmulas.", table_cell),
        ],
        [
            Paragraph("<b>Vanilla PWA</b>", table_cell),
            Paragraph("ES Modules", table_cell_mono),
            Paragraph("Frontend / Interfaz de usuario", table_cell),
            Paragraph("Cero dependencias de Node.js, Webpack o React. Carga instantánea, limpia y ultra-ligera.", table_cell),
        ],
        [
            Paragraph("<b>Service Worker</b>", table_cell),
            Paragraph("v7 (sw.js)", table_cell_mono),
            Paragraph("Caché y soporte móvil", table_cell),
            Paragraph("Permite instalar la web como App nativa en iOS/Android y agiliza la navegación local.", table_cell),
        ],
        [
            Paragraph("<b>Pytest + Cov</b>", table_cell),
            Paragraph("8.x / 6.x", table_cell_mono),
            Paragraph("Suite de pruebas automáticas", table_cell),
            Paragraph("136 tests ejecutables en <20s. Mide cobertura real de código línea a línea.", table_cell),
        ],
        [
            Paragraph("<b>Ruff</b>", table_cell),
            Paragraph("0.8+", table_cell_mono),
            Paragraph("Linter y formateador", table_cell),
            Paragraph("Reemplaza a flake8, black e isort con velocidad instantánea en Rust.", table_cell),
        ],
    ]
    t_stack = Table(stack_table_data, colWidths=[80, 55, 125, 255])
    t_stack.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, c_border),
        ("PADDING", (0, 0), (-1, -1), 4.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(t_stack)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 3: MAPA DE CARPETAS Y ARQUITECTURA DEL CÓDIGO
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("3. Estructura de Archivos: ¿Dónde está cada cosa?", h1_style))
    story.append(Paragraph(
        "El código sigue una arquitectura limpia en 3 capas desacopladas: "
        "<b>Modelos (datos)</b> &rarr; <b>Servicios (lógica financiera pura)</b> &rarr; <b>API (controladores HTTP)</b> &rarr; <b>Frontend (PWA)</b>.",
        body_style
    ))

    estructura_data = [
        [Paragraph("Directorio / Fichero", table_header), Paragraph("Función y Contenido", table_header)],
        [
            Paragraph("<code>app_conta/db.py</code>", table_cell_mono),
            Paragraph("Motor SQLite. Configura <code>engine</code>, <code>SessionLocal</code> y la dependencia <code>get_db</code> para FastAPI.", table_cell),
        ],
        [
            Paragraph("<code>app_conta/main.py</code>", table_cell_mono),
            Paragraph("Punto de entrada de FastAPI. Registra routers, sirve la PWA en <code>/static</code>, auto-crea el Hogar único y muestra la IP local en consola.", table_cell),
        ],
        [
            Paragraph("<code>app_conta/models/</code>", table_cell_mono),
            Paragraph("<b>Capa de Datos:</b> Los 8 modelos SQLAlchemy (<code>hogar.py</code>, <code>cuenta.py</code>, <code>movimiento.py</code>, <code>bote.py</code>, <code>categoria.py</code>, <code>auditoria.py</code>, <code>deuda.py</code>, <code>gasto_recurrente.py</code>, <code>importacion.py</code>).", table_cell),
        ],
        [
            Paragraph("<code>app_conta/services/</code>", table_cell_mono),
            Paragraph("<b>Capa de Inteligencia Contable:</b> Funciones independientes de la web. Cálculos matemáticos, validaciones, auditoría y conciliación.", table_cell),
        ],
        [
            Paragraph("<code>app_conta/api/</code>", table_cell_mono),
            Paragraph("<b>Capa de Exposición REST:</b> Endpoints HTTP (<code>cuentas.py</code>, <code>movimientos.py</code>, <code>botes.py</code>, <code>conciliacion.py</code>, <code>deudas.py</code>, <code>prevision_gastos.py</code>, <code>importacion.py</code>).", table_cell),
        ],
        [
            Paragraph("<code>app_conta/static/</code>", table_cell_mono),
            Paragraph("<b>Frontend PWA:</b> <code>index.html</code> (shell único), <code>styles.css</code> (diseño fintech), <code>sw.js</code> (Service Worker) y <code>manifest.webmanifest</code>.", table_cell),
        ],
        [
            Paragraph("<code>app_conta/static/js/</code>", table_cell_mono),
            Paragraph("<b>Lógica de Cliente:</b> <code>api.js</code> (cliente fetch), <code>vistas.js</code> (registro de pantallas e iconos SVG), <code>nav.js</code> (menú) y <code>app.js</code> (router y eventos).", table_cell),
        ],
        [
            Paragraph("<code>app_conta/static/js/views/</code>", table_cell_mono),
            Paragraph("<b>Pantallas Individuales:</b> <code>inicio.js</code>, <code>cuentas.js</code>, <code>tarjetas.js</code>, <code>tarjetas-regalo.js</code>, <code>gastos-tarjetas.js</code>, <code>ahorro.js</code>, <code>botes.js</code>, <code>prevision-gastos.js</code>, <code>deben.js</code>, <code>categorias.js</code>, <code>importar.js</code>.", table_cell),
        ],
        [
            Paragraph("<code>migrations/versions/</code>", table_cell_mono),
            Paragraph("<b>Control de Versiones de BD:</b> Los 4 scripts Alembic que construyen la base de datos desde cero sin romper datos.", table_cell),
        ],
        [
            Paragraph("<code>tests/</code>", table_cell_mono),
            Paragraph("<b>Pruebas de Calidad:</b> Tests unitarios (<code>tests/unit/</code>), de contrato API (<code>tests/api/</code>) y de integración end-to-end (<code>tests/integration/</code>).", table_cell),
        ],
        [
            Paragraph("<code>levantar.bat</code> / <code>iniciar_servidor.bat</code>", table_cell_mono),
            Paragraph("Scripts directos de Windows para arrancar uvicorn en red local mediante <code>uv run</code> en un solo clic.", table_cell),
        ],
    ]
    t_est = Table(estructura_data, colWidths=[155, 360])
    t_est.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("GRID", (0, 0), (-1, -1), 0.5, c_border),
        ("PADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(t_est)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 4: MODELO DE DATOS Y BASE DE DATOS
    # =========================================================================
    story.append(Paragraph("4. Modelo de Datos y Base de Datos Relacional", h1_style))
    story.append(Paragraph(
        "La base de datos SQLite almacena la información estructurada mediante claves foráneas e índices para máxima velocidad. "
        "A continuación se detalla cada entidad y para qué sirve:",
        body_style
    ))

    modelos_info = [
        ("Hogar (hogares)", "El contenedor maestro del sistema. Todos los datos (cuentas, botes, deudas) cuelgan de un <code>hogar_id</code>. Permite en el futuro multi-hogar sin cambiar el esquema."),
        ("Cuenta (cuentas)", "Representa los depósitos de dinero real. Tipos: <code>banco</code> (cuentas corrientes), <code>tarjeta</code> (tarjetas de crédito/débito y regalo), <code>efectivo</code> (caja física) o <code>inversion</code>. Almacena nombre, entidad bancaria (Caixa, Deutsche, BBVA, Revolut...) y <code>saldo_inicial_centimos</code>."),
        ("Movimiento (movimientos)", "Cada transacción individual. Registra fecha, <code>importe_centimos</code> (con signo: positivo = ingreso, negativo = gasto), descripción, <code>cuenta_id</code> (obligatorio), <code>bote_id</code> (opcional, sobre al que se imputa), <code>categoria_id</code> (opcional) y flag <code>eliminado</code> (borrado lógico para preservar auditoría)."),
        ("Bote (botes)", "Los sobres virtuales donde se guarda o compromete el dinero. Tipos: <code>ahorro</code> (fondos para hipotecas o reservas), <code>recurrente</code> (gastos previsibles), <code>proyecto</code> o <code>ajeno</code>. Su saldo es siempre la suma de los movimientos asignados a él."),
        ("Categoria (categorias)", "Etiquetas analíticas opcionales para clasificar consumos (ej. Supermercado, Gasolina, Restaurantes). Cuenta con selector de color hexadecimal y cálculo de totales por periodos de fechas."),
        ("AuditoriaMovimiento (auditoria_movimientos)", "Caja negra de seguridad. Registra automáticamente cada creación, edición, eliminación o reasignación de bote con los valores anteriores y nuevos en formato JSON para trazabilidad total."),
        ("Deuda (deudas)", "Módulo 'Dinero que me deben'. Almacena nombre del deudor, concepto, importe inicial, importe cobrado acumulado, fecha, fecha límite y estado (<code>pendiente</code>, <code>parcial</code> o <code>saldado</code>). Permite registrar cobros con generación opcional de ingreso en cuenta."),
        ("GastoRecurrente (gastos_recurrentes)", "Planificación anual de tributos y recibos (IBI, basuras, seguros, sellos). Guarda importe anual presupuestado, cuota mensual fija (total 176,54 €/mes), pagado real acumulado y notas de cobro."),
        ("PrevisionGastosConfig (prevision_gastos_config)", "Configuración del bote de gastos anuales. Controla el año activo y los meses transcurridos/aportados (1 a 12 meses) para calcular la provisión teórica acumulada."),
        ("Importacion (importaciones)", "Historial de importaciones del Excel <code>OCTUBRE.xlsx</code>. Guarda nombre, huella digital SHA-256 para evitar duplicados y resumen con avisos de filas dudosas detectadas."),
    ]

    for nom, desc in modelos_info:
        story.append(Paragraph(f"• <b>{nom}:</b> {desc}", bullet_style))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECCIÓN 5: CAPA DE SERVICIOS Y REGLAS DE NEGOCIO
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("5. Capa de Servicios: La Lógica Contable y Fórmulas", h1_style))
    story.append(Paragraph(
        "En una arquitectura profesional, los controladores de la API no deben contener cálculos matemáticos. "
        "Toda la inteligencia reside en <code>app_conta/services/</code>, donde se implementan las fórmulas contables maestras:",
        body_style
    ))

    # Conciliación y Disponible Real
    caja_conciliacion = crear_caja_destacada(
        "Fórmula Maestra del 'Disponible Real' y Conciliación (services/conciliacion.py)",
        "<b>Diferencia = Saldo Total Cuentas − Saldo Inicial Total − (Saldo Total Botes + Sin Asignar)</b><br/>"
        "• <b>Estado 'Cuadrado' (Verde):</b> La diferencia es exactamente 0.00 €. Todo el dinero físico en bancos y caja coincide con la suma de los sobres comprometidos más el dinero libre.<br/>"
        "• <b>Estado 'Revisar' (Rojo):</b> Existe un desfase. La pantalla avisa del importe exacto sin cuadrar.<br/>"
        "• <i>Nota de diseño:</i> Este servicio SOLO LEE la base de datos (Principio II); jamás altera ningún registro.",
        callout_tit, callout_txt, bg_color="#f0fdf4", border_color="#86efac"
    )
    story.append(caja_conciliacion)
    story.append(Spacer(1, 10))

    # Dinero en Caja vs Dinero en Bancos
    story.append(Paragraph("Segregación Financiera: Dinero en Caja vs. Dinero en Bancos", h2_style))
    story.append(Paragraph(
        "A petición expresa de las reglas del hogar, se implementó una estricta segregación matemática:<br/>"
        "• <b>Dinero en Caja:</b> Suma <i>exclusivamente</i> el dinero físico en metálico (cuentas con <code>tipo == 'efectivo'</code>). No incluye bancos.<br/>"
        "• <b>Dinero en Bancos:</b> Suma las cuentas corrientes y depósitos bancarios (cuentas con <code>tipo == 'banco'</code>).<br/>"
        "• <b>Dinero Disponible (Hero principal):</b> Es el total líquido real del hogar: <code>Dinero en Caja + Dinero en Bancos</code>.",
        body_style
    ))

    # Bote de Gastos Periódicos y Previsión Anual
    story.append(Paragraph("Módulo de Previsión de Gastos y Bote Anual (services/prevision_gastos.py)", h2_style))
    story.append(Paragraph(
        "Equivalente a la hoja <b>GASTOS 2026</b> de tu Excel. Los gastos anuales (IBI Cañete, IBI Piso, IBI Córdoba, Basura, Seguros, Sellos) "
        "se dividen en 12 mensualidades exactas. El sistema calcula:<br/>"
        "1. <b>Cuota Mensual Fija a Guardar:</b> Suma de las mensualidades (actualmente <b>176,54 €/mes</b>).<br/>"
        "2. <b>Provisión Acumulada:</b> <code>(Importe Anual * Meses Aportados) / 12</code>.<br/>"
        "3. <b>Saldo del Bote:</b> <code>Provisión Acumulada − Facturas Reales Pagadas</code>.<br/>"
        "Si el saldo es positivo, el bote está en <b>Superávit</b> (fondos suficientes guardados). Si es negativo, marca <b>Déficit</b>.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECCIÓN 6: LA API REST (ENDPOINTS)
    # =========================================================================
    story.append(Paragraph("6. Catálogo de la API REST (Rutas y Endpoints)", h1_style))
    story.append(Paragraph(
        "FastAPI expone los endpoints bajo el prefijo común <code>/api/v1</code>, comunicando el backend con la interfaz web mediante JSON:",
        body_style
    ))

    endpoints_data = [
        [Paragraph("Endpoint HTTP", table_header), Paragraph("Método", table_header), Paragraph("Descripción y Funcionalidad", table_header)],
        [
            Paragraph("<code>/api/v1/conciliacion</code>", table_cell_mono),
            Paragraph("GET", table_cell_bold),
            Paragraph("Devuelve el estado global, dinero en cuentas, dinero en botes, sin asignar y cuadre.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/cuentas</code>", table_cell_mono),
            Paragraph("GET / POST", table_cell_bold),
            Paragraph("Listado con saldo derivado de cuentas y alta de nueva cuenta (banco, efectivo, tarjeta).", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/cuentas/{id}</code>", table_cell_mono),
            Paragraph("PATCH / DEL", table_cell_bold),
            Paragraph("Edición de datos (el saldo se ignora por Principio II) y borrado protegido con archivado.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/movimientos</code>", table_cell_mono),
            Paragraph("GET / POST", table_cell_bold),
            Paragraph("Consulta con filtros (cuenta, bote, categoría, fechas) y registro de nuevo ingreso/gasto.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/movimientos/{id}</code>", table_cell_mono),
            Paragraph("PATCH / DEL", table_cell_bold),
            Paragraph("Edición de movimiento con registro en auditoría y borrado lógico (desaparece de listados).", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/movimientos/{id}/bote</code>", table_cell_mono),
            Paragraph("PATCH", table_cell_bold),
            Paragraph("Reasignación directa de sobre/bote con auditoría de cambio atómica.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/botes</code>", table_cell_mono),
            Paragraph("GET / POST", table_cell_bold),
            Paragraph("Consulta de botes con saldos derivados, porcentajes de progreso y alta de nuevos sobres.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/botes/{id}</code>", table_cell_mono),
            Paragraph("GET / DEL", table_cell_bold),
            Paragraph("Extracto individual con movimientos del sobre y borrado (libera fondos a sin asignar).", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/deudas</code>", table_cell_mono),
            Paragraph("GET / POST", table_cell_bold),
            Paragraph("Listado de dinero que me deben con KPIs y registro de nuevos préstamos.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/deudas/{id}/cobro</code>", table_cell_mono),
            Paragraph("POST", table_cell_bold),
            Paragraph("Registra un cobro parcial o total, con opción de crear ingreso contable automático en cuenta.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/prevision-gastos</code>", table_cell_mono),
            Paragraph("GET / POST", table_cell_bold),
            Paragraph("Resumen del bote de gastos anuales, cuota fija y listado comparativo de recibos.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/prevision-gastos/config</code>", table_cell_mono),
            Paragraph("PATCH", table_cell_bold),
            Paragraph("Actualiza el stepper del mes de provisión aportado (1 a 12 meses).", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/prevision-gastos/{id}/pagar</code>", table_cell_mono),
            Paragraph("POST", table_cell_bold),
            Paragraph("Registra el importe de una factura real cobrada (IBI, Seguro...) actualizando el saldo.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/importacion/previsualizar</code>", table_cell_mono),
            Paragraph("POST", table_cell_bold),
            Paragraph("Analiza <code>OCTUBRE.xlsx</code> en memoria, calcula recuentos y detecta huella SHA-256 sin tocar BD.", table_cell),
        ],
        [
            Paragraph("<code>/api/v1/importacion/aplicar</code>", table_cell_mono),
            Paragraph("POST", table_cell_bold),
            Paragraph("Aplica de forma transaccional el volcado contable a la base de datos.", table_cell),
        ],
    ]
    t_api = Table(endpoints_data, colWidths=[165, 65, 285])
    t_api.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("GRID", (0, 0), (-1, -1), 0.5, c_border),
        ("PADDING", (0, 0), (-1, -1), 3.8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(t_api)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 7: FRONTEND PWA Y DISEÑO FINTECH
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("7. Frontend PWA: Interfaz, Navegación y Vistas", h1_style))
    story.append(Paragraph(
        "El frontend se construyó bajo la filosofía <b>Vanilla ES Modules</b>: código limpio, modular y sin compiladores pesados. "
        "Cada pantalla es un módulo JavaScript independiente en <code>static/js/views/</code> que se auto-registra mediante <code>vista(nombre, renderFn)</code>.",
        body_style
    ))

    story.append(Paragraph("Arquitectura de Navegación Consolidada (5 Pestañas)", h2_style))
    story.append(Paragraph(
        "Para erradicar la saturación horizontal y la barra de desplazamiento ('línea para desplazar'), "
        "el menú superior se consolidó en <b>5 secciones maestras</b> de ancho fijo holgado (~580px en contenedor de 1080px):",
        body_style
    ))

    nav_tabs_info = [
        ("1. 📊 Resumen (#/inicio):", "Panel global del hogar. Muestra el Dinero Disponible líquido (Caja + Bancos), el badge vivo de conciliación, las tarjetas estadísticas y los botes destacados."),
        ("2. 🏦 Cuentas y Tarjetas (#/cuentas):", "Hub financiero agrupado. Dispone de subnavegación por píldoras para alternar entre:<br/>"
         "&nbsp;&nbsp;&nbsp;&nbsp;• <code>[ 🏦 Cuentas y Depósitos ]</code>: Agrupadas por bancos (Caixa, Deutsche Bank, BBVA, Revolut, Otros).<br/>"
         "&nbsp;&nbsp;&nbsp;&nbsp;• <code>[ 💳 Tarjetas Bancarias ]</code>: Tarjetas de crédito/débito digitales con chip visual y saldo dispuesto.<br/>"
         "&nbsp;&nbsp;&nbsp;&nbsp;• <code>[ 🎁 Tarjetas Regalo ]</code>: Tarjetas prepago para compras (Amazon, Carrefour, Decathlon...).<br/>"
         "&nbsp;&nbsp;&nbsp;&nbsp;• <code>[ 🏷️ Gastos Tarjetas ]</code>: Movimientos y compras imputadas a cada tarjeta."),
        ("3. 🎯 Ahorro y Botes (#/ahorro):", "Hub de previsión futura y sobres de gasto. Subnavegación por píldoras entre:<br/>"
         "&nbsp;&nbsp;&nbsp;&nbsp;• <code>[ 🎯 Fondos de Ahorro e Hipotecas ]</code>: Amortización de hipotecas, reservas futuras y extracto individual.<br/>"
         "&nbsp;&nbsp;&nbsp;&nbsp;• <code>[ 🏺 Sobres y Botes ]</code>: Sobres para vacaciones, regalos o proyectos con barra de progreso.<br/>"
         "&nbsp;&nbsp;&nbsp;&nbsp;• <code>[ 📋 Previsión Gastos Anuales ]</code>: Control de IBI, basuras, seguros, sellos y cuotas mensuales de 176,54 €.<br/>"
         "&nbsp;&nbsp;&nbsp;&nbsp;• <code>[ 🤝 Dinero que me deben ]</code>: Registro de préstamos a terceros y control de recuperaciones."),
        ("4. 📝 Movimientos (#/movimientos):", "El libro diario contable. Registro cronológico con importes coloreados (+ verde / − rojo), selector de bote y categoría directamente en la fila y formulario rápido con control segmentado de Gasto/Ingreso."),
        ("5. ⋯ Más (Desplegable flotante):", "Ventana glassmorphism para herramientas secundarias: <b>Categorías</b> (clasificación con colores) e <b>Importar Excel</b> (lector de <code>OCTUBRE.xlsx</code>)."),
    ]
    for tit, desc in nav_tabs_info:
        story.append(Paragraph(f"• <b>{tit}</b> {desc}", bullet_style))

    story.append(Spacer(1, 8))

    story.append(Paragraph("Sistema de Diseño Fintech (Fintech Design System)", h2_style))
    story.append(Paragraph(
        "• <b>Tipografía:</b> <code>Plus Jakarta Sans</code> para textos y navegación; <code>JetBrains Mono</code> para importes tabulares.<br/>"
        "• <b>Iconografía:</b> Sustituidos los emojis por un set completo de <b>iconos vectoriales SVG limpios</b> en <code>vistas.js</code>.<br/>"
        "• <b>Paleta Obsidian / Slate:</b> Fondos oscuros translúcidos con efecto <i>glassmorphism</i> (desenfoque de 20px), sombras sutiles y tarjetas elevadas.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECCIÓN 8: FLUJO DE EJECUCIÓN (QUÉ PASA AL ARRANCAR)
    # =========================================================================
    story.append(Paragraph("8. Ciclo de Vida: ¿Qué pasa cuando abres la aplicación?", h1_style))
    story.append(Paragraph(
        "Explicación técnica paso a paso desde que pulsas <code>levantar.bat</code> hasta que interactúas en el móvil:",
        body_style
    ))

    flujo_pasos = [
        ("1. Ejecución del script:", "El archivo <code>levantar.bat</code> ejecuta <code>uv run uvicorn app_conta.main:app --host 0.0.0.0 --port 8000</code>. El gestor <code>uv</code> localiza el entorno virtual <code>.venv</code> garantizando que todas las librerías están presentes."),
        ("2. Arranque de FastAPI:", "Se ejecuta el evento <code>lifespan</code> de <code>main.py</code>. Se conecta a <code>conta.db</code>. Si la base de datos está vacía, crea automáticamente el <b>Hogar único</b> con ID '00000000-0000-0000-0000-000000000001'."),
        ("3. Publicación en LAN:", "FastAPI detecta las tarjetas de red del PC e imprime en consola la URL local (<code>http://127.0.0.1:8000</code>) y la URL para móviles (ej. <code>http://192.168.1.50:8000</code>). Abre automáticamente el navegador."),
        ("4. Carga del Frontend:", "El navegador solicita <code>/</code>, que devuelve <code>static/index.html</code>. El HTML descarga los estilos <code>styles.css</code>, las Google Fonts y el script de arranque <code>app.js</code> como módulo ES."),
        ("5. Peticiones concurrentes:", "La vista <code>inicio.js</code> realiza llamadas en paralelo mediante <code>Promise.all</code> a <code>/api/v1/conciliacion</code>, <code>/api/v1/cuentas</code>, <code>/api/v1/botes</code>, <code>/api/v1/deudas</code> y <code>/api/v1/prevision-gastos</code>."),
        ("6. Inyección de Sesión BD:", "Cada endpoint FastAPI recibe la sesión SQLite mediante la dependencia <code>Depends(get_db)</code>, que abre una transacción segura y garantiza el <code>close()</code> al finalizar la respuesta JSON."),
        ("7. Renderizado reactivo:", "El JavaScript inyecta en <code>&lt;main id='vista'&gt;</code> el HTML final con los importes formateados (signos, separador de miles y decimales en coma). Al pulsar un botón, la delegación global de eventos captura la acción y refresca la pantalla sin recargar la página."),
    ]
    for paso, desc in flujo_pasos:
        story.append(Paragraph(f"<b>{paso}</b> {desc}", bullet_style))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECCIÓN 9: BATERÍA DE PRUEBAS AUTOMATIZADAS
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("9. Calidad y Tests Automatizados: La Red de Seguridad", h1_style))
    story.append(Paragraph(
        "Siguiendo el <b>Principio III de la Constitución Contable (TDD Obligatorio)</b>, ninguna regla financiera "
        "se programó sin haber escrito primero una prueba automatizada que fallara. Hoy la suite cuenta con <b>136 tests en verde</b>:",
        body_style
    ))

    tests_summary = [
        [Paragraph("Módulo de Pruebas", table_header), Paragraph("Fichero de Tests", table_header), Paragraph("Tests", table_header), Paragraph("Aspecto que Verifica", table_header)],
        [
            Paragraph("Aritmética y Dinero", table_cell),
            Paragraph("<code>tests/unit/test_dinero.py</code>", table_cell_mono),
            Paragraph("21", table_cell_bold),
            Paragraph("Conversión exacta euros-céntimos, redondeo ROUND_HALF_UP, rechazo de importe 0.00 y signos.", table_cell),
        ],
        [
            Paragraph("Cuentas y Movimientos", table_cell),
            Paragraph("<code>tests/api/test_cuentas_movimientos.py</code>", table_cell_mono),
            Paragraph("19", table_cell_bold),
            Paragraph("CRUD de cuentas, cálculo de saldo derivado, filtros de movimientos y borrado lógico.", table_cell),
        ],
        [
            Paragraph("Flujo US2 Integración", table_cell),
            Paragraph("<code>tests/integration/test_us2_flujo.py</code>", table_cell_mono),
            Paragraph("3", table_cell_bold),
            Paragraph("Cuenta 1000 € + 3 movs &rarr; saldo exacto 2449.50 € &rarr; recálculo y auditoría en DB.", table_cell),
        ],
        [
            Paragraph("Conciliación y Cuadre", table_cell),
            Paragraph("<code>tests/unit/test_conciliacion.py</code>", table_cell_mono),
            Paragraph("9", table_cell_bold),
            Paragraph("Cuadre en cero, detección de desfases, saldos negativos e ignorado de archivados.", table_cell),
        ],
        [
            Paragraph("Botes y Sobres", table_cell),
            Paragraph("<code>tests/unit/test_botes.py</code>", table_cell_mono),
            Paragraph("22", table_cell_bold),
            Paragraph("Suma de movimientos asignados, objetivos conseguidos, reasignación atómica entre sobres.", table_cell),
        ],
        [
            Paragraph("Categorías con Fechas", table_cell),
            Paragraph("<code>tests/unit/test_categorias.py</code>", table_cell_mono),
            Paragraph("18", table_cell_bold),
            Paragraph("Totales por periodo desde/hasta, nombres únicos, protección de borrado si tiene movimientos.", table_cell),
        ],
        [
            Paragraph("Importador OCTUBRE.xlsx", table_cell),
            Paragraph("<code>tests/integration/test_importador.py</code>", table_cell_mono),
            Paragraph("26", table_cell_bold),
            Paragraph("Mapeo sintético + fichero real (20 cuentas, 28 botes, 215 movs), huella SHA256 y conciliación.", table_cell),
        ],
        [
            Paragraph("Dinero que me deben", table_cell),
            Paragraph("<code>tests/unit/test_deudas.py</code>", table_cell_mono),
            Paragraph("6", table_cell_bold),
            Paragraph("Registro de préstamos, cobros parciales/totales y estados (pendiente, parcial, saldado).", table_cell),
        ],
        [
            Paragraph("Previsión de Gastos", table_cell),
            Paragraph("<code>tests/unit/test_prevision_gastos.py</code>", table_cell_mono),
            Paragraph("10", table_cell_bold),
            Paragraph("Semilla de 16 gastos, cuota mensual de 176.54 €, provisión acumulada y registro de pagos.", table_cell),
        ],
        [
            Paragraph("Arranque y Migraciones", table_cell),
            Paragraph("<code>tests/integration/test_arranque.py</code>", table_cell_mono),
            Paragraph("2", table_cell_bold),
            Paragraph("Ejecución de migraciones Alembic desde BD vacía y verificación del Hogar único.", table_cell),
        ],
    ]
    t_tests = Table(tests_summary, colWidths=[110, 155, 35, 215])
    t_tests.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("GRID", (0, 0), (-1, -1), 0.5, c_border),
        ("PADDING", (0, 0), (-1, -1), 3.8),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(t_tests)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 10: GUÍA OPERATIVA Y MANTENIMIENTO
    # =========================================================================
    story.append(Paragraph("10. Guía Práctica de Uso y Mantenimiento", h1_style))
    story.append(Paragraph(
        "Instrucciones directas para operar la aplicación en el día a día sin complicaciones técnicas:",
        body_style
    ))

    comandos_guia = [
        ("Arrancar la aplicación:", "Hacer doble clic en <code>levantar.bat</code>. Se abrirá la consola de comando y el navegador cargará la app en <code>http://localhost:8000</code>."),
        ("Abrir la app en los teléfonos móviles:", "Conectar el móvil a la misma red WiFi del hogar y abrir en Safari/Chrome la dirección IP que aparece en la ventana de consola (ejemplo: <code>http://192.168.1.50:8000</code>)."),
        ("Instalar como App en el móvil:", "En Chrome (Android) pulsar en 'Añadir a la pantalla de inicio'. En Safari (iPhone) pulsar 'Compartir' &rarr; 'Añadir a pantalla de inicio'. La app se abrirá sin barras de navegador."),
        ("Hacer una Copia de Seguridad manual:", "Basta con cerrar la app y copiar el archivo <code>conta.db</code> a una memoria USB, carpeta de Google Drive o disco externo. Contiene el 100% de tus datos contables."),
        ("Ejecutar las pruebas automáticas:", "Abrir PowerShell en la carpeta del proyecto y ejecutar <code>uv run pytest</code>. Comprueba que los 136 tests pasan en verde."),
        ("Comprobar estilo y formato del código:", "Ejecutar <code>uv run ruff check</code> para verificar que no hay errores de código o sintaxis."),
    ]
    for tit, desc in comandos_guia:
        story.append(Paragraph(f"• <b>{tit}</b> {desc}", bullet_style))

    story.append(Spacer(1, 14))

    # Cierre / Firma técnica
    caja_cierre = crear_caja_destacada(
        "Certificación de Integridad del MVP (Hito Octubre 2026)",
        "Este documento refleja el estado exacto del código registrado en el commit <b>129d4e1</b> de la rama master. "
        "La aplicación reproduce la totalidad de las reglas contables del Excel original con total precisión matemática en céntimos, "
        "ofreciendo una experiencia moderna, segura, autónoma y multi-dispositivo.",
        callout_tit, callout_txt, bg_color="#f8fafc", border_color="#cbd5e1"
    )
    story.append(caja_cierre)

    # Construir documento
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generado con éxito en: {ruta_destino}")


if __name__ == "__main__":
    carpeta_docs = os.path.dirname(os.path.abspath(__file__))
    raiz_proyecto = os.path.dirname(carpeta_docs)

    ruta_pdf_docs = os.path.join(carpeta_docs, "manual_arquitectura_app_conta.pdf")
    ruta_pdf_static = os.path.join(raiz_proyecto, "app_conta", "static", "manual_arquitectura_app_conta.pdf")

    generar_pdf(ruta_pdf_docs)

    # Copiamos a app_conta/static para permitir descarga directa vía web
    shutil.copyfile(ruta_pdf_docs, ruta_pdf_static)
    print(f"Copia estática para descarga web disponible en: {ruta_pdf_static}")
