"""semeia os 4 hemocomponentes padrao (CH/PF/CP/CR, mesmos nomes do
documento STH Rev.5) na unica unidade hospitalar real -- pedido do cliente
2026-09-30: "deixa padronizado apenas aqueles 4". Cadastro continua
tecnicamente livre (tela Parametrizacoes), mas o fluxo automatico (ver
app.services.formulario_solicitacao_service) nunca cria outro nome.

Revision ID: b6e3f8a1d972
Revises: a4d7e9c2b568
Create Date: 2026-09-30
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b6e3f8a1d972"
down_revision = "a4d7e9c2b568"
branch_labels = None
depends_on = None

_NOMES = ["Concentrado de Hemácias", "Plasma Fresco", "Concentrado de Plaquetas", "Crioprecipitado"]


def upgrade() -> None:
    conn = op.get_bind()
    unidades = conn.execute(sa.text("SELECT id FROM unidade_hospitalar WHERE deleted_at IS NULL")).fetchall()
    for (unidade_id,) in unidades:
        for ordem, nome in enumerate(_NOMES):
            existe = conn.execute(
                sa.text("SELECT 1 FROM hemocomponente WHERE unidade_hospitalar_id = :u AND nome = :n"),
                {"u": unidade_id, "n": nome},
            ).first()
            if existe:
                continue
            conn.execute(
                sa.text(
                    "INSERT INTO hemocomponente (id, unidade_hospitalar_id, nome, ordem, ativo, created_at, updated_at) "
                    "VALUES (:id, :u, :n, :o, true, now(), now())"
                ),
                {"id": str(uuid.uuid4()), "u": unidade_id, "n": nome, "o": ordem},
            )


def downgrade() -> None:
    conn = op.get_bind()
    for nome in _NOMES:
        conn.execute(sa.text("DELETE FROM hemocomponente WHERE nome = :n"), {"n": nome})
