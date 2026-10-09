"""
HemoGest — Service de Solicitação Transfusional (painel de solicitações).
Transições válidas: SOLICITADO -> EM_PROCESSAMENTO -> ENTREGUE. Dentro de
EM_PROCESSAMENTO, registrar_bolsa() registra UMA bolsa de cada vez (ABO/Rh
do paciente — só na primeira bolsa —, dados da bolsa digitados pelo
hemoterapeuta — sem controle de estoque — e a compatibilidade, ver
compatibilidade_abo), gerando a Folha de Hemotransfusão daquela bolsa.
Enquanto o número de bolsas registradas for menor que `quantidade`, a
solicitação está "parcial". entregar() só libera quando todas as bolsas
pedidas já tiverem sido registradas.
"""
import uuid
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
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
from app.models.usuario import Usuario
from app.schemas.solicitacao_transfusional import (
    CancelarSolicitacaoRequest,
    EntregarBolsaRequest,
    RegistrarBolsaRequest,
    SolicitacaoCreate,
)
from app.services import internacao_service, parametrizacao_service, setor_service
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


def registrar_bolsa(
    db: Session,
    solicitacao_id: uuid.UUID,
    payload: RegistrarBolsaRequest,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
    hoje: date | None = None,
) -> tuple[SolicitacaoTransfusional, SolicitacaoBolsa]:
    """Registra UMA bolsa pra solicitação, gerando a Folha de Hemotransfusão
    dela — confere ABO/Rh e compatibilidade com o paciente antes de liberar.
    Pode ser chamado várias vezes, uma por bolsa, até completar `quantidade`
    (2026-10-01, pedido do cliente: bolsas podem chegar em dias diferentes)."""
    item = get_solicitacao(db, solicitacao_id, unidade_hospitalar_id)
    if item.status != StatusSolicitacao.EM_PROCESSAMENTO:
        raise HTTPException(status.HTTP_409_CONFLICT, "Só é possível registrar bolsa de solicitação EM_PROCESSAMENTO.")
    atuais = bolsas_da_solicitacao(db, item.id)
    if len(atuais) >= item.quantidade:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Todas as {item.quantidade} bolsa(s) pedida(s) já foram registradas.",
        )
    # O mesmo número de bolsa pode aparecer mais de uma vez — ela pode ser
    # alicotada pro mesmo paciente ou pra pacientes distintos (2026-10-01,
    # pedido do cliente), não é uma chave única.
    numero = payload.numero_bolsa.strip().upper()
    if item.abo_paciente is not None and item.abo_paciente != payload.abo_paciente:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"ABO/Rh do paciente já registrado como {item.abo_paciente} na primeira bolsa; não pode mudar.",
        )
    if (
        item.pesquisa_anticorpos_irregulares is not None
        and item.pesquisa_anticorpos_irregulares != payload.pesquisa_anticorpos_irregulares
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"PAI do paciente já registrado como {item.pesquisa_anticorpos_irregulares} na primeira bolsa; não pode mudar.",
        )

    hemocomponente = parametrizacao_service.get_item(db, Hemocomponente, item.hemocomponente_id, unidade_hospitalar_id)
    tipo = tipo_por_sigla(hemocomponente.sigla)
    if tipo == TipoComponente.HEMACIAS and payload.prova_cruzada != "COMPATIVEL":
        raise HTTPException(status.HTTP_409_CONFLICT, "Concentrado de hemácias exige prova cruzada COMPATÍVEL.")
    if payload.prova_cruzada == "INCOMPATIVEL":
        raise HTTPException(status.HTTP_409_CONFLICT, "Prova cruzada incompatível: a bolsa não pode ser liberada.")

    hoje = hoje or date.today()
    if payload.data_validade < hoje:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa {payload.numero_bolsa} está vencida.")

    # Incompatibilidade de verdade (ABO cruzado) continua travando — só a
    # ressalva (ex.: Rh+ pra Rh-, plaquetas não isogrupo) não exige mais
    # autorização de médico hemoterapeuta pra liberar: não tem esse médico
    # presente aqui pra aprovar nada (2026-10-01, pedido do cliente).
    resultado, mensagem = avaliar(tipo, payload.tipo_sanguineo, payload.abo_paciente)
    if resultado == ResultadoCompatibilidade.INCOMPATIVEL:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Bolsa {payload.numero_bolsa}: {mensagem}")
    ressalva = resultado == ResultadoCompatibilidade.RESSALVA

    agora = utcnow()
    bolsa = SolicitacaoBolsa(
        solicitacao_id=item.id,
        numero_bolsa=numero,
        tipo_sanguineo=payload.tipo_sanguineo,
        data_validade=payload.data_validade,
        volume_ml=payload.volume_ml,
        prova_cruzada=payload.prova_cruzada or "NAO_SE_APLICA",
        liberacao_com_ressalva=ressalva,
        responsavel_testes=payload.responsavel_testes.strip(),
        folha_emitida_em=agora,
        folha_emitida_por=actor_id,
    )
    db.add(bolsa)
    if item.abo_paciente is None:
        item.abo_paciente = payload.abo_paciente
    if item.pesquisa_anticorpos_irregulares is None:
        item.pesquisa_anticorpos_irregulares = payload.pesquisa_anticorpos_irregulares
    item.updated_by = actor_id
    item.updated_at = agora
    db.flush()

    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="solicitacao_bolsa", entidade_id=bolsa.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"solicitacao_id": str(item.id), "numero_bolsa": numero, "ressalva": ressalva},
    )
    db.commit()
    db.refresh(item)
    db.refresh(bolsa)
    return item, bolsa


