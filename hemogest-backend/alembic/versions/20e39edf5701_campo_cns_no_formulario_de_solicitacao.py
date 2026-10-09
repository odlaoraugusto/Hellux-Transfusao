"""campo cns no formulario de solicitacao

Revision ID: 20e39edf5701
Revises: 83b2f08d38db
Create Date: 2026-10-01 00:05:00.000000
"""
from alembic import op
import sqlalchemy as sa

import app.db.encrypted_types


revision = '20e39edf5701'
down_revision = '83b2f08d38db'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'formulario_solicitacao',
        sa.Column('cns', app.db.encrypted_types.EncryptedString(length=255), nullable=True, comment='Cartão Nacional de Saúde'),
    )


def downgrade() -> None:
    op.drop_column('formulario_solicitacao', 'cns')
