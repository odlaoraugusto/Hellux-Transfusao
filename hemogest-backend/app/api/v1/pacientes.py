import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.paciente import PacienteCreate, PacienteOut, PacienteUpdate
from app.services import paciente_service

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])
_pode_escrever = require_roles(RoleCodigo.BIOMEDICO, RoleCodigo.TECNICO, RoleCodigo.SUPERVISOR)


@router.get("", response_model=list[PacienteOut])
def pesquisar(
    termo: str | None = Query(default=None, description="Busca por nome ou nome da mãe"),
    cpf: str | None = Query(default=None),
    numero_prontuario: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return paciente_service.search_pacientes(
        db, ctx.unidade_hospitalar_id, termo=termo, cpf=cpf, numero_prontuario=numero_prontuario,
        limit=limit, offset=offset,
    )


@router.get("/{paciente_id}", response_model=PacienteOut)
def obter(paciente_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return paciente_service.get_paciente(db, paciente_id, ctx.unidade_hospitalar_id, actor_id=ctx.user_id)


@router.post("", response_model=PacienteOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: PacienteCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return paciente_service.create_paciente(
        db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )


@router.put("/{paciente_id}", response_model=PacienteOut)
def atualizar(
    paciente_id: uuid.UUID,
    payload: PacienteUpdate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return paciente_service.update_paciente(
        db, paciente_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )


@router.delete("/{paciente_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(
    paciente_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    paciente_service.delete_paciente(db, paciente_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
