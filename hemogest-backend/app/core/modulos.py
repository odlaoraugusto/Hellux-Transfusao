"""
HemoGest — Guarda de módulo configurável por unidade.
Cada agência transfusional liga/desliga os módulos opcionais conforme seu
fluxo real (estoque, mapa de trabalho pré-transfusional, solicitação ao
hemocentro) — ver app.models.unidade_hospitalar e MODULOS.md. Esta
dependência bloqueia o acesso a um módulo desligado com 403, mesmo que o
perfil do usuário normalmente tivesse a permissão da ação.
"""
from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.unidade_hospitalar import UnidadeHospitalar

CAMPO_POR_MODULO = {
    "estoque": "modulo_estoque_ativo",
    "mapa_trabalho": "modulo_mapa_trabalho_ativo",
    "solicitacao_hemocentro": "modulo_solicitacao_hemocentro_ativo",
}


def require_modulo_ativo(modulo: str) -> Callable:
    campo = CAMPO_POR_MODULO[modulo]

    def _dependency(
        db: Session = Depends(get_db), ctx: TenantContext = Depends(require_unidade_resolvida)
    ) -> TenantContext:
        unidade = db.get(UnidadeHospitalar, ctx.unidade_hospitalar_id)
        if unidade is None or not getattr(unidade, campo):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Este módulo não está ativo para esta unidade hospitalar.",
            )
        return ctx

    return _dependency
