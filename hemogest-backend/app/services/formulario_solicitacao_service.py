"""
HemoGest — Service do Formulário de Solicitação de Transfusão (formulário público).
Gravação sem login: a unidade vem do link usado, não do usuário. Por isso o
que é aceito é conferido aqui — a unidade precisa existir e estar ativa. Os
hemocomponentes pedidos são os 4 fixos do documento oficial (CH/PF/CP/CR,
ver app.schemas.formulario_solicitacao), não um catálogo configurável.
"""
import hashlib
import secrets
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.db.encrypted_types import blind_index
from app.models.audit_log import AcaoAuditoria
from app.models.formulario_solicitacao import FormularioSolicitacao
from app.models.medico import Medico
from app.models.paciente import Paciente
from app.models.parametrizacao import Hemocomponente
from app.models.setor import Setor
from app.models.solicitacao_transfusional import SolicitacaoTransfusional, StatusSolicitacao
from app.models.unidade_hospitalar import UnidadeHospitalar
from app.schemas.formulario_solicitacao import NOME_TIPO, FormularioCreate

# Modalidade do formulário público -> prioridade da Solicitação Transfusional
# (painel interno). PROGRAMADA não tem equivalente direto — cai em ROTINA
# (sem urgência, só agendada pra depois).
_PRIORIDADE_POR_MODALIDADE = {
    "EMERGENCIA": "EMERGENCIA",
    "URGENCIA": "URGENTE",
    "ROTINA": "ROTINA",
    "PROGRAMADA": "ROTINA",
}

# Sem 0/O/1/I: o protocolo é lido e digitado por pessoas.
_ALFABETO_PROTOCOLO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _novo_protocolo(agora: datetime) -> str:
    sufixo = "".join(secrets.choice(_ALFABETO_PROTOCOLO) for _ in range(5))
    return f"FS-{agora:%y%m%d}-{sufixo}"


def get_unidade_ativa(db: Session, unidade_id: uuid.UUID) -> UnidadeHospitalar:
    unidade = db.get(UnidadeHospitalar, unidade_id)
    # Mesma resposta para "não existe" e "inativa": não deixa enumerar unidades.
    if unidade is None or unidade.deleted_at is not None or not unidade.ativo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Formulário não encontrado.")
    return unidade


def estabelecimento_de(unidade: UnidadeHospitalar) -> dict:
    return {
        "nome": unidade.nome_fantasia,
        "razao_social": unidade.razao_social,
        "cnpj": unidade.cnpj,
        "cnes": unidade.codigo_cnes,
        "endereco": unidade.endereco,
        "cidade": unidade.cidade,
        "uf": unidade.uf,
        "telefone": unidade.telefone,
    }


def config_publica(db: Session, unidade_id: uuid.UUID) -> dict:
    unidade = get_unidade_ativa(db, unidade_id)
    return {"estabelecimento": estabelecimento_de(unidade)}


def criar(
    db: Session, unidade_id: uuid.UUID, payload: FormularioCreate, *, ip_origem: str | None
) -> tuple[FormularioSolicitacao, str]:
    """Grava o formulário e devolve (registro, token de impressão em texto puro).
    O token só existe aqui e na resposta: no banco fica só o hash."""
    get_unidade_ativa(db, unidade_id)

    itens = [
        {
            "tipo": item.tipo,
            "quantidade": item.quantidade,
            "unidade_medida": item.unidade_medida,
            "modificacoes": item.modificacoes,
        }
        for item in payload.itens
    ]

    dados = payload.model_dump(exclude={"website", "itens"})
    token = secrets.token_urlsafe(24)
    agora = utcnow()

    for tentativa in range(5):
        registro = FormularioSolicitacao(
            unidade_hospitalar_id=unidade_id,
            protocolo=_novo_protocolo(agora),
            token_hash=hash_token(token),
            ip_origem=ip_origem,
            itens=itens,
            **dados,
        )
        db.add(registro)
        try:
            db.flush()
        except IntegrityError:
            # Protocolo repetido na mesma unidade (5 caracteres aleatórios): sorteia outro.
            db.rollback()
            if tentativa == 4:
                raise
            continue
        break

    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="formulario_solicitacao", entidade_id=registro.id,
        usuario_id=None, unidade_hospitalar_id=unidade_id, ip_origem=ip_origem,
        detalhes={"protocolo": registro.protocolo, "origem": "formulario_publico"},
    )
    paciente_id = _criar_paciente_se_novo(db, registro, unidade_id, ip_origem=ip_origem)
    _salvar_medico_se_novo(db, unidade_id, registro.medico_crm, registro.medico_nome)
    _criar_solicitacoes(db, registro, unidade_id, paciente_id, ip_origem=ip_origem)
    db.commit()
    db.refresh(registro)
    return registro, token


