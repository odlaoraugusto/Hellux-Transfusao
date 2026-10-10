import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.modulos import require_modulo_ativo
from app.core.permissions import require_permission
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.schemas.solicitacao_hemocentro import (
    CancelarSolicitacaoHemocentroRequest,
    ReceberSolicitacaoHemocentroRequest,
    SolicitacaoHemocentroCreate,
    SolicitacaoHemocentroOut,
)
from app.services import solicitacao_hemocentro_service as svc

router = APIRouter(prefix="/solicitacoes-hemocentro", tags=["Solicitação ao Hemocentro"])
_pode_escrever = require_permission("solicitacoes_hemocentro_gerenciar")
_modulo = require_modulo_ativo("solicitacao_hemocentro")


@router.get("", response_model=list[SolicitacaoHemocentroOut])
def listar(
    status_filtro: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    _m=Depends(_modulo),
):
    return svc.search(db, ctx.unidade_hospitalar_id, status_filtro=status_filtro)


@router.get("/{solicitacao_id}", response_model=SolicitacaoHemocentroOut)
def obter(
    solicitacao_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    _m=Depends(_modulo),
):
    return svc.get(db, solicitacao_id, ctx.unidade_hospitalar_id)


@router.post("", response_model=SolicitacaoHemocentroOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: SolicitacaoHemocentroCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
    _m=Depends(_modulo),
):
    return svc.criar(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.post("/{solicitacao_id}/marcar-enviada", response_model=SolicitacaoHemocentroOut)
def marcar_enviada(
    solicitacao_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
    _m=Depends(_modulo),
):
    return svc.marcar_enviada(db, solicitacao_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.post("/{solicitacao_id}/receber", response_model=SolicitacaoHemocentroOut)
def receber(
    solicitacao_id: uuid.UUID,
    payload: ReceberSolicitacaoHemocentroRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
    _m=Depends(_modulo),
):
    return svc.receber(db, solicitacao_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.post("/{solicitacao_id}/cancelar", response_model=SolicitacaoHemocentroOut)
def cancelar(
    solicitacao_id: uuid.UUID,
    payload: CancelarSolicitacaoHemocentroRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
    _m=Depends(_modulo),
):
    return svc.cancelar(db, solicitacao_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
