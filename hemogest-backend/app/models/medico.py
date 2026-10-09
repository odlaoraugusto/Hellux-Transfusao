"""
HemoGest — Médico (2026-10-02, pedido do cliente).
Diretório de médicos requisitantes por unidade, alimentado sozinho conforme
o formulário público de solicitação é preenchido: digita o CRM, se já
existir preenche o nome; se não, fica salvo pro próximo (ver
app.services.formulario_solicitacao_service). Não é um cadastro
administrado à parte — só memoriza o que já foi digitado.
"""
from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin
from app.db.session import Base


class Medico(Base, BaseEntity, TenantMixin):
    __tablename__ = "medico"
    __table_args__ = (
        UniqueConstraint("unidade_hospitalar_id", "crm", name="uq_medico_unidade_crm"),
    )

    crm: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Medico {self.crm}>"
