"""
HemoGest — Unidade Hospitalar.
Raiz do isolamento multitenant: toda entidade assistencial referencia esta
tabela via TenantMixin.
"""
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_mixins import BaseEntity
from app.db.session import Base


class UnidadeHospitalar(Base, BaseEntity):
    __tablename__ = "unidade_hospitalar"

    razao_social: Mapped[str] = mapped_column(String(255), nullable=False)
    nome_fantasia: Mapped[str] = mapped_column(String(255), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(14), unique=True, nullable=False, index=True)
    codigo_cnes: Mapped[str | None] = mapped_column(String(20), nullable=True)

    endereco: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cidade: Mapped[str | None] = mapped_column(String(120), nullable=True)
    uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    logo_object_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Referência ao objeto no MinIO"
    )

    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    setores: Mapped[list["Setor"]] = relationship(back_populates="unidade_hospitalar")  # noqa: F821
    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="unidade_hospitalar")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<UnidadeHospitalar {self.nome_fantasia}>"
