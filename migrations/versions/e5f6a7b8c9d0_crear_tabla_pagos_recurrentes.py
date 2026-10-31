"""crear tabla pagos_recurrentes

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-31 01:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pagos_recurrentes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("hogar_id", sa.String(length=36), nullable=False),
        sa.Column("cuenta_id", sa.Integer(), nullable=False),
        sa.Column("concepto", sa.String(length=255), nullable=False),
        sa.Column("importe_centimos", sa.Integer(), nullable=False),
        sa.Column("categoria_id", sa.Integer(), nullable=True),
        sa.Column("dia_mes", sa.Integer(), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("ultimo_pago", sa.Date(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["categoria_id"], ["categorias.id"]),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"]),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_pagos_recurrentes_cuenta_id"), "pagos_recurrentes", ["cuenta_id"], unique=False
    )
    op.create_index(
        op.f("ix_pagos_recurrentes_hogar_id"), "pagos_recurrentes", ["hogar_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pagos_recurrentes_hogar_id"), table_name="pagos_recurrentes")
    op.drop_index(op.f("ix_pagos_recurrentes_cuenta_id"), table_name="pagos_recurrentes")
    op.drop_table("pagos_recurrentes")

