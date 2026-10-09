"""login deixa de ser e-mail; senha definida direto na criacao/reset;
adiciona telefone na unidade hospitalar

Sem fluxo de envio de e-mail implementado, o token de "primeiro acesso"
gerado em `create_user` nunca chegava a ninguém (descartado no endpoint) —
login travado de verdade, sem saida. Troca para o mesmo padrao ja usado nos
sistemas irmaos (Almoxarifado/Farmacia): quem cria/reseta o usuario digita
a senha temporaria e repassa por fora; `primeiro_acesso` passa a apenas
forcar troca no primeiro login, nao bloquear a entrada.

`password_reset_token` fica sem uso (só existia para o fluxo por e-mail) —
removida. Sistema recem-implantado, só 1 usuário real (admin global) e
nenhuma unidade com paciente/formulário de verdade — ajuste direto, sem
migração de dado.

Revision ID: c7d4b2f8a916
Revises: b3f1a9c5e7d2
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = "c7d4b2f8a916"
down_revision = "b3f1a9c5e7d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("password_reset_token")

    op.drop_index("ix_usuario_email", table_name="usuario")
    op.drop_constraint("uq_usuario_email", "usuario", type_="unique")
    op.alter_column("usuario", "email", new_column_name="login", existing_type=sa.String(255))
    op.alter_column("usuario", "login", type_=sa.String(60), existing_nullable=False)
    op.create_unique_constraint("uq_usuario_login", "usuario", ["login"])
    op.create_index("ix_usuario_login", "usuario", ["login"])

    op.add_column("unidade_hospitalar", sa.Column("telefone", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("unidade_hospitalar", "telefone")

    op.drop_index("ix_usuario_login", table_name="usuario")
    op.drop_constraint("uq_usuario_login", "usuario", type_="unique")
    op.alter_column("usuario", "login", type_=sa.String(255), existing_nullable=False)
    op.alter_column("usuario", "login", new_column_name="email")
    op.create_unique_constraint("uq_usuario_email", "usuario", ["email"])
    op.create_index("ix_usuario_email", "usuario", ["email"])

    op.create_table(
        "password_reset_token",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("usado", sa.Boolean, nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"]),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_password_reset_token_usuario_id", "password_reset_token", ["usuario_id"])
    op.create_index("ix_password_reset_token_token_hash", "password_reset_token", ["token_hash"], unique=True)
