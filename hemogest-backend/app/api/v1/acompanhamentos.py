import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.acompanhamento_transfusional import (
    AcompanhamentoCreate,
    AcompanhamentoFinalizarRequest,
    AcompanhamentoOut,
    SinalVitalCreate,
    SinalVitalOut,
)
from app.services import acompanhamento_transfusional_service as svc

router = APIRouter(prefix="/acompanhamentos", tags=["Acompanhamento Transfusional"])
_pode_escrever = require_roles(RoleCodigo.BIOMEDICO, RoleCodigo.TECNICO, RoleCodigo.SUPERVISOR)


@router.get("/{acompanhamento_id}", response_model=AcompanhamentoOut)
def obter(acompanhamento_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return svc.get_acompanhamento(db, acompanhamento_id, ctx.unidade_hospitalar_id)


@router.post("", response_model=AcompanhamentoOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: AcompanhamentoCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.criar(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.post("/{acompanhamento_id}/iniciar", response_model=AcompanhamentoOut)
def iniciar(
    acompanhamento_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.iniciar(db, acompanhamento_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.get("/{acompanhamento_id}/sinais-vitais", response_model=list[SinalVitalOut])
def listar_sinais_vitais(
    acompanhamento_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)
):
    return svc.listar_sinais_vitais(db, acompanhamento_id, ctx.unidade_hospitalar_id)


@router.post("/{acompanhamento_id}/sinais-vitais", response_model=SinalVitalOut, status_code=status.HTTP_201_CREATED)
def registrar_sinal_vital(
    acompanhamento_id: uuid.UUID,
    payload: SinalVitalCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.registrar_sinal_vital(
        db, acompanhamento_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )


@router.post("/{acompanhamento_id}/finalizar", response_model=AcompanhamentoOut)
def finalizar(
    acompanhamento_id: uuid.UUID,
    payload: AcompanhamentoFinalizarRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.finalizar(
        db, acompanhamento_id, payload.observacoes_finalizacao, payload.houve_intercorrencia,
        unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id,
    )
