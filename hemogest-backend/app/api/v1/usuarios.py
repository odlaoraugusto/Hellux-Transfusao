"""
HemoGest — Rotas de Usuário.
Escrita restrita a Supervisor+ (Técnico e Biomédico não gerenciam contas).
Um usuário sem unidade (Admin Global) enxerga todas; os demais só veem
usuários da própria unidade — reforçado no service via tenant context.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_roles
from app.core.tenant import TenantContext, get_tenant_context
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.usuario import UsuarioCreate, UsuarioOut, UsuarioUpdate
from app.services import user_service

router = APIRouter(prefix="/usuarios", tags=["Usuários"])

_pode_escrever = require_roles(RoleCodigo.SUPERVISOR)


@router.get("/me", response_model=UsuarioOut)
def eu(current_user=Depends(get_current_user)):
    return current_user


@router.get("", response_model=list[UsuarioOut])
def listar_usuarios(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
):
    unidade = None if ctx.is_admin_global else ctx.unidade_hospitalar_id
    return user_service.list_users(db, unidade)


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def criar_usuario(payload: UsuarioCreate, db: Session = Depends(get_db), user=Depends(_pode_escrever)):
    usuario, _token_primeiro_acesso = user_service.create_user(db, payload, actor=user)
    # _token_primeiro_acesso deve ser enviado por e-mail (Fase futura);
    # por ora fica disponível ao service para o admin repassar manualmente.
    return usuario


@router.put("/{user_id}", response_model=UsuarioOut)
def atualizar_usuario(
    user_id: uuid.UUID,
    payload: UsuarioUpdate,
    db: Session = Depends(get_db),
    user=Depends(_pode_escrever),
):
    return user_service.update_user(db, user_id, payload, actor=user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def desativar_usuario(user_id: uuid.UUID, db: Session = Depends(get_db), user=Depends(_pode_escrever)):
    user_service.deactivate_user(db, user_id, actor=user)
