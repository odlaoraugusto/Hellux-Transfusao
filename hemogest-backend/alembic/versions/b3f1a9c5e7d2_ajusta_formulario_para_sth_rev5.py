"""ajusta formulario_solicitacao para bater com o documento oficial STH Rev.5

O layout definitivo do papel (STH Rev.5) trouxe campos que não existiam
(cpf, nome social, data/hora programada) e não tem campos que existiam
(indicação, termos de heterogrupo/emergência — não fazem parte deste
documento) — e boa parte do que era obrigatório no rascunho não é
obrigatório no formulário real. Tabela sem nenhum registro em produção
ainda (sistema recém-implantado), então ajuste direto de coluna, sem
migração de dado.

Revision ID: b3f1a9c5e7d2
Revises: a9d2f6b8c314
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = "b3f1a9c5e7d2"
down_revision = "a9d2f6b8c314"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Campos novos do documento oficial — cpf/nome_social são dado sensível
    # de paciente, mesmo critério de criptografia por campo já usado em
    # nome_paciente/prontuario/nome_mae (ver app.db.encrypted_types).
    op.add_column("formulario_solicitacao", sa.Column("cpf", sa.String(255), nullable=True))
    op.add_column("formulario_solicitacao", sa.Column("nome_social", sa.String(500), nullable=True))
    op.add_column("formulario_solicitacao", sa.Column("data_programada", sa.Date, nullable=True))
    op.add_column("formulario_solicitacao", sa.Column("hora_programada", sa.Time, nullable=True))

    # No papel oficial, só prontuário/nome/unidade/nascimento/sexo/diagnóstico
    # são de preenchimento obrigatório — o resto (mãe, leito, peso, raça,
    # laboratoriais) é opcional.
    op.alter_column("formulario_solicitacao", "nome_mae", nullable=True)
    op.alter_column("formulario_solicitacao", "raca_cor", nullable=True)
    op.alter_column("formulario_solicitacao", "leito", nullable=True)
    op.alter_column("formulario_solicitacao", "peso_kg", nullable=True)
    op.alter_column("formulario_solicitacao", "hb", nullable=True)
    op.alter_column("formulario_solicitacao", "ht", nullable=True)
    op.alter_column("formulario_solicitacao", "plaquetas", nullable=True)

    # Não existem no documento oficial.
    op.drop_column("formulario_solicitacao", "indicacao")
    op.drop_column("formulario_solicitacao", "termo_heterogrupo_medico")
    op.drop_column("formulario_solicitacao", "termo_heterogrupo_crm")
    op.drop_column("formulario_solicitacao", "termo_emergencia_medico")
    op.drop_column("formulario_solicitacao", "termo_emergencia_crm")


def downgrade() -> None:
    op.add_column("formulario_solicitacao", sa.Column("termo_emergencia_crm", sa.String(30), nullable=True))
    op.add_column("formulario_solicitacao", sa.Column("termo_emergencia_medico", sa.String(120), nullable=True))
    op.add_column("formulario_solicitacao", sa.Column("termo_heterogrupo_crm", sa.String(30), nullable=True))
    op.add_column("formulario_solicitacao", sa.Column("termo_heterogrupo_medico", sa.String(120), nullable=True))
    op.add_column("formulario_solicitacao", sa.Column("indicacao", sa.String(7), nullable=False, server_default="USO"))
    op.alter_column("formulario_solicitacao", "indicacao", server_default=None)

    op.alter_column("formulario_solicitacao", "plaquetas", nullable=False)
    op.alter_column("formulario_solicitacao", "ht", nullable=False)
    op.alter_column("formulario_solicitacao", "hb", nullable=False)
    op.alter_column("formulario_solicitacao", "peso_kg", nullable=False)
    op.alter_column("formulario_solicitacao", "leito", nullable=False)
    op.alter_column("formulario_solicitacao", "raca_cor", nullable=False)
    op.alter_column("formulario_solicitacao", "nome_mae", nullable=False)

    op.drop_column("formulario_solicitacao", "hora_programada")
    op.drop_column("formulario_solicitacao", "data_programada")
    op.drop_column("formulario_solicitacao", "nome_social")
    op.drop_column("formulario_solicitacao", "cpf")
