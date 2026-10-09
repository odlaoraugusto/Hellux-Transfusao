"""volume_ml_solicitado_na_solicitacao

Revision ID: de24617fe5d8
Revises: 91c4754f5682
Create Date: 2026-10-01 15:14:48.197694
"""
from alembic import op
import sqlalchemy as sa


revision = 'de24617fe5d8'
down_revision = '91c4754f5682'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("solicitacao_transfusional", sa.Column("volume_ml_solicitado", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("solicitacao_transfusional", "volume_ml_solicitado")
