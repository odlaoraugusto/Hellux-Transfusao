"""criptografia de campo em paciente + indice cego de cpf/prontuario

Colunas diretamente identificadoras de Paciente (nome, nome_mae, cpf, cns,
numero_prontuario, telefone) passam a guardar ciphertext (ver
app.db.encrypted_types.EncryptedString) em vez de texto plano — por isso
crescem de tamanho (ciphertext em base64 é bem maior que o valor original).
Os índices antigos sobre essas colunas eram inúteis mesmo antes desta
migration ser aplicada em código (ciphertext não-determinístico não serve
pra igualdade/prefixo) e são removidos aqui; os novos índices ficam nas
colunas de índice cego (`cpf_hash`, `numero_prontuario_hash`), que são
HMAC determinístico e por isso comparáveis com `=`.

IMPORTANTE — esta migration NÃO recriptografa dados existentes. No ambiente
em que foi escrita não havia nenhum paciente cadastrado (tabela vazia); se
aplicada num banco com pacientes já em texto plano, os valores antigos
continuariam legíveis (o alter de tamanho de coluna não afeta o conteúdo),
mas ficariam desalinhados com o novo código (que sempre cifra ao gravar e
sempre tenta decifrar ao ler) — nesse caso, migre o dado com um script
único de re-gravação (ler cada linha, salvar de novo) ANTES de subir o
código novo, não depois.

Revision ID: c1a4e9f7d203
Revises: 5c8e2b0f4a17
Create Date: 2026-08-12
"""
from alembic import op
import sqlalchemy as sa

revision = "c1a4e9f7d203"
down_revision = "5c8e2b0f4a17"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("paciente") as batch_op:
        batch_op.drop_index("ix_paciente_nome")
        batch_op.drop_index("ix_paciente_cpf")
        batch_op.drop_index("ix_paciente_cns")
        batch_op.drop_index("ix_paciente_numero_prontuario")

        batch_op.alter_column("nome", type_=sa.String(500), existing_nullable=False)
        batch_op.alter_column("nome_mae", type_=sa.String(500), existing_nullable=True)
        batch_op.alter_column("cpf", type_=sa.String(255), existing_nullable=True)
        batch_op.alter_column("cns", type_=sa.String(255), existing_nullable=True)
        batch_op.alter_column("numero_prontuario", type_=sa.String(255), existing_nullable=True)
        batch_op.alter_column("telefone", type_=sa.String(255), existing_nullable=True)

        batch_op.add_column(sa.Column("cpf_hash", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("numero_prontuario_hash", sa.String(64), nullable=True))

    op.create_index("ix_paciente_cpf_hash", "paciente", ["cpf_hash"])
    op.create_index("ix_paciente_numero_prontuario_hash", "paciente", ["numero_prontuario_hash"])


def downgrade() -> None:
    # Aviso: se já existir ciphertext gravado (paciente cadastrado com o
    # código novo), o downgrade de tamanho de coluna NÃO decifra nada — os
    # valores continuam sendo ciphertext ilegível, só que num schema que
    # parece "antigo". Downgrade seguro exige rodar com o código antigo
    # tendo re-gravado os dados em texto plano antes.
    op.drop_index("ix_paciente_numero_prontuario_hash", table_name="paciente")
    op.drop_index("ix_paciente_cpf_hash", table_name="paciente")

    with op.batch_alter_table("paciente") as batch_op:
        batch_op.drop_column("numero_prontuario_hash")
        batch_op.drop_column("cpf_hash")

        batch_op.alter_column("telefone", type_=sa.String(20), existing_nullable=True)
        batch_op.alter_column("numero_prontuario", type_=sa.String(30), existing_nullable=True)
        batch_op.alter_column("cns", type_=sa.String(15), existing_nullable=True)
        batch_op.alter_column("cpf", type_=sa.String(11), existing_nullable=True)
        batch_op.alter_column("nome_mae", type_=sa.String(200), existing_nullable=True)
        batch_op.alter_column("nome", type_=sa.String(200), existing_nullable=False)

    op.create_index("ix_paciente_nome", "paciente", ["nome"])
    op.create_index("ix_paciente_cpf", "paciente", ["cpf"])
    op.create_index("ix_paciente_cns", "paciente", ["cns"])
    op.create_index("ix_paciente_numero_prontuario", "paciente", ["numero_prontuario"])
