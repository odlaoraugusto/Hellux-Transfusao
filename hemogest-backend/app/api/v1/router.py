"""
HemoGest — Router agregador da API v1.
"""
from fastapi import APIRouter

from app.api.v1.acompanhamentos import router as acompanhamentos_router
from app.api.v1.anexos import router as anexos_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.devolucoes_descartes import router as devolucoes_descartes_router
from app.api.v1.formularios_solicitacao import router as formularios_solicitacao_router
from app.api.v1.health import router as health_router
from app.api.v1.indicadores import router as indicadores_router
from app.api.v1.internacoes import router as internacoes_router
from app.api.v1.pacientes import router as pacientes_router
from app.api.v1.parametrizacoes import (
    gravidades_router,
    hemocomponentes_router,
    motivos_devolucao_router,
    tipos_reacao_router,
)
from app.api.v1.publico import router as publico_router
from app.api.v1.reacoes_transfusionais import router as reacoes_router
from app.api.v1.relatorios import router as relatorios_router
from app.api.v1.roles import router as roles_router
from app.api.v1.setores import router as setores_router
from app.api.v1.solicitacoes import router as solicitacoes_router
from app.api.v1.unidades_hemocomponente import router as unidades_hemocomponente_router
from app.api.v1.unidades_hospitalares import router as unidades_router
from app.api.v1.usuarios import router as usuarios_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(publico_router)
api_router.include_router(auth_router)
api_router.include_router(roles_router)
api_router.include_router(usuarios_router)
api_router.include_router(unidades_router)
api_router.include_router(setores_router)
api_router.include_router(hemocomponentes_router)
api_router.include_router(motivos_devolucao_router)
api_router.include_router(tipos_reacao_router)
api_router.include_router(gravidades_router)
api_router.include_router(pacientes_router)
api_router.include_router(internacoes_router)
api_router.include_router(unidades_hemocomponente_router)
api_router.include_router(solicitacoes_router)
api_router.include_router(formularios_solicitacao_router)
api_router.include_router(acompanhamentos_router)
api_router.include_router(reacoes_router)
api_router.include_router(devolucoes_descartes_router)
api_router.include_router(anexos_router)
api_router.include_router(dashboard_router)
api_router.include_router(relatorios_router)
api_router.include_router(indicadores_router)
