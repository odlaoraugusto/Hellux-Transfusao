"""formulario_solicitacao: volta indicacao (faltava no documento recebido),
nome_mae/hb/ht voltam obrigatorios (pedido do cliente, 2026-09-30)

Revision ID: d8a5e6c1f234
Revises: c7d4b2f8a916
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = "d8a5e6c1f234"
down_revision = "c7d4b2f8a916"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tabela sem registros em produção — sem dado pra migrar.
    op.add_column(
        "formulario_solicitacao",
        sa.Column("indicacao", sa.String(7), nullable=False, server_default="USO"),
    )
    op.alter_column("formulario_solicitacao", "indicacao", server_default=None)

    op.alter_column("formulario_solicitacao", "nome_mae", nullable=False)
    op.alter_column("formulario_solicitacao", "hb", nullable=False)
    op.alter_column("formulario_solicitacao", "ht", nullable=False)


def downgrade() -> None:
    op.alter_column("formulario_solicitacao", "ht", nullable=True)
    op.alter_column("formulario_solicitacao", "hb", nullable=True)
    op.alter_column("formulario_solicitacao", "nome_mae", nullable=True)
    op.drop_column("formulario_solicitacao", "indicacao")
