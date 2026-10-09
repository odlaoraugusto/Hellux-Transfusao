"""
HemoGest — Service genérico para o bloco Parametrização.
As 4 entidades (Hemocomponente, MotivoDevolucao — motivos de devolução E
descarte, 2026-10-05, pedido do cliente —, TipoReacao, Gravidade) têm CRUD
idêntico: isolado por unidade, com soft delete e auditoria. Em vez de
repetir a mesma função 4 vezes, parametrizamos pela classe do model —
cada router chama estas funções passando seu Model.
"""
import uuid
from typing import TypeVar

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria

ModelT = TypeVar("ModelT")


def list_itens(db: Session, model: type[ModelT], unidade_hospitalar_id: uuid.UUID) -> list[ModelT]:
    stmt = (
        select(model)
        .where(model.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(model.deleted_at.is_(None))
        .order_by(model.ordem, model.nome)
    )
    return list(db.scalars(stmt))


def get_item(db: Session, model: type[ModelT], item_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> ModelT:
    item = db.get(model, item_id)
    if (
        item is None
        or item.deleted_at is not None
        or item.unidade_hospitalar_id != unidade_hospitalar_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} não encontrado(a).")
    return item


def create_item(
    db: Session,
    model: type[ModelT],
    payload: BaseModel,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> ModelT:
    existente = db.scalar(
        select(model)
        .where(model.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(model.nome == payload.nome)
        .where(model.deleted_at.is_(None))
    )
    if existente is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Já existe um(a) {model.__name__} com este nome.")

    item = model(
        **payload.model_dump(),
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(item)
    db.flush()
    registrar_auditoria(
        db,
        acao=AcaoAuditoria.CRIACAO,
        entidade=model.__tablename__,
        entidade_id=item.id,
        usuario_id=actor_id,
        unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(item)
    return item


def update_item(
    db: Session,
    model: type[ModelT],
    item_id: uuid.UUID,
    payload: BaseModel,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> ModelT:
    item = get_item(db, model, item_id, unidade_hospitalar_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_by = actor_id
    item.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db,
        acao=AcaoAuditoria.EDICAO,
        entidade=model.__tablename__,
        entidade_id=item.id,
        usuario_id=actor_id,
        unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(item)
    return item


def delete_item(
    db: Session,
    model: type[ModelT],
    item_id: uuid.UUID,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> None:
    item = get_item(db, model, item_id, unidade_hospitalar_id)
    item.deleted_at = utcnow()
    item.updated_by = actor_id
    db.flush()
    registrar_auditoria(
        db,
        acao=AcaoAuditoria.EXCLUSAO_LOGICA,
        entidade=model.__tablename__,
        entidade_id=item.id,
        usuario_id=actor_id,
        unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
