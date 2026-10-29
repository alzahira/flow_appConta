"""Tabla gastos_recurrentes y prevision_gastos_config.

Revision ID: 8b7c3d2e1f05
Revises: 4a8e2b7c6d91
Create Date: 2026-10-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "8b7c3d2e1f05"
down_revision = "4a8e2b7c6d91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gastos_recurrentes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hogar_id", sa.String(length=36), sa.ForeignKey("hogares.id"), nullable=False),
        sa.Column("concepto", sa.String(length=255), nullable=False),
        sa.Column("fecha_cobro", sa.String(length=100), nullable=False),
        sa.Column("importe_anual_centimos", sa.Integer(), nullable=False),
        sa.Column("cuota_mensual_centimos", sa.Integer(), nullable=True),
        sa.Column("pagado_real_centimos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("actualizado_en", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_gastos_recurrentes_hogar_id", "gastos_recurrentes", ["hogar_id"])

    op.create_table(
        "prevision_gastos_config",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hogar_id", sa.String(length=36), sa.ForeignKey("hogares.id"), nullable=False, unique=True),
        sa.Column("meses_pagados", sa.Integer(), nullable=False, server_default="11"),
        sa.Column("anio", sa.Integer(), nullable=False, server_default="2026"),
        sa.Column("actualizado_en", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_prevision_gastos_config_hogar_id", "prevision_gastos_config", ["hogar_id"])


def downgrade() -> None:
    op.drop_index("ix_prevision_gastos_config_hogar_id", table_name="prevision_gastos_config")
    op.drop_table("prevision_gastos_config")
    op.drop_index("ix_gastos_recurrentes_hogar_id", table_name="gastos_recurrentes")
    op.drop_table("gastos_recurrentes")
