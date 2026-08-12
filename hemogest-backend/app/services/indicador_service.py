"""
HemoGest — Service de Indicadores (Fase 12).
KPIs calculados sobre uma janela de tempo (padrão: últimos 30 dias).
"""
import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.acompanhamento_transfusional import AcompanhamentoTransfusional, StatusAcompanhamento
from app.models.devolucao_descarte import Descarte, Devolucao
from app.models.reacao_transfusional import ReacaoTransfusional
from app.models.unidade_hemocomponente import UnidadeHemocomponente


def indicadores(db: Session, unidade_hospitalar_id: uuid.UUID, dias: int = 30) -> dict:
    inicio = date.today() - timedelta(days=dias)

    total_transfusoes = db.scalar(
        select(func.count(AcompanhamentoTransfusional.id))
        .where(AcompanhamentoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(AcompanhamentoTransfusional.status == StatusAcompanhamento.FINALIZADO)
        .where(func.date(AcompanhamentoTransfusional.data_fim) >= inicio)
    ) or 0

    total_bolsas_cadastradas = db.scalar(
        select(func.count(UnidadeHemocomponente.id))
        .where(UnidadeHemocomponente.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(func.date(UnidadeHemocomponente.created_at) >= inicio)
    ) or 0

    total_descartes = db.scalar(
        select(func.count(Descarte.id))
        .where(Descarte.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(func.date(Descarte.data_descarte) >= inicio)
    ) or 0

    total_devolucoes = db.scalar(
        select(func.count(Devolucao.id))
        .where(Devolucao.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(func.date(Devolucao.data_devolucao) >= inicio)
    ) or 0

    total_reacoes = db.scalar(
        select(func.count(ReacaoTransfusional.id))
        .where(ReacaoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(func.date(ReacaoTransfusional.data_abertura) >= inicio)
    ) or 0

    taxa_descarte = round(total_descartes / total_bolsas_cadastradas, 4) if total_bolsas_cadastradas else 0.0
    taxa_devolucao = round(total_devolucoes / total_bolsas_cadastradas, 4) if total_bolsas_cadastradas else 0.0
    taxa_reacao_por_transfusao = round(total_reacoes / total_transfusoes, 4) if total_transfusoes else 0.0

    return {
        "periodo_dias": dias,
        "assistenciais": {
            "total_transfusoes_finalizadas": total_transfusoes,
        },
        "operacionais": {
            "total_bolsas_cadastradas": total_bolsas_cadastradas,
            "total_descartes": total_descartes,
            "total_devolucoes": total_devolucoes,
            "taxa_descarte": taxa_descarte,
            "taxa_devolucao": taxa_devolucao,
        },
        "qualidade": {
            "total_reacoes": total_reacoes,
            "taxa_reacao_por_transfusao": taxa_reacao_por_transfusao,
        },
    }
