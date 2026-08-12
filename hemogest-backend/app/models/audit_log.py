"""
HemoGest — Audit Log.
Tabela central de auditoria (SRS §Regras de Negócio — Auditoria):
login, logout, criação, edição, exclusão lógica, download, upload.
Nunca sofre soft delete nem edição — é append-only.
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import UUIDPrimaryKeyMixin, utcnow
from app.db.session import Base


class AcaoAuditoria:
    LOGIN = "LOGIN"
    LOGIN_FALHOU = "LOGIN_FALHOU"
    LOGOUT = "LOGOUT"
    CRIACAO = "CRIACAO"
    EDICAO = "EDICAO"
    EXCLUSAO_LOGICA = "EXCLUSAO_LOGICA"
    DOWNLOAD = "DOWNLOAD"
    UPLOAD = "UPLOAD"


class AuditLog(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "audit_log"

    usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=True, index=True
    )
    unidade_hospitalar_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unidade_hospitalar.id"), nullable=True, index=True
    )

    acao: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    entidade: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entidade_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    detalhes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_origem: Mapped[str | None] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AuditLog {self.acao} {self.entidade}>"
