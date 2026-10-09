"""prontuario_opcional_no_formulario_publico

Revision ID: ae55d0021a21
Revises: f795bb31f180
Create Date: 2026-10-02 13:00:05.958700
"""
from alembic import op
import sqlalchemy as sa


revision = 'ae55d0021a21'
down_revision = 'f795bb31f180'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("formulario_solicitacao", "prontuario", nullable=True)


def downgrade() -> None:
    op.alter_column("formulario_solicitacao", "prontuario", nullable=False)
