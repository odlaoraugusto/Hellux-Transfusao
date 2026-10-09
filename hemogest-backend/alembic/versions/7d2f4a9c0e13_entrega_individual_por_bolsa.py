"""entrega individual por bolsa

Revision ID: 7d2f4a9c0e13
Revises: 9c4b7e2a1f06
Create Date: 2026-10-01 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '7d2f4a9c0e13'
down_revision = '9c4b7e2a1f06'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Recebimento passa a ser por bolsa, não por solicitação inteira
    # (2026-10-01, pedido do cliente: "posso entregar uma bolsa primeiro e
    # a segunda depois"). Sem dado real nessas colunas ainda (nenhuma
    # solicitação chegou a ENTREGUE em produção), então sem backfill.
    op.add_column('solicitacao_bolsa', sa.Column('temperatura_transporte_c', sa.Numeric(precision=4, scale=1), nullable=True))
    op.add_column('solicitacao_bolsa', sa.Column('recebido_por', sa.String(length=120), nullable=True))
    op.add_column('solicitacao_bolsa', sa.Column('nome_pai_receptor', sa.String(length=200), nullable=True))
    op.add_column('solicitacao_bolsa', sa.Column('observacoes_entrega', sa.Text(), nullable=True))
    op.add_column('solicitacao_bolsa', sa.Column('entregue_em', sa.DateTime(timezone=True), nullable=True))
    op.add_column('solicitacao_bolsa', sa.Column('entregue_por', sa.UUID(), nullable=True))

    op.drop_column('solicitacao_transfusional', 'temperatura_transporte_c')
    op.drop_column('solicitacao_transfusional', 'recebido_por')
    op.drop_column('solicitacao_transfusional', 'entregue_por')
    op.drop_column('solicitacao_transfusional', 'observacoes_entrega')
    op.drop_column('solicitacao_transfusional', 'nome_pai_receptor')


def downgrade() -> None:
    op.add_column('solicitacao_transfusional', sa.Column('nome_pai_receptor', sa.String(length=200), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('observacoes_entrega', sa.Text(), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('entregue_por', sa.UUID(), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('recebido_por', sa.String(length=120), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('temperatura_transporte_c', sa.Numeric(precision=4, scale=1), nullable=True))

    op.drop_column('solicitacao_bolsa', 'entregue_por')
    op.drop_column('solicitacao_bolsa', 'entregue_em')
    op.drop_column('solicitacao_bolsa', 'observacoes_entrega')
    op.drop_column('solicitacao_bolsa', 'nome_pai_receptor')
    op.drop_column('solicitacao_bolsa', 'recebido_por')
    op.drop_column('solicitacao_bolsa', 'temperatura_transporte_c')
