"""
HemoGest — Rotas de Autenticação.
"""
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.schemas.usuario import AlterarSenhaRequest, LoginRequest, RefreshRequest, TokenResponse
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    return user_service.authenticate(
        db, payload.login, payload.senha, ip_origem=request.client.host if request.client else None
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    return user_service.refresh_tokens(db, payload.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_service.logout(db, payload.refresh_token, actor_id=current_user.id)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def alterar_senha(
    payload: AlterarSenhaRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_service.change_password(db, current_user, payload.senha_atual, payload.nova_senha)
