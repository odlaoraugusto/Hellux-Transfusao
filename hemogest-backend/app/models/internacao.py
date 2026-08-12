"""
HemoGest — Internação (Sprint 4.2).
Uma internação pertence a um paciente e, a qualquer momento, está associada
a um setor "atual". Toda mudança de setor gera um registro em
InternacaoSetorHistorico — a internação em si guarda só o estado atual
(setor_atual_id) para consultas rápidas.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin, UUIDPrimaryKeyMixin, utcnow
from app.db.session import Base


class StatusInternacao:
    ATIVA = "ATIVA"
    ALTA = "ALTA"


class Internacao(Base, BaseEntity, TenantMixin):
    __tablename__ = "internacao"

    paciente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("paciente.id"), nullable=False, index=True
    )
    setor_atual_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("setor.id"), nullable=False, index=True
    )

    numero_internacao: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    leito: Mapped[str | None] = mapped_column(String(20), nullable=True)
    data_entrada: Mapped[date] = mapped_column(Date, nullable=False)
    data_alta: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=StatusInternacao.ATIVA)
    motivo_alta: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Internacao {self.numero_internacao or self.id}>"


class InternacaoSetorHistorico(Base, UUIDPrimaryKeyMixin):
    """Trilha de mudanças de setor dentro de uma internação (SRS §Internações)."""

    __tablename__ = "internacao_setor_historico"

    internacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("internacao.id"), nullable=False, index=True
    )
    setor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("setor.id"), nullable=False)
    data_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    data_fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    registrado_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
