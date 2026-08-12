import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.internacao import (
    InternacaoAltaRequest,
    InternacaoCreate,
    InternacaoMudancaSetorRequest,
    InternacaoOut,
    InternacaoSetorHistoricoOut,
)
from app.services import internacao_service

router = APIRouter(prefix="/internacoes", tags=["Internações"])
_pode_escrever = require_roles(RoleCodigo.BIOMEDICO, RoleCodigo.TECNICO, RoleCodigo.SUPERVISOR)


@router.get("/paciente/{paciente_id}", response_model=list[InternacaoOut])
def listar_por_paciente(
    paciente_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)
):
    return internacao_service.list_internacoes_paciente(db, paciente_id, ctx.unidade_hospitalar_id)


@router.get("/{internacao_id}", response_model=InternacaoOut)
def obter(internacao_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return internacao_service.get_internacao(db, internacao_id, ctx.unidade_hospitalar_id)


@router.get("/{internacao_id}/historico-setores", response_model=list[InternacaoSetorHistoricoOut])
def historico_setores(
    internacao_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)
):
    return internacao_service.historico_setores(db, internacao_id, ctx.unidade_hospitalar_id)


@router.post("", response_model=InternacaoOut, status_code=status.HTTP_201_CREATED)
def nova_internacao(
    payload: InternacaoCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return internacao_service.create_internacao(
        db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )


@router.post("/{internacao_id}/alta", response_model=InternacaoOut)
def dar_alta(
    internacao_id: uuid.UUID,
    payload: InternacaoAltaRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return internacao_service.dar_alta(
        db, internacao_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )


@router.post("/{internacao_id}/mudar-setor", response_model=InternacaoOut)
def mudar_setor(
    internacao_id: uuid.UUID,
    payload: InternacaoMudancaSetorRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return internacao_service.mudar_setor(
        db, internacao_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )
