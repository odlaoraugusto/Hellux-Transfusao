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
    MedicoLookupOut,
    PacienteBuscaOut,
    PacientePrefillOut,
)
from app.services import formulario_solicitacao_service as svc

router = APIRouter(prefix="/publico", tags=["Público — Formulário de Solicitação"])


@router.get("/unidades/{unidade_id}/formulario-solicitacao", response_model=FormularioConfigOut)
@limiter.limit("60/minute")
def configuracao(unidade_id: uuid.UUID, request: Request, db: Session = Depends(get_db)):
    """Dados para montar a tela: estabelecimento, hemocomponentes ativos e setores."""
    return svc.config_publica(db, unidade_id)


@router.get("/unidades/{unidade_id}/paciente-por-prontuario", response_model=PacientePrefillOut | None)
@limiter.limit("10/minute;60/hour")
def paciente_por_prontuario(unidade_id: uuid.UUID, prontuario: str, request: Request, db: Session = Depends(get_db)):
    """Pré-preenchimento pelo prontuário já cadastrado nesta unidade
    (2026-10-01, pedido do cliente) — None (sem erro) quando não acha
    ninguém, pra não dar pista de prontuário existente/inexistente."""
    svc.get_unidade_ativa(db, unidade_id)
    return svc.buscar_paciente_por_prontuario(
        db, unidade_id, prontuario, ip_origem=request.client.host if request.client else None
    )


@router.get("/unidades/{unidade_id}/pacientes/buscar", response_model=list[PacienteBuscaOut])
@limiter.limit("10/minute;60/hour")
def pacientes_buscar(unidade_id: uuid.UUID, nome: str, request: Request, db: Session = Depends(get_db)):
    """Busca por nome (2026-10-02, pedido do cliente) — pra quando o
    prontuário não é conhecido na hora (ex.: contingência). Só nome/
    nascimento/prontuário na lista; dado completo só depois, reabrindo
    pelo prontuário escolhido."""
    svc.get_unidade_ativa(db, unidade_id)
    return svc.buscar_pacientes_por_nome(db, unidade_id, nome)


@router.get("/unidades/{unidade_id}/medico-por-crm", response_model=MedicoLookupOut | None)
@limiter.limit("30/minute;200/hour")
def medico_por_crm(unidade_id: uuid.UUID, crm: str, request: Request, db: Session = Depends(get_db)):
    """Pré-preenchimento do nome do médico pelo CRM (2026-10-02, pedido do
    cliente: "pede primeiro o crm, pq aí já puxa o nome completo")."""
    svc.get_unidade_ativa(db, unidade_id)
    nome = svc.buscar_medico_por_crm(db, unidade_id, crm)
    return {"nome": nome} if nome else None


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
