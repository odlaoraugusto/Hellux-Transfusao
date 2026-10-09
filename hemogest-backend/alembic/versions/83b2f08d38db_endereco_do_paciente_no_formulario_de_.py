"""endereco do paciente no formulario de solicitacao

Revision ID: 83b2f08d38db
Revises: 07fdee44c8a5
Create Date: 2026-09-30 23:21:43.868044
"""
from alembic import op
import sqlalchemy as sa

import app.db.encrypted_types


revision = '83b2f08d38db'
down_revision = '07fdee44c8a5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('formulario_solicitacao', sa.Column('cep', sa.String(length=9), nullable=True))
    op.add_column('formulario_solicitacao', sa.Column('logradouro', app.db.encrypted_types.EncryptedString(length=255), nullable=True))
    op.add_column('formulario_solicitacao', sa.Column('numero', app.db.encrypted_types.EncryptedString(length=255), nullable=True))
    op.add_column('formulario_solicitacao', sa.Column('bairro', app.db.encrypted_types.EncryptedString(length=255), nullable=True))
    op.add_column('formulario_solicitacao', sa.Column('cidade', sa.String(length=120), nullable=True))
    op.add_column('formulario_solicitacao', sa.Column('uf', sa.String(length=2), nullable=True))
    op.add_column('formulario_solicitacao', sa.Column('codigo_ibge', sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column('formulario_solicitacao', 'codigo_ibge')
    op.drop_column('formulario_solicitacao', 'uf')
    op.drop_column('formulario_solicitacao', 'cidade')
    op.drop_column('formulario_solicitacao', 'bairro')
    op.drop_column('formulario_solicitacao', 'numero')
    op.drop_column('formulario_solicitacao', 'logradouro')
    op.drop_column('formulario_solicitacao', 'cep')
