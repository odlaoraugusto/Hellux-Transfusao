"""
HemoGest — Segurança: hashing de senha, hashing de tokens opacos e
emissão/validação de JWT.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    return _create_token(
        subject, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), "access", extra_claims
    )


def create_refresh_token(subject: str) -> str:
    return _create_token(subject, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), "refresh")


def _create_token(
    subject: str, expires_delta: timedelta, token_type: str, extra_claims: dict[str, Any] | None = None
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        # jti evita colisão de hash quando dois tokens do mesmo usuário e
        # tipo são emitidos no mesmo segundo (iat só tem resolução de
        # segundo) — bug real visto em teste: dois logins rápidos geravam
        # o mesmo refresh_token e batiam na constraint única da tabela.
        "jti": secrets.token_hex(16),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
