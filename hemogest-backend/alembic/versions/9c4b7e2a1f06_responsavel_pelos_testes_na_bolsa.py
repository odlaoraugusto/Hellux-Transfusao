"""responsavel pelos testes na bolsa

Revision ID: 9c4b7e2a1f06
Revises: 5e9a1c3f7b84
Create Date: 2026-10-01 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '9c4b7e2a1f06'
down_revision = '5e9a1c3f7b84'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('solicitacao_bolsa', sa.Column('responsavel_testes', sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column('solicitacao_bolsa', 'responsavel_testes')
