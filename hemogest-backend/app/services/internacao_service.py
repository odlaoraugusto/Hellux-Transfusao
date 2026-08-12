"""
HemoGest — Service de Internação.
Regra de negócio: uma internação ATIVA sempre tem exatamente um registro
"aberto" (data_fim=None) em InternacaoSetorHistorico, que reflete
setor_atual_id. Mudar de setor fecha o registro aberto e abre um novo;
dar alta apenas fecha a internação (não fecha o histórico de setor).
"""
import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.internacao import Internacao, InternacaoSetorHistorico, StatusInternacao
from app.models.paciente import Paciente
from app.schemas.internacao import InternacaoAltaRequest, InternacaoCreate, InternacaoMudancaSetorRequest


def get_internacao(db: Session, internacao_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> Internacao:
    internacao = db.get(Internacao, internacao_id)
    if (
        internacao is None
        or internacao.deleted_at is not None
        or internacao.unidade_hospitalar_id != unidade_hospitalar_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Internação não encontrada.")
    return internacao


def list_internacoes_paciente(
    db: Session, paciente_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID
) -> list[Internacao]:
    stmt = (
        select(Internacao)
        .where(Internacao.paciente_id == paciente_id)
        .where(Internacao.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(Internacao.deleted_at.is_(None))
        .order_by(Internacao.data_entrada.desc())
    )
    return list(db.scalars(stmt))


def historico_setores(db: Session, internacao_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> list[InternacaoSetorHistorico]:
    get_internacao(db, internacao_id, unidade_hospitalar_id)  # valida acesso/tenant
    stmt = (
        select(InternacaoSetorHistorico)
        .where(InternacaoSetorHistorico.internacao_id == internacao_id)
        .order_by(InternacaoSetorHistorico.data_inicio)
    )
    return list(db.scalars(stmt))


def create_internacao(
    db: Session, payload: InternacaoCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Internacao:
    paciente = db.get(Paciente, payload.paciente_id)
    if (
        paciente is None
        or paciente.deleted_at is not None
        or paciente.unidade_hospitalar_id != unidade_hospitalar_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paciente não encontrado.")

    internacao = Internacao(
        paciente_id=payload.paciente_id,
        setor_atual_id=payload.setor_id,
        numero_internacao=payload.numero_internacao,
        leito=payload.leito,
        data_entrada=payload.data_entrada,
        status=StatusInternacao.ATIVA,
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(internacao)
    db.flush()

    db.add(InternacaoSetorHistorico(internacao_id=internacao.id, setor_id=payload.setor_id, registrado_por=actor_id))
    db.flush()

    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="internacao", entidade_id=internacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(internacao)
    return internacao


def dar_alta(
    db: Session, internacao_id: uuid.UUID, payload: InternacaoAltaRequest, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Internacao:
    internacao = get_internacao(db, internacao_id, unidade_hospitalar_id)
    if internacao.status == StatusInternacao.ALTA:
        raise HTTPException(status.HTTP_409_CONFLICT, "Internação já possui alta registrada.")
    if payload.data_alta < internacao.data_entrada:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data de alta não pode ser anterior à data de entrada.")

    internacao.status = StatusInternacao.ALTA
    internacao.data_alta = payload.data_alta
    internacao.motivo_alta = payload.motivo_alta
    internacao.updated_by = actor_id
    internacao.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="internacao_alta", entidade_id=internacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(internacao)
    return internacao


def mudar_setor(
    db: Session, internacao_id: uuid.UUID, payload: InternacaoMudancaSetorRequest, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Internacao:
    internacao = get_internacao(db, internacao_id, unidade_hospitalar_id)
    if internacao.status == StatusInternacao.ALTA:
        raise HTTPException(status.HTTP_409_CONFLICT, "Não é possível mudar setor de internação já com alta.")

    registro_aberto = db.scalar(
        select(InternacaoSetorHistorico)
        .where(InternacaoSetorHistorico.internacao_id == internacao_id)
        .where(InternacaoSetorHistorico.data_fim.is_(None))
    )
    agora = utcnow()
    if registro_aberto is not None:
        registro_aberto.data_fim = agora

    db.add(
        InternacaoSetorHistorico(
            internacao_id=internacao_id, setor_id=payload.novo_setor_id, data_inicio=agora, registrado_por=actor_id
        )
    )

    internacao.setor_atual_id = payload.novo_setor_id
    if payload.leito is not None:
        internacao.leito = payload.leito
    internacao.updated_by = actor_id
    internacao.updated_at = agora
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="internacao_mudanca_setor", entidade_id=internacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"novo_setor_id": str(payload.novo_setor_id)},
    )
    db.commit()
    db.refresh(internacao)
    return internacao
