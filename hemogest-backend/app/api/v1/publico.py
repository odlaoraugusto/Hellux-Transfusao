"""
HemoGest — Rotas públicas (sem login).
Hoje só o formulário de solicitação de transfusão. A unidade vem do link
(UUID na URL, difícil de adivinhar) e cada rota tem limite de requisições
por IP, já que qualquer pessoa com o link consegue chamá-las.
"""
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.db.session import get_db
from app.schemas.formulario_solicitacao import (
    FormularioConfigOut,
    FormularioCreate,
    FormularioCriadoOut,
    FormularioOut,
)
from app.services import formulario_solicitacao_service as svc

router = APIRouter(prefix="/publico", tags=["Público — Formulário de Solicitação"])


@router.get("/unidades/{unidade_id}/formulario-solicitacao", response_model=FormularioConfigOut)
@limiter.limit("60/minute")
def configuracao(unidade_id: uuid.UUID, request: Request, db: Session = Depends(get_db)):
    """Dados para montar a tela: estabelecimento, hemocomponentes ativos e setores."""
    return svc.config_publica(db, unidade_id)


@router.post(
    "/unidades/{unidade_id}/formulario-solicitacao",
    response_model=FormularioCriadoOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("3/minute;20/hour")
def enviar(unidade_id: uuid.UUID, payload: FormularioCreate, request: Request, db: Session = Depends(get_db)):
    if payload.website:
        # Campo-isca preenchido: é robô. Responde como se tivesse gravado, sem gravar.
        svc.get_unidade_ativa(db, unidade_id)
        return FormularioCriadoOut(
            protocolo=svc._novo_protocolo(datetime.now(timezone.utc)),
            token_impressao=secrets.token_urlsafe(24),
            criado_em=datetime.now(timezone.utc),
        )
    registro, token = svc.criar(
        db, unidade_id, payload, ip_origem=request.client.host if request.client else None
    )
    return FormularioCriadoOut(protocolo=registro.protocolo, token_impressao=token, criado_em=registro.created_at)


@router.get("/formularios/{token}", response_model=FormularioOut)
@limiter.limit("60/minute")
def abrir_para_impressao(token: str, request: Request, db: Session = Depends(get_db)):
    """Reabre só o formulário do token (entregue a quem enviou) para impressão."""
    return svc.montar_saida(db, svc.get_por_token(db, token))
