"""
HemoGest — RBAC.
Duas formas de proteger uma rota:
  - require_roles(*codigos): restringe por perfil fixo
  - require_permission(perm): checa a lista granular `role.permissoes` —
    configurável pela tela Permissões (2026-09-30, pedido do cliente,
    ver PERMISSOES_CONFIGURAVEIS abaixo)
Administrador Global e Supervisor sempre passam, independentemente do que
for exigido — só Biomédico/Técnico têm o acesso de fato controlado pela
matriz configurável (Supervisor é quem a edita, não faz sentido travar o
próprio editor).
"""
from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.role import RoleCodigo

_SEMPRE_LIBERADOS = (RoleCodigo.ADMIN_GLOBAL, RoleCodigo.SUPERVISOR, RoleCodigo.RT)

# Chaves configuráveis pela tela Permissões (só pra Biomédico/Técnico —
# Admin Global e Supervisor sempre têm tudo liberado). Rótulos ficam só no
# frontend (mesmo padrão do projeto irmão Almoxarifado).
PERMISSOES_CONFIGURAVEIS = (
    "pacientes_gerenciar",
    "internacoes_gerenciar",
    "solicitacoes_gerenciar",
    "hemocomponentes_bolsas_gerenciar",
    "acompanhamentos_gerenciar",
    "reacoes_gerenciar",
    "devolucoes_descartes_gerenciar",
    "anexos_gerenciar",
)


def require_roles(*codigos_permitidos: str) -> Callable:
    def _dependency(current_user=Depends(get_current_user)):
        if current_user.role.codigo == RoleCodigo.ADMIN_GLOBAL:
            return current_user
        if current_user.role.codigo not in codigos_permitidos:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Seu perfil não tem permissão para executar esta ação.",
            )
        return current_user

    return _dependency


def require_permission(permissao: str) -> Callable:
    def _dependency(current_user=Depends(get_current_user)):
        if current_user.role.codigo in _SEMPRE_LIBERADOS:
            return current_user
        if permissao not in (current_user.role.permissoes or []):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Seu perfil não possui a permissão '{permissao}'.",
            )
        return current_user

    return _dependency
