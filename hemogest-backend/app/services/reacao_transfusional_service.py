"""
HemoGest — Service de Reação Transfusional (Fase 7).
Fluxo linear e obrigatório: ABERTA -> INVESTIGACAO -> [NOTIVISA] -> ENCERRADA.
Notivisa é opcional (nem toda reação exige notificação), mas se usado deve
acontecer durante a investigação, antes do encerramento.
"""
import uuid

from fastapi import HTTPException, status

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.reacao_transfusional import ReacaoTransfusional, StatusReacao
from app.schemas.reacao_transfusional import ReacaoAberturaRequest
from sqlalchemy.orm import Session


def get_reacao(db: Session, reacao_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> ReacaoTransfusional:
    item = db.get(ReacaoTransfusional, reacao_id)
    if item is None or item.deleted_at is not None or item.unidade_hospitalar_id != unidade_hospitalar_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reação transfusional não encontrada.")
    return item


def abrir(db: Session, payload: ReacaoAberturaRequest, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID) -> ReacaoTransfusional:
    reacao = ReacaoTransfusional(
        **payload.model_dump(),
        status=StatusReacao.ABERTA,
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(reacao)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="reacao_transfusional", entidade_id=reacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(reacao)
    return reacao


def investigar(db: Session, reacao_id: uuid.UUID, investigacao: str, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID) -> ReacaoTransfusional:
    reacao = get_reacao(db, reacao_id, unidade_hospitalar_id)
    if reacao.status not in (StatusReacao.ABERTA, StatusReacao.INVESTIGACAO):
        raise HTTPException(status.HTTP_409_CONFLICT, "Reação precisa estar ABERTA ou em INVESTIGACAO.")
    reacao.status = StatusReacao.INVESTIGACAO
    reacao.investigacao = investigacao
    reacao.updated_by = actor_id
    reacao.updated_at = utcnow()
    db.flush()
    db.commit()
    db.refresh(reacao)
    return reacao


def notificar_notivisa(db: Session, reacao_id: uuid.UUID, numero: str, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID) -> ReacaoTransfusional:
    reacao = get_reacao(db, reacao_id, unidade_hospitalar_id)
    if reacao.status != StatusReacao.INVESTIGACAO:
        raise HTTPException(status.HTTP_409_CONFLICT, "Notivisa só pode ser registrado durante a investigação.")
    reacao.status = StatusReacao.NOTIVISA
    reacao.notivisa_numero = numero
    reacao.notivisa_data_envio = utcnow()
    reacao.updated_by = actor_id
    reacao.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="reacao_transfusional_notivisa", entidade_id=reacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id, detalhes={"notivisa_numero": numero},
    )
    db.commit()
    db.refresh(reacao)
    return reacao


def encerrar(db: Session, reacao_id: uuid.UUID, conclusao: str, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID) -> ReacaoTransfusional:
    reacao = get_reacao(db, reacao_id, unidade_hospitalar_id)
    if reacao.status not in (StatusReacao.INVESTIGACAO, StatusReacao.NOTIVISA):
        raise HTTPException(status.HTTP_409_CONFLICT, "Reação precisa estar em INVESTIGACAO ou NOTIVISA para ser encerrada.")
    reacao.status = StatusReacao.ENCERRADA
    reacao.conclusao = conclusao
    reacao.data_encerramento = utcnow()
    reacao.updated_by = actor_id
    reacao.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="reacao_transfusional_encerramento", entidade_id=reacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(reacao)
    return reacao
