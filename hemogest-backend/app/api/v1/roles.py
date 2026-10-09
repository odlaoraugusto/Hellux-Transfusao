"""
HemoGest — Rotas de Role (RBAC).
Leitura liberada para Supervisor+ (quem gerencia usuários precisa ver as
roles disponíveis); escrita restrita a Administrador Global.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.db.session import get_db
from app.models.role import RoleCodigo
from app.schemas.role import RoleCreate, RoleOut, RolePermissoesUpdate, RoleUpdate
from app.services import role_service

router = APIRouter(prefix="/roles", tags=["Roles"])

_pode_ler = require_roles(RoleCodigo.SUPERVISOR, RoleCodigo.RT)
_pode_escrever = require_roles()  # nenhum código extra => só ADMIN_GLOBAL passa
# Tela Permissões (2026-09-30, pedido do cliente): Supervisor também edita
# a matriz de Biomédico/Técnico, sem precisar do Admin Global pra isso.
_pode_gerenciar_permissoes = require_roles(RoleCodigo.SUPERVISOR, RoleCodigo.RT)


@router.get("", response_model=list[RoleOut])
def listar_roles(db: Session = Depends(get_db), _user=Depends(_pode_ler)):
    return role_service.list_roles(db)


@router.get("/{role_id}", response_model=RoleOut)
def obter_role(role_id: uuid.UUID, db: Session = Depends(get_db), _user=Depends(_pode_ler)):
    return role_service.get_role(db, role_id)


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def criar_role(payload: RoleCreate, db: Session = Depends(get_db), user=Depends(_pode_escrever)):
    return role_service.create_role(db, payload, actor_id=user.id)


@router.put("/{role_id}", response_model=RoleOut)
def atualizar_role(
    role_id: uuid.UUID,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    user=Depends(_pode_escrever),
):
    return role_service.update_role(db, role_id, payload, actor_id=user.id)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_role(role_id: uuid.UUID, db: Session = Depends(get_db), user=Depends(_pode_escrever)):
    role_service.delete_role(db, role_id, actor_id=user.id)


@router.patch("/{role_id}/permissoes", response_model=RoleOut)
def atualizar_permissoes(
    role_id: uuid.UUID,
    payload: RolePermissoesUpdate,
    db: Session = Depends(get_db),
    user=Depends(_pode_gerenciar_permissoes),
):
    """Tela Permissões — só Biomédico/Técnico têm matriz configurável;
    Admin Global e Supervisor sempre têm tudo liberado (ver
    app.services.role_service.ROLES_COM_PERMISSOES_CONFIGURAVEIS)."""
    return role_service.update_permissoes(db, role_id, payload, actor_id=user.id)
