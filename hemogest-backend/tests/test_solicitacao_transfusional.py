"""
Testes do painel de solicitações transfusionais: fluxo de status
(SOLICITADO -> EM_PROCESSAMENTO -> ENTREGUE), regras da entrega (bolsa do
hemocomponente certo, disponível, na validade, ABO/Rh compatível) e o
efeito sobre as bolsas (ficam RESERVADAS para o paciente).
"""
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401 — registra todos os mappers em Base.metadata
from app.db.session import Base
from app.models.internacao import Internacao, StatusInternacao
from app.models.paciente import Paciente
from app.models.parametrizacao import Hemocomponente
from app.models.setor import Setor
from app.models.solicitacao_transfusional import StatusSolicitacao
from app.models.unidade_hemocomponente import StatusHemocomponente, UnidadeHemocomponente
from app.models.unidade_hospitalar import UnidadeHospitalar
from app.schemas.solicitacao_transfusional import SolicitacaoCreate, SolicitacaoEntregaRequest
from app.services import solicitacao_transfusional_service as svc
from app.services.compatibilidade_abo import ResultadoCompatibilidade, TipoComponente, avaliar, tipo_por_sigla

_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
_TestSessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
HOJE = date(2026, 9, 26)
ATOR = uuid.uuid4()


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
    unidade = UnidadeHospitalar(razao_social="Hospital Teste", nome_fantasia="Hospital Teste", cnpj="11111111111111")
    db.add(unidade)
    db.flush()
    setor = Setor(nome="UTI Adulto", unidade_hospitalar_id=unidade.id)
    paciente = Paciente(nome="Maria da Silva", tipo_sanguineo="A+", unidade_hospitalar_id=unidade.id)
    ch = Hemocomponente(nome="Concentrado de Hemácias", sigla="CH", unidade_hospitalar_id=unidade.id)
    pfc = Hemocomponente(nome="Plasma Fresco Congelado", sigla="PFC", unidade_hospitalar_id=unidade.id)
    db.add_all([setor, paciente, ch, pfc])
    db.flush()
    internacao = Internacao(
        paciente_id=paciente.id, setor_atual_id=setor.id, data_entrada=HOJE,
        status=StatusInternacao.ATIVA, unidade_hospitalar_id=unidade.id,
    )
    db.add(internacao)
    db.commit()
    return {"unidade": unidade, "setor": setor, "paciente": paciente, "ch": ch, "pfc": pfc, "internacao": internacao}


def _bolsa(db: Session, cenario: dict, *, hemo="ch", abo="A+", validade=HOJE + timedelta(days=10), numero=None) -> UnidadeHemocomponente:
    b = UnidadeHemocomponente(
        hemocomponente_id=cenario[hemo].id, numero_bolsa=numero or f"B3045 26 {uuid.uuid4().int % 10**6:06d}",
        tipo_sanguineo=abo, data_validade=validade, status=StatusHemocomponente.DISPONIVEL,
        unidade_hospitalar_id=cenario["unidade"].id,
    )
    db.add(b)
    db.commit()
    return b


def _solicitar(db: Session, cenario: dict, *, hemo="ch", quantidade=1):
    return svc.criar(
        db,
        SolicitacaoCreate(internacao_id=cenario["internacao"].id, hemocomponente_id=cenario[hemo].id, quantidade=quantidade),
        unidade_hospitalar_id=cenario["unidade"].id, actor_id=ATOR,
    )


def _entrega(bolsas, **kw) -> SolicitacaoEntregaRequest:
    dados = {"abo_paciente": "A+", "bolsas": [b.id for b in bolsas], "prova_cruzada": "COMPATIVEL", "recebido_por": "Enf. Cláudia"}
    dados.update(kw)
    return SolicitacaoEntregaRequest(**dados)


def _processar(db, cenario, solicitacao):
    return svc.iniciar_processamento(db, solicitacao.id, unidade_hospitalar_id=cenario["unidade"].id, actor_id=ATOR)


def _entregar(db, cenario, solicitacao, payload):
    return svc.entregar(db, solicitacao.id, payload, unidade_hospitalar_id=cenario["unidade"].id, actor_id=ATOR, hoje=HOJE)


# --- regras de compatibilidade ---------------------------------------------

@pytest.mark.parametrize(
    "tipo,doador,receptor,esperado",
    [
        (TipoComponente.HEMACIAS, "O-", "AB+", ResultadoCompatibilidade.COMPATIVEL),
        (TipoComponente.HEMACIAS, "A+", "O+", ResultadoCompatibilidade.INCOMPATIVEL),
        (TipoComponente.HEMACIAS, "O+", "O-", ResultadoCompatibilidade.RESSALVA),
        (TipoComponente.PLASMA, "AB-", "O+", ResultadoCompatibilidade.COMPATIVEL),
        (TipoComponente.PLASMA, "O+", "A+", ResultadoCompatibilidade.INCOMPATIVEL),
        (TipoComponente.PLAQUETAS, "B+", "B+", ResultadoCompatibilidade.COMPATIVEL),
        (TipoComponente.PLAQUETAS, "O+", "A+", ResultadoCompatibilidade.RESSALVA),
    ],
)
def test_avaliar_compatibilidade(tipo, doador, receptor, esperado) -> None:
    assert avaliar(tipo, doador, receptor)[0] == esperado


