"""
HemoGest — Service de Devolução e Descarte (Fase 8).
Ambos exigem que a bolsa esteja DISPONIVEL ou RESERVADA (uma bolsa já
TRANSFUNDIDA/DEVOLVIDA/DESCARTADA não pode ser devolvida nem descartada de
novo). Ao concluir, a bolsa vai para o status terminal correspondente.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.models.audit_log import AcaoAuditoria
from app.models.devolucao_descarte import Descarte, Devolucao
from app.models.unidade_hemocomponente import StatusHemocomponente
from app.schemas.devolucao_descarte import DescarteCreate, DevolucaoCreate
from app.services import unidade_hemocomponente_service

_STATUS_PERMITEM_BAIXA = {StatusHemocomponente.DISPONIVEL, StatusHemocomponente.RESERVADO}


def registrar_devolucao(
    db: Session, payload: DevolucaoCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Devolucao:
    bolsa = unidade_hemocomponente_service.get_bolsa(db, payload.unidade_hemocomponente_id, unidade_hospitalar_id)
    if bolsa.status not in _STATUS_PERMITEM_BAIXA:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa em status {bolsa.status} não pode ser devolvida.")

    devolucao = Devolucao(**payload.model_dump(), unidade_hospitalar_id=unidade_hospitalar_id, created_by=actor_id, updated_by=actor_id)
    db.add(devolucao)
    db.flush()

    unidade_hemocomponente_service.forcar_status(
        db, bolsa.id, StatusHemocomponente.DEVOLVIDO, unidade_hospitalar_id=unidade_hospitalar_id, actor_id=actor_id
    )

    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="devolucao", entidade_id=devolucao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(devolucao)
    return devolucao


def registrar_descarte(
    db: Session, payload: DescarteCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Descarte:
    bolsa = unidade_hemocomponente_service.get_bolsa(db, payload.unidade_hemocomponente_id, unidade_hospitalar_id)
    if bolsa.status not in _STATUS_PERMITEM_BAIXA:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa em status {bolsa.status} não pode ser descartada.")

    descarte = Descarte(**payload.model_dump(), unidade_hospitalar_id=unidade_hospitalar_id, created_by=actor_id, updated_by=actor_id)
    db.add(descarte)
    db.flush()

    unidade_hemocomponente_service.forcar_status(
        db, bolsa.id, StatusHemocomponente.DESCARTADO, unidade_hospitalar_id=unidade_hospitalar_id, actor_id=actor_id
    )

    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="descarte", entidade_id=descarte.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(descarte)
    return descarte
