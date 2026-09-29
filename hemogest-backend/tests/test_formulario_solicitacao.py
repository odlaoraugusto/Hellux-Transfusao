"""
Testes do formulário público de solicitação de transfusão: gravação sem
login, validações do servidor, dados de identificação cifrados em repouso,
reabertura para impressão por token e proteção contra abuso (campo-isca e
limite por IP).
"""
import os

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-with-at-least-32-characters")
os.environ.setdefault("FIELD_ENCRYPTION_KEY", "test-field-key-with-at-least-32-characters")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

import uuid
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registra todos os mappers em Base.metadata
from app.core.rate_limit import limiter
from app.db.session import Base, get_db
from app.main import app
from app.models.audit_log import AcaoAuditoria, AuditLog
from app.models.formulario_solicitacao import FormularioSolicitacao
from app.models.parametrizacao import Hemocomponente
from app.models.setor import Setor
from app.models.unidade_hospitalar import UnidadeHospitalar
from app.services import formulario_solicitacao_service as svc

_engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
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
def cenario(db: Session) -> dict:
    unidade = UnidadeHospitalar(
        razao_social="Hospital Teste LTDA", nome_fantasia="Hospital Teste", cnpj="11111111111111",
        codigo_cnes="2415844", endereco="Av. Brasil, s/n", cidade="Ilhéus", uf="BA",
    )
    db.add(unidade)
    db.flush()
    ch = Hemocomponente(nome="Concentrado de Hemácias", sigla="CH", unidade_hospitalar_id=unidade.id)
    inativo = Hemocomponente(nome="Antigo", sigla="AN", ativo=False, unidade_hospitalar_id=unidade.id)
    db.add_all([ch, inativo, Setor(nome="UTI Neonatal", unidade_hospitalar_id=unidade.id)])
    db.commit()
    return {"unidade": unidade, "ch": ch, "inativo": inativo}


@pytest.fixture()
def client(db: Session):
    app.dependency_overrides[get_db] = lambda: db
    limiter.enabled = False
    yield TestClient(app)
    limiter.enabled = True
    app.dependency_overrides.clear()


def _corpo(cenario: dict, **extra) -> dict:
    corpo = {
        "data_solicitacao": date.today().isoformat(),
        "hora_solicitacao": "14:35",
        "convenio": "SUS",
        "nome_paciente": "Maria da Silva Santos",
        "prontuario": "445566",
        "sexo": "F",
        "data_nascimento": "2026-09-01",
        "nome_mae": "Joana da Silva",
        "raca_cor": "Parda",
        "setor_nome": "UTI Neonatal",
        "leito": "07",
        "peso_kg": 2.85,
        "diagnostico": "Anemia da prematuridade",
        "hb": "6,4",
        "ht": "19",
        "plaquetas": "120.000",
        "indicacao": "USO",
        "antecedentes_transfusionais": False,
        "antecedentes_obstetricos": False,
        "reacao_previa": False,
        "itens": [
            {"hemocomponente_id": str(cenario["ch"].id), "quantidade": 1, "unidade_medida": "UNIDADE", "modificacoes": ["Irradiação"]}
        ],
        "modalidade": "URGENCIA",
        "medico_nome": "Dra. Beatriz Tavares",
        "medico_crm": "CRM-BA 12345",
    }
    corpo.update(extra)
    return corpo


def _url(cenario: dict) -> str:
    return f"/api/v1/publico/unidades/{cenario['unidade'].id}/formulario-solicitacao"


# --- tela pública --------------------------------------------------------------

def test_configuracao_lista_so_hemocomponentes_ativos(client: TestClient, cenario: dict) -> None:
    r = client.get(_url(cenario))
    assert r.status_code == 200
    dados = r.json()
    assert dados["estabelecimento"]["nome"] == "Hospital Teste"
    assert dados["estabelecimento"]["cnes"] == "2415844"
    assert [h["sigla"] for h in dados["hemocomponentes"]] == ["CH"]
    assert dados["setores"] == ["UTI Neonatal"]


def test_unidade_inexistente_ou_inativa_da_404(client: TestClient, db: Session, cenario: dict) -> None:
    assert client.get(f"/api/v1/publico/unidades/{uuid.uuid4()}/formulario-solicitacao").status_code == 404
    cenario["unidade"].ativo = False
    db.commit()
    assert client.get(_url(cenario)).status_code == 404
    assert client.post(_url(cenario), json=_corpo(cenario)).status_code == 404


# --- gravação ------------------------------------------------------------------

def test_grava_sem_login_e_reabre_pelo_token(client: TestClient, db: Session, cenario: dict) -> None:
    r = client.post(_url(cenario), json=_corpo(cenario))
    assert r.status_code == 201
    criado = r.json()
    assert criado["protocolo"].startswith("FS-")

    aberto = client.get(f"/api/v1/publico/formularios/{criado['token_impressao']}")
    assert aberto.status_code == 200
    doc = aberto.json()
    assert doc["protocolo"] == criado["protocolo"]
    assert doc["nome_paciente"] == "Maria da Silva Santos"
    assert doc["estabelecimento"]["nome"] == "Hospital Teste"
    assert doc["itens"][0]["hemocomponente_nome"] == "Concentrado de Hemácias"
    assert doc["itens"][0]["modificacoes"] == ["Irradiação"]
    assert doc["peso_kg"] == pytest.approx(2.85)
    assert "token_hash" not in doc and "ip_origem" not in doc

    assert client.get("/api/v1/publico/formularios/token-que-nao-existe").status_code == 404


