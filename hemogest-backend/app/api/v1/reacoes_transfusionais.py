import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.reacao_transfusional import (
    ReacaoAberturaRequest,
    ReacaoEncerramentoRequest,
    ReacaoInvestigacaoRequest,
    ReacaoNotivisaRequest,
    ReacaoOut,
)
from app.services import reacao_transfusional_service as svc

router = APIRouter(prefix="/reacoes-transfusionais", tags=["Reações Transfusionais"])
_pode_escrever = require_roles(RoleCodigo.BIOMEDICO, RoleCodigo.SUPERVISOR)


@router.get("/{reacao_id}", response_model=ReacaoOut)
def obter(reacao_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return svc.get_reacao(db, reacao_id, ctx.unidade_hospitalar_id)


@router.post("", response_model=ReacaoOut, status_code=status.HTTP_201_CREATED)
def abrir(
    payload: ReacaoAberturaRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.abrir(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.post("/{reacao_id}/investigar", response_model=ReacaoOut)
def investigar(
    reacao_id: uuid.UUID,
    payload: ReacaoInvestigacaoRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.investigar(db, reacao_id, payload.investigacao, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.post("/{reacao_id}/notivisa", response_model=ReacaoOut)
def notivisa(
    reacao_id: uuid.UUID,
    payload: ReacaoNotivisaRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.notificar_notivisa(
        db, reacao_id, payload.notivisa_numero, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )


@router.post("/{reacao_id}/encerrar", response_model=ReacaoOut)
def encerrar(
    reacao_id: uuid.UUID,
    payload: ReacaoEncerramentoRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.encerrar(db, reacao_id, payload.conclusao, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