def entregar_bolsa(
    db: Session,
    solicitacao_id: uuid.UUID,
    bolsa_id: uuid.UUID,
    payload: EntregarBolsaRequest,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> tuple[SolicitacaoTransfusional, SolicitacaoBolsa]:
    """Registra o recebimento físico de UMA bolsa já registrada —
    independente das outras bolsas da mesma solicitação (2026-10-01,
    pedido do cliente: "posso entregar uma bolsa primeiro e a segunda
    depois"). Quando a última bolsa pedida é entregue, a solicitação vira
    ENTREGUE sozinha."""
    item = get_solicitacao(db, solicitacao_id, unidade_hospitalar_id)
    if item.status != StatusSolicitacao.EM_PROCESSAMENTO:
        raise HTTPException(status.HTTP_409_CONFLICT, "Só é possível registrar entrega de solicitação EM_PROCESSAMENTO.")
    bolsa = db.get(SolicitacaoBolsa, bolsa_id)
    if bolsa is None or bolsa.solicitacao_id != item.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bolsa não encontrada nesta solicitação.")
    if bolsa.entregue_em is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Essa bolsa já foi entregue.")

    agora = utcnow()
    bolsa.temperatura_transporte_c = payload.temperatura_transporte_c
    bolsa.recebido_por = payload.recebido_por
    bolsa.observacoes_entrega = payload.observacoes
    bolsa.entregue_em = agora
    bolsa.entregue_por = actor_id
    db.flush()

    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="solicitacao_bolsa_entrega", entidade_id=bolsa.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"solicitacao_id": str(item.id), "numero_bolsa": bolsa.numero_bolsa},
    )

    todas = bolsas_da_solicitacao(db, item.id)
    if len(todas) >= item.quantidade and all(b.entregue_em is not None for b in todas):
        item.status = StatusSolicitacao.ENTREGUE
        item.data_entrega = agora
        item.updated_by = actor_id
        item.updated_at = agora
        db.flush()
        registrar_auditoria(
            db, acao=AcaoAuditoria.EDICAO, entidade="solicitacao_transfusional_status", entidade_id=item.id,
            usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id, detalhes={"novo_status": item.status},
        )

    db.commit()
    db.refresh(item)
    db.refresh(bolsa)
    return item, bolsa


def cancelar(
    db: Session,
    solicitacao_id: uuid.UUID,
    payload: CancelarSolicitacaoRequest,
    *,
    unidade_hospitalar_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> SolicitacaoTransfusional:
    """Cancela a solicitação — erro de digitação do médico ou suspensão da
    transfusão (2026-10-01, pedido do cliente). Só antes de ENTREGUE; bolsas
    já entregues antes do cancelamento continuam registradas (fato
    histórico, a entrega em si não é desfeita)."""
    item = get_solicitacao(db, solicitacao_id, unidade_hospitalar_id)
    if item.status not in (StatusSolicitacao.SOLICITADO, StatusSolicitacao.EM_PROCESSAMENTO):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Só é possível cancelar uma solicitação Solicitada ou Em processamento.",
        )
    item.status = StatusSolicitacao.CANCELADO
    item.motivo_cancelamento = payload.motivo
    item.cancelado_em = utcnow()
    item.cancelado_por = actor_id
    item.updated_by = actor_id
    item.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="solicitacao_transfusional_status", entidade_id=item.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"novo_status": item.status, "motivo": payload.motivo},
    )
    db.commit()
    db.refresh(item)
    return item


def bolsas_da_solicitacao(db: Session, solicitacao_id: uuid.UUID) -> list[SolicitacaoBolsa]:
    stmt = (
        select(SolicitacaoBolsa)
        .where(SolicitacaoBolsa.solicitacao_id == solicitacao_id)
        .order_by(SolicitacaoBolsa.folha_emitida_em)
    )
    return list(db.scalars(stmt))


