"""
HemoGest — Contexto de Tenant (Unidade Hospitalar).
Regra de negócio congelada (SRS §Regras de Negócio): isolamento total entre
unidades. Toda query assistencial deve ser filtrada por unidade_hospitalar_id,
resolvida a partir do usuário autenticado.

Exceção: Administrador Global não pertence a nenhuma unidade fixa. Quando ele
acessa um endpoint com escopo de unidade (parametrização, setores etc.), a
unidade é resolvida a partir do header `X-Unidade-Id` (settings.DEFAULT_TENANT_HEADER).
Para os demais perfis, o header é ignorado — nunca confiar em input do
cliente para decidir o tenant de quem não é Admin Global.
"""
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import settings


@dataclass
class TenantContext:
    unidade_hospitalar_id: UUID | None
    user_id: UUID
    is_admin_global: bool


def get_tenant_context(
    current_user=Depends(get_current_user),
    x_unidade_id: str | None = Header(default=None, alias=settings.DEFAULT_TENANT_HEADER),
) -> TenantContext:
    if current_user.is_admin_global:
        unidade_id = None
        if x_unidade_id:
            try:
                unidade_id = UUID(x_unidade_id)
            except ValueError as exc:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, f"Header {settings.DEFAULT_TENANT_HEADER} inválido."
                ) from exc
        return TenantContext(unidade_hospitalar_id=unidade_id, user_id=current_user.id, is_admin_global=True)

    if current_user.unidade_hospitalar_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não vinculado a nenhuma unidade hospitalar.",
        )
    return TenantContext(
        unidade_hospitalar_id=current_user.unidade_hospitalar_id,
        user_id=current_user.id,
        is_admin_global=False,
    )


def require_unidade_resolvida(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
    """Para rotas com escopo de unidade (parametrização, setores): garante
    que exista uma unidade resolvida, mesmo para Admin Global (que precisa
    então enviar o header X-Unidade-Id)."""
    if ctx.unidade_hospitalar_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Administrador Global precisa informar o header {settings.DEFAULT_TENANT_HEADER} "
            "para acessar dados de uma unidade específica.",
        )
    return ctx
