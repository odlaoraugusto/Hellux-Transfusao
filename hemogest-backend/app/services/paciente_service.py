import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.paciente import Paciente
from app.schemas.paciente import PacienteCreate, PacienteUpdate


def search_pacientes(
    db: Session,
    unidade_hospitalar_id: uuid.UUID,
    *,
    termo: str | None = None,
    cpf: str | None = None,
    numero_prontuario: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Paciente]:
    stmt = (
        select(Paciente)
        .where(Paciente.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(Paciente.deleted_at.is_(None))
    )
    if termo:
        padrao = f"%{termo}%"
        stmt = stmt.where(or_(Paciente.nome.ilike(padrao), Paciente.nome_mae.ilike(padrao)))
    if cpf:
        stmt = stmt.where(Paciente.cpf == cpf)
    if numero_prontuario:
        stmt = stmt.where(Paciente.numero_prontuario == numero_prontuario)

    stmt = stmt.order_by(Paciente.nome).limit(limit).offset(offset)
    return list(db.scalars(stmt))


def get_paciente(db: Session, paciente_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> Paciente:
    paciente = db.get(Paciente, paciente_id)
    if (
        paciente is None
        or paciente.deleted_at is not None
        or paciente.unidade_hospitalar_id != unidade_hospitalar_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paciente não encontrado.")
    return paciente


def create_paciente(
    db: Session, payload: PacienteCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Paciente:
    if payload.cpf:
        existente = db.scalar(
            select(Paciente)
            .where(Paciente.unidade_hospitalar_id == unidade_hospitalar_id)
            .where(Paciente.cpf == payload.cpf)
            .where(Paciente.deleted_at.is_(None))
        )
        if existente is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um paciente com este CPF nesta unidade.")

    paciente = Paciente(
        **payload.model_dump(),
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(paciente)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="paciente", entidade_id=paciente.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(paciente)
    return paciente


def update_paciente(
    db: Session, paciente_id: uuid.UUID, payload: PacienteUpdate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Paciente:
    paciente = get_paciente(db, paciente_id, unidade_hospitalar_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(paciente, field, value)
    paciente.updated_by = actor_id
    paciente.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="paciente", entidade_id=paciente.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(paciente)
    return paciente


def delete_paciente(db: Session, paciente_id: uuid.UUID, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    paciente = get_paciente(db, paciente_id, unidade_hospitalar_id)
    paciente.deleted_at = utcnow()
    paciente.updated_by = actor_id
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EXCLUSAO_LOGICA, entidade="paciente", entidade_id=paciente.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