def _criar_paciente_se_novo(
    db: Session, registro: FormularioSolicitacao, unidade_id: uuid.UUID, *, ip_origem: str | None
) -> uuid.UUID:
    """Bootstrap do cadastro de Paciente a partir do formulário público
    (2026-09-30, pedido do cliente) — só na PRIMEIRA vez que o prontuário
    aparece nesta unidade. Em formulários seguintes com o mesmo
    prontuário, nunca sobrescreve o cadastro já existente (correção de
    dado divergente é manual, pela tela de Pacientes) — evita que um
    formulário público, sem login, apague/altere um cadastro já
    curado pela equipe. Sem prontuário (2026-10-02, pedido do cliente:
    "quando tiver na contingência sem sistema, isso não ser uma trava"),
    não dá pra achar/reaproveitar com segurança — nasce um Paciente novo
    sem prontuário, que a equipe completa depois pela tela de Pacientes.
    Devolve o id do paciente (achado ou criado)."""
    prontuario_hash = blind_index(registro.prontuario) if registro.prontuario else None
    if prontuario_hash is not None:
        ja_existe = db.scalar(
            select(Paciente.id)
            .where(Paciente.unidade_hospitalar_id == unidade_id)
            .where(Paciente.numero_prontuario_hash == prontuario_hash)
            .where(Paciente.deleted_at.is_(None))
        )
        if ja_existe is not None:
            return ja_existe

    paciente = Paciente(
        unidade_hospitalar_id=unidade_id,
        nome=registro.nome_paciente,
        data_nascimento=registro.data_nascimento,
        sexo=registro.sexo,
        cpf=registro.cpf,
        cpf_hash=blind_index(registro.cpf) if registro.cpf else None,
        cns=registro.cns,
        numero_prontuario=registro.prontuario,
        numero_prontuario_hash=prontuario_hash,
        nome_mae=registro.nome_mae,
    )
    db.add(paciente)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="paciente", entidade_id=paciente.id,
        usuario_id=None, unidade_hospitalar_id=unidade_id, ip_origem=ip_origem,
        detalhes={"origem": "formulario_publico", "protocolo": registro.protocolo},
    )
    return paciente.id


def _obter_ou_criar_por_nome(db: Session, modelo, unidade_id: uuid.UUID, nome: str):
    """Setor/Hemocomponente têm a mesma forma básica (nome único por
    unidade) — usado pra não travar a solicitação automática esperando um
    cadastro prévio que a equipe nunca chegou a fazer (2026-09-30, pedido
    do cliente: "a equipe não completa nada")."""
    item = db.scalar(
        select(modelo)
        .where(modelo.unidade_hospitalar_id == unidade_id)
        .where(modelo.nome == nome)
        .where(modelo.deleted_at.is_(None))
    )
    if item is not None:
        return item
    item = modelo(unidade_hospitalar_id=unidade_id, nome=nome)
    db.add(item)
    db.flush()
    return item


