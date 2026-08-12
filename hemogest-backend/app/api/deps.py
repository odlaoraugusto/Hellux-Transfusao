"""
HemoGest — Dependências compartilhadas da camada API.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou expiradas.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except Exception as exc:  # noqa: BLE001 — qualquer falha de decode invalida o token
        raise credentials_exception from exc

    # NOTE: implementação real do repositório de usuário chega no Sprint 2.2
    from app.services.user_service import get_user_by_id  # import tardio evita ciclo

    user = get_user_by_id(db, user_id)
    if user is None or user.deleted_at is not None or not user.ativo:
        raise credentials_exception
    return user
