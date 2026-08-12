"""
Regressão do achado crítico da auditoria de segurança pré-deploy: um
Supervisor conseguia se autopromover a Admin Global (via role_id arbitrário)
e editar/desativar usuários de outra unidade hospitalar através de
PUT/DELETE /usuarios/{id}. Ver app.services.user_service.
"""
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401 — registra todos os mappers em Base.metadata
from app.core.security import hash_password
from app.db.session import Base
from app.models.role import Role, RoleCodigo
from app.models.unidade_hospitalar import UnidadeHospitalar
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate
from app.services import user_service

# Engine isolado em memória — nunca toca o hemogest.db real de desenvolvimento.
_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
_TestSessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


@pytest.fixture()
def db() -> Session:
    Base.metadata.create_all(_engine)
    session = _TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(_engine)


def _criar_role(db: Session, codigo: str) -> Role:
    role = Role(codigo=codigo, nome_exibicao=codigo, permissoes=[])
    db.add(role)
    db.flush()
    return role


def _criar_unidade(db: Session, nome: str) -> UnidadeHospitalar:
    unidade = UnidadeHospitalar(
        razao_social=nome, nome_fantasia=nome, cnpj=str(uuid.uuid4().int)[:14]
    )
    db.add(unidade)
    db.flush()
    return unidade


def _criar_usuario(db: Session, *, role: Role, unidade: UnidadeHospitalar | None, email: str) -> Usuario:
    usuario = Usuario(
        nome=email, email=email, senha_hash=hash_password("x"), role_id=role.id,
        unidade_hospitalar_id=unidade.id if unidade else None,
    )
    db.add(usuario)
    db.flush()
    return usuario


def test_supervisor_nao_consegue_se_autopromover_a_admin_global(db: Session) -> None:
    admin_role = _criar_role(db, RoleCodigo.ADMIN_GLOBAL)
    supervisor_role = _criar_role(db, RoleCodigo.SUPERVISOR)
    unidade = _criar_unidade(db, "Hospital A")
    supervisor = _criar_usuario(db, role=supervisor_role, unidade=unidade, email="sup@a.com")

    with pytest.raises(HTTPException) as exc:
        user_service.update_user(
            db, supervisor.id, UsuarioUpdate(role_id=admin_role.id), actor=supervisor
        )
    assert exc.value.status_code == 403


def test_supervisor_nao_consegue_promover_terceiro_a_supervisor(db: Session) -> None:
    supervisor_role = _criar_role(db, RoleCodigo.SUPERVISOR)
    tecnico_role = _criar_role(db, RoleCodigo.TECNICO)
    unidade = _criar_unidade(db, "Hospital A")
    supervisor = _criar_usuario(db, role=supervisor_role, unidade=unidade, email="sup@a.com")
    tecnico = _criar_usuario(db, role=tecnico_role, unidade=unidade, email="tec@a.com")

    with pytest.raises(HTTPException) as exc:
        user_service.update_user(
            db, tecnico.id, UsuarioUpdate(role_id=supervisor_role.id), actor=supervisor
        )
    assert exc.value.status_code == 403


def test_supervisor_pode_promover_dentro_do_limite_biomedico_tecnico(db: Session) -> None:
    supervisor_role = _criar_role(db, RoleCodigo.SUPERVISOR)
    tecnico_role = _criar_role(db, RoleCodigo.TECNICO)
    biomedico_role = _criar_role(db, RoleCodigo.BIOMEDICO)
    unidade = _criar_unidade(db, "Hospital A")
    supervisor = _criar_usuario(db, role=supervisor_role, unidade=unidade, email="sup@a.com")
    tecnico = _criar_usuario(db, role=tecnico_role, unidade=unidade, email="tec@a.com")

    atualizado = user_service.update_user(
        db, tecnico.id, UsuarioUpdate(role_id=biomedico_role.id), actor=supervisor
    )
    assert atualizado.role_id == biomedico_role.id


def test_supervisor_nao_acessa_usuario_de_outra_unidade(db: Session) -> None:
    supervisor_role = _criar_role(db, RoleCodigo.SUPERVISOR)
    tecnico_role = _criar_role(db, RoleCodigo.TECNICO)
    unidade_a = _criar_unidade(db, "Hospital A")
    unidade_b = _criar_unidade(db, "Hospital B")
    supervisor_a = _criar_usuario(db, role=supervisor_role, unidade=unidade_a, email="sup@a.com")
    tecnico_b = _criar_usuario(db, role=tecnico_role, unidade=unidade_b, email="tec@b.com")

    with pytest.raises(HTTPException) as exc:
        user_service.update_user(db, tecnico_b.id, UsuarioUpdate(nome="Hackeado"), actor=supervisor_a)
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc_delete:
        user_service.deactivate_user(db, tecnico_b.id, actor=supervisor_a)
    assert exc_delete.value.status_code == 403


def test_supervisor_nao_consegue_mudar_unidade_hospitalar_de_usuario(db: Session) -> None:
    supervisor_role = _criar_role(db, RoleCodigo.SUPERVISOR)
    tecnico_role = _criar_role(db, RoleCodigo.TECNICO)
    unidade_a = _criar_unidade(db, "Hospital A")
    unidade_b = _criar_unidade(db, "Hospital B")
    supervisor = _criar_usuario(db, role=supervisor_role, unidade=unidade_a, email="sup@a.com")
    tecnico = _criar_usuario(db, role=tecnico_role, unidade=unidade_a, email="tec@a.com")

    with pytest.raises(HTTPException) as exc:
        user_service.update_user(
            db, tecnico.id, UsuarioUpdate(unidade_hospitalar_id=unidade_b.id), actor=supervisor
        )
    assert exc.value.status_code == 403


def test_supervisor_nao_consegue_criar_usuario_admin_global_ou_em_outra_unidade(db: Session) -> None:
    admin_role = _criar_role(db, RoleCodigo.ADMIN_GLOBAL)
    supervisor_role = _criar_role(db, RoleCodigo.SUPERVISOR)
    unidade_a = _criar_unidade(db, "Hospital A")
    unidade_b = _criar_unidade(db, "Hospital B")
    supervisor = _criar_usuario(db, role=supervisor_role, unidade=unidade_a, email="sup@a.com")

    with pytest.raises(HTTPException) as exc:
        user_service.create_user(
            db,
            UsuarioCreate(nome="Invasor", email="invasor@a.com", role_id=admin_role.id, unidade_hospitalar_id=unidade_b.id),
            actor=supervisor,
        )
    assert exc.value.status_code == 403


def test_admin_global_pode_promover_e_mover_de_unidade(db: Session) -> None:
    admin_role = _criar_role(db, RoleCodigo.ADMIN_GLOBAL)
    supervisor_role = _criar_role(db, RoleCodigo.SUPERVISOR)
    tecnico_role = _criar_role(db, RoleCodigo.TECNICO)
    unidade_a = _criar_unidade(db, "Hospital A")
    unidade_b = _criar_unidade(db, "Hospital B")
    admin = _criar_usuario(db, role=admin_role, unidade=None, email="admin@x.com")
    tecnico = _criar_usuario(db, role=tecnico_role, unidade=unidade_a, email="tec@a.com")

    atualizado = user_service.update_user(
        db,
        tecnico.id,
        UsuarioUpdate(role_id=supervisor_role.id, unidade_hospitalar_id=unidade_b.id),
        actor=admin,
    )
    assert atualizado.role_id == supervisor_role.id
    assert atualizado.unidade_hospitalar_id == unidade_b.id
