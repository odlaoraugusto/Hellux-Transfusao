"""
HemoGest — Service de Solicitação Transfusional (painel de solicitações).
Transições válidas: SOLICITADO -> EM_PROCESSAMENTO -> ENTREGUE.
Na entrega, cada bolsa informada precisa ser do hemocomponente pedido,
estar DISPONÍVEL (ou já RESERVADA para o mesmo paciente), dentro da
validade e ABO/Rh compatível com o paciente (ver compatibilidade_abo).
As bolsas entregues ficam RESERVADAS para o paciente.
"""
import uuid
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.internacao import StatusInternacao
from app.models.paciente import Paciente
from app.models.parametrizacao import Hemocomponente
from app.models.setor import Setor
from app.models.solicitacao_transfusional import (
    SolicitacaoBolsa,
    SolicitacaoTransfusional,
    StatusSolicitacao,
)
from app.models.unidade_hemocomponente import StatusHemocomponente, UnidadeHemocomponente
from app.schemas.solicitacao_transfusional import SolicitacaoCreate, SolicitacaoEntregaRequest
from app.services import (
    internacao_service,
    parametrizacao_service,
    setor_service,
    unidade_hemocomponente_service,
)
from app.services.compatibilidade_abo import ResultadoCompatibilidade, TipoComponente, avaliar, tipo_por_sigla


def get_solicitacao(db: Session, solicitacao_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> SolicitacaoTransfusional:
    item = db.get(SolicitacaoTransfusional, solicitacao_id)
    if item is None or item.deleted_at is not None or item.unidade_hospitalar_id != unidade_hospitalar_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitação transfusional não encontrada.")
    return item


def search(
    db: Session,
    unidade_hospitalar_id: uuid.UUID,
    *,
    de: datetime | None = None,
    ate: datetime | None = None,
    status_filtro: str | None = None,
    setor_id: uuid.UUID | None = None,
    hemocomponente_id: uuid.UUID | None = None,
    limit: int = 200,
) -> list[SolicitacaoTransfusional]:
    stmt = (
        select(SolicitacaoTransfusional)
        .where(SolicitacaoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(SolicitacaoTransfusional.deleted_at.is_(None))
    )
    if de:
        stmt = stmt.where(SolicitacaoTransfusional.data_solicitacao >= de)
    if ate:
        stmt = stmt.where(SolicitacaoTransfusional.data_solicitacao < ate)
    if status_filtro:
        stmt = stmt.where(SolicitacaoTransfusional.status == status_filtro)
    if setor_id:
        stmt = stmt.where(SolicitacaoTransfusional.setor_solicitante_id == setor_id)
    if hemocomponente_id:
        stmt = stmt.where(SolicitacaoTransfusional.hemocomponente_id == hemocomponente_id)
    stmt = stmt.order_by(SolicitacaoTransfusional.data_solicitacao).limit(limit)
    return list(db.scalars(stmt))


def criar(
    db: Session, payload: SolicitacaoCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> SolicitacaoTransfusional:
    internacao = internacao_service.get_internacao(db, payload.internacao_id, unidade_hospitalar_id)
    if internacao.status != StatusInternacao.ATIVA:
        raise HTTPException(status.HTTP_409_CONFLICT, "Só é possível solicitar hemocomponente para internação ativa.")
    parametrizacao_service.get_item(db, Hemocomponente, payload.hemocomponente_id, unidade_hospitalar_id)
    setor_id = payload.setor_solicitante_id or internacao.setor_atual_id
    setor_service.get_setor(db, setor_id, unidade_hospitalar_id)

    item = SolicitacaoTransfusional(
        internacao_id=internacao.id,
        paciente_id=internacao.paciente_id,
        setor_solicitante_id=setor_id,
        hemocomponente_id=payload.hemocomponente_id,
        quantidade=payload.quantidade,
        prioridade=payload.prioridade,
        indicacao=payload.indicacao,
        medico_solicitante=payload.medico_solicitante,
        status=StatusSolicitacao.SOLICITADO,
        data_solicitacao=utcnow(),
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(item)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="solicitacao_transfusional", entidade_id=item.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(item)
    return item


def iniciar_processamento(
    db: Session, solicitacao_id: uuid.UUID, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> SolicitacaoTransfusional:
    item = get_solicitacao(db, solicitacao_id, unidade_hospitalar_id)
    if item.status != StatusSolicitacao.SOLICITADO:
        raise HTTPException(status.HTTP_409_CONFLICT, "Só é possível iniciar o processamento de solicitação SOLICITADA.")
    item.status = StatusSolicitacao.EM_PROCESSAMENTO
    item.data_inicio_processamento = utcnow()
    item.updated_by = actor_id
    item.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="solicitacao_transfusional_status", entidade_id=item.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id, detalhes={"novo_status": item.status},
    )
    db.commit()
    db.refresh(item)
    return item


def entregar(
    db: Session,
    solicitacao_id: uuid.UUID,
    payload: SolicitacaoEntregaRequest,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
    hoje: date | None = None,
) -> SolicitacaoTransfusional:
    item = get_solicitacao(db, solicitacao_id, unidade_hospitalar_id)
    if item.status != StatusSolicitacao.EM_PROCESSAMENTO:
        raise HTTPException(status.HTTP_409_CONFLICT, "Só é possível registrar entrega de solicitação EM_PROCESSAMENTO.")
    if len(set(payload.bolsas)) != len(payload.bolsas):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A mesma bolsa foi informada mais de uma vez.")
    if len(payload.bolsas) != item.quantidade:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"A solicitação pede {item.quantidade} unidade(s); foram informadas {len(payload.bolsas)} bolsa(s).",
        )

    hemocomponente = parametrizacao_service.get_item(db, Hemocomponente, item.hemocomponente_id, unidade_hospitalar_id)
    tipo = tipo_por_sigla(hemocomponente.sigla)
    if tipo == TipoComponente.HEMACIAS and payload.prova_cruzada != "COMPATIVEL":
        raise HTTPException(status.HTTP_409_CONFLICT, "Concentrado de hemácias exige prova cruzada COMPATÍVEL.")
    if payload.prova_cruzada == "INCOMPATIVEL":
        raise HTTPException(status.HTTP_409_CONFLICT, "Prova cruzada incompatível: a bolsa não pode ser liberada.")

    hoje = hoje or date.today()
    bolsas: list[UnidadeHemocomponente] = []
    com_ressalva: list[str] = []
    for bolsa_id in payload.bolsas:
        bolsa = unidade_hemocomponente_service.get_bolsa(db, bolsa_id, unidade_hospitalar_id)
        rotulo = bolsa.numero_bolsa + (f"-{bolsa.codigo_satelite}" if bolsa.codigo_satelite else "")
        if bolsa.hemocomponente_id != item.hemocomponente_id:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa {rotulo} não é do hemocomponente solicitado.")
        reservada_para_outro = (
            bolsa.status == StatusHemocomponente.RESERVADO and bolsa.paciente_reservado_id != item.paciente_id
        )
        if bolsa.status not in (StatusHemocomponente.DISPONIVEL, StatusHemocomponente.RESERVADO) or reservada_para_outro:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa {rotulo} não está disponível.")
        if bolsa.data_validade < hoje:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa {rotulo} está vencida.")
        if not bolsa.tipo_sanguineo:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa {rotulo} não tem ABO/Rh cadastrado.")

        resultado, mensagem = avaliar(tipo, bolsa.tipo_sanguineo, payload.abo_paciente)
        if resultado == ResultadoCompatibilidade.INCOMPATIVEL:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa {rotulo}: {mensagem}")
        if resultado == ResultadoCompatibilidade.RESSALVA:
            com_ressalva.append(f"{rotulo}: {mensagem}")
        bolsas.append(bolsa)

    if com_ressalva and not payload.autorizacao_ressalva:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Liberação com ressalva exige autorização do médico hemoterapeuta. " + " ".join(com_ressalva),
        )

    agora = utcnow()
    for bolsa in bolsas:
        bolsa.status = StatusHemocomponente.RESERVADO
        bolsa.paciente_reservado_id = item.paciente_id
        bolsa.updated_by = actor_id
        bolsa.updated_at = agora
        db.add(SolicitacaoBolsa(solicitacao_id=item.id, unidade_hemocomponente_id=bolsa.id))

    item.status = StatusSolicitacao.ENTREGUE
    item.data_entrega = agora
    item.abo_paciente = payload.abo_paciente
    item.prova_cruzada = payload.prova_cruzada or "NAO_SE_APLICA"
    item.temperatura_transporte_c = payload.temperatura_transporte_c
    item.recebido_por = payload.recebido_por
    item.entregue_por = actor_id
    item.liberacao_com_ressalva = bool(com_ressalva)
    item.observacoes_entrega = payload.observacoes
    item.updated_by = actor_id
    item.updated_at = agora
    db.flush()

    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="solicitacao_transfusional_entrega", entidade_id=item.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"bolsas": [str(b.id) for b in bolsas], "ressalvas": com_ressalva},
    )
    db.commit()
    db.refresh(item)
    return item


