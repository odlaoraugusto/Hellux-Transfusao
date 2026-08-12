"""
HemoGest — Service do Dashboard (Fase 10).
Só cobre os cards com dado real por trás. Alguns cards do mockup original
("Solicitações pendentes", "Provas cruzadas em andamento") dependem de
módulos ainda não modelados (fila de solicitação de sangue, prova cruzada
laboratorial) — não existem na V1 atual do backend, então ficam de fora
até que esses módulos existam. Sinalizado no Roadmap.
"""
import uuid
from collections import Counter
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.acompanhamento_transfusional import AcompanhamentoTransfusional, StatusAcompanhamento
from app.models.devolucao_descarte import Descarte, Devolucao
from app.models.parametrizacao import Hemocomponente
from app.models.reacao_transfusional import ReacaoTransfusional, StatusReacao
from app.models.unidade_hemocomponente import StatusHemocomponente, UnidadeHemocomponente

ESTOQUE_CRITICO_LIMIAR = 5  # bolsas disponíveis abaixo disso => alerta de estoque crítico
VENCIMENTO_PROXIMO_DIAS = 3


def estoque_por_tipo(db: Session, unidade_hospitalar_id: uuid.UUID) -> list[dict]:
    stmt = (
        select(Hemocomponente.id, Hemocomponente.nome, Hemocomponente.sigla, func.count(UnidadeHemocomponente.id))
        .join(
            UnidadeHemocomponente,
            (UnidadeHemocomponente.hemocomponente_id == Hemocomponente.id)
            & (UnidadeHemocomponente.status == StatusHemocomponente.DISPONIVEL),
            isouter=True,
        )
        .where(Hemocomponente.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(Hemocomponente.deleted_at.is_(None))
        .group_by(Hemocomponente.id, Hemocomponente.nome, Hemocomponente.sigla)
        .order_by(Hemocomponente.nome)
    )
    return [
        {"hemocomponente_id": hid, "nome": nome, "sigla": sigla, "bolsas_disponiveis": qtd}
        for hid, nome, sigla, qtd in db.execute(stmt).all()
    ]


def pendencias(db: Session, unidade_hospitalar_id: uuid.UUID) -> dict:
    transfusoes_em_andamento = db.scalar(
        select(func.count(AcompanhamentoTransfusional.id))
        .where(AcompanhamentoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(AcompanhamentoTransfusional.status == StatusAcompanhamento.EM_ANDAMENTO)
    ) or 0
    reacoes_abertas = db.scalar(
        select(func.count(ReacaoTransfusional.id))
        .where(ReacaoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(ReacaoTransfusional.status.in_([StatusReacao.ABERTA, StatusReacao.INVESTIGACAO]))
    ) or 0
    return {"transfusoes_em_andamento": transfusoes_em_andamento, "reacoes_abertas": reacoes_abertas}


def alertas(db: Session, unidade_hospitalar_id: uuid.UUID) -> dict:
    hoje = date.today()
    bolsas_vencendo = db.scalar(
        select(func.count(UnidadeHemocomponente.id))
        .where(UnidadeHemocomponente.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(UnidadeHemocomponente.status == StatusHemocomponente.DISPONIVEL)
        .where(UnidadeHemocomponente.data_validade <= hoje + timedelta(days=VENCIMENTO_PROXIMO_DIAS))
    ) or 0

    estoque = estoque_por_tipo(db, unidade_hospitalar_id)
    tipos_criticos = [item for item in estoque if item["bolsas_disponiveis"] < ESTOQUE_CRITICO_LIMIAR]

    reacoes_notificadas = db.scalar(
        select(func.count(ReacaoTransfusional.id))
        .where(ReacaoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(ReacaoTransfusional.status == StatusReacao.NOTIVISA)
    ) or 0

    return {
        "bolsas_proximas_vencimento": bolsas_vencendo,
        "tipos_com_estoque_critico": len(tipos_criticos),
        "detalhe_estoque_critico": tipos_criticos,
        "reacoes_notificadas_notivisa": reacoes_notificadas,
    }


def indicadores_diarios(db: Session, unidade_hospitalar_id: uuid.UUID, dias: int = 7) -> list[dict]:
    hoje = date.today()
    inicio = hoje - timedelta(days=dias - 1)

    entradas = Counter()
    for (dt,) in db.execute(
        select(func.date(UnidadeHemocomponente.created_at))
        .where(UnidadeHemocomponente.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(func.date(UnidadeHemocomponente.created_at) >= inicio)
    ).all():
        entradas[dt] += 1

    saidas = Counter()
    for (dt,) in db.execute(
        select(func.date(AcompanhamentoTransfusional.data_fim))
        .where(AcompanhamentoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(AcompanhamentoTransfusional.status == StatusAcompanhamento.FINALIZADO)
        .where(func.date(AcompanhamentoTransfusional.data_fim) >= inicio)
    ).all():
        saidas[dt] += 1

    descartes = Counter()
    for (dt,) in db.execute(
        select(func.date(Descarte.data_descarte))
        .where(Descarte.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(func.date(Descarte.data_descarte) >= inicio)
    ).all():
        descartes[dt] += 1

    retornos = Counter()
    for (dt,) in db.execute(
        select(func.date(Devolucao.data_devolucao))
        .where(Devolucao.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(func.date(Devolucao.data_devolucao) >= inicio)
    ).all():
        retornos[dt] += 1

    resultado = []
    for i in range(dias):
        dia = inicio + timedelta(days=i)
        resultado.append(
            {
                "data": dia.isoformat(),
                "entradas": entradas.get(dia, 0),
                "saidas": saidas.get(dia, 0),
                "descartes": descartes.get(dia, 0),
                "retornos": retornos.get(dia, 0),
            }
        )
    return resultado
