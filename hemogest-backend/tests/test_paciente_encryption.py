"""
Testes da criptografia de campo de Paciente (nome, CPF, CNS, prontuário,
telefone, nome da mãe) — ver app/db/encrypted_types.py. Cobre: o valor
persistido no banco é de fato ciphertext (não só "confia" que o
TypeDecorator funciona), busca por nome continua funcionando apesar da
cifra, unicidade de CPF via índice cego, e a trilha de auditoria de leitura
de prontuário.
"""
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401 — registra todos os mappers em Base.metadata
from app.db.encrypted_types import blind_index
from app.db.session import Base
from app.models.audit_log import AcaoAuditoria, AuditLog
from app.models.role import Role, RoleCodigo
from app.models.unidade_hospitalar import UnidadeHospitalar
from app.models.usuario import Usuario
from app.schemas.paciente import PacienteCreate, PacienteUpdate
from app.services import paciente_service

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


@pytest.fixture()
def unidade(db: Session) -> UnidadeHospitalar:
    u = UnidadeHospitalar(razao_social="Hospital Teste", nome_fantasia="Hospital Teste", cnpj="11111111111111")
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def usuario_ator(db: Session, unidade: UnidadeHospitalar) -> Usuario:
    role = Role(codigo=RoleCodigo.SUPERVISOR, nome_exibicao="Supervisor", permissoes=[])
    db.add(role)
    db.flush()
    ator = Usuario(
        nome="Ator", email="ator@x.com", senha_hash="x", role_id=role.id, unidade_hospitalar_id=unidade.id
    )
    db.add(ator)
    db.flush()
    return ator


def test_nome_e_cpf_ficam_como_ciphertext_no_banco(db: Session, unidade: UnidadeHospitalar) -> None:
    paciente = paciente_service.create_paciente(
        db,
        PacienteCreate(nome="Maria da Silva", cpf="12345678900", numero_prontuario="PRONT-001"),
        unidade_hospitalar_id=unidade.id,
        actor_id=uuid.uuid4(),
    )

    # Consulta o valor CRU da coluna via SQL direto — não via ORM (que já
    # descriptografaria de volta) — pra provar que o dado em repouso não é
    # texto plano. SQLite guarda o UUID sem hífens via o tipo
    # postgresql.UUID compilado nesse dialeto, por isso o replace.
    linha = db.execute(
        text("SELECT nome, cpf, numero_prontuario FROM paciente WHERE id = :id"),
        {"id": str(paciente.id).replace("-", "")},
    ).fetchone()
    assert "Maria" not in linha[0]
    assert "12345678900" not in linha[1]
    assert "PRONT-001" not in linha[2]
    # Mas pelo objeto ORM (já carregado/decifrado), o valor é o esperado.
    assert paciente.nome == "Maria da Silva"
    assert paciente.cpf == "12345678900"


def test_busca_por_termo_funciona_apesar_da_cifra(db: Session, unidade: UnidadeHospitalar) -> None:
    paciente_service.create_paciente(
        db, PacienteCreate(nome="Maria da Silva"), unidade_hospitalar_id=unidade.id, actor_id=uuid.uuid4()
    )
    paciente_service.create_paciente(
        db, PacienteCreate(nome="João Souza"), unidade_hospitalar_id=unidade.id, actor_id=uuid.uuid4()
    )

    resultado = paciente_service.search_pacientes(db, unidade.id, termo="maria")
    assert len(resultado) == 1
    assert resultado[0].nome == "Maria da Silva"

    resultado_parcial = paciente_service.search_pacientes(db, unidade.id, termo="silva")
    assert len(resultado_parcial) == 1


def test_busca_exata_por_cpf_e_prontuario_via_indice_cego(db: Session, unidade: UnidadeHospitalar) -> None:
    paciente_service.create_paciente(
        db,
        PacienteCreate(nome="Maria da Silva", cpf="12345678900", numero_prontuario="PRONT-001"),
        unidade_hospitalar_id=unidade.id,
        actor_id=uuid.uuid4(),
    )

    por_cpf = paciente_service.search_pacientes(db, unidade.id, cpf="12345678900")
    assert len(por_cpf) == 1

    por_prontuario = paciente_service.search_pacientes(db, unidade.id, numero_prontuario="PRONT-001")
    assert len(por_prontuario) == 1

    assert paciente_service.search_pacientes(db, unidade.id, cpf="00000000000") == []


def test_cpf_duplicado_na_mesma_unidade_e_rejeitado(db: Session, unidade: UnidadeHospitalar) -> None:
    paciente_service.create_paciente(
        db, PacienteCreate(nome="Maria", cpf="12345678900"), unidade_hospitalar_id=unidade.id, actor_id=uuid.uuid4()
    )
    with pytest.raises(Exception):  # noqa: B017 — HTTPException 409, checado só o efeito
        paciente_service.create_paciente(
            db, PacienteCreate(nome="Outra Maria", cpf="12345678900"),
            unidade_hospitalar_id=unidade.id, actor_id=uuid.uuid4(),
        )


def test_atualizar_cpf_atualiza_o_indice_cego_junto(db: Session, unidade: UnidadeHospitalar) -> None:
    paciente = paciente_service.create_paciente(
        db, PacienteCreate(nome="Maria", cpf="12345678900"), unidade_hospitalar_id=unidade.id, actor_id=uuid.uuid4()
    )
    paciente_service.update_paciente(
        db, paciente.id, PacienteUpdate(cpf="98765432100"), unidade_hospitalar_id=unidade.id, actor_id=uuid.uuid4()
    )

    assert paciente_service.search_pacientes(db, unidade.id, cpf="12345678900") == []
    encontrado = paciente_service.search_pacientes(db, unidade.id, cpf="98765432100")
    assert len(encontrado) == 1
    assert encontrado[0].cpf_hash == blind_index("98765432100")


def test_leitura_de_paciente_individual_gera_trilha_de_auditoria(
    db: Session, unidade: UnidadeHospitalar, usuario_ator: Usuario
) -> None:
    paciente = paciente_service.create_paciente(
        db, PacienteCreate(nome="Maria"), unidade_hospitalar_id=unidade.id, actor_id=usuario_ator.id
    )

    paciente_service.get_paciente(db, paciente.id, unidade.id, actor_id=usuario_ator.id)

    leituras = (
        db.query(AuditLog)
        .filter(AuditLog.entidade_id == paciente.id, AuditLog.acao == AcaoAuditoria.LEITURA)
        .all()
    )
    assert len(leituras) == 1
    assert leituras[0].usuario_id == usuario_ator.id


def test_busca_em_lista_nao_gera_trilha_de_leitura(db: Session, unidade: UnidadeHospitalar) -> None:
    # Só GET-by-id (visualização de prontuário) audita leitura — buscar numa
    # lista geraria ruído sem o mesmo valor de accountability.
    paciente_service.create_paciente(
        db, PacienteCreate(nome="Maria"), unidade_hospitalar_id=unidade.id, actor_id=uuid.uuid4()
    )
    paciente_service.search_pacientes(db, unidade.id, termo="maria")

    assert db.query(AuditLog).filter(AuditLog.acao == AcaoAuditoria.LEITURA).count() == 0
