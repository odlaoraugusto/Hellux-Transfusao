"""
HemoGest — Solicitação de Bolsas ao Hemocentro (módulo opcional).
Fluxo inverso do formulário público: a agência transfusional pede reposição
de estoque ao hemocentro de referência, em vez de o setor pedir para a
agência. Só existe para unidades com modulo_solicitacao_hemocentro_ativo
(exige modulo_estoque_ativo também — não faz sentido pedir reposição para
quem não mantém estoque próprio).

Ao marcar como RECEBIDA, as bolsas chegadas são lançadas no estoque
(UnidadeHemocomponente) já marcadas com esta solicitação como origem — ver
app.services.solicitacao_hemocentro_service.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_mixins import BaseEntity, TenantMixin, UUIDPrimaryKeyMixin, utcnow
from app.db.session import Base


class StatusSolicitacaoHemocentro:
    SOLICITADA = "SOLICITADA"
    ENVIADA = "ENVIADA"
    RECEBIDA = "RECEBIDA"
    CANCELADA = "CANCELADA"


class SolicitacaoHemocentro(Base, BaseEntity, TenantMixin):
    __tablename__ = "solicitacao_hemocentro"

    hemocentro_nome: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(15), nullable=False, default=StatusSolicitacaoHemocentro.SOLICITADA, index=True
    )
    data_solicitacao: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    data_envio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_recebimento: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)

    itens: Mapped[list["SolicitacaoHemocentroItem"]] = relationship(
        back_populates="solicitacao", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SolicitacaoHemocentro {self.id} status={self.status}>"


class SolicitacaoHemocentroItem(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "solicitacao_hemocentro_item"

    solicitacao_hemocentro_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solicitacao_hemocentro.id"), nullable=False, index=True
    )
    hemocomponente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hemocomponente.id"), nullable=False
    )
    quantidade_solicitada: Mapped[int] = mapped_column(Integer, nullable=False)

    solicitacao: Mapped["SolicitacaoHemocentro"] = relationship(back_populates="itens")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SolicitacaoHemocentroItem {self.hemocomponente_id} x{self.quantidade_solicitada}>"
