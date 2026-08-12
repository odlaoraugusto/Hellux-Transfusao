"""
HemoGest — Service de Unidade de Hemocomponente (a bolsa física).
Transições de status válidas (SRS §Regras de Negócio — Fluxo assistencial):
  DISPONIVEL -> RESERVADO -> TRANSFUNDIDO
  DISPONIVEL -> RESERVADO -> DEVOLVIDO   (via módulo Devoluções, Fase 8)
  DISPONIVEL -> DESCARTADO               (via módulo Descartes, Fase 8)
Qualquer outra transição é rejeitada aqui; os módulos de Devolução/Descarte
chamam `forcar_status` internamente após validar suas próprias regras.
"""
import string
import uuid
from datetime import date

from fastapi import HTTPException, status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.unidade_hemocomponente import StatusHemocomponente, UnidadeHemocomponente
from app.schemas.unidade_hemocomponente import UnidadeHemocomponenteCreate


def search(
    db: Session,
    unidade_hospitalar_id: uuid.UUID,
    *,
    status_filtro: str | None = None,
    hemocomponente_id: uuid.UUID | None = None,
    numero_bolsa: str | None = None,
    validade_ate: date | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[UnidadeHemocomponente]:
    stmt = (
        select(UnidadeHemocomponente)
        .where(UnidadeHemocomponente.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(UnidadeHemocomponente.deleted_at.is_(None))
    )
    if status_filtro:
        stmt = stmt.where(UnidadeHemocomponente.status == status_filtro)
    if hemocomponente_id:
        stmt = stmt.where(UnidadeHemocomponente.hemocomponente_id == hemocomponente_id)
    if numero_bolsa:
        stmt = stmt.where(UnidadeHemocomponente.numero_bolsa == numero_bolsa)
    if validade_ate:
        stmt = stmt.where(UnidadeHemocomponente.data_validade <= validade_ate)
    stmt = stmt.order_by(UnidadeHemocomponente.data_validade).limit(limit).offset(offset)
    return list(db.scalars(stmt))


def get_bolsa(db: Session, bolsa_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> UnidadeHemocomponente:
    bolsa = db.get(UnidadeHemocomponente, bolsa_id)
    if (
        bolsa is None
        or bolsa.deleted_at is not None
        or bolsa.unidade_hospitalar_id != unidade_hospitalar_id
    ):
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Bolsa de hemocomponente não encontrada.")
    return bolsa


def create_bolsa(
    db: Session, payload: UnidadeHemocomponenteCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> UnidadeHemocomponente:
    bolsa = UnidadeHemocomponente(
        **payload.model_dump(),
        status=StatusHemocomponente.DISPONIVEL,
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(bolsa)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="unidade_hemocomponente", entidade_id=bolsa.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(bolsa)
    return bolsa


def fracionar(
    db: Session, bolsa_id: uuid.UUID, quantidade_fracoes: int, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> list[UnidadeHemocomponente]:
    """Fraciona uma bolsa-mãe DISPONÍVEL em N bolsas satélites (A, B, C...).
    A bolsa-mãe original é consumida (vira indisponível) e as satélites
    herdam número, tipo, validade e tipo sanguíneo."""
    mae = get_bolsa(db, bolsa_id, unidade_hospitalar_id)
    if mae.status != StatusHemocomponente.DISPONIVEL:
        raise HTTPException(http_status.HTTP_409_CONFLICT, "Só é possível fracionar bolsa DISPONÍVEL.")
    if mae.codigo_satelite is not None:
        raise HTTPException(http_status.HTTP_409_CONFLICT, "Uma bolsa satélite não pode ser refracionada.")
    if quantidade_fracoes > len(string.ascii_uppercase):
        raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Quantidade de frações excede o limite de sufixos disponíveis.")

    satelites = []
    for letra in string.ascii_uppercase[:quantidade_fracoes]:
        satelite = UnidadeHemocomponente(
            hemocomponente_id=mae.hemocomponente_id,
            numero_bolsa=mae.numero_bolsa,
            codigo_satelite=letra,
            bolsa_mae_id=mae.id,
            tipo_sanguineo=mae.tipo_sanguineo,
            data_coleta=mae.data_coleta,
            data_validade=mae.data_validade,
            status=StatusHemocomponente.DISPONIVEL,
            unidade_hospitalar_id=unidade_hospitalar_id,
            created_by=actor_id,
            updated_by=actor_id,
        )
        db.add(satelite)
        satelites.append(satelite)

    # Bolsa-mãe original deixa de estar disponível isoladamente — seu
    # conteúdo agora existe apenas através das satélites.
    mae.status = StatusHemocomponente.TRANSFUNDIDO  # reaproveita o enum: "consumida" pelo fracionamento
    mae.updated_by = actor_id
    mae.updated_at = utcnow()
    db.flush()

    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="unidade_hemocomponente_fracionamento", entidade_id=mae.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"quantidade_fracoes": quantidade_fracoes},
    )
    db.commit()
    for s in satelites:
        db.refresh(s)
    return satelites


def reservar(
    db: Session, bolsa_id: uuid.UUID, paciente_id: uuid.UUID, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> UnidadeHemocomponente:
    bolsa = get_bolsa(db, bolsa_id, unidade_hospitalar_id)
    if bolsa.status != StatusHemocomponente.DISPONIVEL:
        raise HTTPException(http_status.HTTP_409_CONFLICT, "Só é possível reservar bolsa DISPONÍVEL.")
    bolsa.status = StatusHemocomponente.RESERVADO
    bolsa.paciente_reservado_id = paciente_id
    bolsa.updated_by = actor_id
    bolsa.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="unidade_hemocomponente_status", entidade_id=bolsa.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id, detalhes={"novo_status": "RESERVADO"},
    )
    db.commit()
    db.refresh(bolsa)
    return bolsa


def forcar_status(
    db: Session, bolsa_id: uuid.UUID, novo_status: str, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> UnidadeHemocomponente:
    """Usado internamente pelos services de Transfusão, Devolução e
    Descarte, que já validaram suas próprias regras de transição."""
    bolsa = get_bolsa(db, bolsa_id, unidade_hospitalar_id)
    bolsa.status = novo_status
    bolsa.updated_by = actor_id
    bolsa.updated_at = utcnow()
    db.flush()
    return bolsa
