"""semeia permissoes de Biomedico/Tecnico com o comportamento atual (antes
de trocar require_roles por require_permission nas rotas assistenciais) --
sem isso, usuarios reais ja criados perderiam acesso na troca
(2026-09-30, pedido do cliente: tela de Gerenciamento de Permissoes)

Revision ID: f2a6c8e1b347
Revises: e1f4a7b9c235
Create Date: 2026-09-30
"""
import json

from alembic import op
import sqlalchemy as sa

revision = "f2a6c8e1b347"
down_revision = "e1f4a7b9c235"
branch_labels = None
depends_on = None

_TODAS = [
    "pacientes_gerenciar",
    "internacoes_gerenciar",
    "solicitacoes_gerenciar",
    "hemocomponentes_bolsas_gerenciar",
    "acompanhamentos_gerenciar",
    "reacoes_gerenciar",
    "devolucoes_descartes_gerenciar",
    "anexos_gerenciar",
]
_SEM_REACOES = [p for p in _TODAS if p != "reacoes_gerenciar"]


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE role SET permissoes = :p WHERE codigo = 'BIOMEDICO'"), {"p": json.dumps(_TODAS)}
    )
    conn.execute(
        sa.text("UPDATE role SET permissoes = :p WHERE codigo = 'TECNICO'"), {"p": json.dumps(_SEM_REACOES)}
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE role SET permissoes = '[]' WHERE codigo IN ('BIOMEDICO', 'TECNICO')"))
