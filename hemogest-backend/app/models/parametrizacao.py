"""
HemoGest — Bloco Parametrização (Sprints 3.3 a 3.7).
Cinco tabelas com a mesma forma (nome, descrição, cor, ordem, ativo),
todas isoladas por unidade (TenantMixin) — cada unidade parametriza a sua
própria lista de hemocomponentes, motivos e gravidades.
Mantidas como classes separadas (não uma tabela genérica) porque o DER as
trata como entidades distintas, cada uma com suas próprias FKs futuras
(ex: Hemocomponente será referenciado por toda a Fase 5).
"""
from sqlalchemy import Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_mixins import BaseEntity, TenantMixin
from app.db.session import Base


class _ParametrizacaoItemMixin:
    """Colunas comuns aos 5 itens de parametrização abaixo."""

    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cor: Mapped[str | None] = mapped_column(String(7), nullable=True, comment="Hex, ex: #C62828")
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Hemocomponente(Base, BaseEntity, TenantMixin, _ParametrizacaoItemMixin):
    """Ex: Concentrado de Hemácias (CH), Concentrado de Plaquetas (CP)."""

    __tablename__ = "hemocomponente"
    __table_args__ = (
        UniqueConstraint("unidade_hospitalar_id", "nome", name="uq_hemocomponente_unidade_nome"),
    )

    sigla: Mapped[str | None] = mapped_column(String(10), nullable=True)
    validade_padrao_dias: Mapped[int | None] = mapped_column(Integer, nullable=True)


class MotivoDevolucao(Base, BaseEntity, TenantMixin, _ParametrizacaoItemMixin):
    """Motivos de devolução E descarte (2026-10-05, pedido do cliente:
    "coloca os parâmetros de devolução e descarte juntos" — a tabela
    motivo_descarte foi removida; Descarte.motivo_descarte_id aponta pra
    cá agora, nos mesmos motivos cadastrados aqui)."""

    __tablename__ = "motivo_devolucao"
    __table_args__ = (
        UniqueConstraint("unidade_hospitalar_id", "nome", name="uq_motivo_devolucao_unidade_nome"),
    )


class TipoReacao(Base, BaseEntity, TenantMixin, _ParametrizacaoItemMixin):
    __tablename__ = "tipo_reacao"
    __table_args__ = (
        UniqueConstraint("unidade_hospitalar_id", "nome", name="uq_tipo_reacao_unidade_nome"),
    )


class Gravidade(Base, BaseEntity, TenantMixin, _ParametrizacaoItemMixin):
    __tablename__ = "gravidade"
    __table_args__ = (
        UniqueConstraint("unidade_hospitalar_id", "nome", name="uq_gravidade_unidade_nome"),
    )

    nivel: Mapped[int] = mapped_column(Integer, nullable=False, comment="1=leve ... maior=mais grave")
