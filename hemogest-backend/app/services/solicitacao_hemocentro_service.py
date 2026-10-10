"""
HemoGest — Service de Solicitação de Bolsas ao Hemocentro (módulo opcional).
Fluxo inverso do formulário público: a agência pede reposição de estoque ao
hemocentro de referência. Ver app.models.solicitacao_hemocentro e
MODULOS.md.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.parametrizacao import Hemocomponente
from app.models.solicitacao_hemocentro import (
    SolicitacaoHemocentro,
    SolicitacaoHemocentroItem,
    StatusSolicitacaoHemocentro,
)
from app.models.unidade_hemocomponente import StatusHemocomponente, UnidadeHemocomponente
from app.schemas.solicitacao_hemocentro import (
    CancelarSolicitacaoHemocentroRequest,
    ReceberSolicitacaoHemocentroRequest,
    SolicitacaoHemocentroCreate,
)
from app.services.parametrizacao_service import get_item as get_parametrizacao_item


def _carregar_com_itens(db: Session, solicitacao_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> SolicitacaoHemocentro:
    stmt = (
        select(SolicitacaoHemocentro)
        .options(selectinload(SolicitacaoHemocentro.itens))
        .where(SolicitacaoHemocentro.id == solicitacao_id)
    )
    item = db.scalar(stmt)
    if (
        item is None
        or item.deleted_at is not None
        or item.unidade_hospitalar_id != unidade_hospitalar_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitação ao hemocentro não encontrada.")
    return item


def search(db: Session, unidade_hospitalar_id: uuid.UUID, *, status_filtro: str | None = None) -> list[SolicitacaoHemocentro]:
    stmt = (
        select(SolicitacaoHemocentro)
        .options(selectinload(SolicitacaoHemocentro.itens))
        .where(SolicitacaoHemocentro.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(SolicitacaoHemocentro.deleted_at.is_(None))
        .order_by(SolicitacaoHemocentro.data_solicitacao.desc())
    )
    if status_filtro:
        stmt = stmt.where(SolicitacaoHemocentro.status == status_filtro)
    return list(db.scalars(stmt))


def get(db: Session, solicitacao_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> SolicitacaoHemocentro:
    return _carregar_com_itens(db, solicitacao_id, unidade_hospitalar_id)


def criar(
    db: Session, payload: SolicitacaoHemocentroCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> SolicitacaoHemocentro:
    for item in payload.itens:
        get_parametrizacao_item(db, Hemocomponente, item.hemocomponente_id, unidade_hospitalar_id)

    solicitacao = SolicitacaoHemocentro(
        hemocentro_nome=payload.hemocentro_nome, observacoes=payload.observacoes,
        status=StatusSolicitacaoHemocentro.SOLICITADA, unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id, updated_by=actor_id,
    )
    db.add(solicitacao)
    db.flush()
    for item in payload.itens:
        db.add(SolicitacaoHemocentroItem(
            solicitacao_hemocentro_id=solicitacao.id, hemocomponente_id=item.hemocomponente_id,
            quantidade_solicitada=item.quantidade_solicitada,
        ))
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="solicitacao_hemocentro", entidade_id=solicitacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    return _carregar_com_itens(db, solicitacao.id, unidade_hospitalar_id)


def marcar_enviada(
    db: Session, solicitacao_id: uuid.UUID, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> SolicitacaoHemocentro:
    solicitacao = _carregar_com_itens(db, solicitacao_id, unidade_hospitalar_id)
    if solicitacao.status != StatusSolicitacaoHemocentro.SOLICITADA:
        raise HTTPException(status.HTTP_409_CONFLICT, "Só é possível marcar como enviada uma solicitação SOLICITADA.")
    solicitacao.status = StatusSolicitacaoHemocentro.ENVIADA
    solicitacao.data_envio = utcnow()
    solicitacao.updated_by = actor_id
    solicitacao.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="solicitacao_hemocentro_status", entidade_id=solicitacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id, detalhes={"novo_status": solicitacao.status},
    )
    db.commit()
    db.refresh(solicitacao)
    return solicitacao


def receber(
    db: Session,
    solicitacao_id: uuid.UUID,
    payload: ReceberSolicitacaoHemocentroRequest,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> SolicitacaoHemocentro:
    """Fecha o ciclo: ao marcar como recebida, as bolsas chegadas já entram
    no estoque (UnidadeHemocomponente), marcadas com esta solicitação como
    origem — sem precisar lançar duas vezes."""
    solicitacao = _carregar_com_itens(db, solicitacao_id, unidade_hospitalar_id)
    if solicitacao.status not in (StatusSolicitacaoHemocentro.SOLICITADA, StatusSolicitacaoHemocentro.ENVIADA):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Só é possível receber uma solicitação SOLICITADA ou ENVIADA."
        )

    for bolsa_recebida in payload.bolsas:
        get_parametrizacao_item(db, Hemocomponente, bolsa_recebida.hemocomponente_id, unidade_hospitalar_id)
        db.add(UnidadeHemocomponente(
            hemocomponente_id=bolsa_recebida.hemocomponente_id,
            numero_bolsa=bolsa_recebida.numero_bolsa,
            numero_macarrao=bolsa_recebida.numero_macarrao,
            tipo_sanguineo=bolsa_recebida.tipo_sanguineo,
            data_coleta=bolsa_recebida.data_coleta,
            data_validade=bolsa_recebida.data_validade,
            status=StatusHemocomponente.DISPONIVEL,
            solicitacao_hemocentro_id=solicitacao.id,
            unidade_hospitalar_id=unidade_hospitalar_id,
            created_by=actor_id, updated_by=actor_id,
        ))

    solicitacao.status = StatusSolicitacaoHemocentro.RECEBIDA
    solicitacao.data_recebimento = utcnow()
    solicitacao.updated_by = actor_id
    solicitacao.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="solicitacao_hemocentro_status", entidade_id=solicitacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"novo_status": solicitacao.status, "bolsas_recebidas": len(payload.bolsas)},
    )
    db.commit()
    return _carregar_com_itens(db, solicitacao.id, unidade_hospitalar_id)


def cancelar(
    db: Session,
    solicitacao_id: uuid.UUID,
    payload: CancelarSolicitacaoHemocentroRequest,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> SolicitacaoHemocentro:
    solicitacao = _carregar_com_itens(db, solicitacao_id, unidade_hospitalar_id)
    if solicitacao.status == StatusSolicitacaoHemocentro.RECEBIDA:
        raise HTTPException(status.HTTP_409_CONFLICT, "Uma solicitação já RECEBIDA não pode ser cancelada.")
    solicitacao.status = StatusSolicitacaoHemocentro.CANCELADA
    solicitacao.observacoes = f"{solicitacao.observacoes or ''}\nCancelada: {payload.motivo}".strip()
    solicitacao.updated_by = actor_id
    solicitacao.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="solicitacao_hemocentro_status", entidade_id=solicitacao.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"novo_status": solicitacao.status, "motivo": payload.motivo},
    )
    db.commit()
    db.refresh(solicitacao)
    return solicitacao
