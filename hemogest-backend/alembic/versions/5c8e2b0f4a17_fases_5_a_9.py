"""fases 5-9 - bolsas, acompanhamento, reacoes, devolucoes, descartes, anexos

Revision ID: 5c8e2b0f4a17
Revises: 9d1e5a7c3f28
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "5c8e2b0f4a17"
down_revision = "9d1e5a7c3f28"
branch_labels = None
depends_on = None


def _audit_cols():
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
    ]


def upgrade() -> None:
    # --- Fase 5: Unidade de Hemocomponente (bolsa física) ---
    op.create_table(
        "unidade_hemocomponente",
        *_audit_cols(),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hemocomponente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero_bolsa", sa.String(30), nullable=False),
        sa.Column("codigo_satelite", sa.String(2), nullable=True),
        sa.Column("bolsa_mae_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tipo_sanguineo", sa.String(3), nullable=True),
        sa.Column("data_coleta", sa.Date, nullable=True),
        sa.Column("data_validade", sa.Date, nullable=False),
        sa.Column("status", sa.String(15), nullable=False, server_default="DISPONIVEL"),
        sa.Column("paciente_reservado_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_bolsa_unidade"),
        sa.ForeignKeyConstraint(["hemocomponente_id"], ["hemocomponente.id"], name="fk_bolsa_hemocomponente"),
        sa.ForeignKeyConstraint(["bolsa_mae_id"], ["unidade_hemocomponente.id"], name="fk_bolsa_mae"),
        sa.ForeignKeyConstraint(["paciente_reservado_id"], ["paciente.id"], name="fk_bolsa_paciente"),
    )
    op.create_index("ix_bolsa_unidade_hospitalar_id", "unidade_hemocomponente", ["unidade_hospitalar_id"])
    op.create_index("ix_bolsa_hemocomponente_id", "unidade_hemocomponente", ["hemocomponente_id"])
    op.create_index("ix_bolsa_bolsa_mae_id", "unidade_hemocomponente", ["bolsa_mae_id"])
    op.create_index("ix_bolsa_numero_bolsa", "unidade_hemocomponente", ["numero_bolsa"])
    op.create_index("ix_bolsa_status", "unidade_hemocomponente", ["status"])

    # --- Fase 6: Acompanhamento Transfusional + Sinal Vital ---
    op.create_table(
        "acompanhamento_transfusional",
        *_audit_cols(),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("internacao_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unidade_hemocomponente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(15), nullable=False, server_default="AGUARDANDO"),
        sa.Column("data_inicio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_fim", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observacoes_finalizacao", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_acomp_unidade"),
        sa.ForeignKeyConstraint(["internacao_id"], ["internacao.id"], name="fk_acomp_internacao"),
        sa.ForeignKeyConstraint(["unidade_hemocomponente_id"], ["unidade_hemocomponente.id"], name="fk_acomp_bolsa"),
    )
    op.create_index("ix_acomp_unidade_hospitalar_id", "acompanhamento_transfusional", ["unidade_hospitalar_id"])
    op.create_index("ix_acomp_internacao_id", "acompanhamento_transfusional", ["internacao_id"])
    op.create_index("ix_acomp_bolsa_id", "acompanhamento_transfusional", ["unidade_hemocomponente_id"])

    op.create_table(
        "sinal_vital",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("acompanhamento_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("momento", sa.String(15), nullable=False),
        sa.Column("data_hora", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperatura_c", sa.Numeric(4, 1), nullable=True),
        sa.Column("pressao_arterial", sa.String(15), nullable=True),
        sa.Column("frequencia_cardiaca_bpm", sa.Integer, nullable=True),
        sa.Column("frequencia_respiratoria_ipm", sa.Integer, nullable=True),
        sa.Column("saturacao_o2_pct", sa.Integer, nullable=True),
        sa.Column("observacoes", sa.Text, nullable=True),
        sa.Column("registrado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["acompanhamento_id"], ["acompanhamento_transfusional.id"], name="fk_sinal_acomp"),
    )
    op.create_index("ix_sinal_acompanhamento_id", "sinal_vital", ["acompanhamento_id"])

    # --- Fase 7: Reação Transfusional ---
    op.create_table(
        "reacao_transfusional",
        *_audit_cols(),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("acompanhamento_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tipo_reacao_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gravidade_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(15), nullable=False, server_default="ABERTA"),
        sa.Column("descricao", sa.Text, nullable=False),
        sa.Column("data_abertura", sa.DateTime(timezone=True), nullable=False),
        sa.Column("investigacao", sa.Text, nullable=True),
        sa.Column("notivisa_numero", sa.String(50), nullable=True),
        sa.Column("notivisa_data_envio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("conclusao", sa.Text, nullable=True),
        sa.Column("data_encerramento", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_reacao_unidade"),
        sa.ForeignKeyConstraint(["acompanhamento_id"], ["acompanhamento_transfusional.id"], name="fk_reacao_acomp"),
        sa.ForeignKeyConstraint(["tipo_reacao_id"], ["tipo_reacao.id"], name="fk_reacao_tipo"),
        sa.ForeignKeyConstraint(["gravidade_id"], ["gravidade.id"], name="fk_reacao_gravidade"),
    )
    op.create_index("ix_reacao_unidade_hospitalar_id", "reacao_transfusional", ["unidade_hospitalar_id"])
    op.create_index("ix_reacao_acompanhamento_id", "reacao_transfusional", ["acompanhamento_id"])

    # --- Fase 8: Devolução e Descarte ---
    op.create_table(
        "devolucao",
        *_audit_cols(),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unidade_hemocomponente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("motivo_devolucao_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("observacao", sa.Text, nullable=True),
        sa.Column("data_devolucao", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_devolucao_unidade"),
        sa.ForeignKeyConstraint(["unidade_hemocomponente_id"], ["unidade_hemocomponente.id"], name="fk_devolucao_bolsa"),
        sa.ForeignKeyConstraint(["motivo_devolucao_id"], ["motivo_devolucao.id"], name="fk_devolucao_motivo"),
    )
    op.create_index("ix_devolucao_unidade_hospitalar_id", "devolucao", ["unidade_hospitalar_id"])
    op.create_index("ix_devolucao_bolsa_id", "devolucao", ["unidade_hemocomponente_id"])

    op.create_table(
        "descarte",
        *_audit_cols(),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unidade_hemocomponente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("motivo_descarte_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("observacao", sa.Text, nullable=True),
        sa.Column("data_descarte", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_descarte_unidade"),
        sa.ForeignKeyConstraint(["unidade_hemocomponente_id"], ["unidade_hemocomponente.id"], name="fk_descarte_bolsa"),
        sa.ForeignKeyConstraint(["motivo_descarte_id"], ["motivo_descarte.id"], name="fk_descarte_motivo"),
    )
    op.create_index("ix_descarte_unidade_hospitalar_id", "descarte", ["unidade_hospitalar_id"])
    op.create_index("ix_descarte_bolsa_id", "descarte", ["unidade_hemocomponente_id"])

    # --- Fase 9: Anexo ---
    op.create_table(
        "anexo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entidade", sa.String(60), nullable=False),
        sa.Column("entidade_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("object_name", sa.String(500), nullable=False),
        sa.Column("nome_arquivo", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("tamanho_bytes", sa.BigInteger, nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_anexo_unidade"),
        sa.UniqueConstraint("object_name", name="uq_anexo_object_name"),
    )
    op.create_index("ix_anexo_unidade_hospitalar_id", "anexo", ["unidade_hospitalar_id"])
    op.create_index("ix_anexo_entidade", "anexo", ["entidade"])
    op.create_index("ix_anexo_entidade_id", "anexo", ["entidade_id"])


def downgrade() -> None:
    op.drop_table("anexo")
    op.drop_table("descarte")
    op.drop_table("devolucao")
    op.drop_table("reacao_transfusional")
    op.drop_table("sinal_vital")
    op.drop_table("acompanhamento_transfusional")
    op.drop_table("unidade_hemocomponente")
