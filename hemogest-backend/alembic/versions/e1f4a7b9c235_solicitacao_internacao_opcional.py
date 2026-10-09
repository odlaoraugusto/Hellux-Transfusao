"""solicitacao_transfusional.internacao_id vira opcional -- solicitacoes
originadas do formulario publico nao passam por internacao (2026-09-30,
pedido do cliente: "esquece isso de internacao")

Revision ID: e1f4a7b9c235
Revises: d8a5e6c1f234
Create Date: 2026-09-30
"""
from alembic import op

revision = "e1f4a7b9c235"
down_revision = "d8a5e6c1f234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("solicitacao_transfusional", "internacao_id", nullable=True)


def downgrade() -> None:
    op.alter_column("solicitacao_transfusional", "internacao_id", nullable=False)
