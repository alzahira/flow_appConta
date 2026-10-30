"""Tabla prestamos para financiaciones, pasivo y deudas del hogar (coche, personal, hipoteca).

Revision ID: a1b2c3d4e5f6
Revises: 9c8d7e6f5a4b
Create Date: 2026-10-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "9c8d7e6f5a4b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prestamos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hogar_id", sa.String(length=36), sa.ForeignKey("hogares.id"), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("entidad", sa.String(length=100), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False, server_default="coche"),
        sa.Column("importe_inicial_centimos", sa.Integer(), nullable=False),
        sa.Column("importe_pendiente_centimos", sa.Integer(), nullable=False),
        sa.Column("cuota_mensual_centimos", sa.Integer(), nullable=True),
        sa.Column("cuenta_id", sa.Integer(), sa.ForeignKey("cuentas.id"), nullable=True),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("actualizado_en", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_prestamos_hogar_id", "prestamos", ["hogar_id"])
    op.create_index("ix_prestamos_activo", "prestamos", ["activo"])


def downgrade() -> None:
    op.drop_index("ix_prestamos_activo", table_name="prestamos")
    op.drop_index("ix_prestamos_hogar_id", table_name="prestamos")
    op.drop_table("prestamos")

