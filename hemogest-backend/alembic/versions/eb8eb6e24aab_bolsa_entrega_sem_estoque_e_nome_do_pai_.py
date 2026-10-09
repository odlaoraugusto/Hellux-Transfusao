"""bolsa entrega sem estoque e nome do pai do receptor

Revision ID: eb8eb6e24aab
Revises: b6e3f8a1d972
Create Date: 2026-09-30 14:05:10.238829
"""
from alembic import op
import sqlalchemy as sa


revision = 'eb8eb6e24aab'
down_revision = 'b6e3f8a1d972'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # solicitacao_bolsa passa a guardar os dados digitados na entrega
    # (número, ABO/Rh, validade) em vez de apontar pro estoque de bolsas
    # (módulo inativo — tabela sem nenhuma linha até aqui).
    op.add_column('solicitacao_bolsa', sa.Column('numero_bolsa', sa.String(length=50), nullable=False))
    op.add_column('solicitacao_bolsa', sa.Column('tipo_sanguineo', sa.String(length=3), nullable=False))
    op.add_column('solicitacao_bolsa', sa.Column('data_validade', sa.Date(), nullable=False))
    op.drop_index('ix_solic_bolsa_bolsa_id', table_name='solicitacao_bolsa')
    op.drop_constraint('uq_solicitacao_bolsa', 'solicitacao_bolsa', type_='unique')
    op.drop_constraint('fk_solic_bolsa_bolsa', 'solicitacao_bolsa', type_='foreignkey')
    op.drop_column('solicitacao_bolsa', 'unidade_hemocomponente_id')

    op.add_column('solicitacao_transfusional', sa.Column('nome_pai_receptor', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('solicitacao_transfusional', 'nome_pai_receptor')

    op.add_column('solicitacao_bolsa', sa.Column('unidade_hemocomponente_id', sa.UUID(), autoincrement=False, nullable=False))
    op.create_foreign_key('fk_solic_bolsa_bolsa', 'solicitacao_bolsa', 'unidade_hemocomponente', ['unidade_hemocomponente_id'], ['id'])
    op.create_unique_constraint('uq_solicitacao_bolsa', 'solicitacao_bolsa', ['solicitacao_id', 'unidade_hemocomponente_id'])
    op.create_index('ix_solic_bolsa_bolsa_id', 'solicitacao_bolsa', ['unidade_hemocomponente_id'], unique=False)
    op.drop_column('solicitacao_bolsa', 'data_validade')
    op.drop_column('solicitacao_bolsa', 'tipo_sanguineo')
    op.drop_column('solicitacao_bolsa', 'numero_bolsa')
