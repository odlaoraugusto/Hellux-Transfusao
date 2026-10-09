import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.permissions import require_permission
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.schemas.unidade_hemocomponente import (
    FracionarRequest,
    ReservarRequest,
    UnidadeHemocomponenteCreate,
    UnidadeHemocomponenteOut,
)
from app.services import unidade_hemocomponente_service as svc

router = APIRouter(prefix="/hemocomponentes-bolsas", tags=["Hemocomponentes (Bolsas)"])
_pode_escrever = require_permission("hemocomponentes_bolsas_gerenciar")


@router.get("", response_model=list[UnidadeHemocomponenteOut])
def pesquisar(
    status_filtro: str | None = Query(default=None, alias="status"),
    hemocomponente_id: uuid.UUID | None = None,
    numero_bolsa: str | None = None,
    validade_ate: date | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return svc.search(
        db, ctx.unidade_hospitalar_id, status_filtro=status_filtro, hemocomponente_id=hemocomponente_id,
        numero_bolsa=numero_bolsa, validade_ate=validade_ate, limit=limit, offset=offset,
    )


@router.get("/{bolsa_id}", response_model=UnidadeHemocomponenteOut)
def obter(bolsa_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return svc.get_bolsa(db, bolsa_id, ctx.unidade_hospitalar_id)


@router.post("", response_model=UnidadeHemocomponenteOut, status_code=status.HTTP_201_CREATED)
def cadastrar(
    payload: UnidadeHemocomponenteCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.create_bolsa(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)


@router.post("/{bolsa_id}/fracionar", response_model=list[UnidadeHemocomponenteOut])
def fracionar(
    bolsa_id: uuid.UUID,
    payload: FracionarRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.fracionar(
        db, bolsa_id, payload.quantidade_fracoes, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )


@router.post("/{bolsa_id}/reservar", response_model=UnidadeHemocomponenteOut)
def reservar(
    bolsa_id: uuid.UUID,
    payload: ReservarRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    return svc.reservar(
        db, bolsa_id, payload.paciente_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )
