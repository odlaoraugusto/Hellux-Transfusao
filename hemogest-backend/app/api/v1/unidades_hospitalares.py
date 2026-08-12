import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, get_tenant_context
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.unidade_hospitalar import (
    UnidadeHospitalarCreate,
    UnidadeHospitalarLogoOut,
    UnidadeHospitalarOut,
    UnidadeHospitalarUpdate,
)
from app.services import unidade_hospitalar_service as svc

router = APIRouter(prefix="/unidades-hospitalares", tags=["Unidade Hospitalar"])

_apenas_admin_global = require_roles()  # nenhum código extra => só ADMIN_GLOBAL
_pode_editar = require_roles(RoleCodigo.SUPERVISOR)


@router.get("", response_model=list[UnidadeHospitalarOut])
def listar(db: Session = Depends(get_db), _user=Depends(_apenas_admin_global)):
    return svc.list_unidades(db)


@router.get("/{unidade_id}", response_model=UnidadeHospitalarOut)
def obter(unidade_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    if not ctx.is_admin_global and ctx.unidade_hospitalar_id != unidade_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a esta unidade.")
    return svc.get_unidade(db, unidade_id)


@router.post("", response_model=UnidadeHospitalarOut, status_code=status.HTTP_201_CREATED)
def criar(payload: UnidadeHospitalarCreate, db: Session = Depends(get_db), user=Depends(_apenas_admin_global)):
    return svc.create_unidade(db, payload, actor_id=user.id)


@router.put("/{unidade_id}", response_model=UnidadeHospitalarOut)
def atualizar(
    unidade_id: uuid.UUID,
    payload: UnidadeHospitalarUpdate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
    user=Depends(_pode_editar),
):
    if not ctx.is_admin_global and ctx.unidade_hospitalar_id != unidade_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a esta unidade.")
    return svc.update_unidade(db, unidade_id, payload, actor_id=user.id)


@router.post("/{unidade_id}/logo", response_model=UnidadeHospitalarLogoOut)
def enviar_logo(
    unidade_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
    user=Depends(_pode_editar),
    arquivo: UploadFile = File(...),
):
    if not ctx.is_admin_global and ctx.unidade_hospitalar_id != unidade_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a esta unidade.")
    url = svc.upload_logo(db, unidade_id, arquivo, actor_id=user.id)
    return UnidadeHospitalarLogoOut(logo_url=url)
