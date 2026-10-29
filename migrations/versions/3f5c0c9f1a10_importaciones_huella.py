"""Tabla `importaciones`: huella sha256 para detectar ficheros repetidos (FR-010).

Revision ID: 3f5c0c9f1a10
Revises: 52cd663949d8
Create Date: 2026-10-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "3f5c0c9f1a10"
down_revision = "52cd663949d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "importaciones",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hogar_id", sa.Integer(), sa.ForeignKey("hogares.id"), nullable=False),
        sa.Column("nombre_fichero", sa.String(255), nullable=False),
        sa.Column("huella", sa.String(64), nullable=False),
        sa.Column("resumen", sa.JSON(), nullable=True),
        sa.Column("avisos", sa.JSON(), nullable=True),
        sa.Column("importado_en", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_importaciones_hogar", "importaciones", ["hogar_id"], unique=False)
    op.create_index("ix_importaciones_huella", "importaciones", ["huella"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_importaciones_huella", table_name="importaciones")
    op.drop_index("ix_importaciones_hogar", table_name="importaciones")
    op.drop_table("importaciones")
