"""
HemoGest — Service de Acompanhamento Transfusional.
Abre a partir de uma Solicitação Transfusional (sem checagem de bolsa —
controle de estoque está inativo neste hospital, ver
app.services.unidade_hemocomponente_service). Uma intercorrência pode abrir
uma Reação Transfusional, mas não impede a finalização do acompanhamento.
"""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.acompanhamento_transfusional import (
    AcompanhamentoTransfusional,
    SinalVital,
    StatusAcompanhamento,
)
from app.models.audit_log import AcaoAuditoria
from app.models.solicitacao_transfusional import SolicitacaoTransfusional
from app.schemas.acompanhamento_transfusional import AcompanhamentoCreate, SinalVitalCreate


def get_acompanhamento(db: Session, acompanhamento_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> AcompanhamentoTransfusional:
    item = db.get(AcompanhamentoTransfusional, acompanhamento_id)
    if item is None or item.deleted_at is not None or item.unidade_hospitalar_id != unidade_hospitalar_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Acompanhamento transfusional não encontrado.")
    return item


def criar(
    db: Session, payload: AcompanhamentoCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> AcompanhamentoTransfusional:
    solicitacao = db.get(SolicitacaoTransfusional, payload.solicitacao_id)
    if (
        solicitacao is None
        or solicitacao.deleted_at is not None
        or solicitacao.unidade_hospitalar_id != unidade_hospitalar_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitação transfusional não encontrada.")

    item = AcompanhamentoTransfusional(
        solicitacao_id=payload.solicitacao_id,
        status=StatusAcompanhamento.AGUARDANDO,
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(item)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="acompanhamento_transfusional", entidade_id=item.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(item)
    return item


def iniciar(
    db: Session, acompanhamento_id: uuid.UUID, *, data_inicio: datetime | None = None, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> AcompanhamentoTransfusional:
    item = get_acompanhamento(db, acompanhamento_id, unidade_hospitalar_id)
    if item.status != StatusAcompanhamento.AGUARDANDO:
        raise HTTPException(status.HTTP_409_CONFLICT, "Acompanhamento já foi iniciado.")
    item.status = StatusAcompanhamento.EM_ANDAMENTO
    item.data_inicio = data_inicio or utcnow()
    item.updated_by = actor_id
    item.updated_at = utcnow()
    db.flush()
    db.commit()
    db.refresh(item)
    return item


def registrar_sinal_vital(
    db: Session, acompanhamento_id: uuid.UUID, payload: SinalVitalCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> SinalVital:
    item = get_acompanhamento(db, acompanhamento_id, unidade_hospitalar_id)
    if item.status not in (StatusAcompanhamento.EM_ANDAMENTO, StatusAcompanhamento.INTERCORRENCIA):
        raise HTTPException(status.HTTP_409_CONFLICT, "Acompanhamento precisa estar EM_ANDAMENTO para registrar sinais vitais.")

    sinal = SinalVital(acompanhamento_id=acompanhamento_id, registrado_por=actor_id, **payload.model_dump())
    db.add(sinal)
    db.commit()
    db.refresh(sinal)
    return sinal


def listar_sinais_vitais(db: Session, acompanhamento_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> list[SinalVital]:
    get_acompanhamento(db, acompanhamento_id, unidade_hospitalar_id)
    stmt = select(SinalVital).where(SinalVital.acompanhamento_id == acompanhamento_id).order_by(SinalVital.data_hora)
    return list(db.scalars(stmt))


def finalizar(
    db: Session, acompanhamento_id: uuid.UUID, observacoes: str | None, houve_intercorrencia: bool, *,
    data_fim: datetime | None = None, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> AcompanhamentoTransfusional:
    item = get_acompanhamento(db, acompanhamento_id, unidade_hospitalar_id)
    if item.status not in (StatusAcompanhamento.EM_ANDAMENTO, StatusAcompanhamento.INTERCORRENCIA):
        raise HTTPException(status.HTTP_409_CONFLICT, "Só é possível finalizar acompanhamento EM_ANDAMENTO.")

    item.status = StatusAcompanhamento.INTERCORRENCIA if houve_intercorrencia else StatusAcompanhamento.FINALIZADO
    item.data_fim = data_fim or utcnow()
    item.observacoes_finalizacao = observacoes
    item.updated_by = actor_id
    item.updated_at = utcnow()
    db.flush()

    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="acompanhamento_transfusional_finalizacao", entidade_id=item.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(item)
    return item
