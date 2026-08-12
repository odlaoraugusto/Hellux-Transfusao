"""parametrizacao - hemocomponentes, motivos, tipos de reacao, gravidade

Revision ID: 2f6b8d4a91c3
Revises: 7a3f1c9e2b40
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2f6b8d4a91c3"
down_revision = "7a3f1c9e2b40"
branch_labels = None
depends_on = None


def _audit_columns():
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
    ]


def _parametrizacao_columns():
    return [
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("descricao", sa.String(255), nullable=True),
        sa.Column("cor", sa.String(7), nullable=True),
        sa.Column("ordem", sa.Integer, nullable=False, server_default="0"),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
    ]


def _criar_tabela_simples(nome_tabela: str, uq_name: str, colunas_extra: list | None = None) -> None:
    op.create_table(
        nome_tabela,
        *_audit_columns(),
        *_parametrizacao_columns(),
        *(colunas_extra or []),
        sa.ForeignKeyConstraint(
            ["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name=f"fk_{nome_tabela}_unidade"
        ),
        sa.UniqueConstraint("unidade_hospitalar_id", "nome", name=uq_name),
    )
    op.create_index(f"ix_{nome_tabela}_unidade_hospitalar_id", nome_tabela, ["unidade_hospitalar_id"])


def upgrade() -> None:
    _criar_tabela_simples(
        "hemocomponente",
        "uq_hemocomponente_unidade_nome",
        [
            sa.Column("sigla", sa.String(10), nullable=True),
            sa.Column("validade_padrao_dias", sa.Integer, nullable=True),
        ],
    )
    _criar_tabela_simples("motivo_devolucao", "uq_motivo_devolucao_unidade_nome")
    _criar_tabela_simples("motivo_descarte", "uq_motivo_descarte_unidade_nome")
    _criar_tabela_simples("tipo_reacao", "uq_tipo_reacao_unidade_nome")
    _criar_tabela_simples(
        "gravidade",
        "uq_gravidade_unidade_nome",
        [sa.Column("nivel", sa.Integer, nullable=False, server_default="1")],
    )


def downgrade() -> None:
    for tabela in ("gravidade", "tipo_reacao", "motivo_descarte", "motivo_devolucao", "hemocomponente"):
        op.drop_index(f"ix_{tabela}_unidade_hospitalar_id", table_name=tabela)
        op.drop_table(tabela)
