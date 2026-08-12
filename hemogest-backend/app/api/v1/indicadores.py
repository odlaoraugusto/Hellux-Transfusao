from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.services import indicador_service as svc

router = APIRouter(prefix="/indicadores", tags=["Indicadores"])


@router.get("")
def obter_indicadores(
    dias: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return svc.indicadores(db, ctx.unidade_hospitalar_id, dias)
