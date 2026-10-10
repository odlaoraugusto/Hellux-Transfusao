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

    # --- Módulos configuráveis (CHECKLIST_ROADMAP.md) ---
    # Cada agência transfusional do SUS opera de um jeito diferente — uma só
    # transfunde (sem estoque próprio), outra recebe bolsas do hemocentro de
    # referência, faz os testes completos e mantém estoque. Em vez de travar
    # um fluxo único, cada unidade liga/desliga estas seções; ver
    # MODULOS.md. Só o Admin Global edita (PATCH .../modulos), nunca o
    # próprio Supervisor da unidade — é decisão de TI/implantação, não do
    # dia a dia assistencial.
    modulo_estoque_ativo: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
        comment="Controle de bolsas em estoque (entrada, fracionamento, reserva).",
    )
    modulo_mapa_trabalho_ativo: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
        comment="Mapa de trabalho (ficha técnica dos testes pré-transfusionais), arquivado com a solicitação.",
    )
    modulo_solicitacao_hemocentro_ativo: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="Solicitação de reposição de bolsas ao hemocentro de referência — exige modulo_estoque_ativo.",
    )

    setores: Mapped[list["Setor"]] = relationship(back_populates="unidade_hospitalar")  # noqa: F821
    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="unidade_hospitalar")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<UnidadeHospitalar {self.nome_fantasia}>"
