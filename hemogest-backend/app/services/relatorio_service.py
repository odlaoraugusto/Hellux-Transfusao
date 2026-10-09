"""
HemoGest — Service de Relatórios (Fase 11).
Cada relatório retorna uma lista de dicts (JSON direto) ou, se format=csv,
um CSV gerado com o módulo `csv` da stdlib — sem depender de libs externas
que não pudemos instalar/validar neste ambiente (ex: openpyxl, reportlab).
Exportação real em .xlsx/.pdf fica como TODO explícito: dá pra plugar
`openpyxl`/`reportlab` depois sem mudar a assinatura dos services abaixo,
bastando trocar a camada de serialização no router.
"""
import csv
import io
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.acompanhamento_transfusional import AcompanhamentoTransfusional
from app.models.audit_log import AuditLog
from app.models.devolucao_descarte import Descarte, Devolucao
from app.models.internacao import Internacao
from app.models.paciente import Paciente
from app.models.parametrizacao import Hemocomponente
from app.models.reacao_transfusional import ReacaoTransfusional
from app.models.setor import Setor
from app.models.solicitacao_transfusional import SolicitacaoBolsa, SolicitacaoTransfusional
from app.models.unidade_hemocomponente import UnidadeHemocomponente


def _filtrar_periodo(stmt, coluna, data_inicio: date | None, data_fim: date | None):
    if data_inicio:
        stmt = stmt.where(coluna >= data_inicio)
    if data_fim:
        stmt = stmt.where(coluna <= data_fim)
    return stmt


def relatorio_pacientes(db: Session, unidade_hospitalar_id: uuid.UUID) -> list[dict]:
    stmt = select(Paciente).where(Paciente.unidade_hospitalar_id == unidade_hospitalar_id).where(Paciente.deleted_at.is_(None))
    return [
        {"id": str(p.id), "nome": p.nome, "cpf": p.cpf, "numero_prontuario": p.numero_prontuario, "tipo_sanguineo": p.tipo_sanguineo}
        for p in db.scalars(stmt)
    ]


def relatorio_internacoes(db: Session, unidade_hospitalar_id: uuid.UUID, data_inicio: date | None, data_fim: date | None) -> list[dict]:
    stmt = select(Internacao).where(Internacao.unidade_hospitalar_id == unidade_hospitalar_id).where(Internacao.deleted_at.is_(None))
    stmt = _filtrar_periodo(stmt, Internacao.data_entrada, data_inicio, data_fim)
    return [
        {
            "id": str(i.id), "paciente_id": str(i.paciente_id), "numero_internacao": i.numero_internacao,
            "data_entrada": i.data_entrada.isoformat(), "data_alta": i.data_alta.isoformat() if i.data_alta else None,
            "status": i.status,
        }
        for i in db.scalars(stmt)
    ]


def relatorio_hemocomponentes(db: Session, unidade_hospitalar_id: uuid.UUID, status_filtro: str | None) -> list[dict]:
    stmt = select(UnidadeHemocomponente).where(UnidadeHemocomponente.unidade_hospitalar_id == unidade_hospitalar_id)
    if status_filtro:
        stmt = stmt.where(UnidadeHemocomponente.status == status_filtro)
    return [
        {
            "id": str(u.id), "numero_bolsa": u.numero_bolsa, "codigo_satelite": u.codigo_satelite,
            "status": u.status, "data_validade": u.data_validade.isoformat(), "tipo_sanguineo": u.tipo_sanguineo,
        }
        for u in db.scalars(stmt)
    ]


