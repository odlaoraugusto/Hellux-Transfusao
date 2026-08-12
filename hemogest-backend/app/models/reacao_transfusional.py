"""
HemoGest — Reação Transfusional (Fase 7, hemovigilância).
Fluxo: ABERTA -> INVESTIGACAO -> (NOTIVISA opcional) -> ENCERRADA.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin, utcnow
from app.db.session import Base


class StatusReacao:
    ABERTA = "ABERTA"
    INVESTIGACAO = "INVESTIGACAO"
    NOTIVISA = "NOTIVISA"
    ENCERRADA = "ENCERRADA"


class ReacaoTransfusional(Base, BaseEntity, TenantMixin):
    __tablename__ = "reacao_transfusional"

    acompanhamento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("acompanhamento_transfusional.id"), nullable=False, index=True
    )
    tipo_reacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tipo_reacao.id"), nullable=False
    )
    gravidade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gravidade.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(15), nullable=False, default=StatusReacao.ABERTA)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    data_abertura: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    investigacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    notivisa_numero: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notivisa_data_envio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    conclusao: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_encerramento: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ReacaoTransfusional {self.id} status={self.status}>"
