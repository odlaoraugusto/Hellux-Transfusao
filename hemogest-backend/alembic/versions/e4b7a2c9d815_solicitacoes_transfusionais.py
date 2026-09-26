"""solicitacoes transfusionais - painel de solicitacoes e bolsas entregues

Revision ID: e4b7a2c9d815
Revises: c1a4e9f7d203
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e4b7a2c9d815"
down_revision = "c1a4e9f7d203"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "solicitacao_transfusional",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("internacao_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("paciente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("setor_solicitante_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hemocomponente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantidade", sa.Integer, nullable=False, server_default="1"),
        sa.Column("prioridade", sa.String(12), nullable=False, server_default="ROTINA"),
        sa.Column("indicacao", sa.Text, nullable=True),
        sa.Column("medico_solicitante", sa.String(120), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="SOLICITADO"),
        sa.Column("data_solicitacao", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_inicio_processamento", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_entrega", sa.DateTime(timezone=True), nullable=True),
        sa.Column("abo_paciente", sa.String(3), nullable=True),
        sa.Column("prova_cruzada", sa.String(15), nullable=True),
        sa.Column("temperatura_transporte_c", sa.Numeric(4, 1), nullable=True),
        sa.Column("recebido_por", sa.String(120), nullable=True),
        sa.Column("entregue_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("liberacao_com_ressalva", sa.Boolean, nullable=True),
        sa.Column("observacoes_entrega", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_solic_unidade"),
        sa.ForeignKeyConstraint(["internacao_id"], ["internacao.id"], name="fk_solic_internacao"),
        sa.ForeignKeyConstraint(["paciente_id"], ["paciente.id"], name="fk_solic_paciente"),
        sa.ForeignKeyConstraint(["setor_solicitante_id"], ["setor.id"], name="fk_solic_setor"),
        sa.ForeignKeyConstraint(["hemocomponente_id"], ["hemocomponente.id"], name="fk_solic_hemocomponente"),
    )
    op.create_index("ix_solic_unidade_hospitalar_id", "solicitacao_transfusional", ["unidade_hospitalar_id"])
    op.create_index("ix_solic_internacao_id", "solicitacao_transfusional", ["internacao_id"])
    op.create_index("ix_solic_paciente_id", "solicitacao_transfusional", ["paciente_id"])
    op.create_index("ix_solic_setor_solicitante_id", "solicitacao_transfusional", ["setor_solicitante_id"])
    op.create_index("ix_solic_status", "solicitacao_transfusional", ["status"])
    op.create_index("ix_solic_data_solicitacao", "solicitacao_transfusional", ["data_solicitacao"])

    op.create_table(
        "solicitacao_bolsa",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("solicitacao_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unidade_hemocomponente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["solicitacao_id"], ["solicitacao_transfusional.id"], name="fk_solic_bolsa_solicitacao"),
        sa.ForeignKeyConstraint(["unidade_hemocomponente_id"], ["unidade_hemocomponente.id"], name="fk_solic_bolsa_bolsa"),
        sa.UniqueConstraint("solicitacao_id", "unidade_hemocomponente_id", name="uq_solicitacao_bolsa"),
    )
    op.create_index("ix_solic_bolsa_solicitacao_id", "solicitacao_bolsa", ["solicitacao_id"])
    op.create_index("ix_solic_bolsa_bolsa_id", "solicitacao_bolsa", ["unidade_hemocomponente_id"])


def downgrade() -> None:
    op.drop_table("solicitacao_bolsa")
    op.drop_table("solicitacao_transfusional")
