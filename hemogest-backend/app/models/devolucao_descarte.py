"""
HemoGest — Devolução e Descarte (Fase 8).
Ambas consomem uma UnidadeHemocomponente (bolsa) e a levam a um status
terminal (DEVOLVIDO / DESCARTADO) — a transição real acontece via
`unidade_hemocomponente_service.forcar_status`, chamada pelo service desta
fase depois de validar que a bolsa está num estado que permite a operação.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin, utcnow
from app.db.session import Base


class Devolucao(Base, BaseEntity, TenantMixin):
    __tablename__ = "devolucao"

    unidade_hemocomponente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unidade_hemocomponente.id"), nullable=False, index=True
    )
    motivo_devolucao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("motivo_devolucao.id"), nullable=False
    )
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_devolucao: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Descarte(Base, BaseEntity, TenantMixin):
    __tablename__ = "descarte"

    unidade_hemocomponente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unidade_hemocomponente.id"), nullable=False, index=True
    )
    # Aponta pra motivo_devolucao (2026-10-05, pedido do cliente: "os
    # motivos cadastrados passam a valer para ambos") — mesma lista de
    # motivos usada na devolução.
    motivo_descarte_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("motivo_devolucao.id"), nullable=False
    )
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_descarte: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
