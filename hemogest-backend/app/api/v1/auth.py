"""
HemoGest — Rotas de Autenticação.
"""
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.schemas.usuario import (
    AlterarSenhaRequest,
    LoginRequest,
    RedefinirSenhaRequest,
    RefreshRequest,
    SolicitarRecuperacaoRequest,
    TokenResponse,
)
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    return user_service.authenticate(
        db, payload.email, payload.senha, ip_origem=request.client.host if request.client else None
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


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
def solicitar_recuperacao(payload: SolicitarRecuperacaoRequest, request: Request, db: Session = Depends(get_db)):
    from app.core.config import settings

    token = user_service.request_password_reset(db, payload.email)
    # Resposta sempre genérica (não revela se o e-mail existe).
    # TODO (Fase futura): disparar e-mail real via provedor de envio.
    body = {"detail": "Se o e-mail existir, um link de redefinição foi enviado."}
    if settings.APP_DEBUG and token:
        body["debug_token"] = token  # nunca habilitado em produção (APP_DEBUG=false)
    return body


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirmar_recuperacao(payload: RedefinirSenhaRequest, db: Session = Depends(get_db)):
    user_service.confirm_password_reset(db, payload.token, payload.nova_senha)