def montar_saida(db: Session, itens: list[SolicitacaoTransfusional], *, com_bolsas: bool = False) -> list[dict]:
    """Enriquece as solicitações com nomes de paciente, setor e hemocomponente
    (uma query por tabela, não uma por linha)."""
    if not itens:
        return []
    ids = {i.id for i in itens}
    pacientes = {p.id: p for p in db.scalars(select(Paciente).where(Paciente.id.in_({i.paciente_id for i in itens})))}
    setores = {s.id: s for s in db.scalars(select(Setor).where(Setor.id.in_({i.setor_solicitante_id for i in itens})))}
    hemos = {
        h.id: h for h in db.scalars(select(Hemocomponente).where(Hemocomponente.id.in_({i.hemocomponente_id for i in itens})))
    }
    contagens = dict(
        db.execute(
            select(SolicitacaoBolsa.solicitacao_id, func.count())
            .where(SolicitacaoBolsa.solicitacao_id.in_(ids))
            .group_by(SolicitacaoBolsa.solicitacao_id)
        ).all()
    )
    entregas = dict(
        db.execute(
            select(SolicitacaoBolsa.solicitacao_id, func.count())
            .where(SolicitacaoBolsa.solicitacao_id.in_(ids))
            .where(SolicitacaoBolsa.entregue_em.isnot(None))
            .group_by(SolicitacaoBolsa.solicitacao_id)
        ).all()
    )
    canceladores: dict[uuid.UUID, Usuario] = {}
    ids_cancelado_por = {i.cancelado_por for i in itens if i.cancelado_por}
    if ids_cancelado_por:
        canceladores = {u.id: u for u in db.scalars(select(Usuario).where(Usuario.id.in_(ids_cancelado_por)))}

    bolsas_por_item: dict[uuid.UUID, list[SolicitacaoBolsa]] = {}
    usuarios: dict[uuid.UUID, Usuario] = {}
    if com_bolsas:
        todas_bolsas = list(
            db.scalars(
                select(SolicitacaoBolsa).where(SolicitacaoBolsa.solicitacao_id.in_(ids)).order_by(SolicitacaoBolsa.folha_emitida_em)
            )
        )
        for b in todas_bolsas:
            bolsas_por_item.setdefault(b.solicitacao_id, []).append(b)
        usuario_ids = {b.folha_emitida_por for b in todas_bolsas} | {b.entregue_por for b in todas_bolsas if b.entregue_por}
        if usuario_ids:
            usuarios = {u.id: u for u in db.scalars(select(Usuario).where(Usuario.id.in_(usuario_ids)))}

    saida = []
    for i in itens:
        paciente, setor, hemo = pacientes.get(i.paciente_id), setores.get(i.setor_solicitante_id), hemos.get(i.hemocomponente_id)
        dados = {c.key: getattr(i, c.key) for c in SolicitacaoTransfusional.__table__.columns}
        dados.update(
            paciente_nome=paciente.nome if paciente else "—",
            setor_nome=setor.nome if setor else "—",
            hemocomponente_nome=hemo.nome if hemo else "—",
            hemocomponente_sigla=hemo.sigla if hemo else None,
            bolsas_registradas=contagens.get(i.id, 0),
            bolsas_entregues=entregas.get(i.id, 0),
            cancelado_por_nome=canceladores[i.cancelado_por].nome if i.cancelado_por in canceladores else None,
            bolsas=[
                {
                    "id": b.id, "numero_bolsa": b.numero_bolsa, "tipo_sanguineo": b.tipo_sanguineo,
                    "data_validade": b.data_validade, "volume_ml": b.volume_ml,
                    "prova_cruzada": b.prova_cruzada, "liberacao_com_ressalva": b.liberacao_com_ressalva,
                    "responsavel_testes": b.responsavel_testes,
                    "folha_emitida_em": b.folha_emitida_em,
                    "folha_emitida_por_nome": usuarios[b.folha_emitida_por].nome if b.folha_emitida_por in usuarios else None,
                    "temperatura_transporte_c": float(b.temperatura_transporte_c) if b.temperatura_transporte_c is not None else None,
                    "recebido_por": b.recebido_por,
                    "observacoes_entrega": b.observacoes_entrega,
                    "entregue_em": b.entregue_em,
                    "entregue_por_nome": usuarios[b.entregue_por].nome if b.entregue_por in usuarios else None,
                }
                for b in bolsas_por_item.get(i.id, [])
            ] if com_bolsas else [],
        )
        saida.append(dados)
    return saida
