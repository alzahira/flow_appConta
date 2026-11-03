"""usuarios y sesiones para autenticacion y multi-hogar

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-03 10:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("hogar_id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=60), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("nombre_mostrar", sa.String(length=120), nullable=False),
        sa.Column("rol", sa.String(length=20), server_default="miembro", nullable=False),
        sa.Column("activo", sa.Boolean(), server_default="1", nullable=False),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_usuarios_hogar_id"), "usuarios", ["hogar_id"], unique=False)
    op.create_index(op.f("ix_usuarios_username"), "usuarios", ["username"], unique=True)

    op.create_table(
        "sesiones_usuario",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("expira_en", sa.DateTime(), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index(op.f("ix_sesiones_usuario_usuario_id"), "sesiones_usuario", ["usuario_id"], unique=False)
    op.create_index(op.f("ix_sesiones_usuario_expira_en"), "sesiones_usuario", ["expira_en"], unique=False)


def downgrade() -> None:
    op.drop_table("sesiones_usuario")
    op.drop_table("usuarios")

