import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.modulos import require_modulo_ativo
from app.core.permissions import require_permission
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.schemas.mapa_trabalho_pretransfusional import MapaTrabalhoOut, MapaTrabalhoUpsert
from app.schemas.solicitacao_transfusional import (
    CancelarSolicitacaoRequest,
    EntregarBolsaRequest,
    RegistrarBolsaRequest,
    RegistroBolsaOut,
    SolicitacaoCreate,
    SolicitacaoOut,
)
from app.services import mapa_trabalho_service, solicitacao_transfusional_service as svc

router = APIRouter(prefix="/solicitacoes", tags=["Solicitações Transfusionais"])
_pode_escrever = require_permission("solicitacoes_gerenciar")
_pode_escrever_bolsa = require_permission("hemocomponentes_bolsas_gerenciar")
_modulo_mapa_trabalho = require_modulo_ativo("mapa_trabalho")


@router.get("", response_model=list[SolicitacaoOut])
def listar(
    de: datetime | None = Query(default=None, description="Início do período (inclusive), com fuso"),
    ate: datetime | None = Query(default=None, description="Fim do período (exclusivo), com fuso"),
    status_filtro: str | None = Query(default=None, alias="status", pattern="^(SOLICITADO|EM_PROCESSAMENTO|ENTREGUE|CANCELADO)$"),
    setor_id: uuid.UUID | None = None,
    hemocomponente_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
):
    itens = svc.search(
        db, ctx.unidade_hospitalar_id, de=de, ate=ate, status_filtro=status_filtro,
        setor_id=setor_id, hemocomponente_id=hemocomponente_id,
    )
    return svc.montar_saida(db, itens)


@router.get("/{solicitacao_id}", response_model=SolicitacaoOut)
def obter(solicitacao_id: uuid.UUID, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    item = svc.get_solicitacao(db, solicitacao_id, ctx.unidade_hospitalar_id)
    return svc.montar_saida(db, [item], com_bolsas=True)[0]


@router.post("", response_model=SolicitacaoOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: SolicitacaoCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    item = svc.criar(db, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
    return svc.montar_saida(db, [item])[0]


@router.post("/{solicitacao_id}/iniciar-processamento", response_model=SolicitacaoOut)
def iniciar_processamento(
    solicitacao_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    item = svc.iniciar_processamento(db, solicitacao_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
    return svc.montar_saida(db, [item])[0]


@router.post("/{solicitacao_id}/cancelar", response_model=SolicitacaoOut)
def cancelar(
    solicitacao_id: uuid.UUID,
    payload: CancelarSolicitacaoRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    item = svc.cancelar(db, solicitacao_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
    return svc.montar_saida(db, [item])[0]


@router.post("/{solicitacao_id}/bolsas", response_model=RegistroBolsaOut)
def registrar_bolsa(
    solicitacao_id: uuid.UUID,
    payload: RegistrarBolsaRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    item, bolsa = svc.registrar_bolsa(db, solicitacao_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id)
    saida = svc.montar_saida(db, [item], com_bolsas=True)[0]
    return {**saida, "bolsa_id": bolsa.id}


@router.post("/{solicitacao_id}/bolsas/{bolsa_id}/entregar", response_model=RegistroBolsaOut)
def entregar_bolsa(
    solicitacao_id: uuid.UUID,
    bolsa_id: uuid.UUID,
    payload: EntregarBolsaRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
):
    item, bolsa = svc.entregar_bolsa(
        db, solicitacao_id, bolsa_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )
    saida = svc.montar_saida(db, [item], com_bolsas=True)[0]
    return {**saida, "bolsa_id": bolsa.id}


@router.get("/{solicitacao_id}/bolsas/{bolsa_id}/mapa-trabalho", response_model=MapaTrabalhoOut | None)
def obter_mapa_trabalho(
    solicitacao_id: uuid.UUID,
    bolsa_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    _modulo=Depends(_modulo_mapa_trabalho),
):
    return mapa_trabalho_service.get_mapa(
        db, solicitacao_id, bolsa_id, unidade_hospitalar_id=ctx.unidade_hospitalar_id
    )


@router.put("/{solicitacao_id}/bolsas/{bolsa_id}/mapa-trabalho", response_model=MapaTrabalhoOut)
def atualizar_mapa_trabalho(
    solicitacao_id: uuid.UUID,
    bolsa_id: uuid.UUID,
    payload: MapaTrabalhoUpsert,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever_bolsa),
    _modulo=Depends(_modulo_mapa_trabalho),
):
    return mapa_trabalho_service.upsert_mapa(
        db, solicitacao_id, bolsa_id, payload, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )
