"""Creación de tablas plantillas_reparto y plantillas_reparto_lineas para nóminas y repartos recurrentes.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plantillas_reparto",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("hogar_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("cuenta_id", sa.Integer(), nullable=False),
        sa.Column("importe_estimado_centimos", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("dia_mes", sa.Integer(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("creado_en", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"]),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plantillas_reparto_hogar_id", "plantillas_reparto", ["hogar_id"])
    op.create_index("ix_plantillas_reparto_cuenta_id", "plantillas_reparto", ["cuenta_id"])

    op.create_table(
        "plantillas_reparto_lineas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plantilla_id", sa.Integer(), nullable=False),
        sa.Column("bote_id", sa.Integer(), nullable=True),
        sa.Column("concepto", sa.String(length=150), nullable=False),
        sa.Column("importe_centimos", sa.BigInteger(), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["bote_id"], ["botes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["plantilla_id"], ["plantillas_reparto.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plantillas_reparto_lineas_plantilla_id", "plantillas_reparto_lineas", ["plantilla_id"])
    op.create_index("ix_plantillas_reparto_lineas_bote_id", "plantillas_reparto_lineas", ["bote_id"])


def downgrade() -> None:
    op.drop_index("ix_plantillas_reparto_lineas_bote_id", table_name="plantillas_reparto_lineas")
    op.drop_index("ix_plantillas_reparto_lineas_plantilla_id", table_name="plantillas_reparto_lineas")
    op.drop_table("plantillas_reparto_lineas")
    op.drop_index("ix_plantillas_reparto_cuenta_id", table_name="plantillas_reparto")
    op.drop_index("ix_plantillas_reparto_hogar_id", table_name="plantillas_reparto")
    op.drop_table("plantillas_reparto")

