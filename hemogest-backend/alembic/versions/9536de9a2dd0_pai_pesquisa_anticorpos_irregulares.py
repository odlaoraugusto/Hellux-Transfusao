"""pai_pesquisa_anticorpos_irregulares

Revision ID: 9536de9a2dd0
Revises: de24617fe5d8
Create Date: 2026-10-01 15:33:50.840381
"""
from alembic import op
import sqlalchemy as sa


revision = '9536de9a2dd0'
down_revision = 'de24617fe5d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "solicitacao_transfusional", sa.Column("pesquisa_anticorpos_irregulares", sa.String(length=15), nullable=True)
    )
    # Sem dado real em nome_pai_receptor até aqui (conferido antes de gerar
    # esta migração) — remoção direta, sem backfill.
    op.drop_column("solicitacao_bolsa", "nome_pai_receptor")


def downgrade() -> None:
    op.add_column("solicitacao_bolsa", sa.Column("nome_pai_receptor", sa.String(length=200), nullable=True))
    op.drop_column("solicitacao_transfusional", "pesquisa_anticorpos_irregulares")
