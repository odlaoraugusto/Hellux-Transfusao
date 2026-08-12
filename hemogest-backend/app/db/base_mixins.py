"""
HemoGest — Mixins reutilizados por todos os models, conforme premissas
congeladas do Documento 02 (DER): UUID, Soft Delete, Status, UTC, Auditoria.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class TenantMixin:
    """Isolamento multitenant: toda entidade assistencial pertence a uma Unidade Hospitalar."""

    unidade_hospitalar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unidade_hospitalar.id"), nullable=False, index=True
    )


class AuditUserMixin:
    """Quem criou / alterou o registro — complementa a trilha em audit_log."""

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class BaseEntity(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, AuditUserMixin):
    """Combinação padrão para a maioria das entidades do sistema."""
    pass
