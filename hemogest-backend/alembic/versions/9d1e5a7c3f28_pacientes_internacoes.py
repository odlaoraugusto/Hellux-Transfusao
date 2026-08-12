"""assistencial - pacientes e internacoes

Revision ID: 9d1e5a7c3f28
Revises: 2f6b8d4a91c3
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "9d1e5a7c3f28"
down_revision = "2f6b8d4a91c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "paciente",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("data_nascimento", sa.Date, nullable=True),
        sa.Column("sexo", sa.String(1), nullable=True),
        sa.Column("cpf", sa.String(11), nullable=True),
        sa.Column("cns", sa.String(15), nullable=True),
        sa.Column("numero_prontuario", sa.String(30), nullable=True),
        sa.Column("tipo_sanguineo", sa.String(3), nullable=True),
        sa.Column("telefone", sa.String(20), nullable=True),
        sa.Column("nome_mae", sa.String(200), nullable=True),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_paciente_unidade"),
    )
    op.create_index("ix_paciente_unidade_hospitalar_id", "paciente", ["unidade_hospitalar_id"])
    op.create_index("ix_paciente_nome", "paciente", ["nome"])
    op.create_index("ix_paciente_cpf", "paciente", ["cpf"])
    op.create_index("ix_paciente_cns", "paciente", ["cns"])
    op.create_index("ix_paciente_numero_prontuario", "paciente", ["numero_prontuario"])

    op.create_table(
        "internacao",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("paciente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("setor_atual_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero_internacao", sa.String(30), nullable=True),
        sa.Column("leito", sa.String(20), nullable=True),
        sa.Column("data_entrada", sa.Date, nullable=False),
        sa.Column("data_alta", sa.Date, nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="ATIVA"),
        sa.Column("motivo_alta", sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_internacao_unidade"),
        sa.ForeignKeyConstraint(["paciente_id"], ["paciente.id"], name="fk_internacao_paciente"),
        sa.ForeignKeyConstraint(["setor_atual_id"], ["setor.id"], name="fk_internacao_setor"),
    )
    op.create_index("ix_internacao_unidade_hospitalar_id", "internacao", ["unidade_hospitalar_id"])
    op.create_index("ix_internacao_paciente_id", "internacao", ["paciente_id"])
    op.create_index("ix_internacao_setor_atual_id", "internacao", ["setor_atual_id"])
    op.create_index("ix_internacao_numero_internacao", "internacao", ["numero_internacao"])

    op.create_table(
        "internacao_setor_historico",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("internacao_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("setor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_fim", sa.DateTime(timezone=True), nullable=True),
        sa.Column("registrado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["internacao_id"], ["internacao.id"], name="fk_historico_internacao"),
        sa.ForeignKeyConstraint(["setor_id"], ["setor.id"], name="fk_historico_setor"),
    )
    op.create_index("ix_historico_internacao_id", "internacao_setor_historico", ["internacao_id"])


def downgrade() -> None:
    op.drop_index("ix_historico_internacao_id", table_name="internacao_setor_historico")
    op.drop_table("internacao_setor_historico")
    op.drop_index("ix_internacao_numero_internacao", table_name="internacao")
    op.drop_index("ix_internacao_setor_atual_id", table_name="internacao")
    op.drop_index("ix_internacao_paciente_id", table_name="internacao")
    op.drop_index("ix_internacao_unidade_hospitalar_id", table_name="internacao")
    op.drop_table("internacao")
    op.drop_index("ix_paciente_numero_prontuario", table_name="paciente")
    op.drop_index("ix_paciente_cns", table_name="paciente")
    op.drop_index("ix_paciente_cpf", table_name="paciente")
    op.drop_index("ix_paciente_nome", table_name="paciente")
    op.drop_index("ix_paciente_unidade_hospitalar_id", table_name="paciente")
    op.drop_table("paciente")