def _salvar_medico_se_novo(db: Session, unidade_id: uuid.UUID, crm: str, nome: str) -> None:
    """Memoriza o médico pelo CRM conforme o formulário público é
    preenchido (2026-10-02, pedido do cliente: "vai sendo salvo conforme
    eles forem solicitando") — não sobrescreve um nome já salvo pra esse
    CRM (mesmo raciocínio do paciente: divergência se resolve na mão, não
    por um formulário público sem login)."""
    ja_existe = db.scalar(
        select(Medico.id)
        .where(Medico.unidade_hospitalar_id == unidade_id)
        .where(Medico.crm == crm)
        .where(Medico.deleted_at.is_(None))
    )
    if ja_existe is not None:
        return
    db.add(Medico(unidade_hospitalar_id=unidade_id, crm=crm, nome=nome))
    db.flush()


def buscar_medico_por_crm(db: Session, unidade_id: uuid.UUID, crm: str) -> str | None:
    """Pré-preenchimento do nome do médico pelo CRM já digitado antes
    nesta unidade (2026-10-02, pedido do cliente: "pede primeiro o crm,
    pq aí já puxa o nome completo")."""
    crm = crm.strip()
    if not crm:
        return None
    return db.scalar(
        select(Medico.nome)
        .where(Medico.unidade_hospitalar_id == unidade_id)
        .where(Medico.crm == crm)
        .where(Medico.deleted_at.is_(None))
    )


def buscar_pacientes_por_nome(db: Session, unidade_id: uuid.UUID, nome: str, *, limit: int = 8) -> list[dict]:
    """Busca de pacientes pelo nome (2026-10-02, pedido do cliente: "quando
    ficamos sem sistema, não temos prontuário de alguns pacientes").
    Devolve só nome/nascimento/prontuário — sem CPF/CNS/endereço aqui, que
    só aparecem depois, ao reabrir pelo prontuário encontrado (ver
    `buscar_paciente_por_prontuario`). Nome é cifrado (sem índice de busca
    possível em SQL): decifra e filtra em memória, mesma técnica já usada
    em paciente_service.search_pacientes — só viável em volume pequeno de
    pacientes por unidade."""
    termo = " ".join(nome.strip().lower().split())
    if len(termo) < 3:
        return []
    candidatos = db.scalars(
        select(Paciente)
        .where(Paciente.unidade_hospitalar_id == unidade_id)
        .where(Paciente.deleted_at.is_(None))
        .where(Paciente.numero_prontuario_hash.isnot(None))
    )
    achados = [p for p in candidatos if termo in p.nome.lower()]
    achados.sort(key=lambda p: p.nome)
    return [
        {"numero_prontuario": p.numero_prontuario, "nome_paciente": p.nome, "data_nascimento": p.data_nascimento}
        for p in achados[:limit]
    ]


