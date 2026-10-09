"""cancelamento_de_solicitacao

Revision ID: 91c4754f5682
Revises: 7d2f4a9c0e13
Create Date: 2026-10-01 13:58:27.083126
"""
from alembic import op
import sqlalchemy as sa


revision = '91c4754f5682'
down_revision = '7d2f4a9c0e13'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("solicitacao_transfusional", sa.Column("motivo_cancelamento", sa.Text(), nullable=True))
    op.add_column(
        "solicitacao_transfusional", sa.Column("cancelado_em", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("solicitacao_transfusional", sa.Column("cancelado_por", sa.UUID(), nullable=True))


def downgrade() -> None:
    op.drop_column("solicitacao_transfusional", "cancelado_por")
    op.drop_column("solicitacao_transfusional", "cancelado_em")
    op.drop_column("solicitacao_transfusional", "motivo_cancelamento")
