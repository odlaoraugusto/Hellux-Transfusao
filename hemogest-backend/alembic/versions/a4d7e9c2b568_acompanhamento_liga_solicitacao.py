"""acompanhamento_transfusional passa a ligar direto na
solicitacao_transfusional em vez de internacao + bolsa -- sem uso real de
internacao nem de estoque de bolsas neste hospital (2026-09-30, pedido do
cliente). Tabela vazia (feature nunca usada em produção) -- ajuste direto.

Revision ID: a4d7e9c2b568
Revises: f2a6c8e1b347
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a4d7e9c2b568"
down_revision = "f2a6c8e1b347"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_acomp_internacao_id", table_name="acompanhamento_transfusional")
    op.drop_index("ix_acomp_bolsa_id", table_name="acompanhamento_transfusional")
    op.drop_constraint("fk_acomp_internacao", "acompanhamento_transfusional", type_="foreignkey")
    op.drop_constraint("fk_acomp_bolsa", "acompanhamento_transfusional", type_="foreignkey")
    op.drop_column("acompanhamento_transfusional", "internacao_id")
    op.drop_column("acompanhamento_transfusional", "unidade_hemocomponente_id")

    op.add_column(
        "acompanhamento_transfusional",
        sa.Column("solicitacao_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "fk_acomp_solicitacao", "acompanhamento_transfusional", "solicitacao_transfusional",
        ["solicitacao_id"], ["id"],
    )
    op.create_index("ix_acomp_solicitacao_id", "acompanhamento_transfusional", ["solicitacao_id"])


def downgrade() -> None:
    op.drop_index("ix_acomp_solicitacao_id", table_name="acompanhamento_transfusional")
    op.drop_constraint("fk_acomp_solicitacao", "acompanhamento_transfusional", type_="foreignkey")
    op.drop_column("acompanhamento_transfusional", "solicitacao_id")

    op.add_column(
        "acompanhamento_transfusional",
        sa.Column("internacao_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.add_column(
        "acompanhamento_transfusional",
        sa.Column("unidade_hemocomponente_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "fk_acomp_internacao", "acompanhamento_transfusional", "internacao", ["internacao_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_acomp_bolsa", "acompanhamento_transfusional", "unidade_hemocomponente", ["unidade_hemocomponente_id"], ["id"]
    )
    op.create_index("ix_acomp_internacao_id", "acompanhamento_transfusional", ["internacao_id"])
    op.create_index("ix_acomp_bolsa_id", "acompanhamento_transfusional", ["unidade_hemocomponente_id"])