def test_tipo_por_sigla() -> None:
    assert tipo_por_sigla("CH") == TipoComponente.HEMACIAS
    assert tipo_por_sigla("cpaf") == TipoComponente.PLAQUETAS
    assert tipo_por_sigla("CRIO") == TipoComponente.PLASMA
    assert tipo_por_sigla(None) is None


# --- fluxo -------------------------------------------------------------------

def test_fluxo_completo_reserva_bolsa_para_paciente(db: Session, cenario: dict) -> None:
    s = _solicitar(db, cenario)
    assert s.status == StatusSolicitacao.SOLICITADO
    assert s.setor_solicitante_id == cenario["setor"].id  # herdado da internação

    s = _processar(db, cenario, s)
    assert s.status == StatusSolicitacao.EM_PROCESSAMENTO

    bolsa = _bolsa(db, cenario, abo="O-")
    s = _entregar(db, cenario, s, _entrega([bolsa], temperatura_transporte_c=4.2))
    assert s.status == StatusSolicitacao.ENTREGUE
    assert s.abo_paciente == "A+"
    assert s.liberacao_com_ressalva is False
    db.refresh(bolsa)
    assert bolsa.status == StatusHemocomponente.RESERVADO
    assert bolsa.paciente_reservado_id == cenario["paciente"].id

    saida = svc.montar_saida(db, [s], com_bolsas=True)[0]
    assert saida["paciente_nome"] == "Maria da Silva"
    assert saida["setor_nome"] == "UTI Adulto"
    assert [b["id"] for b in saida["bolsas"]] == [bolsa.id]


def test_nao_entrega_sem_processamento(db: Session, cenario: dict) -> None:
    s = _solicitar(db, cenario)
    with pytest.raises(HTTPException) as exc:
        _entregar(db, cenario, s, _entrega([_bolsa(db, cenario)]))
    assert exc.value.status_code == 409


def test_abo_incompativel_bloqueia(db: Session, cenario: dict) -> None:
    s = _processar(db, cenario, _solicitar(db, cenario))
    bolsa = _bolsa(db, cenario, abo="B+")
    with pytest.raises(HTTPException) as exc:
        _entregar(db, cenario, s, _entrega([bolsa]))
    assert exc.value.status_code == 409
    db.refresh(bolsa)
    assert bolsa.status == StatusHemocomponente.DISPONIVEL


def test_ressalva_exige_autorizacao(db: Session, cenario: dict) -> None:
    s = _processar(db, cenario, _solicitar(db, cenario))
    bolsa = _bolsa(db, cenario, abo="O+")
    with pytest.raises(HTTPException):
        _entregar(db, cenario, s, _entrega([bolsa], abo_paciente="O-"))
    s = _entregar(db, cenario, s, _entrega([bolsa], abo_paciente="O-", autorizacao_ressalva=True))
    assert s.liberacao_com_ressalva is True


def test_hemacias_exigem_prova_cruzada(db: Session, cenario: dict) -> None:
    s = _processar(db, cenario, _solicitar(db, cenario))
    with pytest.raises(HTTPException):
        _entregar(db, cenario, s, _entrega([_bolsa(db, cenario)], prova_cruzada=None))


def test_bolsa_vencida_ou_de_outro_hemocomponente(db: Session, cenario: dict) -> None:
    s = _processar(db, cenario, _solicitar(db, cenario))
    with pytest.raises(HTTPException):
        _entregar(db, cenario, s, _entrega([_bolsa(db, cenario, validade=HOJE - timedelta(days=1))]))
    with pytest.raises(HTTPException):
        _entregar(db, cenario, s, _entrega([_bolsa(db, cenario, hemo="pfc", abo="AB+")]))


def test_quantidade_de_bolsas_precisa_bater(db: Session, cenario: dict) -> None:
    s = _processar(db, cenario, _solicitar(db, cenario, hemo="pfc", quantidade=2))
    with pytest.raises(HTTPException) as exc:
        _entregar(db, cenario, s, _entrega([_bolsa(db, cenario, hemo="pfc", abo="AB+")], prova_cruzada=None))
    assert exc.value.status_code == 400
    duas = [_bolsa(db, cenario, hemo="pfc", abo="AB+"), _bolsa(db, cenario, hemo="pfc", abo="A-")]
    s = _entregar(db, cenario, s, _entrega(duas, prova_cruzada=None))
    assert s.prova_cruzada == "NAO_SE_APLICA"


def test_filtro_por_dia_e_status(db: Session, cenario: dict) -> None:
    a = _solicitar(db, cenario)
    b = _solicitar(db, cenario)
    _processar(db, cenario, b)
    ontem = datetime.now(timezone.utc) - timedelta(days=1)
    a.data_solicitacao = ontem
    db.commit()

    agora = datetime.now(timezone.utc)
    hoje_ini = agora - timedelta(hours=12)
    ids = [i.id for i in svc.search(db, cenario["unidade"].id, de=hoje_ini, ate=agora + timedelta(hours=1))]
    assert ids == [b.id]
    ids = [i.id for i in svc.search(db, cenario["unidade"].id, status_filtro=StatusSolicitacao.SOLICITADO)]
    assert ids == [a.id]
    assert svc.search(db, uuid.uuid4()) == []  # outra unidade não enxerga
