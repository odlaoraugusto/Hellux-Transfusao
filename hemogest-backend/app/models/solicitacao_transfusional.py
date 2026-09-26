"""
HemoGest — Solicitação Transfusional (painel de solicitações).
Um pedido de hemocomponente feito por um setor para um paciente internado.
Fluxo: SOLICITADO -> EM_PROCESSAMENTO -> ENTREGUE. Na entrega a agência
informa as bolsas (UnidadeHemocomponente) liberadas; elas passam a
RESERVADO para o paciente, prontas para abrir o Acompanhamento Transfusional.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin, UUIDPrimaryKeyMixin, utcnow
from app.db.session import Base


class StatusSolicitacao:
    SOLICITADO = "SOLICITADO"
    EM_PROCESSAMENTO = "EM_PROCESSAMENTO"
    ENTREGUE = "ENTREGUE"


class PrioridadeSolicitacao:
    ROTINA = "ROTINA"
    URGENTE = "URGENTE"
    EMERGENCIA = "EMERGENCIA"


class SolicitacaoTransfusional(Base, BaseEntity, TenantMixin):
    __tablename__ = "solicitacao_transfusional"

    internacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("internacao.id"), nullable=False, index=True
    )
    paciente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("paciente.id"), nullable=False, index=True
    )
    setor_solicitante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("setor.id"), nullable=False, index=True
    )
    hemocomponente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hemocomponente.id"), nullable=False
    )
    quantidade: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    prioridade: Mapped[str] = mapped_column(String(12), nullable=False, default=PrioridadeSolicitacao.ROTINA)
    indicacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    medico_solicitante: Mapped[str | None] = mapped_column(String(120), nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=StatusSolicitacao.SOLICITADO, index=True)
    data_solicitacao: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    data_inicio_processamento: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_entrega: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Dados registrados na entrega ao setor
    abo_paciente: Mapped[str | None] = mapped_column(String(3), nullable=True)
    prova_cruzada: Mapped[str | None] = mapped_column(String(15), nullable=True, comment="COMPATIVEL | NAO_SE_APLICA")
    temperatura_transporte_c: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    recebido_por: Mapped[str | None] = mapped_column(String(120), nullable=True)
    entregue_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    liberacao_com_ressalva: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    observacoes_entrega: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SolicitacaoTransfusional {self.id} status={self.status}>"


class SolicitacaoBolsa(Base, UUIDPrimaryKeyMixin):
    """Bolsas entregues para uma solicitação."""

    __tablename__ = "solicitacao_bolsa"
    __table_args__ = (
        UniqueConstraint("solicitacao_id", "unidade_hemocomponente_id", name="uq_solicitacao_bolsa"),
    )

    solicitacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solicitacao_transfusional.id"), nullable=False, index=True
    )
    unidade_hemocomponente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unidade_hemocomponente.id"), nullable=False, index=True
    )
