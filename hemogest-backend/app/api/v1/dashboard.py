from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.services import dashboard_service as svc

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/estoque")
def estoque(db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return svc.estoque_por_tipo(db, ctx.unidade_hospitalar_id)


@router.get("/pendencias")
def pendencias(db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return svc.pendencias(db, ctx.unidade_hospitalar_id)


@router.get("/alertas")
def alertas(db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return svc.alertas(db, ctx.unidade_hospitalar_id)


@router.get("/indicadores-diarios")
def indicadores_diarios(
    dias: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return svc.indicadores_diarios(db, ctx.unidade_hospitalar_id, dias)
