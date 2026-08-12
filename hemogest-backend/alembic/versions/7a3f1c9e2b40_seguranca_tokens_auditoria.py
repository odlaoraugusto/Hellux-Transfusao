"""seguranca - refresh token, password reset token, audit log

Revision ID: 7a3f1c9e2b40
Revises: bf98cf59805f
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "7a3f1c9e2b40"
down_revision = "bf98cf59805f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_token",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("revogado", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"], name="fk_refresh_token_usuario"),
        sa.UniqueConstraint("token_hash", name="uq_refresh_token_hash"),
    )
    op.create_index("ix_refresh_token_usuario_id", "refresh_token", ["usuario_id"])
    op.create_index("ix_refresh_token_hash", "refresh_token", ["token_hash"])

    op.create_table(
        "password_reset_token",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("usado", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"], name="fk_password_reset_usuario"),
        sa.UniqueConstraint("token_hash", name="uq_password_reset_hash"),
    )
    op.create_index("ix_password_reset_usuario_id", "password_reset_token", ["usuario_id"])
    op.create_index("ix_password_reset_hash", "password_reset_token", ["token_hash"])

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("acao", sa.String(30), nullable=False),
        sa.Column("entidade", sa.String(60), nullable=False),
        sa.Column("entidade_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("detalhes", sa.JSON, nullable=True),
        sa.Column("ip_origem", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"], name="fk_audit_log_usuario"),
        sa.ForeignKeyConstraint(
            ["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_audit_log_unidade"
        ),
    )
    op.create_index("ix_audit_log_usuario_id", "audit_log", ["usuario_id"])
    op.create_index("ix_audit_log_unidade_hospitalar_id", "audit_log", ["unidade_hospitalar_id"])
    op.create_index("ix_audit_log_acao", "audit_log", ["acao"])
    op.create_index("ix_audit_log_entidade", "audit_log", ["entidade"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_index("ix_password_reset_hash", table_name="password_reset_token")
    op.drop_index("ix_password_reset_usuario_id", table_name="password_reset_token")
    op.drop_table("password_reset_token")
    op.drop_index("ix_refresh_token_hash", table_name="refresh_token")
    op.drop_index("ix_refresh_token_usuario_id", table_name="refresh_token")
    op.drop_table("refresh_token")
