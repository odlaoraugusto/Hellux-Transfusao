"""liga solicitacao ao formulario de origem

Revision ID: 0a83b5440328
Revises: eb8eb6e24aab
Create Date: 2026-09-30 14:35:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0a83b5440328'
down_revision = 'eb8eb6e24aab'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('solicitacao_transfusional', sa.Column('formulario_solicitacao_id', sa.UUID(), nullable=True))
    op.create_index(
        op.f('ix_solicitacao_transfusional_formulario_solicitacao_id'),
        'solicitacao_transfusional', ['formulario_solicitacao_id'], unique=False,
    )
    op.create_foreign_key(
        None, 'solicitacao_transfusional', 'formulario_solicitacao',
        ['formulario_solicitacao_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_solicitacao_transfusional_formulario_solicitacao_id'), table_name='solicitacao_transfusional')
    op.drop_column('solicitacao_transfusional', 'formulario_solicitacao_id')
