"""formulario de solicitacao de transfusao (formulario publico)

Revision ID: a9d2f6b8c314
Revises: e4b7a2c9d815
Create Date: 2026-09-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a9d2f6b8c314"
down_revision = "e4b7a2c9d815"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "formulario_solicitacao",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("protocolo", sa.String(20), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("ip_origem", sa.String(45), nullable=True),
        sa.Column("convenio", sa.String(60), nullable=True),
        sa.Column("data_solicitacao", sa.Date, nullable=False),
        sa.Column("hora_solicitacao", sa.Time, nullable=False),
        # Colunas criptografadas: largas de propósito (ver app.db.encrypted_types).
        sa.Column("nome_paciente", sa.String(500), nullable=False),
        sa.Column("prontuario", sa.String(255), nullable=False),
        sa.Column("sexo", sa.String(1), nullable=False),
        sa.Column("data_nascimento", sa.Date, nullable=False),
        sa.Column("nome_mae", sa.String(500), nullable=False),
        sa.Column("raca_cor", sa.String(10), nullable=False),
        sa.Column("setor_nome", sa.String(120), nullable=False),
        sa.Column("leito", sa.String(20), nullable=False),
        sa.Column("peso_kg", sa.Numeric(7, 3), nullable=False),
        sa.Column("diagnostico", sa.String(500), nullable=False),
        sa.Column("hb", sa.String(20), nullable=False),
        sa.Column("ht", sa.String(20), nullable=False),
        sa.Column("plaquetas", sa.String(20), nullable=False),
        sa.Column("tp", sa.String(20), nullable=True),
        sa.Column("ttpa", sa.String(20), nullable=True),
        sa.Column("indicacao", sa.String(7), nullable=False),
        sa.Column("antecedentes_transfusionais", sa.Boolean, nullable=False),
        sa.Column("antecedentes_obstetricos", sa.Boolean, nullable=True),
        sa.Column("reacao_previa", sa.Boolean, nullable=False),
        sa.Column("reacao_previa_descricao", sa.String(500), nullable=True),
        sa.Column("itens", sa.JSON, nullable=False),
        sa.Column("modalidade", sa.String(12), nullable=False),
        sa.Column("observacoes", sa.Text, nullable=True),
        sa.Column("termo_heterogrupo_medico", sa.String(120), nullable=True),
        sa.Column("termo_heterogrupo_crm", sa.String(30), nullable=True),
        sa.Column("termo_emergencia_medico", sa.String(120), nullable=True),
        sa.Column("termo_emergencia_crm", sa.String(30), nullable=True),
        sa.Column("medico_nome", sa.String(120), nullable=False),
        sa.Column("medico_crm", sa.String(30), nullable=False),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_formulario_unidade"),
        sa.UniqueConstraint("unidade_hospitalar_id", "protocolo", name="uq_formulario_unidade_protocolo"),
    )
    op.create_index("ix_formulario_unidade_hospitalar_id", "formulario_solicitacao", ["unidade_hospitalar_id"])
    op.create_index("ix_formulario_token_hash", "formulario_solicitacao", ["token_hash"], unique=True)
    op.create_index("ix_formulario_data_solicitacao", "formulario_solicitacao", ["data_solicitacao"])
    op.create_index("ix_formulario_modalidade", "formulario_solicitacao", ["modalidade"])


def downgrade() -> None:
    op.drop_table("formulario_solicitacao")
