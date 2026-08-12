import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.setor import Setor
from app.schemas.setor import SetorCreate, SetorUpdate


def list_setores(db: Session, unidade_hospitalar_id: uuid.UUID) -> list[Setor]:
    stmt = (
        select(Setor)
        .where(Setor.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(Setor.deleted_at.is_(None))
        .order_by(Setor.nome)
    )
    return list(db.scalars(stmt))


def get_setor(db: Session, setor_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> Setor:
    setor = db.get(Setor, setor_id)
    if setor is None or setor.deleted_at is not None or setor.unidade_hospitalar_id != unidade_hospitalar_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Setor não encontrado.")
    return setor


def create_setor(
    db: Session, payload: SetorCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Setor:
    existente = db.scalar(
        select(Setor)
        .where(Setor.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(Setor.nome == payload.nome)
        .where(Setor.deleted_at.is_(None))
    )
    if existente is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um setor com este nome.")

    setor = Setor(
        **payload.model_dump(),
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(setor)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="setor", entidade_id=setor.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(setor)
    return setor


def update_setor(
    db: Session, setor_id: uuid.UUID, payload: SetorUpdate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Setor:
    setor = get_setor(db, setor_id, unidade_hospitalar_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(setor, field, value)
    setor.updated_by = actor_id
    setor.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="setor", entidade_id=setor.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(setor)
    return setor


def delete_setor(db: Session, setor_id: uuid.UUID, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    setor = get_setor(db, setor_id, unidade_hospitalar_id)
    setor.deleted_at = utcnow()
    setor.updated_by = actor_id
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EXCLUSAO_LOGICA, entidade="setor", entidade_id=setor.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
