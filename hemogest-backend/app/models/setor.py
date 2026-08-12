"""
HemoGest — Setor.
Parametrização por unidade: ex. UTI, Centro Cirúrgico, Pronto Socorro.
Usado para vincular Internações e filtrar Pendências.
"""
from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_mixins import BaseEntity, TenantMixin
from app.db.session import Base


class Setor(Base, BaseEntity, TenantMixin):
    __tablename__ = "setor"
    __table_args__ = (
        UniqueConstraint("unidade_hospitalar_id", "nome", name="uq_setor_unidade_nome"),
    )

    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    sigla: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    unidade_hospitalar: Mapped["UnidadeHospitalar"] = relationship(back_populates="setores")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Setor {self.nome}>"