def test_identificacao_do_paciente_fica_cifrada_no_banco(client: TestClient, db: Session, cenario: dict) -> None:
    client.post(_url(cenario), json=_corpo(cenario))
    linha = db.execute(text("SELECT nome_paciente, nome_mae, prontuario, token_hash FROM formulario_solicitacao")).fetchone()
    assert "Maria" not in linha[0] and "Joana" not in linha[1] and "445566" not in linha[2]
    assert len(linha[3]) == 64  # só o hash do token é guardado


def test_token_nao_e_gravado_em_texto_puro(client: TestClient, db: Session, cenario: dict) -> None:
    token = client.post(_url(cenario), json=_corpo(cenario)).json()["token_impressao"]
    registro = db.scalars(select(FormularioSolicitacao)).one()
    assert registro.token_hash == svc.hash_token(token) != token


def test_auditoria_registra_a_criacao_publica(client: TestClient, db: Session, cenario: dict) -> None:
    client.post(_url(cenario), json=_corpo(cenario))
    log = db.scalars(select(AuditLog).where(AuditLog.entidade == "formulario_solicitacao")).one()
    assert log.acao == AcaoAuditoria.CRIACAO and log.usuario_id is None
    assert log.unidade_hospitalar_id == cenario["unidade"].id


# --- validações ------------------------------------------------------------------

@pytest.mark.parametrize(
    "extra",
    [
        {"nome_paciente": "Al"},
        {"sexo": "X"},
        {"peso_kg": 0},
        {"data_nascimento": (date.today() + timedelta(days=2)).isoformat()},
        {"data_solicitacao": (date.today() + timedelta(days=5)).isoformat()},
        {"modalidade": "QUALQUER"},
        {"itens": []},
        {"antecedentes_obstetricos": None},  # sexo F exige a resposta
        {"reacao_previa": True},  # reação prévia exige descrição
    ],
)
def test_rejeita_dados_invalidos(client: TestClient, cenario: dict, extra: dict) -> None:
    assert client.post(_url(cenario), json=_corpo(cenario, **extra)).status_code == 422


def test_maximo_de_tres_hemocomponentes_e_quantidade(client: TestClient, cenario: dict) -> None:
    item = {"hemocomponente_id": str(cenario["ch"].id), "quantidade": 1}
    assert client.post(_url(cenario), json=_corpo(cenario, itens=[item] * 4)).status_code == 422
    assert client.post(_url(cenario), json=_corpo(cenario, itens=[{**item, "quantidade": 21}])).status_code == 422
    assert client.post(_url(cenario), json=_corpo(cenario, itens=[{**item, "quantidade": 150, "unidade_medida": "ML"}])).status_code == 201


def test_hemocomponente_de_outra_unidade_ou_inativo_e_recusado(client: TestClient, cenario: dict) -> None:
    for hemo_id in (cenario["inativo"].id, uuid.uuid4()):
        item = {"hemocomponente_id": str(hemo_id), "quantidade": 1}
        assert client.post(_url(cenario), json=_corpo(cenario, itens=[item])).status_code == 422


def test_obstetricos_e_descartado_para_sexo_masculino(client: TestClient, cenario: dict) -> None:
    token = client.post(_url(cenario), json=_corpo(cenario, sexo="M", antecedentes_obstetricos=True)).json()["token_impressao"]
    assert client.get(f"/api/v1/publico/formularios/{token}").json()["antecedentes_obstetricos"] is None


def test_reacao_previa_com_descricao(client: TestClient, cenario: dict) -> None:
    corpo = _corpo(cenario, reacao_previa=True, reacao_previa_descricao="Febre e calafrios na 2ª bolsa")
    token = client.post(_url(cenario), json=corpo).json()["token_impressao"]
    assert client.get(f"/api/v1/publico/formularios/{token}").json()["reacao_previa_descricao"].startswith("Febre")


# --- abuso -----------------------------------------------------------------------

def test_campo_isca_preenchido_finge_sucesso_sem_gravar(client: TestClient, db: Session, cenario: dict) -> None:
    r = client.post(_url(cenario), json=_corpo(cenario, website="http://spam.example"))
    assert r.status_code == 201
    assert db.scalars(select(FormularioSolicitacao)).all() == []
    assert client.get(f"/api/v1/publico/formularios/{r.json()['token_impressao']}").status_code == 404


def test_limite_de_envios_por_ip(client: TestClient, cenario: dict) -> None:
    limiter.enabled = True
    limiter.reset()
    codigos = [client.post(_url(cenario), json=_corpo(cenario)).status_code for _ in range(4)]
    assert codigos == [201, 201, 201, 429]
    limiter.reset()


# --- lado da agência (com login) ---------------------------------------------------

def test_listagem_e_leitura_individual_com_auditoria(client: TestClient, db: Session, cenario: dict) -> None:
    unidade_id = cenario["unidade"].id
    outra = UnidadeHospitalar(razao_social="Outra", nome_fantasia="Outra", cnpj="22222222222222")
    db.add(outra)
    db.commit()
    client.post(_url(cenario), json=_corpo(cenario))

    itens = svc.search(db, unidade_id)
    assert [i.protocolo for i in itens] and svc.montar_resumo(itens[0])["hemocomponentes"] == ["CH × 1"]
    assert svc.search(db, outra.id) == []  # outra unidade não enxerga

    ator = uuid.uuid4()
    svc.get_formulario(db, itens[0].id, unidade_id, actor_id=None)  # sem ator: não audita
    svc.get_formulario(db, itens[0].id, unidade_id, actor_id=ator)
    leituras = db.scalars(select(AuditLog).where(AuditLog.acao == AcaoAuditoria.LEITURA)).all()
    assert len(leituras) == 1 and leituras[0].usuario_id == ator
    with pytest.raises(HTTPException) as exc:
        svc.get_formulario(db, itens[0].id, outra.id)
    assert exc.value.status_code == 404
