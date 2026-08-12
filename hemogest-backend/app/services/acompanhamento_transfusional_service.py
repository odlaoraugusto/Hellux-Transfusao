"""
HemoGest — Service de Acompanhamento Transfusional (Fase 6).
Iniciar exige que a bolsa esteja RESERVADA (reservada na Fase 5) e muda seu
status para "em uso" implicitamente via o próprio acompanhamento — a bolsa
só vira TRANSFUNDIDO quando o acompanhamento é finalizado sem
intercorrência grave o suficiente para impedir isso (a decisão de
interromper fica a critério clínico, registrada como intercorrência).
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
from app.models.unidade_hemocomponente import StatusHemocomponente
from app.schemas.acompanhamento_transfusional import AcompanhamentoCreate, SinalVitalCreate
from app.services import unidade_hemocomponente_service


def get_acompanhamento(db: Session, acompanhamento_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> AcompanhamentoTransfusional:
    item = db.get(AcompanhamentoTransfusional, acompanhamento_id)
    if item is None or item.deleted_at is not None or item.unidade_hospitalar_id != unidade_hospitalar_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Acompanhamento transfusional não encontrado.")
    return item


def criar(
    db: Session, payload: AcompanhamentoCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> AcompanhamentoTransfusional:
    bolsa = unidade_hemocomponente_service.get_bolsa(db, payload.unidade_hemocomponente_id, unidade_hospitalar_id)
    if bolsa.status != StatusHemocomponente.RESERVADO:
        raise HTTPException(status.HTTP_409_CONFLICT, "Bolsa precisa estar RESERVADA para iniciar acompanhamento.")

    item = AcompanhamentoTransfusional(
        internacao_id=payload.internacao_id,
        unidade_hemocomponente_id=payload.unidade_hemocomponente_id,
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


def iniciar(db: Session, acompanhamento_id: uuid.UUID, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID) -> AcompanhamentoTransfusional:
    item = get_acompanhamento(db, acompanhamento_id, unidade_hospitalar_id)
    if item.status != StatusAcompanhamento.AGUARDANDO:
        raise HTTPException(status.HTTP_409_CONFLICT, "Acompanhamento já foi iniciado.")
    item.status = StatusAcompanhamento.EM_ANDAMENTO
    item.data_inicio = utcnow()
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
    db: Session, acompanhamento_id: uuid.UUID, observacoes: str | None, houve_intercorrencia: bool, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> AcompanhamentoTransfusional:
    item = get_acompanhamento(db, acompanhamento_id, unidade_hospitalar_id)
    if item.status not in (StatusAcompanhamento.EM_ANDAMENTO, StatusAcompanhamento.INTERCORRENCIA):
        raise HTTPException(status.HTTP_409_CONFLICT, "Só é possível finalizar acompanhamento EM_ANDAMENTO.")

    item.status = StatusAcompanhamento.INTERCORRENCIA if houve_intercorrencia else StatusAcompanhamento.FINALIZADO
    item.data_fim = utcnow()
    item.observacoes_finalizacao = observacoes
    item.updated_by = actor_id
    item.updated_at = utcnow()
    db.flush()

    if not houve_intercorrencia:
        unidade_hemocomponente_service.forcar_status(
            db, item.unidade_hemocomponente_id, StatusHemocomponente.TRANSFUNDIDO,
            unidade_hospitalar_id=unidade_hospitalar_id, actor_id=actor_id,
        )

    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="acompanhamento_transfusional_finalizacao", entidade_id=item.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(item)
    return item
