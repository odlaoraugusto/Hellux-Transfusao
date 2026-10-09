"""unifica_motivos_devolucao_descarte

Revision ID: c4b3aaffed93
Revises: ae55d0021a21
Create Date: 2026-10-05 13:37:47.339206
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'c4b3aaffed93'
down_revision = 'ae55d0021a21'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 2026-10-05, pedido do cliente: "coloca os parâmetros de devolução e
    # descarte juntos (os motivos cadastrados passam a valer para ambos)".
    # motivo_descarte estava vazia em produção (conferido antes de gerar
    # esta migração) — sem dado pra migrar, só repontar o FK.
    op.drop_constraint("fk_descarte_motivo", "descarte", type_="foreignkey")
    op.create_foreign_key(
        "fk_descarte_motivo", "descarte", "motivo_devolucao", ["motivo_descarte_id"], ["id"]
    )
    op.drop_index("ix_motivo_descarte_unidade_hospitalar_id", table_name="motivo_descarte")
    op.drop_table("motivo_descarte")


def downgrade() -> None:
    op.create_table(
        "motivo_descarte",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("descricao", sa.String(255), nullable=True),
        sa.Column("cor", sa.String(7), nullable=True),
        sa.Column("ordem", sa.Integer, nullable=False, server_default="0"),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_motivo_descarte_unidade"),
        sa.UniqueConstraint("unidade_hospitalar_id", "nome", name="uq_motivo_descarte_unidade_nome"),
    )
    op.create_index("ix_motivo_descarte_unidade_hospitalar_id", "motivo_descarte", ["unidade_hospitalar_id"])
    op.drop_constraint("fk_descarte_motivo", "descarte", type_="foreignkey")
    op.create_foreign_key(
        "fk_descarte_motivo", "descarte", "motivo_descarte", ["motivo_descarte_id"], ["id"]
    )
