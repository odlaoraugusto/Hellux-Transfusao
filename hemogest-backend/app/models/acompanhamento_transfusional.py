"""
HemoGest — Acompanhamento Transfusional (o coração do sistema).
Um acompanhamento liga uma Solicitação Transfusional (que já tem paciente,
setor e hemocomponente) e acumula sinais vitais nos momentos protocolares
(Pré, 10min, 1h, Final, Extras). Uma intercorrência pode abrir uma Reação
Transfusional, mas não impede a finalização do acompanhamento.

Antes ligava a uma internação + uma bolsa reservada (Fase 6 original) — sem
uso real de estoque de bolsas nem de internação neste hospital
(2026-09-30, pedido do cliente), passou a ligar direto à Solicitação. Se o
controle de bolsas for reativado no futuro, a bolsa efetivamente usada pode
voltar a ser registrada aqui (ou consultada via a Solicitação).
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin, UUIDPrimaryKeyMixin, utcnow
from app.db.session import Base


class StatusAcompanhamento:
    AGUARDANDO = "AGUARDANDO"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    FINALIZADO = "FINALIZADO"
    INTERCORRENCIA = "INTERCORRENCIA"


class MomentoSinalVital:
    PRE = "PRE"
    DEZ_MINUTOS = "DEZ_MINUTOS"
    UMA_HORA = "UMA_HORA"
    FINAL = "FINAL"
    EXTRA = "EXTRA"


class AcompanhamentoTransfusional(Base, BaseEntity, TenantMixin):
    __tablename__ = "acompanhamento_transfusional"

    solicitacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solicitacao_transfusional.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(15), nullable=False, default=StatusAcompanhamento.AGUARDANDO)
    data_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    observacoes_finalizacao: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AcompanhamentoTransfusional {self.id} status={self.status}>"


class SinalVital(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "sinal_vital"

    acompanhamento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("acompanhamento_transfusional.id"), nullable=False, index=True
    )
    momento: Mapped[str] = mapped_column(String(15), nullable=False)
    data_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    temperatura_c: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    pressao_arterial: Mapped[str | None] = mapped_column(String(15), nullable=True, comment="ex: 120/80")
    frequencia_cardiaca_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frequencia_respiratoria_ipm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saturacao_o2_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)

    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    registrado_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
