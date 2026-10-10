"""
HemoGest — Service do Mapa de Trabalho Pré-Transfusional (módulo opcional).
Ficha técnica 1:1 com uma SolicitacaoBolsa já registrada — ver
app.models.mapa_trabalho_pretransfusional. Reaproveita a validação de
tenant já usada em entregar_bolsa (SolicitacaoTransfusional.unidade_hospitalar_id,
já que SolicitacaoBolsa em si não tem TenantMixin).
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.mapa_trabalho_pretransfusional import MapaTrabalhoPreTransfusional
from app.models.solicitacao_transfusional import SolicitacaoBolsa
from app.schemas.mapa_trabalho_pretransfusional import MapaTrabalhoUpsert
from app.services.solicitacao_transfusional_service import get_solicitacao


def _get_bolsa_da_solicitacao(db: Session, solicitacao_id: uuid.UUID, bolsa_id: uuid.UUID) -> SolicitacaoBolsa:
    bolsa = db.get(SolicitacaoBolsa, bolsa_id)
    if bolsa is None or bolsa.solicitacao_id != solicitacao_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bolsa não encontrada nesta solicitação.")
    return bolsa


def get_mapa(
    db: Session, solicitacao_id: uuid.UUID, bolsa_id: uuid.UUID, *, unidade_hospitalar_id: uuid.UUID
) -> MapaTrabalhoPreTransfusional | None:
    get_solicitacao(db, solicitacao_id, unidade_hospitalar_id)  # valida tenant + existência
    _get_bolsa_da_solicitacao(db, solicitacao_id, bolsa_id)
    return (
        db.query(MapaTrabalhoPreTransfusional)
        .filter(MapaTrabalhoPreTransfusional.solicitacao_bolsa_id == bolsa_id)
        .first()
    )


def upsert_mapa(
    db: Session,
    solicitacao_id: uuid.UUID,
    bolsa_id: uuid.UUID,
    payload: MapaTrabalhoUpsert,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> MapaTrabalhoPreTransfusional:
    get_solicitacao(db, solicitacao_id, unidade_hospitalar_id)
    _get_bolsa_da_solicitacao(db, solicitacao_id, bolsa_id)

    mapa = (
        db.query(MapaTrabalhoPreTransfusional)
        .filter(MapaTrabalhoPreTransfusional.solicitacao_bolsa_id == bolsa_id)
        .first()
    )
    dados = payload.model_dump(exclude_unset=True)
    if mapa is None:
        mapa = MapaTrabalhoPreTransfusional(
            solicitacao_bolsa_id=bolsa_id,
            unidade_hospitalar_id=unidade_hospitalar_id,
            created_by=actor_id,
            updated_by=actor_id,
            **dados,
        )
        db.add(mapa)
        acao = AcaoAuditoria.CRIACAO
    else:
        for campo, valor in dados.items():
            setattr(mapa, campo, valor)
        mapa.updated_by = actor_id
        mapa.updated_at = utcnow()
        acao = AcaoAuditoria.EDICAO

    db.flush()
    registrar_auditoria(
        db, acao=acao, entidade="mapa_trabalho_pretransfusional", entidade_id=mapa.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"solicitacao_bolsa_id": str(bolsa_id)},
    )
    db.commit()
    db.refresh(mapa)
    return mapa