def _criar_solicitacoes(
    db: Session, registro: FormularioSolicitacao, unidade_id: uuid.UUID, paciente_id: uuid.UUID, *, ip_origem: str | None
) -> None:
    """Uma Solicitação Transfusional por hemocomponente pedido no
    formulário — já nasce SOLICITADO, pronta pra tocar o alerta sonoro e
    aparecer no painel de Solicitações, sem a equipe completar nada
    (2026-09-30, pedido do cliente). Setor/hemocomponente são resolvidos
    (ou criados) por nome; sem internação — não faz parte deste fluxo."""
    setor = _obter_ou_criar_por_nome(db, Setor, unidade_id, registro.setor_nome)
    prioridade = _PRIORIDADE_POR_MODALIDADE[registro.modalidade]
    medico = " – ".join(p for p in [registro.medico_nome, registro.medico_crm and f"CRM {registro.medico_crm}"] if p)

    for item in registro.itens:
        hemo = _obter_ou_criar_por_nome(db, Hemocomponente, unidade_id, NOME_TIPO[item["tipo"]])
        # Quando o pedido é por VOLUME em mL (comum em pediatria/neonatologia)
        # em vez de nº de bolsas, `quantidade` (nº de bolsas a registrar/
        # entregar) é 1 — o volume pedido vai à parte, em
        # volume_ml_solicitado (2026-10-01, correção de bug real: um pedido
        # de "261 mL" virava `quantidade=261`, e o sistema passava a esperar
        # 261 bolsas antes de liberar a entrega).
        em_ml = item["unidade_medida"] == "ML"
        solicitacao = SolicitacaoTransfusional(
            unidade_hospitalar_id=unidade_id,
            internacao_id=None,
            formulario_solicitacao_id=registro.id,
            paciente_id=paciente_id,
            setor_solicitante_id=setor.id,
            hemocomponente_id=hemo.id,
            quantidade=1 if em_ml else item["quantidade"],
            volume_ml_solicitado=item["quantidade"] if em_ml else None,
            prioridade=prioridade,
            indicacao=registro.indicacao,
            medico_solicitante=medico or None,
            status=StatusSolicitacao.SOLICITADO,
            data_solicitacao=utcnow(),
        )
        db.add(solicitacao)
        db.flush()
        registrar_auditoria(
            db, acao=AcaoAuditoria.CRIACAO, entidade="solicitacao_transfusional", entidade_id=solicitacao.id,
            usuario_id=None, unidade_hospitalar_id=unidade_id, ip_origem=ip_origem,
            detalhes={"origem": "formulario_publico", "protocolo": registro.protocolo},
        )


def buscar_paciente_por_prontuario(
    db: Session, unidade_id: uuid.UUID, prontuario: str, *, ip_origem: str | None
) -> dict | None:
    """Pré-preenchimento do formulário público pelo prontuário (2026-10-01,
    pedido do cliente) — acha o Paciente pelo índice cego (comparação
    exata, sem decifrar nada pra buscar) e devolve os dados do ÚLTIMO
    formulário recebido desse paciente nesta unidade, que tem mais campos
    que o cadastro de Paciente (endereço, raça/cor, peso). Sem formulário
    anterior (paciente só tem cadastro manual), cai pro que o cadastro
    de Paciente tem. None se o prontuário não bate com ninguém."""
    prontuario = prontuario.strip()
    if not prontuario:
        return None
    prontuario_hash = blind_index(prontuario)
    paciente = db.scalar(
        select(Paciente)
        .where(Paciente.unidade_hospitalar_id == unidade_id)
        .where(Paciente.numero_prontuario_hash == prontuario_hash)
        .where(Paciente.deleted_at.is_(None))
    )
    if paciente is None:
        return None

    registrar_auditoria(
        db, acao=AcaoAuditoria.LEITURA, entidade="paciente", entidade_id=paciente.id,
        usuario_id=None, unidade_hospitalar_id=unidade_id, ip_origem=ip_origem,
        detalhes={"origem": "formulario_publico_prefill"},
    )
    db.commit()

    ultimo_formulario_id = db.scalar(
        select(SolicitacaoTransfusional.formulario_solicitacao_id)
        .where(SolicitacaoTransfusional.paciente_id == paciente.id)
        .where(SolicitacaoTransfusional.formulario_solicitacao_id.isnot(None))
        .order_by(SolicitacaoTransfusional.data_solicitacao.desc())
        .limit(1)
    )
    formulario = db.get(FormularioSolicitacao, ultimo_formulario_id) if ultimo_formulario_id else None
    if formulario is not None:
        return {
            "nome_paciente": formulario.nome_paciente,
            "nome_social": formulario.nome_social,
            "cpf": formulario.cpf,
            "cpf_e_da_mae": formulario.cpf_e_da_mae,
            "cns": formulario.cns,
            "sexo": formulario.sexo,
            "data_nascimento": formulario.data_nascimento,
            "nome_mae": formulario.nome_mae,
            "raca_cor": formulario.raca_cor,
            "peso_kg": float(formulario.peso_kg) if formulario.peso_kg is not None else None,
            "cep": formulario.cep,
            "logradouro": formulario.logradouro,
            "numero": formulario.numero,
            "bairro": formulario.bairro,
            "cidade": formulario.cidade,
            "uf": formulario.uf,
            "codigo_ibge": formulario.codigo_ibge,
        }

    return {
        "nome_paciente": paciente.nome,
        "nome_social": None,
        "cpf": paciente.cpf,
        "cpf_e_da_mae": False,
        "cns": paciente.cns,
        "sexo": paciente.sexo,
        "data_nascimento": paciente.data_nascimento,
        "nome_mae": paciente.nome_mae,
        "raca_cor": None,
        "peso_kg": None,
        "cep": None,
        "logradouro": None,
        "numero": None,
        "bairro": None,
        "cidade": None,
        "uf": None,
        "codigo_ibge": None,
    }


