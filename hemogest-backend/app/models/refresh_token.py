"""
HemoGest — Refresh Token.
JWT de access token é stateless (não precisa de tabela), mas o refresh
token é persistido para permitir revogação real no Logout — sem isso,
um refresh token vazado continuaria válido até expirar sozinho.
Armazenamos apenas o hash do token, nunca o valor puro.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import UUIDPrimaryKeyMixin, utcnow
from app.db.session import Base


class RefreshToken(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "refresh_token"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    revogado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
