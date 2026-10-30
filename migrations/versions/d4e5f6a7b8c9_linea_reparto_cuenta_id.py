"""Añadir cuenta_id a plantillas_reparto_lineas para repartir dinero a diferentes bancos.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("plantillas_reparto_lineas") as batch_op:
        batch_op.add_column(sa.Column("cuenta_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_plantillas_reparto_lineas_cuenta_id",
            "cuentas",
            ["cuenta_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_plantillas_reparto_lineas_cuenta_id", ["cuenta_id"])


def downgrade() -> None:
    with op.batch_alter_table("plantillas_reparto_lineas") as batch_op:
        batch_op.drop_index("ix_plantillas_reparto_lineas_cuenta_id")
        batch_op.drop_constraint("fk_plantillas_reparto_lineas_cuenta_id", type_="foreignkey")
        batch_op.drop_column("cuenta_id")
