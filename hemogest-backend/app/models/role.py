"""
HemoGest — Role (RBAC).
Perfis fixos (SRS §Regras de Negócio — Controle de permissões):
  ADMIN_GLOBAL, SUPERVISOR, BIOMEDICO, TECNICO, RT
RT (2026-09-30, pedido do cliente) é o médico Responsável Técnico da
agência transfusional — mesma liberação total do Supervisor.
Role é uma entidade global (não pertence a uma unidade específica), pois o
Administrador Global pode atuar sobre múltiplas unidades.
"""
from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_mixins import BaseEntity
from app.db.session import Base


class RoleCodigo:
    """Códigos fixos de perfil da V1 — usados em checagens de permissão."""

    ADMIN_GLOBAL = "ADMIN_GLOBAL"
    SUPERVISOR = "SUPERVISOR"
    BIOMEDICO = "BIOMEDICO"
    TECNICO = "TECNICO"
    RT = "RT"


class Role(Base, BaseEntity):
    __tablename__ = "role"

    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    nome_exibicao: Mapped[str] = mapped_column(String(80), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Lista de permissões (strings tipo "pacientes:criar", "reacoes:notivisa")
    # V1: granularidade simples via JSON; pode evoluir para tabela própria depois.
    permissoes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="role")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Role {self.codigo}>"
