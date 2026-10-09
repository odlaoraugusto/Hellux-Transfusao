"""medico_e_cpf_da_mae

Revision ID: f795bb31f180
Revises: 9536de9a2dd0
Create Date: 2026-10-02 09:58:48.455545
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'f795bb31f180'
down_revision = '9536de9a2dd0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "formulario_solicitacao",
        sa.Column("cpf_e_da_mae", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("formulario_solicitacao", "cpf_e_da_mae", server_default=None)

    op.create_table(
        "medico",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("crm", sa.String(30), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_medico_unidade"),
        sa.UniqueConstraint("unidade_hospitalar_id", "crm", name="uq_medico_unidade_crm"),
    )
    op.create_index("ix_medico_unidade_hospitalar_id", "medico", ["unidade_hospitalar_id"])
    op.create_index("ix_medico_crm", "medico", ["crm"])


def downgrade() -> None:
    op.drop_index("ix_medico_crm", table_name="medico")
    op.drop_index("ix_medico_unidade_hospitalar_id", table_name="medico")
    op.drop_table("medico")
    op.drop_column("formulario_solicitacao", "cpf_e_da_mae")
