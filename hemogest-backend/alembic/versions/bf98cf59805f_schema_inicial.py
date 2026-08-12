"""schema inicial - bloco parametrizacao e seguranca

Revision ID: bf98cf59805f
Revises:
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "bf98cf59805f"
down_revision = None
branch_labels = None
depends_on = None


def _audit_columns():
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
    ]


def upgrade() -> None:
    op.create_table(
        "unidade_hospitalar",
        *_audit_columns(),
        sa.Column("razao_social", sa.String(255), nullable=False),
        sa.Column("nome_fantasia", sa.String(255), nullable=False),
        sa.Column("cnpj", sa.String(14), nullable=False),
        sa.Column("codigo_cnes", sa.String(20), nullable=True),
        sa.Column("endereco", sa.String(255), nullable=True),
        sa.Column("cidade", sa.String(120), nullable=True),
        sa.Column("uf", sa.String(2), nullable=True),
        sa.Column("logo_object_name", sa.String(255), nullable=True),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("cnpj", name="uq_unidade_hospitalar_cnpj"),
    )

    op.create_table(
        "role",
        *_audit_columns(),
        sa.Column("codigo", sa.String(30), nullable=False),
        sa.Column("nome_exibicao", sa.String(80), nullable=False),
        sa.Column("descricao", sa.String(255), nullable=True),
        sa.Column("permissoes", sa.JSON, nullable=False, server_default="[]"),
        sa.UniqueConstraint("codigo", name="uq_role_codigo"),
    )

    op.create_table(
        "setor",
        *_audit_columns(),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("sigla", sa.String(20), nullable=True),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_setor_unidade"
        ),
        sa.UniqueConstraint("unidade_hospitalar_id", "nome", name="uq_setor_unidade_nome"),
    )
    op.create_index("ix_setor_unidade_hospitalar_id", "setor", ["unidade_hospitalar_id"])

    op.create_table(
        "usuario",
        *_audit_columns(),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unidade_hospitalar_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("primeiro_acesso", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("ultimo_login_em", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["role_id"], ["role.id"], name="fk_usuario_role"),
        sa.ForeignKeyConstraint(
            ["unidade_hospitalar_id"], ["unidade_hospitalar.id"], name="fk_usuario_unidade"
        ),
        sa.UniqueConstraint("email", name="uq_usuario_email"),
    )
    op.create_index("ix_usuario_email", "usuario", ["email"])
    op.create_index("ix_usuario_unidade_hospitalar_id", "usuario", ["unidade_hospitalar_id"])

    # Seed dos 4 perfis fixos da V1 (RoleCodigo em app/models/role.py)
    role_table = sa.table(
        "role",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("codigo", sa.String),
        sa.column("nome_exibicao", sa.String),
        sa.column("permissoes", sa.JSON),
    )
    import uuid
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        role_table,
        [
            {
                "id": uuid.uuid4(),
                "created_at": now,
                "updated_at": now,
                "codigo": codigo,
                "nome_exibicao": nome,
                "permissoes": [],
            }
            for codigo, nome in [
                ("ADMIN_GLOBAL", "Administrador Global"),
                ("SUPERVISOR", "Supervisor"),
                ("BIOMEDICO", "Biomédico"),
                ("TECNICO", "Técnico"),
            ]
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_usuario_unidade_hospitalar_id", table_name="usuario")
    op.drop_index("ix_usuario_email", table_name="usuario")
    op.drop_table("usuario")
    op.drop_index("ix_setor_unidade_hospitalar_id", table_name="setor")
    op.drop_table("setor")
    op.drop_table("role")
    op.drop_table("unidade_hospitalar")
