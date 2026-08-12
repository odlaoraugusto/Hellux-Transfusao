"""
HemoGest — RBAC (Sprint 2.3).
Duas formas de proteger uma rota:
  - require_roles(*codigos): restringe por perfil fixo (uso mais comum na V1)
  - require_permission(perm): checa a lista granular `role.permissoes`
Administrador Global sempre passa, independentemente do que for exigido.
"""
from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.role import RoleCodigo


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
        if current_user.role.codigo == RoleCodigo.ADMIN_GLOBAL:
            return current_user
        if permissao not in (current_user.role.permissoes or []):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Seu perfil não possui a permissão '{permissao}'.",
            )
        return current_user

    return _dependency
