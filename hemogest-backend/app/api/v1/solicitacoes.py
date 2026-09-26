import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.solicitacao_transfusional import SolicitacaoCreate, SolicitacaoEntregaRequest, SolicitacaoOut
from app.services import solicitacao_transfusional_service as svc

router = APIRouter(prefix="/solicitacoes", tags=["Solicitações Transfusionais"])
_pode_escrever = require_roles(RoleCodigo.BIOMEDICO, RoleCodigo.TECNICO, RoleCodigo.SUPERVISOR)


@router.get("", response_model=list[SolicitacaoOut])
def listar(
    de: datetime | None = Query(default=None, description="Início do período (inclusive), com fuso"),
    ate: datetime | None = Query(default=None, description="Fim do período (exclusivo), com fuso"),
    status_filtro: str | None = Query(default=None, alias="status", pattern="^(SOLICITADO|EM_PROCESSAMENTO|ENTREGUE)$"),
    setor_id: uuid.UUID | None = None,
    hemocomponente_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
):
    itens = svc.search(
        db, ctx.unidade_hospitalar_id, de=de, ate=ate, status_filtro=status_filtro,
        setor_id=setor_id, hemocomponente_id=hemocomponente_id,
    )
    return svc.montar_saida(db, itens)


@router.get("/{solicitacao_id}", response_model=SolicitacaoOut)
def obter(solicitacao_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    item = svc.get_solicitacao(db, solicitacao_id, ctx.unidade_hospitalar_id)
    return svc.montar_saida(db, [item], com_bolsas=True)[0]


@router.post("", response_model=SolicitacaoOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: SolicitacaoCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    item = svc.criar(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
    return svc.montar_saida(db, [item])[0]


@router.post("/{solicitacao_id}/iniciar-processamento", response_model=SolicitacaoOut)
def iniciar_processamento(
    solicitacao_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    item = svc.iniciar_processamento(db, solicitacao_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
    return svc.montar_saida(db, [item])[0]


@router.post("/{solicitacao_id}/entregar", response_model=SolicitacaoOut)
def entregar(
    solicitacao_id: uuid.UUID,
    payload: SolicitacaoEntregaRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    item = svc.entregar(db, solicitacao_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
    return svc.montar_saida(db, [item], com_bolsas=True)[0]
