from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.devolucao_descarte import DescarteCreate, DescarteOut, DevolucaoCreate, DevolucaoOut
from app.services import devolucao_descarte_service as svc

router = APIRouter(tags=["Devoluções e Descartes"])
_pode_escrever = require_roles(RoleCodigo.BIOMEDICO, RoleCodigo.TECNICO, RoleCodigo.SUPERVISOR)


@router.post("/devolucoes", response_model=DevolucaoOut, status_code=status.HTTP_201_CREATED)
def registrar_devolucao(
    payload: DevolucaoCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.registrar_devolucao(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.post("/descartes", response_model=DescarteOut, status_code=status.HTTP_201_CREATED)
def registrar_descarte(
    payload: DescarteCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.registrar_descarte(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