def relatorio_transfusoes(db: Session, unidade_hospitalar_id: uuid.UUID, data_inicio: date | None, data_fim: date | None) -> list[dict]:
    stmt = select(AcompanhamentoTransfusional).where(AcompanhamentoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
    stmt = _filtrar_periodo(stmt, AcompanhamentoTransfusional.data_inicio, data_inicio, data_fim)
    itens = list(db.scalars(stmt))
    if not itens:
        return []

    solicitacoes = {
        s.id: s for s in db.scalars(
            select(SolicitacaoTransfusional).where(SolicitacaoTransfusional.id.in_({a.solicitacao_id for a in itens}))
        )
    }
    pacientes = {p.id: p for p in db.scalars(select(Paciente).where(Paciente.id.in_({s.paciente_id for s in solicitacoes.values()})))}
    setores = {s.id: s for s in db.scalars(select(Setor).where(Setor.id.in_({s.setor_solicitante_id for s in solicitacoes.values()})))}
    hemos = {
        h.id: h for h in db.scalars(select(Hemocomponente).where(Hemocomponente.id.in_({s.hemocomponente_id for s in solicitacoes.values()})))
    }
    bolsas_por_solicitacao: dict[uuid.UUID, list[SolicitacaoBolsa]] = {}
    for b in db.scalars(select(SolicitacaoBolsa).where(SolicitacaoBolsa.solicitacao_id.in_(solicitacoes.keys())).order_by(SolicitacaoBolsa.numero_bolsa)):
        bolsas_por_solicitacao.setdefault(b.solicitacao_id, []).append(b)

    saida = []
    for a in itens:
        sol = solicitacoes.get(a.solicitacao_id)
        paciente = pacientes.get(sol.paciente_id) if sol else None
        setor = setores.get(sol.setor_solicitante_id) if sol else None
        hemo = hemos.get(sol.hemocomponente_id) if sol else None
        bolsas = bolsas_por_solicitacao.get(a.solicitacao_id, []) if sol else []
        saida.append(
            {
                "id": str(a.id), "solicitacao_id": str(a.solicitacao_id),
                "paciente_nome": paciente.nome if paciente else "—",
                "abo_paciente": paciente.tipo_sanguineo if paciente else "—",
                "setor_nome": setor.nome if setor else "—",
                "hemocomponente_nome": hemo.nome if hemo else "—",
                "numero_bolsa": ", ".join(b.numero_bolsa for b in bolsas) or "—",
                "abo_bolsa": ", ".join(b.tipo_sanguineo for b in bolsas) or "—",
                "status": a.status, "data_inicio": a.data_inicio.isoformat() if a.data_inicio else None,
                "data_fim": a.data_fim.isoformat() if a.data_fim else None,
            }
        )
    return saida


def relatorio_reacoes(db: Session, unidade_hospitalar_id: uuid.UUID, data_inicio: date | None, data_fim: date | None) -> list[dict]:
    stmt = select(ReacaoTransfusional).where(ReacaoTransfusional.unidade_hospitalar_id == unidade_hospitalar_id)
    stmt = _filtrar_periodo(stmt, ReacaoTransfusional.data_abertura, data_inicio, data_fim)
    return [
        {
            "id": str(r.id), "status": r.status, "tipo_reacao_id": str(r.tipo_reacao_id), "gravidade_id": str(r.gravidade_id),
            "data_abertura": r.data_abertura.isoformat(), "notivisa_numero": r.notivisa_numero,
        }
        for r in db.scalars(stmt)
    ]


def relatorio_devolucoes(db: Session, unidade_hospitalar_id: uuid.UUID, data_inicio: date | None, data_fim: date | None) -> list[dict]:
    stmt = select(Devolucao).where(Devolucao.unidade_hospitalar_id == unidade_hospitalar_id)
    stmt = _filtrar_periodo(stmt, Devolucao.data_devolucao, data_inicio, data_fim)
    return [
        {"id": str(d.id), "unidade_hemocomponente_id": str(d.unidade_hemocomponente_id), "motivo_devolucao_id": str(d.motivo_devolucao_id), "data_devolucao": d.data_devolucao.isoformat()}
        for d in db.scalars(stmt)
    ]


def relatorio_descartes(db: Session, unidade_hospitalar_id: uuid.UUID, data_inicio: date | None, data_fim: date | None) -> list[dict]:
    stmt = select(Descarte).where(Descarte.unidade_hospitalar_id == unidade_hospitalar_id)
    stmt = _filtrar_periodo(stmt, Descarte.data_descarte, data_inicio, data_fim)
    return [
        {"id": str(d.id), "unidade_hemocomponente_id": str(d.unidade_hemocomponente_id), "motivo_descarte_id": str(d.motivo_descarte_id), "data_descarte": d.data_descarte.isoformat()}
        for d in db.scalars(stmt)
    ]


def relatorio_auditoria(db: Session, unidade_hospitalar_id: uuid.UUID, data_inicio: date | None, data_fim: date | None) -> list[dict]:
    stmt = select(AuditLog).where(AuditLog.unidade_hospitalar_id == unidade_hospitalar_id)
    stmt = _filtrar_periodo(stmt, AuditLog.created_at, data_inicio, data_fim)
    stmt = stmt.order_by(AuditLog.created_at.desc()).limit(1000)
    return [
        {"id": str(a.id), "acao": a.acao, "entidade": a.entidade, "usuario_id": str(a.usuario_id) if a.usuario_id else None, "created_at": a.created_at.isoformat()}
        for a in db.scalars(stmt)
    ]


def to_csv(linhas: list[dict]) -> str:
    if not linhas:
        return ""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(linhas[0].keys()))
    writer.writeheader()
    writer.writerows(linhas)
    return buffer.getvalue()
