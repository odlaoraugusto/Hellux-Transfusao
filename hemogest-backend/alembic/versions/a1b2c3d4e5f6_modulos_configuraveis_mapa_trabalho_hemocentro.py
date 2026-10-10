"""módulos configuráveis por unidade, mapa de trabalho pré-transfusional e solicitação ao hemocentro

Cada agência transfusional do SUS opera de um jeito diferente: uma só
transfunde (sem estoque próprio), outra recebe bolsas do hemocentro de
referência, faz os testes completos e mantém estoque — ver
MODULOS.md. Esta migration dá a cada unidade hospitalar 3 chaves
para ligar/desligar essas seções, sem exigir um fluxo único para todo
mundo:

  - modulo_estoque_ativo (default True — preserva o comportamento atual)
  - modulo_mapa_trabalho_ativo (default True)
  - modulo_solicitacao_hemocentro_ativo (default False — funcionalidade
    nova, cada unidade liga quando fizer sentido)

Também adiciona:
  - numero_macarrao em unidade_hemocomponente (nº do segmento/tubo da
    bolsa, usado em reteste de confirmação);
  - mapa_trabalho_pretransfusional (ficha técnica dos testes
    pré-transfusionais, 1:1 com solicitacao_bolsa);
  - solicitacao_hemocentro / solicitacao_hemocentro_item (reposição de
    estoque junto ao hemocentro de referência) e a FK de origem em
    unidade_hemocomponente.solicitacao_hemocentro_id.

Só ADD COLUMN/CREATE TABLE — nenhum ALTER COLUMN em tabela existente, de
propósito: funciona tanto em Postgres quanto em SQLite (ver nota em
setup.bat sobre ALTER COLUMN não ser suportado fora do modo batch do
Alembic no SQLite).

Revision ID: a1b2c3d4e5f6
Revises: c4b3aaffed93
Create Date: 2026-10-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "c4b3aaffed93"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "unidade_hospitalar",
        sa.Column("modulo_estoque_ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "unidade_hospitalar",
        sa.Column("modulo_mapa_trabalho_ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "unidade_hospitalar",
        sa.Column("modulo_solicitacao_hemocentro_ativo", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.add_column("unidade_hemocomponente", sa.Column("numero_macarrao", sa.String(30), nullable=True))

    op.create_table(
        "solicitacao_hemocentro",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("unidade_hospitalar.id"), nullable=False, index=True),
        sa.Column("hemocentro_nome", sa.String(120), nullable=True),
        sa.Column("status", sa.String(15), nullable=False),
        sa.Column("data_solicitacao", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_envio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_recebimento", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
    )
    op.create_index("ix_solicitacao_hemocentro_status", "solicitacao_hemocentro", ["status"])

    op.create_table(
        "solicitacao_hemocentro_item",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "solicitacao_hemocentro_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("solicitacao_hemocentro.id"), nullable=False, index=True,
        ),
        sa.Column("hemocomponente_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hemocomponente.id"), nullable=False),
        sa.Column("quantidade_solicitada", sa.Integer(), nullable=False),
    )

    op.add_column(
        "unidade_hemocomponente",
        sa.Column(
            "solicitacao_hemocentro_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("solicitacao_hemocentro.id"), nullable=True,
        ),
    )
    op.create_index(
        "ix_unidade_hemocomponente_solicitacao_hemocentro_id",
        "unidade_hemocomponente", ["solicitacao_hemocentro_id"],
    )

    op.create_table(
        "mapa_trabalho_pretransfusional",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("unidade_hospitalar.id"), nullable=False, index=True),
        sa.Column(
            "solicitacao_bolsa_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("solicitacao_bolsa.id"), nullable=False, unique=True, index=True,
        ),
        sa.Column("abo_rh_receptor_confirmado", sa.String(3), nullable=True),
        sa.Column("abo_rh_doador_confirmado", sa.String(3), nullable=True),
        sa.Column("metodo_abo_rh", sa.String(20), nullable=True),
        sa.Column("tecnica_prova_cruzada", sa.String(20), nullable=True),
        sa.Column("lote_reagente_pai", sa.String(60), nullable=True),
        sa.Column("lote_soro_anti_a", sa.String(60), nullable=True),
        sa.Column("lote_soro_anti_b", sa.String(60), nullable=True),
        sa.Column("lote_soro_anti_d", sa.String(60), nullable=True),
        sa.Column("validade_reagentes", sa.Date(), nullable=True),
        sa.Column("temperatura_amostra_c", sa.Numeric(4, 1), nullable=True),
        sa.Column("tecnico_executante_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("conferente_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("data_hora_inicio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_hora_fim", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("mapa_trabalho_pretransfusional")
    op.drop_index("ix_unidade_hemocomponente_solicitacao_hemocentro_id", table_name="unidade_hemocomponente")
    op.drop_column("unidade_hemocomponente", "solicitacao_hemocentro_id")
    op.drop_table("solicitacao_hemocentro_item")
    op.drop_index("ix_solicitacao_hemocentro_status", table_name="solicitacao_hemocentro")
    op.drop_table("solicitacao_hemocentro")
    op.drop_column("unidade_hemocomponente", "numero_macarrao")
    op.drop_column("unidade_hospitalar", "modulo_solicitacao_hemocentro_ativo")
    op.drop_column("unidade_hospitalar", "modulo_mapa_trabalho_ativo")
    op.drop_column("unidade_hospitalar", "modulo_estoque_ativo")
