"""
HemoGest — Service de Role.
Regra de negócio: os 5 perfis fixos (RoleCodigo) não podem ser excluídos
nem ter o código alterado — apenas nome/descrição/permissões.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.core.permissions import PERMISSOES_CONFIGURAVEIS
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.role import Role, RoleCodigo
from app.schemas.role import RoleCreate, RolePermissoesUpdate, RoleUpdate

ROLES_PROTEGIDAS = {
    RoleCodigo.ADMIN_GLOBAL,
    RoleCodigo.SUPERVISOR,
    RoleCodigo.BIOMEDICO,
    RoleCodigo.TECNICO,
    RoleCodigo.RT,
}

# Só Biomédico/Técnico têm a matriz configurável pela tela Permissões —
# Admin Global e Supervisor sempre têm tudo liberado (ver
# app.core.permissions.require_permission), editar a lista deles não teria
# efeito nenhum, então a rota nem deixa tentar.
ROLES_COM_PERMISSOES_CONFIGURAVEIS = {RoleCodigo.BIOMEDICO, RoleCodigo.TECNICO}


def list_roles(db: Session) -> list[Role]:
    stmt = select(Role).where(Role.deleted_at.is_(None)).order_by(Role.nome_exibicao)
    return list(db.scalars(stmt))


def get_role(db: Session, role_id: uuid.UUID) -> Role:
    role = db.get(Role, role_id)
    if role is None or role.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role não encontrada.")
    return role


def create_role(db: Session, payload: RoleCreate, *, actor_id: uuid.UUID) -> Role:
    codigo = payload.codigo.strip().upper()
    existente = db.scalar(select(Role).where(Role.codigo == codigo))
    if existente is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma role com este código.")

    role = Role(
        codigo=codigo,
        nome_exibicao=payload.nome_exibicao,
        descricao=payload.descricao,
        permissoes=payload.permissoes,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(role)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="role", entidade_id=role.id, usuario_id=actor_id
    )
    db.commit()
    db.refresh(role)
    return role


def update_role(db: Session, role_id: uuid.UUID, payload: RoleUpdate, *, actor_id: uuid.UUID) -> Role:
    role = get_role(db, role_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(role, field, value)
    role.updated_by = actor_id
    role.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="role", entidade_id=role.id, usuario_id=actor_id
    )
    db.commit()
    db.refresh(role)
    return role


def update_permissoes(db: Session, role_id: uuid.UUID, payload: RolePermissoesUpdate, *, actor_id: uuid.UUID) -> Role:
    role = get_role(db, role_id)
    if role.codigo not in ROLES_COM_PERMISSOES_CONFIGURAVEIS:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Só é possível configurar permissões de Biomédico ou Técnico — Admin Global e Supervisor sempre têm tudo liberado.",
        )
    invalidas = [p for p in payload.permissoes if p not in PERMISSOES_CONFIGURAVEIS]
    if invalidas:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Permissão(ões) inválida(s): {', '.join(invalidas)}.")

    role.permissoes = list(dict.fromkeys(payload.permissoes))
    role.updated_by = actor_id
    role.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="role_permissoes", entidade_id=role.id, usuario_id=actor_id,
        detalhes={"permissoes": role.permissoes},
    )
    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role_id: uuid.UUID, *, actor_id: uuid.UUID) -> None:
    role = get_role(db, role_id)
    if role.codigo in ROLES_PROTEGIDAS:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Os 4 perfis fixos da V1 não podem ser excluídos."
        )
    role.deleted_at = utcnow()
    role.updated_by = actor_id
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EXCLUSAO_LOGICA, entidade="role", entidade_id=role.id, usuario_id=actor_id
    )
    db.commit()
