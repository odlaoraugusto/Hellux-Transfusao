import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.schemas.formulario_solicitacao import FormularioOut, FormularioResumoOut
from app.services import formulario_solicitacao_service as svc

router = APIRouter(prefix="/formularios-solicitacao", tags=["Formulários de Solicitação Recebidos"])


@router.get("", response_model=list[FormularioResumoOut])
def listar(
    de: datetime | None = Query(default=None, description="Início do período de recebimento (inclusive), com fuso"),
    ate: datetime | None = Query(default=None, description="Fim do período de recebimento (exclusivo), com fuso"),
    modalidade: str | None = Query(default=None, pattern="^(EMERGENCIA|URGENCIA|ROTINA|PROGRAMADA)$"),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
):
    itens = svc.search(db, ctx.unidade_hospitalar_id, de=de, ate=ate, modalidade=modalidade)
    return [svc.montar_resumo(i) for i in itens]


@router.get("/{formulario_id}", response_model=FormularioOut)
def obter(formulario_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    registro = svc.get_formulario(db, formulario_id, ctx.unidade_hospitalar_id, actor_id=ctx.user_id)
    return svc.montar_saida(db, registro)
