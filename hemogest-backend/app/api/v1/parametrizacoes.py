"""
HemoGest — Rotas do bloco Parametrização (Sprints 3.3 a 3.7).
Uma fábrica de router gera o CRUD para as 5 entidades a partir do service
genérico — leitura liberada a qualquer usuário autenticado da unidade,
escrita restrita a Supervisor+.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.parametrizacao import Gravidade, Hemocomponente, MotivoDescarte, MotivoDevolucao, TipoReacao
from app.models.role import RoleCodigo
from app.schemas.parametrizacao import (
    GravidadeCreate,
    GravidadeOut,
    GravidadeUpdate,
    HemocomponenteCreate,
    HemocomponenteOut,
    HemocomponenteUpdate,
    MotivoDescarteCreate,
    MotivoDescarteOut,
    MotivoDevolucaoCreate,
    MotivoDevolucaoOut,
    ParametrizacaoItemUpdate,
    TipoReacaoCreate,
    TipoReacaoOut,
)
from app.services import parametrizacao_service as svc

_pode_escrever = require_roles(RoleCodigo.SUPERVISOR)


def _build_router(*, prefix: str, tag: str, model, schema_out, schema_create, schema_update) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    @router.get("", response_model=list[schema_out])
    def listar(db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
        return svc.list_itens(db, model, ctx.unidade_hospitalar_id)

    @router.get("/{item_id}", response_model=schema_out)
    def obter(
        item_id: uuid.UUID,
        db: Session = Depends(get_db),
        ctx: TenantContext = Depends(require_unidade_resolvida),
    ):
        return svc.get_item(db, model, item_id, ctx.unidade_hospitalar_id)

    @router.post("", response_model=schema_out, status_code=status.HTTP_201_CREATED)
    def criar(
        payload: schema_create,
        db: Session = Depends(get_db),
        ctx: TenantContext = Depends(require_unidade_resolvida),
        user=Depends(_pode_escrever),
    ):
        return svc.create_item(
            db, model, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
        )

    @router.put("/{item_id}", response_model=schema_out)
    def atualizar(
        item_id: uuid.UUID,
        payload: schema_update,
        db: Session = Depends(get_db),
        ctx: TenantContext = Depends(require_unidade_resolvida),
        user=Depends(_pode_escrever),
    ):
        return svc.update_item(
            db, model, item_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
        )

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    def excluir(
        item_id: uuid.UUID,
        db: Session = Depends(get_db),
        ctx: TenantContext = Depends(require_unidade_resolvida),
        user=Depends(_pode_escrever),
    ):
        svc.delete_item(db, model, item_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)

    return router


hemocomponentes_router = _build_router(
    prefix="/hemocomponentes",
    tag="Parametrização — Hemocomponentes",
    model=Hemocomponente,
    schema_out=HemocomponenteOut,
    schema_create=HemocomponenteCreate,
    schema_update=HemocomponenteUpdate,
)

motivos_devolucao_router = _build_router(
    prefix="/motivos-devolucao",
    tag="Parametrização — Motivos de Devolução",
    model=MotivoDevolucao,
    schema_out=MotivoDevolucaoOut,
    schema_create=MotivoDevolucaoCreate,
    schema_update=ParametrizacaoItemUpdate,
)

motivos_descarte_router = _build_router(
    prefix="/motivos-descarte",
    tag="Parametrização — Motivos de Descarte",
    model=MotivoDescarte,
    schema_out=MotivoDescarteOut,
    schema_create=MotivoDescarteCreate,
    schema_update=ParametrizacaoItemUpdate,
)

tipos_reacao_router = _build_router(
    prefix="/tipos-reacao",
    tag="Parametrização — Tipos de Reação",
    model=TipoReacao,
    schema_out=TipoReacaoOut,
    schema_create=TipoReacaoCreate,
    schema_update=ParametrizacaoItemUpdate,
)

gravidades_router = _build_router(
    prefix="/gravidades",
    tag="Parametrização — Gravidades",
    model=Gravidade,
    schema_out=GravidadeOut,
    schema_create=GravidadeCreate,
    schema_update=GravidadeUpdate,
)
