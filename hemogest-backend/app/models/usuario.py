"""
HemoGest — Usuário.
unidade_hospitalar_id é opcional aqui (diferente do TenantMixin padrão)
porque o Administrador Global não pertence a uma única unidade — ele opera
sobre múltiplas. Os demais perfis (Supervisor, Biomédico, Técnico) sempre
têm uma unidade vinculada; essa regra é reforçada em app.core.tenant.

`login` é um nome de usuário simples, não um e-mail (2026-09-30, pedido do
cliente — mesmo padrão dos sistemas irmãos Almoxarifado/Farmácia). Quem
cria ou reseta a conta define a senha na hora (`app.services.user_service`)
e repassa por fora; não existe fluxo de e-mail.
"""
import uuid

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_mixins import BaseEntity
from app.db.session import Base


class Usuario(Base, BaseEntity):
    __tablename__ = "usuario"

    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    login: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("role.id"), nullable=False)
    unidade_hospitalar_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unidade_hospitalar.id"), nullable=True, index=True
    )

    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    primeiro_acesso: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ultimo_login_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    role: Mapped["Role"] = relationship(back_populates="usuarios")  # noqa: F821
    unidade_hospitalar: Mapped["UnidadeHospitalar | None"] = relationship(back_populates="usuarios")  # noqa: F821

    @property
    def is_admin_global(self) -> bool:
        from app.models.role import RoleCodigo

        return self.role is not None and self.role.codigo == RoleCodigo.ADMIN_GLOBAL

    @property
    def role_codigo(self) -> str | None:
        """Exposto em UsuarioOut pra o frontend decidir o que mostrar (ex.:
        tela Permissões) sem precisar de uma segunda chamada pra /roles."""
        return self.role.codigo if self.role is not None else None

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Usuario {self.login}>"