def get_por_token(db: Session, token: str) -> FormularioSolicitacao:
    stmt = select(FormularioSolicitacao).where(
        FormularioSolicitacao.token_hash == hash_token(token), FormularioSolicitacao.deleted_at.is_(None)
    )
    registro = db.scalars(stmt).first()
    if registro is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Formulário não encontrado.")
    return registro


def get_formulario(
    db: Session, formulario_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID, *, actor_id: uuid.UUID | None = None
) -> FormularioSolicitacao:
    registro = db.get(FormularioSolicitacao, formulario_id)
    if registro is None or registro.deleted_at is not None or registro.unidade_hospitalar_id != unidade_hospitalar_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Formulário não encontrado.")
    # Abrir um formulário individual mostra dado de paciente: fica na trilha de
    # auditoria (LGPD), como no prontuário. Listagens não geram registro.
    if actor_id is not None:
        registrar_auditoria(
            db, acao=AcaoAuditoria.LEITURA, entidade="formulario_solicitacao", entidade_id=registro.id,
            usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        )
        db.commit()
    return registro


def search(
    db: Session,
    unidade_hospitalar_id: uuid.UUID,
    *,
    de: datetime | None = None,
    ate: datetime | None = None,
    modalidade: str | None = None,
    limit: int = 200,
) -> list[FormularioSolicitacao]:
    stmt = (
        select(FormularioSolicitacao)
        .where(FormularioSolicitacao.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(FormularioSolicitacao.deleted_at.is_(None))
    )
    if de:
        stmt = stmt.where(FormularioSolicitacao.created_at >= de)
    if ate:
        stmt = stmt.where(FormularioSolicitacao.created_at < ate)
    if modalidade:
        stmt = stmt.where(FormularioSolicitacao.modalidade == modalidade)
    return list(db.scalars(stmt.order_by(FormularioSolicitacao.created_at.desc()).limit(limit)))


def montar_saida(db: Session, registro: FormularioSolicitacao) -> dict:
    unidade = db.get(UnidadeHospitalar, registro.unidade_hospitalar_id)
    dados = {c.key: getattr(registro, c.key) for c in FormularioSolicitacao.__table__.columns}
    dados.update(
        criado_em=registro.created_at,
        estabelecimento=estabelecimento_de(unidade),
        peso_kg=float(registro.peso_kg) if registro.peso_kg is not None else None,
    )
    return dados


def montar_resumo(registro: FormularioSolicitacao) -> dict:
    return {
        "id": registro.id,
        "protocolo": registro.protocolo,
        "criado_em": registro.created_at,
        "data_solicitacao": registro.data_solicitacao,
        "hora_solicitacao": registro.hora_solicitacao,
        "nome_paciente": registro.nome_paciente,
        "setor_nome": registro.setor_nome,
        "leito": registro.leito,
        "modalidade": registro.modalidade,
        "medico_nome": registro.medico_nome,
        "hemocomponentes": [
            f"{NOME_TIPO[i['tipo']]} × {i['quantidade']}{' mL' if i['unidade_medida'] == 'ML' else ''}"
            for i in registro.itens
        ],
    }