def bolsas_da_solicitacao(db: Session, solicitacao_id: uuid.UUID) -> list[UnidadeHemocomponente]:
    stmt = (
        select(UnidadeHemocomponente)
        .join(SolicitacaoBolsa, SolicitacaoBolsa.unidade_hemocomponente_id == UnidadeHemocomponente.id)
        .where(SolicitacaoBolsa.solicitacao_id == solicitacao_id)
        .order_by(UnidadeHemocomponente.numero_bolsa, UnidadeHemocomponente.codigo_satelite)
    )
    return list(db.scalars(stmt))


def montar_saida(db: Session, itens: list[SolicitacaoTransfusional], *, com_bolsas: bool = False) -> list[dict]:
    """Enriquece as solicitações com nomes de paciente, setor e hemocomponente
    (uma query por tabela, não uma por linha)."""
    if not itens:
        return []
    pacientes = {p.id: p for p in db.scalars(select(Paciente).where(Paciente.id.in_({i.paciente_id for i in itens})))}
    setores = {s.id: s for s in db.scalars(select(Setor).where(Setor.id.in_({i.setor_solicitante_id for i in itens})))}
    hemos = {
        h.id: h for h in db.scalars(select(Hemocomponente).where(Hemocomponente.id.in_({i.hemocomponente_id for i in itens})))
    }
    saida = []
    for i in itens:
        paciente, setor, hemo = pacientes.get(i.paciente_id), setores.get(i.setor_solicitante_id), hemos.get(i.hemocomponente_id)
        dados = {c.key: getattr(i, c.key) for c in SolicitacaoTransfusional.__table__.columns}
        dados.update(
            paciente_nome=paciente.nome if paciente else "—",
            setor_nome=setor.nome if setor else "—",
            hemocomponente_nome=hemo.nome if hemo else "—",
            hemocomponente_sigla=hemo.sigla if hemo else None,
            temperatura_transporte_c=float(i.temperatura_transporte_c) if i.temperatura_transporte_c is not None else None,
            bolsas=[
                {
                    "id": b.id, "numero_bolsa": b.numero_bolsa, "codigo_satelite": b.codigo_satelite,
                    "tipo_sanguineo": b.tipo_sanguineo, "data_validade": b.data_validade,
                }
                for b in bolsas_da_solicitacao(db, i.id)
            ] if com_bolsas else [],
        )
        saida.append(dados)
    return saida
