import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.setor import SetorCreate, SetorOut, SetorUpdate
from app.services import setor_service

router = APIRouter(prefix="/setores", tags=["Parametrização — Setores"])
_pode_escrever = require_roles(RoleCodigo.SUPERVISOR)


@router.get("", response_model=list[SetorOut])
def listar(db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return setor_service.list_setores(db, ctx.unidade_hospitalar_id)


@router.get("/{setor_id}", response_model=SetorOut)
def obter(setor_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return setor_service.get_setor(db, setor_id, ctx.unidade_hospitalar_id)


@router.post("", response_model=SetorOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: SetorCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return setor_service.create_setor(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.put("/{setor_id}", response_model=SetorOut)
def atualizar(
    setor_id: uuid.UUID,
    payload: SetorUpdate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return setor_service.update_setor(
        db, setor_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )


@router.delete("/{setor_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(
    setor_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    setor_service.delete_setor(db, setor_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
