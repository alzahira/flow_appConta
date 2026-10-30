"""Tabla inversiones para carteras, fondos, acciones, renta fija y planes de pensiones.

Revision ID: 9c8d7e6f5a4b
Revises: 8b7c3d2e1f05
Create Date: 2026-10-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "9c8d7e6f5a4b"
down_revision = "8b7c3d2e1f05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inversiones",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hogar_id", sa.String(length=36), sa.ForeignKey("hogares.id"), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("entidad", sa.String(length=100), nullable=False),
        sa.Column("tipo_activo", sa.String(length=50), nullable=False, server_default="fondos"),
        sa.Column("capital_aportado_centimos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valor_actual_centimos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cuenta_id", sa.Integer(), sa.ForeignKey("cuentas.id"), nullable=True),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("actualizado_en", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_inversiones_hogar_id", "inversiones", ["hogar_id"])
    op.create_index("ix_inversiones_activo", "inversiones", ["activo"])


def downgrade() -> None:
    op.drop_index("ix_inversiones_activo", table_name="inversiones")
    op.drop_index("ix_inversiones_hogar_id", table_name="inversiones")
    op.drop_table("inversiones")
