"""
HemoGest — Service de Usuário e Autenticação (Sprint 2.2).
Cobre: CRUD de usuário, login, refresh token (com revogação), logout,
alteração de senha, recuperação de senha e primeiro acesso.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    verify_password,
)
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.role import Role, RoleCodigo
from app.models.usuario import Usuario
from app.schemas.usuario import TokenResponse, UsuarioCreate, UsuarioUpdate

# Perfis que um Supervisor (não Admin Global) pode atribuir a outro usuário.
# Nunca inclui SUPERVISOR/ADMIN_GLOBAL — evita autopromoção ou promoção de
# terceiros a um perfil igual/maior que o do próprio ator.
_ROLES_ATRIBUIVEIS_POR_SUPERVISOR = {RoleCodigo.BIOMEDICO, RoleCodigo.TECNICO}


def _validar_role_atribuivel(db: Session, role_id: uuid.UUID, *, is_admin_global: bool) -> None:
    if is_admin_global:
        return
    role = db.get(Role, role_id)
    if role is None or role.codigo not in _ROLES_ATRIBUIVEIS_POR_SUPERVISOR:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seu perfil só pode atribuir os perfis Biomédico ou Técnico.",
        )

# --- Consultas básicas -------------------------------------------------

def get_user_by_id(db: Session, user_id: str | uuid.UUID) -> Usuario | None:
    try:
        uid = uuid.UUID(str(user_id))
    except ValueError:
        return None
    return db.get(Usuario, uid)


def get_user_by_email(db: Session, email: str) -> Usuario | None:
    return db.scalar(select(Usuario).where(Usuario.email == email.lower()))


def list_users(db: Session, unidade_hospitalar_id: uuid.UUID | None) -> list[Usuario]:
    stmt = select(Usuario).where(Usuario.deleted_at.is_(None))
    if unidade_hospitalar_id is not None:
        stmt = stmt.where(Usuario.unidade_hospitalar_id == unidade_hospitalar_id)
    return list(db.scalars(stmt.order_by(Usuario.nome)))


# --- CRUD ----------------------------------------------------------------

def create_user(db: Session, payload: UsuarioCreate, *, actor: Usuario) -> tuple[Usuario, str]:
    if get_user_by_email(db, payload.email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um usuário com este e-mail.")

    is_admin_global = actor.role.codigo == RoleCodigo.ADMIN_GLOBAL
    _validar_role_atribuivel(db, payload.role_id, is_admin_global=is_admin_global)
    # Supervisor só cria usuário na própria unidade — ignora unidade enviada no payload.
    unidade_hospitalar_id = payload.unidade_hospitalar_id if is_admin_global else actor.unidade_hospitalar_id

    # Senha inicial é uma senha aleatória inutilizável até o primeiro acesso
    # definir a senha real via token de recuperação.
    senha_provisoria = generate_opaque_token()
    usuario = Usuario(
        nome=payload.nome,
        email=payload.email.lower(),
        senha_hash=hash_password(senha_provisoria),
        role_id=payload.role_id,
        unidade_hospitalar_id=unidade_hospitalar_id,
        primeiro_acesso=True,
        created_by=actor.id,
        updated_by=actor.id,
    )
    db.add(usuario)
    db.flush()

    reset_token = _emitir_token_recuperacao(db, usuario)

    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="usuario", entidade_id=usuario.id, usuario_id=actor.id
    )
    db.commit()
    db.refresh(usuario)
    # NOTE (Fase futura): integrar serviço de e-mail. Por ora, o token de
    # primeiro acesso é retornado ao chamador (admin) para envio manual.
    return usuario, reset_token


def update_user(db: Session, user_id: uuid.UUID, payload: UsuarioUpdate, *, actor: Usuario) -> Usuario:
    usuario = get_user_by_id(db, user_id)
    if usuario is None or usuario.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.")

    is_admin_global = actor.role.codigo == RoleCodigo.ADMIN_GLOBAL
    dados = payload.model_dump(exclude_unset=True)
    if not is_admin_global:
        if usuario.unidade_hospitalar_id != actor.unidade_hospitalar_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a este usuário.")
        # O frontend sempre reenvia a unidade atual no payload (implícita para
        # quem não é Admin Global) — só bloqueia se o valor for de fato uma
        # tentativa de mover o usuário para outra unidade.
        if "unidade_hospitalar_id" in dados and dados["unidade_hospitalar_id"] != actor.unidade_hospitalar_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Seu perfil não pode alterar a unidade hospitalar de um usuário."
            )
        if "role_id" in dados:
            _validar_role_atribuivel(db, dados["role_id"], is_admin_global=False)

    for field, value in dados.items():
        setattr(usuario, field, value)
    usuario.updated_by = actor.id
    usuario.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="usuario", entidade_id=usuario.id, usuario_id=actor.id
    )
    db.commit()
    db.refresh(usuario)
    return usuario


def deactivate_user(db: Session, user_id: uuid.UUID, *, actor: Usuario) -> None:
    usuario = get_user_by_id(db, user_id)
    if usuario is None or usuario.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.")
    is_admin_global = actor.role.codigo == RoleCodigo.ADMIN_GLOBAL
    if not is_admin_global and usuario.unidade_hospitalar_id != actor.unidade_hospitalar_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a este usuário.")
    usuario.deleted_at = utcnow()
    usuario.ativo = False
    usuario.updated_by = actor.id
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EXCLUSAO_LOGICA, entidade="usuario", entidade_id=usuario.id, usuario_id=actor.id
    )
    db.commit()


# --- Autenticação ---------------------------------------------------------

def authenticate(db: Session, email: str, senha: str, *, ip_origem: str | None = None) -> TokenResponse:
    usuario = get_user_by_email(db, email)
    senha_ok = usuario is not None and verify_password(senha, usuario.senha_hash)

    if not senha_ok or usuario is None or not usuario.ativo or usuario.deleted_at is not None:
        registrar_auditoria(
            db,
            acao=AcaoAuditoria.LOGIN_FALHOU,
            entidade="usuario",
            usuario_id=usuario.id if usuario else None,
            detalhes={"email": email},
            ip_origem=ip_origem,
        )
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha inválidos.")

    if usuario.primeiro_acesso:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Primeiro acesso: defina sua senha pelo link enviado antes de entrar.",
        )

    tokens = _emitir_par_de_tokens(db, usuario)
    usuario.ultimo_login_em = utcnow()
    registrar_auditoria(
        db, acao=AcaoAuditoria.LOGIN, entidade="usuario", usuario_id=usuario.id,
        unidade_hospitalar_id=usuario.unidade_hospitalar_id, ip_origem=ip_origem,
    )
    db.commit()
    return tokens


def refresh_tokens(db: Session, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("tipo de token inválido")
        user_id = uuid.UUID(payload["sub"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token inválido.") from exc

    token_hash = hash_opaque_token(refresh_token)
    registro = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if registro is None or registro.revogado or registro.expira_em < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token inválido ou revogado.")

    usuario = get_user_by_id(db, user_id)
    if usuario is None or not usuario.ativo or usuario.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário inválido.")

    # Rotação: revoga o antigo e emite um novo par
    registro.revogado = True
    db.flush()
    return _emitir_par_de_tokens(db, usuario)


def logout(db: Session, refresh_token: str, *, actor_id: uuid.UUID) -> None:
    token_hash = hash_opaque_token(refresh_token)
    registro = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if registro is not None:
        registro.revogado = True
        db.flush()
    registrar_auditoria(db, acao=AcaoAuditoria.LOGOUT, entidade="usuario", usuario_id=actor_id)
    db.commit()


def _emitir_par_de_tokens(db: Session, usuario: Usuario) -> TokenResponse:
    access = create_access_token(str(usuario.id), extra_claims={"role": usuario.role.codigo})
    refresh_raw = create_refresh_token(str(usuario.id))
    db.add(
        RefreshToken(
            usuario_id=usuario.id,
            token_hash=hash_opaque_token(refresh_raw),
            expira_em=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    db.flush()
    return TokenResponse(access_token=access, refresh_token=refresh_raw)


# --- Senha: alteração, recuperação e primeiro acesso ----------------------

def change_password(db: Session, usuario: Usuario, senha_atual: str, nova_senha: str) -> None:
    if not verify_password(senha_atual, usuario.senha_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Senha atual incorreta.")
    usuario.senha_hash = hash_password(nova_senha)
    usuario.updated_at = utcnow()
    db.flush()
    registrar_auditoria(db, acao=AcaoAuditoria.EDICAO, entidade="usuario_senha", usuario_id=usuario.id)
    db.commit()


def request_password_reset(db: Session, email: str) -> str | None:
    usuario = get_user_by_email(db, email)
    if usuario is None or usuario.deleted_at is not None:
        # Não revela se o e-mail existe (evita enumeração de usuários)
        return None
    return _emitir_token_recuperacao(db, usuario)


def confirm_password_reset(db: Session, token: str, nova_senha: str) -> None:
    token_hash = hash_opaque_token(token)
    registro = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    if (
        registro is None
        or registro.usado
        or registro.expira_em < datetime.now(timezone.utc)
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token inválido ou expirado.")

    usuario = get_user_by_id(db, registro.usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Usuário não encontrado.")

    usuario.senha_hash = hash_password(nova_senha)
    usuario.primeiro_acesso = False
    usuario.updated_at = utcnow()
    registro.usado = True
    db.flush()
    registrar_auditoria(db, acao=AcaoAuditoria.EDICAO, entidade="usuario_senha", usuario_id=usuario.id)
    db.commit()


def _emitir_token_recuperacao(db: Session, usuario: Usuario) -> str:
    raw = generate_opaque_token()
    db.add(
        PasswordResetToken(
            usuario_id=usuario.id,
            token_hash=hash_opaque_token(raw),
            expira_em=datetime.now(timezone.utc) + timedelta(hours=24),
        )
    )
    db.flush()
    return raw
