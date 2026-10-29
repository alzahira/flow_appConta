"""Tabla `deudas`: registro de dinero que le deben al hogar (Principio I).

Revision ID: 4a8e2b7c6d91
Revises: 3f5c0c9f1a10
Create Date: 2026-10-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "4a8e2b7c6d91"
down_revision = "3f5c0c9f1a10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deudas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hogar_id", sa.String(length=36), sa.ForeignKey("hogares.id"), nullable=False),
        sa.Column("deudor", sa.String(length=120), nullable=False),
        sa.Column("concepto", sa.String(length=255), nullable=False),
        sa.Column("importe_inicial_centimos", sa.Integer(), nullable=False),
        sa.Column("importe_cobrado_centimos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("fecha_limite", sa.Date(), nullable=True),
        sa.Column(
            "estado",
            sa.Enum("pendiente", "parcial", "saldado", name="estado_deuda"),
            nullable=False,
            server_default="pendiente",
        ),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("archivada", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_deudas_hogar_id", "deudas", ["hogar_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_deudas_hogar_id", table_name="deudas")
    op.drop_table("deudas")
