"""bolsa individual com folha propria

Revision ID: 5e9a1c3f7b84
Revises: 20e39edf5701
Create Date: 2026-10-01 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '5e9a1c3f7b84'
down_revision = '20e39edf5701'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Cada bolsa passa a ter sua própria folha/compatibilidade (2026-10-01,
    # pedido do cliente: registro individual por bolsa, bolsas podem chegar
    # em dias diferentes). Colunas nullable primeiro pra poder fazer o
    # backfill a partir da solicitação-mãe antes de travar NOT NULL.
    op.add_column('solicitacao_bolsa', sa.Column('prova_cruzada', sa.String(length=15), nullable=True, comment='COMPATIVEL | INCOMPATIVEL | NAO_SE_APLICA'))
    op.add_column('solicitacao_bolsa', sa.Column('liberacao_com_ressalva', sa.Boolean(), nullable=True))
    op.add_column('solicitacao_bolsa', sa.Column('folha_emitida_em', sa.DateTime(timezone=True), nullable=True))
    op.add_column('solicitacao_bolsa', sa.Column('folha_emitida_por', sa.UUID(), nullable=True))

    op.execute(
        """
        UPDATE solicitacao_bolsa AS sb
        SET prova_cruzada = st.prova_cruzada,
            liberacao_com_ressalva = COALESCE(st.liberacao_com_ressalva, false),
            folha_emitida_em = COALESCE(st.folha_emitida_em, st.created_at),
            folha_emitida_por = COALESCE(st.folha_emitida_por, st.created_by)
        FROM solicitacao_transfusional AS st
        WHERE st.id = sb.solicitacao_id
        """
    )
    # Bolsa sem solicitação-mãe com dado nenhum pra herdar (não deveria
    # existir, mas por segurança) cai no próprio instante da migração.
    op.execute(
        """
        UPDATE solicitacao_bolsa
        SET liberacao_com_ressalva = COALESCE(liberacao_com_ressalva, false),
            folha_emitida_em = COALESCE(folha_emitida_em, now()),
            folha_emitida_por = COALESCE(folha_emitida_por, (SELECT id FROM usuario ORDER BY created_at LIMIT 1))
        WHERE folha_emitida_em IS NULL OR folha_emitida_por IS NULL
        """
    )

    op.alter_column('solicitacao_bolsa', 'liberacao_com_ressalva', nullable=False)
    op.alter_column('solicitacao_bolsa', 'folha_emitida_em', nullable=False)
    op.alter_column('solicitacao_bolsa', 'folha_emitida_por', nullable=False)

    op.drop_column('solicitacao_transfusional', 'prova_cruzada')
    op.drop_column('solicitacao_transfusional', 'liberacao_com_ressalva')
    op.drop_column('solicitacao_transfusional', 'folha_emitida_em')
    op.drop_column('solicitacao_transfusional', 'folha_emitida_por')


def downgrade() -> None:
    op.add_column('solicitacao_transfusional', sa.Column('folha_emitida_por', sa.UUID(), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('folha_emitida_em', sa.DateTime(timezone=True), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('liberacao_com_ressalva', sa.Boolean(), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('prova_cruzada', sa.String(length=15), nullable=True, comment='COMPATIVEL | NAO_SE_APLICA'))

    op.execute(
        """
        UPDATE solicitacao_transfusional AS st
        SET prova_cruzada = sb.prova_cruzada,
            liberacao_com_ressalva = sb.liberacao_com_ressalva,
            folha_emitida_em = sb.folha_emitida_em,
            folha_emitida_por = sb.folha_emitida_por
        FROM (
            SELECT DISTINCT ON (solicitacao_id) solicitacao_id, prova_cruzada, liberacao_com_ressalva, folha_emitida_em, folha_emitida_por
            FROM solicitacao_bolsa
            ORDER BY solicitacao_id, folha_emitida_em
        ) AS sb
        WHERE sb.solicitacao_id = st.id
        """
    )

    op.drop_column('solicitacao_bolsa', 'folha_emitida_por')
    op.drop_column('solicitacao_bolsa', 'folha_emitida_em')
    op.drop_column('solicitacao_bolsa', 'liberacao_com_ressalva')
    op.drop_column('solicitacao_bolsa', 'prova_cruzada')
