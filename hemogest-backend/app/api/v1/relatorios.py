"""
HemoGest — Rotas de Relatórios (Fase 11).
`format=json` (padrão) retorna a lista direto; `format=csv` retorna texto
CSV (`text/csv`). Exportação .xlsx/.pdf fica marcada como TODO no service —
não instalamos/validamos `openpyxl`/`reportlab` neste ambiente sem rede.
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.services import relatorio_service as svc

router = APIRouter(prefix="/relatorios", tags=["Relatórios"])

FormatoRelatorio = Literal["json", "csv"]


def _responder(linhas: list[dict], formato: FormatoRelatorio):
    if formato == "csv":
        return PlainTextResponse(svc.to_csv(linhas), media_type="text/csv")
    return linhas


@router.get("/pacientes")
def pacientes(formato: FormatoRelatorio = Query(default="json", alias="format"), db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)):
    return _responder(svc.relatorio_pacientes(db, ctx.unidade_hospitalar_id), formato)


@router.get("/internacoes")
def internacoes(
    data_inicio: date | None = None, data_fim: date | None = None,
    formato: FormatoRelatorio = Query(default="json", alias="format"),
    db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return _responder(svc.relatorio_internacoes(db, ctx.unidade_hospitalar_id, data_inicio, data_fim), formato)


@router.get("/hemocomponentes")
def hemocomponentes(
    status_filtro: str | None = Query(default=None, alias="status"),
    formato: FormatoRelatorio = Query(default="json", alias="format"),
    db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return _responder(svc.relatorio_hemocomponentes(db, ctx.unidade_hospitalar_id, status_filtro), formato)


@router.get("/transfusoes")
def transfusoes(
    data_inicio: date | None = None, data_fim: date | None = None,
    formato: FormatoRelatorio = Query(default="json", alias="format"),
    db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return _responder(svc.relatorio_transfusoes(db, ctx.unidade_hospitalar_id, data_inicio, data_fim), formato)


@router.get("/reacoes")
def reacoes(
    data_inicio: date | None = None, data_fim: date | None = None,
    formato: FormatoRelatorio = Query(default="json", alias="format"),
    db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return _responder(svc.relatorio_reacoes(db, ctx.unidade_hospitalar_id, data_inicio, data_fim), formato)


@router.get("/devolucoes")
def devolucoes(
    data_inicio: date | None = None, data_fim: date | None = None,
    formato: FormatoRelatorio = Query(default="json", alias="format"),
    db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return _responder(svc.relatorio_devolucoes(db, ctx.unidade_hospitalar_id, data_inicio, data_fim), formato)


@router.get("/descartes")
def descartes(
    data_inicio: date | None = None, data_fim: date | None = None,
    formato: FormatoRelatorio = Query(default="json", alias="format"),
    db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return _responder(svc.relatorio_descartes(db, ctx.unidade_hospitalar_id, data_inicio, data_fim), formato)


@router.get("/auditoria")
def auditoria(
    data_inicio: date | None = None, data_fim: date | None = None,
    formato: FormatoRelatorio = Query(default="json", alias="format"),
    db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return _responder(svc.relatorio_auditoria(db, ctx.unidade_hospitalar_id, data_inicio, data_fim), formato)
