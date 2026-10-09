"""folha de hemotransfusao e role RT

Revision ID: 07fdee44c8a5
Revises: 0a83b5440328
Create Date: 2026-09-30 15:10:00.000000
"""
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = '07fdee44c8a5'
down_revision = '0a83b5440328'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('solicitacao_bolsa', sa.Column('volume_ml', sa.Integer(), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('folha_emitida_em', sa.DateTime(timezone=True), nullable=True))
    op.add_column('solicitacao_transfusional', sa.Column('folha_emitida_por', sa.UUID(), nullable=True))

    role_table = sa.table(
        "role",
        sa.column("id", sa.UUID),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("codigo", sa.String),
        sa.column("nome_exibicao", sa.String),
        sa.column("permissoes", sa.JSON),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        role_table,
        [{
            "id": uuid.uuid4(),
            "created_at": now,
            "updated_at": now,
            "codigo": "RT",
            "nome_exibicao": "Médico RT (Responsável Técnico)",
            "permissoes": [],
        }],
    )


def downgrade() -> None:
    op.execute("DELETE FROM role WHERE codigo = 'RT'")
    op.drop_column('solicitacao_transfusional', 'folha_emitida_por')
    op.drop_column('solicitacao_transfusional', 'folha_emitida_em')
    op.drop_column('solicitacao_bolsa', 'volume_ml')
