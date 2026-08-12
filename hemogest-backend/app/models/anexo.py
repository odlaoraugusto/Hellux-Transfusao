"""
HemoGest — Anexo (Fase 9, Gerenciador de Anexos).
Tabela genérica: qualquer entidade (devolução, descarte, reação, logo de
unidade...) pode ter N anexos, referenciados por `entidade` + `entidade_id`.
O arquivo em si vive no MinIO (`object_name`); aqui só o metadado.
"""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import TenantMixin, UUIDPrimaryKeyMixin, utcnow
from app.db.session import Base


class Anexo(Base, UUIDPrimaryKeyMixin, TenantMixin):
    __tablename__ = "anexo"

    entidade: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entidade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    object_name: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    nome_arquivo: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    tamanho_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Anexo {self.nome_arquivo} ({self.entidade})>"
